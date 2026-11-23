-- Connect Admin Dashboard (chạy SAU 012_admin_moderation.sql; chạy lại an toàn).
-- Mọi hàm admin_* kiểm tra quyền Ở MÁY CHỦ bằng is_admin(); giao diện admin.html chỉ là lớp hiển thị.
-- Không dùng Service Role Key ở trình duyệt. Không hàm nào trả về mật khẩu hay băm mật khẩu.

-- 1. Vai trò quản trị: owner (cấp/gỡ quyền) và admin (quản lý người dùng, kiểm duyệt).
alter table public.admins add column if not exists role text not null default 'admin';
alter table public.admins add column if not exists granted_by uuid references auth.users(id) on delete set null;
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'admins_role_check') then
    alter table public.admins add constraint admins_role_check check (role in ('owner', 'admin'));
  end if;
end $$;
-- Nếu chưa có owner nào, quản trị viên đầu tiên trở thành owner.
update public.admins set role = 'owner'
 where user_id = (select user_id from public.admins order by created_at asc limit 1)
   and not exists (select 1 from public.admins where role = 'owner');

create or replace function public.admin_my_role()
returns text language sql stable security definer set search_path = public as $$
  select role from public.admins where user_id = auth.uid();
$$;
revoke all on function public.admin_my_role() from public, anon;
grant execute on function public.admin_my_role() to authenticated;

-- 2. Khóa tài khoản. Bảng không có policy: trình duyệt không đọc/ghi trực tiếp.
create table if not exists public.account_locks (
  user_id uuid primary key references auth.users(id) on delete cascade,
  locked_by uuid references auth.users(id) on delete set null,
  reason text not null default '',
  profile_was_visible boolean not null default false,
  locked_at timestamptz not null default now()
);
alter table public.account_locks enable row level security;
revoke all on public.account_locks from anon, authenticated;

create or replace function public.is_current_user_locked()
returns boolean language sql stable security definer set search_path = public as $$
  select auth.uid() is not null and exists (select 1 from public.account_locks where user_id = auth.uid());
$$;
revoke all on function public.is_current_user_locked() from public, anon;
grant execute on function public.is_current_user_locked() to authenticated;

-- Tài khoản bị khóa không thể ghi dữ liệu vào bảng public có bật RLS (kể cả gọi API trực tiếp).
-- Nếu sau này thêm bảng mới, chạy lại khối này.
do $$
declare t record;
begin
  for t in
    select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public' and c.relkind = 'r' and c.relrowsecurity
       and c.relname not in ('admins', 'account_locks', 'admin_activity_log', 'admin_audit_log')
  loop
    execute format('drop policy if exists block_locked_insert on public.%I', t.relname);
    execute format('drop policy if exists block_locked_update on public.%I', t.relname);
    execute format('drop policy if exists block_locked_delete on public.%I', t.relname);
    execute format('create policy block_locked_insert on public.%I as restrictive for insert to authenticated with check (not public.is_current_user_locked())', t.relname);
    execute format('create policy block_locked_update on public.%I as restrictive for update to authenticated using (not public.is_current_user_locked()) with check (not public.is_current_user_locked())', t.relname);
    execute format('create policy block_locked_delete on public.%I as restrictive for delete to authenticated using (not public.is_current_user_locked())', t.relname);
  end loop;
end $$;

-- 3. Nhật ký thao tác quản trị.
create table if not exists public.admin_activity_log (
  id bigint generated always as identity primary key,
  admin_id uuid references auth.users(id) on delete set null,
  action text not null check (action in ('lock', 'unlock', 'grant_admin', 'revoke_admin', 'view_user')),
  target_user_id uuid references auth.users(id) on delete set null,
  target_email text,
  details text,
  created_at timestamptz not null default now()
);
create index if not exists admin_activity_log_created_idx on public.admin_activity_log (created_at desc);
alter table public.admin_activity_log enable row level security;
revoke all on public.admin_activity_log from anon, authenticated;

create or replace function public._admin_log(p_action text, p_target uuid, p_details text default null)
returns void language plpgsql security definer set search_path = public, auth as $$
begin
  insert into public.admin_activity_log (admin_id, action, target_user_id, target_email, details)
  values (auth.uid(), p_action, p_target, (select email from auth.users where id = p_target), left(p_details, 300));
end $$;
revoke all on function public._admin_log(text, uuid, text) from public, anon, authenticated;

-- 4. Tổng quan.
create or replace function public.admin_overview()
returns table (total_users bigint, active_users bigint, verified_users bigint, locked_users bigint, admin_count bigint, new_7d bigint)
language plpgsql stable security definer set search_path = public, auth as $$
begin
  if not public.is_admin() then raise exception 'Không có quyền'; end if;
  return query select
    (select count(*) from auth.users u where u.deleted_at is null),
    (select count(*) from auth.users u where u.deleted_at is null and u.last_sign_in_at >= now() - interval '7 days'),
    (select count(*) from auth.users u where u.deleted_at is null and u.email_confirmed_at is not null),
    (select count(*) from public.account_locks),
    (select count(*) from public.admins),
    (select count(*) from auth.users u where u.deleted_at is null and u.created_at >= now() - interval '7 days');
end $$;
revoke all on function public.admin_overview() from public, anon;
grant execute on function public.admin_overview() to authenticated;

-- 5. Danh sách người dùng: tìm theo email, tên hoặc ID; lọc trạng thái; phân trang.
create or replace function public.admin_list_users(
  p_search text default null, p_status text default 'all', p_verified text default 'all',
  p_limit integer default 20, p_offset integer default 0)
returns table (user_id uuid, email text, display_name text, created_at timestamptz, email_confirmed_at timestamptz,
               last_sign_in_at timestamptz, is_locked boolean, locked_at timestamptz, lock_reason text,
               is_admin boolean, admin_role text, is_visible boolean, total_count bigint)
language plpgsql stable security definer set search_path = public, auth as $$
declare v_q text := nullif(btrim(coalesce(p_search, '')), '');
begin
  if not public.is_admin() then raise exception 'Không có quyền'; end if;
  if p_status not in ('all', 'active', 'locked') or p_verified not in ('all', 'verified', 'unverified') then
    raise exception 'Bộ lọc không hợp lệ';
  end if;
  if v_q is not null then
    v_q := '%' || replace(replace(replace(left(v_q, 100), '\', '\\'), '%', '\%'), '_', '\_') || '%';
  end if;
  return query
  select u.id, u.email::text, coalesce(p.display_name, '')::text, u.created_at, u.email_confirmed_at,
         u.last_sign_in_at, (l.user_id is not null), l.locked_at, l.reason::text,
         (a.user_id is not null), a.role::text, coalesce(p.is_visible, false), count(*) over()
    from auth.users u
    left join public.profiles p on p.id = u.id
    left join public.account_locks l on l.user_id = u.id
    left join public.admins a on a.user_id = u.id
   where u.deleted_at is null
     and (v_q is null or u.email ilike v_q or p.display_name ilike v_q or u.id::text ilike v_q)
     and (p_status = 'all' or (p_status = 'locked' and l.user_id is not null) or (p_status = 'active' and l.user_id is null))
     and (p_verified = 'all' or (p_verified = 'verified' and u.email_confirmed_at is not null)
                             or (p_verified = 'unverified' and u.email_confirmed_at is null))
   order by u.created_at desc
   limit least(greatest(coalesce(p_limit, 20), 1), 50) offset greatest(coalesce(p_offset, 0), 0);
end $$;
revoke all on function public.admin_list_users(text, text, text, integer, integer) from public, anon;
grant execute on function public.admin_list_users(text, text, text, integer, integer) to authenticated;

-- 6. Chi tiết một người dùng (hồ sơ công khai + trạng thái). Việc xem được ghi nhật ký.
create or replace function public.admin_user_detail(p_user_id uuid)
returns jsonb language plpgsql security definer set search_path = public, auth as $$
declare r jsonb;
begin
  if not public.is_admin() then raise exception 'Không có quyền'; end if;
  select jsonb_build_object(
      'id', u.id, 'email', u.email, 'created_at', u.created_at,
      'email_confirmed_at', u.email_confirmed_at, 'last_sign_in_at', u.last_sign_in_at,
      'provider', u.raw_app_meta_data ->> 'provider',
      'has_profile', p.id is not null,
      'display_name', p.display_name, 'headline', p.headline, 'bio', p.bio, 'city', p.city,
      'interests', to_jsonb(p.interests), 'is_visible', coalesce(p.is_visible, false),
      'is_locked', l.user_id is not null, 'lock_reason', l.reason, 'locked_at', l.locked_at,
      'locked_by_email', (select x.email from auth.users x where x.id = l.locked_by),
      'is_admin', a.user_id is not null, 'admin_role', a.role,
      'open_reports', (select count(*) from public.content_reports c
                        where c.content_type = 'profile' and c.content_id = u.id::text and c.status = 'open'))
    into r
    from auth.users u
    left join public.profiles p on p.id = u.id
    left join public.account_locks l on l.user_id = u.id
    left join public.admins a on a.user_id = u.id
   where u.id = p_user_id and u.deleted_at is null;
  if r is null then raise exception 'Không tìm thấy người dùng'; end if;
  perform public._admin_log('view_user', p_user_id);
  return r;
end $$;
revoke all on function public.admin_user_detail(uuid) from public, anon;
grant execute on function public.admin_user_detail(uuid) to authenticated;

-- 7. Khóa / mở khóa. Khóa: chặn đăng nhập mới (banned_until), thu hồi phiên, chặn ghi dữ liệu, gỡ hồ sơ khỏi danh sách công khai.
create or replace function public.admin_set_account_lock(p_user_id uuid, p_lock boolean, p_reason text default '')
returns void language plpgsql security definer set search_path = public, auth as $$
declare v_exists boolean; v_visible boolean; v_reason text := btrim(coalesce(p_reason, ''));
begin
  if not public.is_admin() then raise exception 'Không có quyền'; end if;
  if p_user_id = auth.uid() then raise exception 'Không thể tự khóa tài khoản của chính mình'; end if;
  select true into v_exists from auth.users where id = p_user_id and deleted_at is null;
  if v_exists is null then raise exception 'Không tìm thấy người dùng'; end if;

  if p_lock then
    if exists (select 1 from public.admins where user_id = p_user_id) then
      raise exception 'Hãy gỡ quyền quản trị trước khi khóa tài khoản này';
    end if;
    if exists (select 1 from public.account_locks where user_id = p_user_id) then
      raise exception 'Tài khoản đã bị khóa';
    end if;
    if char_length(v_reason) < 3 then raise exception 'Vui lòng nhập lý do khóa (ít nhất 3 ký tự)'; end if;
    select is_visible into v_visible from public.profiles where id = p_user_id;
    insert into public.account_locks (user_id, locked_by, reason, profile_was_visible)
    values (p_user_id, auth.uid(), left(v_reason, 300), coalesce(v_visible, false));
    update public.profiles set is_visible = false where id = p_user_id;
    update auth.users set banned_until = now() + interval '100 years' where id = p_user_id;
    begin delete from auth.sessions where user_id = p_user_id;
    exception when undefined_table then null; end;
    perform public._admin_log('lock', p_user_id, v_reason);
  else
    select profile_was_visible into v_visible from public.account_locks where user_id = p_user_id;
    if not found then raise exception 'Tài khoản không bị khóa'; end if;
    delete from public.account_locks where user_id = p_user_id;
    update auth.users set banned_until = null where id = p_user_id;
    if v_visible then update public.profiles set is_visible = true where id = p_user_id; end if;
    perform public._admin_log('unlock', p_user_id, nullif(v_reason, ''));
  end if;
end $$;
revoke all on function public.admin_set_account_lock(uuid, boolean, text) from public, anon;
grant execute on function public.admin_set_account_lock(uuid, boolean, text) to authenticated;

-- 8. Phân quyền: chỉ owner được cấp/gỡ; không đổi quyền của chính mình; không gỡ owner.
create or replace function public.admin_set_admin_role(p_user_id uuid, p_make_admin boolean)
returns void language plpgsql security definer set search_path = public, auth as $$
declare v_confirmed timestamptz; v_found boolean; v_role text;
begin
  if not public.is_admin() then raise exception 'Không có quyền'; end if;
  if public.admin_my_role() is distinct from 'owner' then raise exception 'Chỉ owner mới được cấp hoặc gỡ quyền quản trị'; end if;
  if p_user_id = auth.uid() then raise exception 'Không thể thay đổi quyền của chính mình'; end if;
  select true, email_confirmed_at into v_found, v_confirmed from auth.users where id = p_user_id and deleted_at is null;
  if v_found is null then raise exception 'Không tìm thấy người dùng'; end if;

  if p_make_admin then
    if v_confirmed is null then raise exception 'Chỉ cấp quyền cho tài khoản đã xác minh email'; end if;
    if exists (select 1 from public.account_locks where user_id = p_user_id) then
      raise exception 'Không thể cấp quyền cho tài khoản đang bị khóa';
    end if;
    if exists (select 1 from public.admins where user_id = p_user_id) then raise exception 'Người dùng đã là quản trị viên'; end if;
    insert into public.admins (user_id, role, granted_by) values (p_user_id, 'admin', auth.uid());
    perform public._admin_log('grant_admin', p_user_id);
  else
    select role into v_role from public.admins where user_id = p_user_id;
    if not found then raise exception 'Người dùng này không phải quản trị viên'; end if;
    if v_role = 'owner' then raise exception 'Không thể gỡ quyền của owner'; end if;
    delete from public.admins where user_id = p_user_id;
    perform public._admin_log('revoke_admin', p_user_id);
  end if;
end $$;
revoke all on function public.admin_set_admin_role(uuid, boolean) from public, anon;
grant execute on function public.admin_set_admin_role(uuid, boolean) to authenticated;

create or replace function public.admin_list_admins()
returns table (user_id uuid, email text, display_name text, role text, created_at timestamptz, granted_by_email text)
language plpgsql stable security definer set search_path = public, auth as $$
begin
  if not public.is_admin() then raise exception 'Không có quyền'; end if;
  return query
  select a.user_id, u.email::text, coalesce(p.display_name, '')::text, a.role::text, a.created_at, g.email::text
    from public.admins a
    join auth.users u on u.id = a.user_id
    left join public.profiles p on p.id = a.user_id
    left join auth.users g on g.id = a.granted_by
   order by (a.role = 'owner') desc, a.created_at;
end $$;
revoke all on function public.admin_list_admins() from public, anon;
grant execute on function public.admin_list_admins() to authenticated;

-- 9. Thống kê đăng ký theo ngày và các chỉ số tổng hợp.
create or replace function public.admin_stats(p_days integer default 30)
returns jsonb language plpgsql stable security definer set search_path = public, auth as $$
declare v_days integer := least(greatest(coalesce(p_days, 30), 7), 90); v_signups jsonb; v_totals jsonb;
begin
  if not public.is_admin() then raise exception 'Không có quyền'; end if;
  with days as (
    select generate_series((current_date - (v_days - 1))::timestamp, current_date::timestamp, interval '1 day')::date as d),
  s as (
    select u.created_at::date as d, count(*) as c from auth.users u
     where u.deleted_at is null and u.created_at >= current_date - (v_days - 1) group by 1)
  select coalesce(jsonb_agg(jsonb_build_object('day', days.d, 'count', coalesce(s.c, 0)) order by days.d), '[]'::jsonb)
    into v_signups from days left join s on s.d = days.d;
  select jsonb_build_object(
      'total', count(*),
      'verified', count(*) filter (where u.email_confirmed_at is not null),
      'active_7d', count(*) filter (where u.last_sign_in_at >= now() - interval '7 days'),
      'active_30d', count(*) filter (where u.last_sign_in_at >= now() - interval '30 days'),
      'new_30d', count(*) filter (where u.created_at >= now() - interval '30 days'))
    into v_totals from auth.users u where u.deleted_at is null;
  return jsonb_build_object('days', v_days, 'signups', v_signups, 'totals', v_totals);
end $$;
revoke all on function public.admin_stats(integer) from public, anon;
grant execute on function public.admin_stats(integer) to authenticated;

-- 10. Nhật ký hoạt động: gộp thao tác người dùng/phân quyền với lịch sử kiểm duyệt báo cáo (admin_audit_log).
create or replace function public.admin_activity_list(p_action text default 'all', p_limit integer default 30, p_offset integer default 0)
returns table (log_id text, created_at timestamptz, admin_email text, action text, target_email text, details text, total_count bigint)
language plpgsql stable security definer set search_path = public, auth as $$
begin
  if not public.is_admin() then raise exception 'Không có quyền'; end if;
  if p_action not in ('all', 'lock', 'unlock', 'grant_admin', 'revoke_admin', 'view_user', 'content') then
    raise exception 'Bộ lọc không hợp lệ';
  end if;
  return query
  with merged as (
    select 'a' || l.id::text as lid, l.created_at as at, l.admin_id as aid, l.action as act,
           l.target_email as temail, l.details as det
      from public.admin_activity_log l
    union all
    select 'm' || m.id::text, m.created_at, m.admin_id, 'content',
           null::text, m.content_type || ' #' || m.content_id || ': ' || m.previous_status || ' → ' || m.new_status
      from public.admin_audit_log m)
  select g.lid, g.at, u.email::text, g.act, g.temail, g.det, count(*) over()
    from merged g left join auth.users u on u.id = g.aid
   where p_action = 'all' or g.act = p_action
   order by g.at desc, g.lid desc
   limit least(greatest(coalesce(p_limit, 30), 1), 100) offset greatest(coalesce(p_offset, 0), 0);
end $$;
revoke all on function public.admin_activity_list(text, integer, integer) from public, anon;
grant execute on function public.admin_activity_list(text, integer, integer) to authenticated;

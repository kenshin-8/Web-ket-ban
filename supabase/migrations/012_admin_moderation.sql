-- Connect Admin Moderation (chạy SAU 010_safety_hardening.sql; chạy lại an toàn).
-- Trang admin.html dùng các hàm dưới đây. Mọi hàm đều kiểm tra is_admin() ở phía server.

create table if not exists public.admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.admins enable row level security;
-- Cố ý KHÔNG có policy nào: trình duyệt không đọc/ghi được bảng này. Thêm quản trị viên bằng SQL Editor:
--   insert into public.admins (user_id) select id from auth.users where email = 'ban@example.com';

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select auth.uid() is not null and exists (select 1 from public.admins where user_id = auth.uid());
$$;
revoke all on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated;

-- Ngưỡng tự ẩn chỉ tính báo cáo còn "open": sau khi admin khôi phục/bỏ qua, bài không bị ẩn lại ngay chỉ vì báo cáo cũ.
create or replace function public.apply_report_threshold()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_count integer;
begin
  if new.content_type in ('moment','moment_comment') then
    select count(distinct reporter_id) into v_count from public.content_reports
     where content_type = new.content_type and content_id = new.content_id and status = 'open';
    if v_count >= 3 then
      if new.content_type = 'moment' then
        update public.moments set is_hidden = true where id::text = new.content_id;
      else
        update public.moment_comments set is_hidden = true where id::text = new.content_id;
      end if;
    end if;
  end if;
  return new;
end $$;

-- Hàng đợi báo cáo, gộp theo nội dung. Không trả về tác giả (giữ ẩn danh cho bài ở Quảng trường).
create or replace function public.admin_report_queue(p_status text default 'open', p_limit integer default 50)
returns table (content_type text, content_id text, report_count bigint, reasons text[], details text[],
               latest_at timestamptz, preview text, content_state text)
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'Không có quyền'; end if;
  if p_status not in ('open','reviewed','dismissed','actioned') then raise exception 'Trạng thái không hợp lệ'; end if;
  return query
  with g as (
    select r.content_type as ctype, r.content_id as cid, count(*) as cnt,
           array_agg(distinct r.reason) as reasons,
           (array_agg(r.details order by r.created_at desc) filter (where r.details is not null))[1:3] as details,
           max(r.created_at) as latest
      from public.content_reports r
     where r.status = p_status
     group by r.content_type, r.content_id
  )
  select g.ctype, g.cid, g.cnt, g.reasons, g.details, g.latest,
    case g.ctype
      when 'moment'            then (select left(m.body, 400) from public.moments m where m.id::text = g.cid)
      when 'moment_comment'    then (select left(c.body, 400) from public.moment_comments c where c.id::text = g.cid)
      when 'community_post'    then (select left(p.body, 400) from public.community_posts p where p.id::text = g.cid)
      when 'community_comment' then (select left(c.body, 400) from public.community_comments c where c.id::text = g.cid)
      when 'profile_post'      then (select left(p.body, 400) from public.profile_posts p where p.id::text = g.cid)
      when 'profile'           then (select left(coalesce(p.display_name,'') || ' | ' || coalesce(p.bio,''), 400) from public.profiles p where p.id::text = g.cid)
    end,
    coalesce(case g.ctype
      when 'moment'         then (select case when m.is_hidden then 'hidden' else 'visible' end from public.moments m where m.id::text = g.cid)
      when 'moment_comment' then (select case when c.is_hidden then 'hidden' else 'visible' end from public.moment_comments c where c.id::text = g.cid)
      when 'community_post'    then (select 'visible' from public.community_posts p where p.id::text = g.cid)
      when 'community_comment' then (select 'visible' from public.community_comments c where c.id::text = g.cid)
      when 'profile_post'      then (select 'visible' from public.profile_posts p where p.id::text = g.cid)
      when 'profile'           then (select case when p.is_visible then 'visible' else 'hidden' end from public.profiles p where p.id::text = g.cid)
    end, 'gone')
  from g
  order by g.cnt desc, g.latest desc
  limit least(greatest(coalesce(p_limit, 50), 1), 100);
end $$;
revoke all on function public.admin_report_queue(text, integer) from public, anon;
grant execute on function public.admin_report_queue(text, integer) to authenticated;

-- Xử lý một nội dung bị báo cáo. p_action:
--   hide / restore : moment, moment_comment (đặt is_hidden)
--   remove         : community_post, community_comment, profile_post (xóa hẳn)
--   unlist         : profile (đặt is_visible = false, gỡ khỏi danh sách công khai)
--   dismiss        : bỏ qua báo cáo, không đụng đến nội dung
-- Báo cáo 'open' của nội dung đó chuyển thành 'actioned' (hide/remove/unlist) hoặc 'dismissed' (restore/dismiss).
create or replace function public.admin_resolve_content(p_content_type text, p_content_id text, p_action text)
returns void language plpgsql security definer set search_path = public as $$
declare v_status text;
begin
  if not public.is_admin() then raise exception 'Không có quyền'; end if;

  if p_action = 'dismiss' then
    v_status := 'dismissed';
  elsif p_action = 'restore' and p_content_type in ('moment','moment_comment') then
    if p_content_type = 'moment' then update public.moments set is_hidden = false where id::text = p_content_id;
    else update public.moment_comments set is_hidden = false where id::text = p_content_id; end if;
    v_status := 'dismissed';
  elsif p_action = 'hide' and p_content_type in ('moment','moment_comment') then
    if p_content_type = 'moment' then update public.moments set is_hidden = true where id::text = p_content_id;
    else update public.moment_comments set is_hidden = true where id::text = p_content_id; end if;
    v_status := 'actioned';
  elsif p_action = 'remove' and p_content_type in ('community_post','community_comment','profile_post') then
    if p_content_type = 'community_post' then delete from public.community_posts where id::text = p_content_id;
    elsif p_content_type = 'community_comment' then delete from public.community_comments where id::text = p_content_id;
    else delete from public.profile_posts where id::text = p_content_id; end if;
    v_status := 'actioned';
  elsif p_action = 'unlist' and p_content_type = 'profile' then
    update public.profiles set is_visible = false where id::text = p_content_id;
    v_status := 'actioned';
  else
    raise exception 'Thao tác không hợp lệ';
  end if;

  update public.content_reports set status = v_status
   where content_type = p_content_type and content_id = p_content_id and status = 'open';
end $$;
revoke all on function public.admin_resolve_content(text, text, text) from public, anon;
grant execute on function public.admin_resolve_content(text, text, text) to authenticated;


-- Nhật ký kiểm duyệt: trigger ghi nhận thay đổi trạng thái báo cáo do RPC admin_resolve_content
-- thực hiện. Bảng không có policy cho client; chỉ quản trị qua SQL Dashboard.
create table if not exists public.admin_audit_log (
  id bigint generated always as identity primary key,
  admin_id uuid references auth.users(id) on delete set null,
  content_type text not null,
  content_id text not null,
  previous_status text not null,
  new_status text not null,
  created_at timestamptz not null default now()
);
create index if not exists admin_audit_log_created_idx
  on public.admin_audit_log (created_at desc);
alter table public.admin_audit_log enable row level security;
revoke all on public.admin_audit_log from anon, authenticated;

create or replace function public.log_admin_report_status_change()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if old.status is distinct from new.status and auth.uid() is not null then
    insert into public.admin_audit_log
      (admin_id, content_type, content_id, previous_status, new_status)
    values
      (auth.uid(), new.content_type, new.content_id, old.status, new.status);
  end if;
  return new;
end $$;
revoke all on function public.log_admin_report_status_change() from public, anon, authenticated;
drop trigger if exists admin_report_status_audit on public.content_reports;
create trigger admin_report_status_audit
  after update of status on public.content_reports
  for each row execute function public.log_admin_report_status_change();

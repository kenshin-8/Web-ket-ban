-- Connect Safety Hardening (chạy SAU 001_schema.sql, 003_friend_system.sql và các migration khác)
-- Gồm: chặn người dùng, báo cáo nội dung, tự ẩn bài bị báo cáo nhiều,
--       giới hạn tần suất, giới hạn upload, chống spam form liên hệ,
--       tính khoảng cách "gần bạn" phía server (không lộ tọa độ).
-- Có thể chạy lại nhiều lần. Không xóa dữ liệu.

-- =====================================================================
-- 1. CHẶN NGƯỜI DÙNG
-- =====================================================================
create table if not exists public.user_blocks (
  blocker_id uuid not null references auth.users(id) on delete cascade,
  blocked_id uuid not null references auth.users(id) on delete cascade,
  -- 'anonymous': chặn qua bài ẩn danh -> không bao giờ trả tên người bị chặn về client.
  source text not null default 'profile' check (source in ('profile','anonymous')),
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);
alter table public.user_blocks enable row level security;
drop policy if exists "blocks_select_own" on public.user_blocks;
create policy "blocks_select_own" on public.user_blocks for select to authenticated using (blocker_id = auth.uid());
drop policy if exists "blocks_insert_own" on public.user_blocks;
create policy "blocks_insert_own" on public.user_blocks for insert to authenticated with check (blocker_id = auth.uid() and source = 'profile');
drop policy if exists "blocks_delete_own" on public.user_blocks;
create policy "blocks_delete_own" on public.user_blocks for delete to authenticated using (blocker_id = auth.uid());

-- Chỉ trả true khi một trong hai người là người đang gọi, nên không dùng để dò quan hệ của người khác.
create or replace function public.is_blocked_between(a uuid, b uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select auth.uid() is not null and auth.uid() in (a, b) and exists (
    select 1 from public.user_blocks
    where (blocker_id = a and blocked_id = b) or (blocker_id = b and blocked_id = a)
  );
$$;
revoke all on function public.is_blocked_between(uuid, uuid) from public;
grant execute on function public.is_blocked_between(uuid, uuid) to anon, authenticated;

-- Chặn tác giả bài ẩn danh mà không biết họ là ai.
create or replace function public.block_moment_author(p_moment_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_author uuid;
begin
  if auth.uid() is null then raise exception 'Cần đăng nhập'; end if;
  select author_id into v_author from public.moments where id = p_moment_id;
  if v_author is null then raise exception 'Không tìm thấy bài viết'; end if;
  if v_author = auth.uid() then raise exception 'Không thể tự chặn mình'; end if;
  insert into public.user_blocks (blocker_id, blocked_id, source)
  values (auth.uid(), v_author, 'anonymous') on conflict do nothing;
end $$;
revoke all on function public.block_moment_author(uuid) from public, anon;
grant execute on function public.block_moment_author(uuid) to authenticated;

-- Chủ bài chặn người lạ đang nhắn tin kín.
create or replace function public.block_thread_guest(p_thread_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_guest uuid;
begin
  if auth.uid() is null then raise exception 'Cần đăng nhập'; end if;
  select t.guest_id into v_guest from public.moment_threads t
    join public.moments m on m.id = t.moment_id
   where t.id = p_thread_id and m.author_id = auth.uid();
  if v_guest is null then raise exception 'Không tìm thấy cuộc trò chuyện'; end if;
  insert into public.user_blocks (blocker_id, blocked_id, source)
  values (auth.uid(), v_guest, 'anonymous') on conflict do nothing;
end $$;
revoke all on function public.block_thread_guest(uuid) from public, anon;
grant execute on function public.block_thread_guest(uuid) to authenticated;

-- Danh sách đã chặn của tôi (ẩn danh thì không trả tên).
create or replace function public.my_blocks()
returns table (blocked_id uuid, source text, created_at timestamptz, display_name text)
language sql stable security definer set search_path = public as $$
  select b.blocked_id, b.source, b.created_at,
         case when b.source = 'profile' then p.display_name else null end
    from public.user_blocks b
    left join public.profiles p on p.id = b.blocked_id
   where b.blocker_id = auth.uid()
   order by b.created_at desc;
$$;
revoke all on function public.my_blocks() from public, anon;
grant execute on function public.my_blocks() to authenticated;

-- Hồ sơ của hai bên không hiện với nhau (Khám phá, Soul Match, tinh cầu, tìm bạn...).
drop policy if exists "profiles_read_public_or_own" on public.profiles;
create policy "profiles_read_public_or_own" on public.profiles for select using (
  id = auth.uid() or (is_visible = true and not public.is_blocked_between(auth.uid(), id))
);

-- Không gửi lời mời / tin nhắn riêng cho người đã chặn hoặc đã chặn mình.
drop policy if exists "friend_requests_send_public_profile" on public.friend_requests;
create policy "friend_requests_send_public_profile"
  on public.friend_requests for insert to authenticated
  with check (
    requester_id = auth.uid()
    and recipient_id <> auth.uid()
    and status = 'pending'
    and not public.is_blocked_between(requester_id, recipient_id)
    and exists (
      select 1 from public.profiles p
      where p.id = recipient_id and p.is_visible = true
    )
  );

drop policy if exists "direct_messages_send_to_friends" on public.direct_messages;
create policy "direct_messages_send_to_friends"
  on public.direct_messages for insert to authenticated
  with check (
    sender_id = auth.uid()
    and recipient_id <> auth.uid()
    and not public.is_blocked_between(sender_id, recipient_id)
    and exists (
      select 1 from public.friend_requests fr
      where fr.status = 'accepted'
        and ((fr.requester_id = sender_id and fr.recipient_id = recipient_id)
          or (fr.requester_id = recipient_id and fr.recipient_id = sender_id))
    )
  );

-- =====================================================================
-- 2. BÁO CÁO NỘI DUNG + TỰ ẨN
-- =====================================================================
create table if not exists public.content_reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references auth.users(id) on delete cascade,
  content_type text not null check (content_type in
    ('moment','moment_comment','community_post','community_comment','profile','profile_post')),
  content_id text not null check (char_length(content_id) between 1 and 64),
  reason text not null check (reason in ('spam','harassment','sexual','violence','privacy','other')),
  details text check (details is null or char_length(details) <= 500),
  status text not null default 'open' check (status in ('open','reviewed','dismissed','actioned')),
  created_at timestamptz not null default now(),
  unique (reporter_id, content_type, content_id)
);
create index if not exists content_reports_status_idx on public.content_reports (status, created_at desc);
alter table public.content_reports enable row level security;
drop policy if exists "reports_insert_own" on public.content_reports;
create policy "reports_insert_own" on public.content_reports for insert to authenticated with check (reporter_id = auth.uid() and status = 'open');
drop policy if exists "reports_select_own" on public.content_reports;
create policy "reports_select_own" on public.content_reports for select to authenticated using (reporter_id = auth.uid());
-- Quản trị viên xem/xử lý báo cáo trong Supabase Dashboard (service role), không qua trình duyệt.

alter table public.moments        add column if not exists is_hidden boolean not null default false;
alter table public.moment_comments add column if not exists is_hidden boolean not null default false;

-- Đủ 3 người báo cáo khác nhau -> tự ẩn chờ quản trị viên xem xét.
-- (Chủ bài vẫn thấy bài của mình. Quản trị viên có thể bỏ ẩn: update ... set is_hidden = false.)
create or replace function public.apply_report_threshold()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_count integer;
begin
  if new.content_type in ('moment','moment_comment') then
    select count(distinct reporter_id) into v_count from public.content_reports
     where content_type = new.content_type and content_id = new.content_id;
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
drop trigger if exists content_reports_threshold on public.content_reports;
create trigger content_reports_threshold after insert on public.content_reports
  for each row execute function public.apply_report_threshold();

-- View Quảng trường: giữ nguyên cột, thêm lọc bài ẩn + người bị chặn (hai chiều).
create or replace view public.moments_feed as
  select m.id, m.alias, m.body, m.tags, m.media_url, m.media_kind, m.created_at,
    (select count(*) from public.moment_likes l where l.moment_id = m.id) as like_count,
    (select count(*) from public.moment_comments c where c.moment_id = m.id and not c.is_hidden) as comment_count,
    exists (select 1 from public.moment_likes l where l.moment_id = m.id and l.user_id = auth.uid()) as liked_by_me,
    (m.author_id = auth.uid()) as is_mine
  from public.moments m
  where (not m.is_hidden or m.author_id = auth.uid())
    and not exists (
      select 1 from public.user_blocks b
       where (b.blocker_id = auth.uid() and b.blocked_id = m.author_id)
          or (b.blocker_id = m.author_id and b.blocked_id = auth.uid()));

create or replace view public.comments_feed as
  select c.id, c.moment_id, c.alias, c.body, c.created_at, (c.author_id = auth.uid()) as is_mine
  from public.moment_comments c
  where (not c.is_hidden or c.author_id = auth.uid())
    and not exists (
      select 1 from public.user_blocks b
       where (b.blocker_id = auth.uid() and b.blocked_id = c.author_id)
          or (b.blocker_id = c.author_id and b.blocked_id = auth.uid()));
revoke all on public.moments_feed, public.comments_feed from anon;
grant select on public.moments_feed, public.comments_feed to authenticated;

-- Tin nhắn kín: chặn mở / gửi khi hai bên có quan hệ chặn (hàm không lộ danh tính tác giả).
create or replace function public.can_message_moment(p_moment_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select auth.uid() is not null and exists (
    select 1 from public.moments m
     where m.id = p_moment_id and not m.is_hidden
       and not exists (select 1 from public.user_blocks b
             where (b.blocker_id = auth.uid() and b.blocked_id = m.author_id)
                or (b.blocker_id = m.author_id and b.blocked_id = auth.uid()))
  );
$$;
revoke all on function public.can_message_moment(uuid) from public, anon;
grant execute on function public.can_message_moment(uuid) to authenticated;

create or replace function public.thread_not_blocked(p_thread_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select auth.uid() is not null and exists (
    select 1 from public.moment_threads t join public.moments m on m.id = t.moment_id
     where t.id = p_thread_id
       and (t.guest_id = auth.uid() or m.author_id = auth.uid())
       and not exists (select 1 from public.user_blocks b
             where (b.blocker_id = t.guest_id and b.blocked_id = m.author_id)
                or (b.blocker_id = m.author_id and b.blocked_id = t.guest_id))
  );
$$;
revoke all on function public.thread_not_blocked(uuid) from public, anon;
grant execute on function public.thread_not_blocked(uuid) to authenticated;

drop policy if exists "t_insert" on public.moment_threads;
create policy "t_insert" on public.moment_threads for insert to authenticated with check (
  guest_id = auth.uid()
  and not exists (select 1 from public.moments m where m.id = moment_id and m.author_id = auth.uid())
  and public.can_message_moment(moment_id)
);
drop policy if exists "msg_insert" on public.moment_messages;
create policy "msg_insert" on public.moment_messages for insert to authenticated with check (
  public.thread_not_blocked(thread_id)
  and exists (select 1 from public.moment_threads t where t.id = thread_id and (
    (not from_author and t.guest_id = auth.uid()) or
    (from_author and exists (select 1 from public.moments m where m.id = t.moment_id and m.author_id = auth.uid()))))
);

-- =====================================================================
-- 3. GIỚI HẠN TẦN SUẤT (chống spam)
-- =====================================================================
-- Tham số trigger: tối đa N hàng / khoảng thời gian / cột chứa id người dùng.
create or replace function public.rate_limit_guard()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_limit integer := tg_argv[0]::integer;
  v_window interval := tg_argv[1]::interval;
  v_col text := tg_argv[2];
  v_count integer;
begin
  execute format('select count(*) from %I.%I where %I = $1 and created_at > now() - $2',
                 tg_table_schema, tg_table_name, v_col)
    into v_count using (to_jsonb(new) ->> v_col)::uuid, v_window;
  if v_count >= v_limit then
    raise exception 'Bạn thao tác quá nhanh. Vui lòng thử lại sau ít phút.' using errcode = 'P0001';
  end if;
  return new;
end $$;

drop trigger if exists moments_rate_limit on public.moments;
create trigger moments_rate_limit before insert on public.moments
  for each row execute function public.rate_limit_guard('10', '1 hour', 'author_id');
drop trigger if exists moment_comments_rate_limit on public.moment_comments;
create trigger moment_comments_rate_limit before insert on public.moment_comments
  for each row execute function public.rate_limit_guard('30', '1 hour', 'author_id');
drop trigger if exists moment_threads_rate_limit on public.moment_threads;
create trigger moment_threads_rate_limit before insert on public.moment_threads
  for each row execute function public.rate_limit_guard('20', '1 hour', 'guest_id');
drop trigger if exists content_reports_rate_limit on public.content_reports;
create trigger content_reports_rate_limit before insert on public.content_reports
  for each row execute function public.rate_limit_guard('20', '1 hour', 'reporter_id');

-- =====================================================================
-- 4. UPLOAD ẢNH/VIDEO/GHI ÂM (bucket 'moments')
-- =====================================================================
-- Tên tệp vẫn ngẫu nhiên và không chứa id người dùng (giữ ẩn danh), nhưng:
--  - bắt buộc đúng mẫu <uuid>.<đuôi hợp lệ>
--  - tối đa 20 tệp / người / 24 giờ
create or replace function public.moments_uploads_last_day()
returns integer language sql stable security definer set search_path = public, storage as $$
  select count(*)::integer from storage.objects
   where bucket_id = 'moments'
     and (owner_id = auth.uid()::text or owner = auth.uid())
     and created_at > now() - interval '1 day';
$$;
revoke all on function public.moments_uploads_last_day() from public, anon;
grant execute on function public.moments_uploads_last_day() to authenticated;

drop policy if exists "moments_upload" on storage.objects;
create policy "moments_upload" on storage.objects for insert to authenticated with check (
  bucket_id = 'moments'
  and name ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|png|webp|mp4|webm|ogg|m4a|mp3)$'
  and public.moments_uploads_last_day() < 20
);

-- =====================================================================
-- 5. FORM LIÊN HỆ
-- =====================================================================
-- Độ dài đã được ràng buộc từ 001_schema.sql. Thêm: kiểm tra định dạng email cơ bản
-- (NOT VALID: chỉ áp dụng cho hàng mới) và giới hạn tổng tốc độ để chống tràn bảng.
alter table public.contact_messages drop constraint if exists contact_email_format;
alter table public.contact_messages add constraint contact_email_format
  check (email ~* '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$') not valid;

create or replace function public.contact_flood_guard()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if (select count(*) from public.contact_messages where created_at > now() - interval '10 minutes') >= 20 then
    raise exception 'Hệ thống đang nhận quá nhiều lời nhắn. Vui lòng thử lại sau.' using errcode = 'P0001';
  end if;
  return new;
end $$;
drop trigger if exists contact_flood_guard on public.contact_messages;
create trigger contact_flood_guard before insert on public.contact_messages
  for each row execute function public.contact_flood_guard();

-- =====================================================================
-- 6. "GẦN BẠN": TÍNH KHOẢNG CÁCH PHÍA SERVER
-- =====================================================================
-- Trước đây mọi người dùng đăng nhập đọc được tọa độ (đã làm tròn) của tất cả.
-- Giờ chỉ đọc được vị trí của chính mình; muốn biết ai ở gần thì gọi nearby_users().
drop policy if exists "loc_read_auth" on public.user_locations;
-- (policy "loc_write_own" for all ... using (id = auth.uid()) vẫn cho đọc/ghi dòng của chính mình)

-- Trả về id + khoảng cách theo NẤC (1, 2, 5, 10, 25, 50, 100, 200 km), không trả khoảng cách chính xác
-- và không trả tọa độ. Chỉ gồm hồ sơ công khai, đang chia sẻ vị trí trong 24 giờ, không bị chặn.
create or replace function public.nearby_users(radius_km integer default 5)
returns table (user_id uuid, distance_bucket_km integer)
language plpgsql stable security definer set search_path = public as $$
declare
  v_lat numeric; v_lng numeric;
  v_radius integer := least(greatest(coalesce(radius_km, 5), 1), 200);
begin
  if auth.uid() is null then return; end if;
  select l.lat, l.lng into v_lat, v_lng from public.user_locations l
   where l.id = auth.uid() and l.updated_at > now() - interval '24 hours';
  if v_lat is null then return; end if;

  return query
  with d as (
    select l.id as uid,
      6371 * 2 * asin(sqrt(least(1,
        power(sin(radians(l.lat - v_lat) / 2), 2)
        + cos(radians(v_lat)) * cos(radians(l.lat)) * power(sin(radians(l.lng - v_lng) / 2), 2)
      ))) as km
    from public.user_locations l
    join public.profiles p on p.id = l.id and p.is_visible = true
    where l.id <> auth.uid()
      and l.updated_at > now() - interval '24 hours'
      and not public.is_blocked_between(auth.uid(), l.id)
  )
  select d.uid,
         least(case when d.km <= 1 then 1 when d.km <= 2 then 2 when d.km <= 5 then 5
                    when d.km <= 10 then 10 when d.km <= 25 then 25 when d.km <= 50 then 50
                    when d.km <= 100 then 100 else 200 end, v_radius)::integer
    from d
   where d.km <= v_radius
   order by d.km
   limit 100;
end $$;
revoke all on function public.nearby_users(integer) from public, anon;
grant execute on function public.nearby_users(integer) to authenticated;

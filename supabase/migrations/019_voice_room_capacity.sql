-- Connect: giới hạn số thành viên phòng thoại ở PostgreSQL, tránh vượt quá 4 người
-- khi nhiều người nhấn Tham gia gần như đồng thời.
-- Chạy SAU: 015_voice_avatar_repair_v2.sql.
-- An toàn khi chạy lại; không xóa dữ liệu phòng hiện có.

create table if not exists public.voice_room_members (
  room_id uuid not null references public.voice_rooms(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  connection_id uuid not null,
  last_seen timestamptz not null default now(),
  primary key (room_id, user_id, connection_id)
);

create index if not exists voice_room_members_last_seen_idx
  on public.voice_room_members (room_id, last_seen desc);

alter table public.voice_room_members enable row level security;
revoke all on public.voice_room_members from anon, authenticated, public;

-- Một lượt tham gia được cấp trong transaction có khóa dòng phòng.
-- Mỗi tài khoản chỉ chiếm một chỗ dù mở nhiều tab; mỗi tab vẫn có connection_id riêng.
create or replace function public.join_voice_room(p_room_id uuid, p_connection_id uuid)
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_is_open boolean;
  v_count integer;
begin
  if v_uid is null then
    raise exception 'Bạn cần đăng nhập để tham gia phòng.' using errcode = '28000';
  end if;
  if p_connection_id is null then
    raise exception 'Thiếu mã kết nối phòng.' using errcode = '22004';
  end if;

  select is_open into v_is_open
    from public.voice_rooms
    where id = p_room_id
    for update;

  if not found or v_is_open is distinct from true then
    raise exception 'Phòng không tồn tại hoặc đã đóng.' using errcode = 'P0002';
  end if;

  -- Tab đã đóng/mất mạng sẽ tự hết hạn nếu không gửi heartbeat trong 2 phút.
  delete from public.voice_room_members
    where room_id = p_room_id
      and last_seen < now() - interval '2 minutes';

  select count(distinct user_id)::integer into v_count
    from public.voice_room_members
    where room_id = p_room_id;

  if not exists (
    select 1 from public.voice_room_members
    where room_id = p_room_id and user_id = v_uid
  ) and v_count >= 4 then
    raise exception 'Phòng đã đủ 4 thành viên. Vui lòng chọn phòng khác.' using errcode = 'P0001';
  end if;

  insert into public.voice_room_members (room_id, user_id, connection_id, last_seen)
  values (p_room_id, v_uid, p_connection_id, now())
  on conflict (room_id, user_id, connection_id)
  do update set last_seen = excluded.last_seen;

  select count(distinct user_id)::integer into v_count
    from public.voice_room_members
    where room_id = p_room_id;
  return v_count;
end;
$$;

create or replace function public.heartbeat_voice_room(p_room_id uuid, p_connection_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'Bạn cần đăng nhập.' using errcode = '28000';
  end if;

  update public.voice_room_members
    set last_seen = now()
    where room_id = p_room_id
      and user_id = v_uid
      and connection_id = p_connection_id;

  return found;
end;
$$;

create or replace function public.leave_voice_room(p_room_id uuid, p_connection_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'Bạn cần đăng nhập.' using errcode = '28000';
  end if;

  delete from public.voice_room_members
    where room_id = p_room_id
      and user_id = v_uid
      and connection_id = p_connection_id;

  return found;
end;
$$;

revoke all on function public.join_voice_room(uuid, uuid) from public, anon;
revoke all on function public.heartbeat_voice_room(uuid, uuid) from public, anon;
revoke all on function public.leave_voice_room(uuid, uuid) from public, anon;
grant execute on function public.join_voice_room(uuid, uuid) to authenticated;
grant execute on function public.heartbeat_voice_room(uuid, uuid) to authenticated;
grant execute on function public.leave_voice_room(uuid, uuid) to authenticated;

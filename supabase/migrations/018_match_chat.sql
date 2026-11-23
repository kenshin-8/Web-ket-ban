-- Connect — Nhắn tin và gọi thoại 1-1 cho cặp đã ghép đôi (Soul Like hai chiều).
-- Chạy SAU: 001_schema.sql, 003_friend_system.sql, 009_notification_presence.sql, 010_safety_hardening.sql, 013_block_visibility_fix.sql.
-- Chạy được nhiều lần.
--
-- Quy tắc: hai người được nhắn tin/gọi nhau khi (đã là bạn bè HOẶC đã Soul Like lẫn nhau)
-- và không bên nào chặn bên kia. Nếu một bên bỏ thích, quyền nhắn tin theo đường ghép đôi
-- biến mất (tin cũ không hiển thị nữa, trừ khi hai người cũng là bạn bè).

-- ---------- 1. Quyền nhắn tin ----------
create or replace function public.is_soul_matched(a uuid, b uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.soul_likes where from_user_id = a and to_user_id = b)
     and exists (select 1 from public.soul_likes where from_user_id = b and to_user_id = a);
$$;

create or replace function public.can_direct_message(a uuid, b uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select a is not null and b is not null and a <> b
     and not public.is_blocked_between(a, b)
     and (
       exists (select 1 from public.friend_requests fr
                where fr.status = 'accepted'
                  and ((fr.requester_id = a and fr.recipient_id = b) or (fr.requester_id = b and fr.recipient_id = a)))
       or public.is_soul_matched(a, b)
     );
$$;
revoke all on function public.is_soul_matched(uuid, uuid), public.can_direct_message(uuid, uuid) from public, anon;
grant execute on function public.is_soul_matched(uuid, uuid), public.can_direct_message(uuid, uuid) to authenticated;

drop policy if exists "direct_messages_read_friends" on public.direct_messages;
create policy "direct_messages_read_friends" on public.direct_messages
  for select to authenticated using (
    (sender_id = auth.uid() or recipient_id = auth.uid())
    and public.can_direct_message(sender_id, recipient_id)
  );

drop policy if exists "direct_messages_send_to_friends" on public.direct_messages;
create policy "direct_messages_send_to_friends" on public.direct_messages
  for insert to authenticated with check (
    sender_id = auth.uid()
    and recipient_id <> auth.uid()
    and public.can_direct_message(sender_id, recipient_id)
  );

-- ---------- 2. Cuộc gọi thoại 1-1 ----------
-- Hàng cuộc gọi chỉ hai người trong cuộc đọc được. Mã cuộc gọi (uuid) cũng là tên kênh
-- Realtime dùng để trao đổi tín hiệu WebRTC, nên người ngoài không đoán được.
create table if not exists public.match_calls (
  id uuid primary key default gen_random_uuid(),
  caller_id uuid not null references auth.users(id) on delete cascade,
  callee_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'ringing' check (status in ('ringing','accepted','declined','cancelled','missed','ended')),
  created_at timestamptz not null default now(),
  answered_at timestamptz,
  ended_at timestamptz,
  constraint match_calls_no_self check (caller_id <> callee_id)
);
create index if not exists match_calls_callee_idx on public.match_calls (callee_id, status, created_at desc);
create index if not exists match_calls_caller_idx on public.match_calls (caller_id, created_at desc);

alter table public.match_calls enable row level security;
revoke all on public.match_calls from anon, authenticated;
grant select on public.match_calls to authenticated;
drop policy if exists "match_calls_read_participants" on public.match_calls;
create policy "match_calls_read_participants" on public.match_calls
  for select to authenticated using (caller_id = auth.uid() or callee_id = auth.uid());
-- Không có policy ghi: mọi thay đổi đi qua hai hàm bên dưới.

create or replace function public.start_match_call(p_callee uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); v_id uuid;
begin
  if v_uid is null then raise exception 'Cần đăng nhập.' using errcode = '28000'; end if;
  if not public.can_direct_message(v_uid, p_callee) then
    raise exception 'Chỉ gọi được người đã ghép đôi hoặc là bạn bè của bạn.' using errcode = 'P0001';
  end if;
  -- dọn cuộc gọi quá hạn của hai người
  update public.match_calls set status = 'missed', ended_at = now()
   where status = 'ringing' and created_at < now() - interval '60 seconds'
     and (caller_id in (v_uid, p_callee) or callee_id in (v_uid, p_callee));
  update public.match_calls set status = 'ended', ended_at = now()
   where status = 'accepted' and answered_at < now() - interval '2 hours'
     and (caller_id in (v_uid, p_callee) or callee_id in (v_uid, p_callee));
  if exists (select 1 from public.match_calls
              where status in ('ringing','accepted') and (caller_id in (v_uid, p_callee) or callee_id in (v_uid, p_callee))) then
    raise exception 'Một trong hai người đang bận cuộc gọi khác.' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.match_calls where caller_id = v_uid and created_at > now() - interval '8 seconds') then
    raise exception 'Bạn gọi hơi nhanh, hãy chờ vài giây.' using errcode = 'P0001';
  end if;
  insert into public.match_calls (caller_id, callee_id) values (v_uid, p_callee) returning id into v_id;
  return v_id;
end $$;

create or replace function public.respond_match_call(p_id uuid, p_action text)
returns text language plpgsql security definer set search_path = public as $$
declare v_uid uuid := auth.uid(); c public.match_calls%rowtype;
begin
  if v_uid is null then raise exception 'Cần đăng nhập.' using errcode = '28000'; end if;
  select * into c from public.match_calls where id = p_id for update;
  if not found or v_uid not in (c.caller_id, c.callee_id) then
    raise exception 'Không tìm thấy cuộc gọi.' using errcode = 'P0002';
  end if;
  if p_action = 'accept' then
    if v_uid <> c.callee_id or c.status <> 'ringing' or c.created_at < now() - interval '60 seconds'
       or public.is_blocked_between(c.caller_id, c.callee_id) then
      raise exception 'Cuộc gọi không còn hiệu lực.' using errcode = 'P0001';
    end if;
    update public.match_calls set status = 'accepted', answered_at = now() where id = p_id;
    return 'accepted';
  elsif p_action = 'decline' then
    if v_uid = c.callee_id and c.status = 'ringing' then update public.match_calls set status = 'declined', ended_at = now() where id = p_id; end if;
  elsif p_action = 'cancel' then
    if v_uid = c.caller_id and c.status = 'ringing' then update public.match_calls set status = 'cancelled', ended_at = now() where id = p_id; end if;
  elsif p_action = 'missed' then
    if v_uid = c.caller_id and c.status = 'ringing' then update public.match_calls set status = 'missed', ended_at = now() where id = p_id; end if;
  elsif p_action = 'end' then
    if c.status = 'accepted' then update public.match_calls set status = 'ended', ended_at = now() where id = p_id; end if;
  else
    raise exception 'Hành động không hợp lệ.' using errcode = 'P0001';
  end if;
  select status into c.status from public.match_calls where id = p_id;
  return c.status;
end $$;

revoke all on function public.start_match_call(uuid), public.respond_match_call(uuid, text) from public, anon;
grant execute on function public.start_match_call(uuid), public.respond_match_call(uuid, text) to authenticated;

-- Realtime: người nhận được báo có cuộc gọi đến, cả hai bên nhận thay đổi trạng thái.
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'match_calls') then
    alter publication supabase_realtime add table public.match_calls;
  end if;
end $$;

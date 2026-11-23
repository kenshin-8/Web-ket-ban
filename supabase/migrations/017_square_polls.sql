-- Connect — Bình chọn (poll) ở Quảng trường.
-- Chạy SAU: 001_schema.sql và 010_safety_hardening.sql (cần view moments_feed có lọc chặn/ẩn).
-- Chạy được nhiều lần.
--
-- Ẩn danh: không ai (kể cả chủ bài) đọc được ai đã chọn gì. Bảng phiếu chỉ cho người
-- bỏ phiếu xem phiếu của chính mình; kết quả tổng hợp đi qua view moment_poll_options_feed.
-- Mọi thao tác ghi đi qua hàm SECURITY DEFINER để kiểm soát số lựa chọn, thời hạn, quyền xem bài.

create table if not exists public.moment_polls (
  moment_id uuid primary key references public.moments(id) on delete cascade,
  closes_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.moment_poll_options (
  id bigint generated always as identity primary key,
  moment_id uuid not null references public.moment_polls(moment_id) on delete cascade,
  position smallint not null check (position between 1 and 4),
  label text not null check (char_length(label) between 1 and 60),
  unique (moment_id, position)
);

create table if not exists public.moment_poll_votes (
  moment_id uuid not null references public.moment_polls(moment_id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  option_id bigint not null references public.moment_poll_options(id) on delete cascade,
  voted_at timestamptz not null default now(),
  primary key (moment_id, user_id)
);
create index if not exists moment_poll_votes_option_idx on public.moment_poll_votes (option_id);

alter table public.moment_polls enable row level security;
alter table public.moment_poll_options enable row level security;
alter table public.moment_poll_votes enable row level security;

-- Không có policy ghi trực tiếp cho client: chỉ hàm bên dưới được ghi.
drop policy if exists "poll_votes_own_select" on public.moment_poll_votes;
create policy "poll_votes_own_select" on public.moment_poll_votes
  for select to authenticated using (user_id = auth.uid());

-- ---------- Tạo bài có bình chọn ----------
create or replace function public.create_moment_poll(
  p_alias text, p_body text, p_tags text[], p_options text[], p_hours int default null
) returns uuid
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_id uuid;
  v_opts text[];
  i int;
begin
  if v_uid is null then raise exception 'Cần đăng nhập.' using errcode = '28000'; end if;
  if p_body is null or char_length(btrim(p_body)) < 3 then
    raise exception 'Hãy nhập câu hỏi cho bình chọn.' using errcode = 'P0001';
  end if;
  select array_agg(btrim(x)) into v_opts from unnest(coalesce(p_options, '{}')) x where btrim(x) <> '';
  if coalesce(array_length(v_opts, 1), 0) < 2 or array_length(v_opts, 1) > 4 then
    raise exception 'Bình chọn cần từ 2 đến 4 lựa chọn.' using errcode = 'P0001';
  end if;
  if p_hours is not null and (p_hours < 1 or p_hours > 720) then
    raise exception 'Thời hạn bình chọn không hợp lệ.' using errcode = 'P0001';
  end if;

  -- Trigger giới hạn tần suất của bảng moments vẫn áp dụng cho lệnh insert này.
  insert into public.moments (author_id, alias, body, tags)
  values (v_uid, left(p_alias, 40), left(btrim(p_body), 500), coalesce(p_tags, '{}'))
  returning id into v_id;

  insert into public.moment_polls (moment_id, closes_at)
  values (v_id, case when p_hours is null then null else now() + make_interval(hours => p_hours) end);

  for i in 1 .. array_length(v_opts, 1) loop
    insert into public.moment_poll_options (moment_id, position, label) values (v_id, i, left(v_opts[i], 60));
  end loop;
  return v_id;
end $$;

-- ---------- Bỏ phiếu (được đổi lựa chọn khi còn hạn) ----------
create or replace function public.vote_moment_poll(p_moment_id uuid, p_option_id bigint)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_closes timestamptz;
begin
  if v_uid is null then raise exception 'Cần đăng nhập.' using errcode = '28000'; end if;
  -- Chỉ bỏ phiếu được cho bài mà mình đang nhìn thấy (không bị chặn/ẩn).
  if not exists (select 1 from public.moments_feed f where f.id = p_moment_id) then
    raise exception 'Không tìm thấy bình chọn.' using errcode = 'P0002';
  end if;
  select closes_at into v_closes from public.moment_polls where moment_id = p_moment_id;
  if not found then raise exception 'Không tìm thấy bình chọn.' using errcode = 'P0002'; end if;
  if v_closes is not null and v_closes <= now() then
    raise exception 'Bình chọn này đã kết thúc.' using errcode = 'P0001';
  end if;
  if not exists (select 1 from public.moment_poll_options o where o.id = p_option_id and o.moment_id = p_moment_id) then
    raise exception 'Lựa chọn không hợp lệ.' using errcode = 'P0001';
  end if;
  insert into public.moment_poll_votes (moment_id, user_id, option_id)
  values (p_moment_id, v_uid, p_option_id)
  on conflict (moment_id, user_id) do update set option_id = excluded.option_id, voted_at = now();
end $$;

revoke all on function public.create_moment_poll(text, text, text[], text[], int) from public, anon;
revoke all on function public.vote_moment_poll(uuid, bigint) from public, anon;
grant execute on function public.create_moment_poll(text, text, text[], text[], int) to authenticated;
grant execute on function public.vote_moment_poll(uuid, bigint) to authenticated;

-- ---------- Kết quả tổng hợp ----------
-- View chạy với quyền chủ sở hữu (cố ý, giống moments_feed): đếm phiếu mà không lộ user_id.
create or replace view public.moment_poll_options_feed as
  select o.id, o.moment_id, o.position, o.label,
    (select count(*) from public.moment_poll_votes v where v.option_id = o.id) as vote_count,
    exists (select 1 from public.moment_poll_votes v where v.option_id = o.id and v.user_id = auth.uid()) as voted_by_me,
    p.closes_at,
    (p.closes_at is not null and p.closes_at <= now()) as is_closed
  from public.moment_poll_options o
  join public.moment_polls p on p.moment_id = o.moment_id
  where exists (select 1 from public.moments_feed f where f.id = o.moment_id);

revoke all on public.moment_poll_options_feed from anon;
grant select on public.moment_poll_options_feed to authenticated;

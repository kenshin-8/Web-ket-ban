-- Connect Social Universe: membership for the six community planets.
-- Run once in Supabase Dashboard > SQL Editor.
create table if not exists public.community_members (
  community_id text not null check (community_id in ('tech','art','music','nature','books','sport')),
  user_id uuid not null references auth.users(id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (community_id, user_id)
);

create index if not exists community_members_user_idx
  on public.community_members (user_id, joined_at desc);

alter table public.community_members enable row level security;

drop policy if exists "community_members_read_authenticated" on public.community_members;
create policy "community_members_read_authenticated"
  on public.community_members for select to authenticated using (true);

drop policy if exists "community_members_join_self" on public.community_members;
create policy "community_members_join_self"
  on public.community_members for insert to authenticated
  with check (user_id = auth.uid());

drop policy if exists "community_members_leave_self" on public.community_members;
create policy "community_members_leave_self"
  on public.community_members for delete to authenticated
  using (user_id = auth.uid());

-- Helpful index for quickly showing members in each community.

-- Connect Community Chat: persistent messages + Supabase Realtime + member-only access.
-- Run after community_members.sql in Supabase Dashboard > SQL Editor.

create table if not exists public.community_messages (
  id uuid primary key default gen_random_uuid(),
  community_id text not null check (community_id in ('tech','art','music','nature','books','sport')),
  user_id uuid not null references auth.users(id) on delete cascade,
  body text not null check (char_length(trim(body)) between 1 and 1000),
  created_at timestamptz not null default now()
);

create index if not exists community_messages_room_idx
  on public.community_messages (community_id, created_at desc);

alter table public.community_messages enable row level security;

drop policy if exists "community_messages_read_members" on public.community_messages;
create policy "community_messages_read_members"
  on public.community_messages for select to authenticated
  using (exists (
    select 1 from public.community_members cm
    where cm.community_id = community_messages.community_id
      and cm.user_id = auth.uid()
  ));

drop policy if exists "community_messages_insert_members" on public.community_messages;
create policy "community_messages_insert_members"
  on public.community_messages for insert to authenticated
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.community_members cm
      where cm.community_id = community_messages.community_id
        and cm.user_id = auth.uid()
    )
  );

-- Keep message history read-only for clients; no edit/delete policy is granted.
grant select, insert on public.community_messages to authenticated;
revoke all on public.community_messages from anon;

-- Add the table to Supabase Realtime publication only if it is not already present.
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (
       select 1 from pg_publication_tables
       where pubname = 'supabase_realtime'
         and schemaname = 'public'
         and tablename = 'community_messages'
     ) then
    alter publication supabase_realtime add table public.community_messages;
  end if;
end $$;

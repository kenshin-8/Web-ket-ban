-- Connect — bắt buộc xác minh email ở phía máy chủ (lớp bảo vệ thứ hai).
-- Điều kiện: đã bật "Confirm email" trong Supabase Dashboard (xem README mục 4a).
-- Tác dụng: tài khoản chưa xác minh email KHÔNG thể ghi dữ liệu (insert/update/delete)
-- vào bất kỳ bảng public nào có bật RLS, kể cả khi gọi API trực tiếp bằng token.
-- Chạy được nhiều lần (idempotent). Nên thử trên dự án staging trước.

create or replace function public.is_email_verified()
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select exists (
    select 1 from auth.users u
    where u.id = auth.uid() and u.email_confirmed_at is not null
  );
$$;

revoke all on function public.is_email_verified() from public;
grant execute on function public.is_email_verified() to authenticated;

do $$
declare t record;
begin
  for t in
    select c.relname
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind = 'r' and c.relrowsecurity
  loop
    execute format('drop policy if exists require_verified_insert on public.%I', t.relname);
    execute format('drop policy if exists require_verified_update on public.%I', t.relname);
    execute format('drop policy if exists require_verified_delete on public.%I', t.relname);

    execute format('create policy require_verified_insert on public.%I as restrictive for insert to authenticated with check (public.is_email_verified())', t.relname);
    execute format('create policy require_verified_update on public.%I as restrictive for update to authenticated using (public.is_email_verified()) with check (public.is_email_verified())', t.relname);
    execute format('create policy require_verified_delete on public.%I as restrictive for delete to authenticated using (public.is_email_verified())', t.relname);
  end loop;
end $$;

-- Gỡ bỏ (nếu cần):
--   do $$ declare t record; begin
--     for t in select c.relname from pg_class c join pg_namespace n on n.oid=c.relnamespace
--              where n.nspname='public' and c.relkind='r' loop
--       execute format('drop policy if exists require_verified_insert on public.%I', t.relname);
--       execute format('drop policy if exists require_verified_update on public.%I', t.relname);
--       execute format('drop policy if exists require_verified_delete on public.%I', t.relname);
--     end loop; end $$;

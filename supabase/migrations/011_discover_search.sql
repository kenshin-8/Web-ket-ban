-- Connect Discover: tìm kiếm + phân trang phía server (chạy sau 010_safety_hardening.sql; chạy lại an toàn).
-- Hàm chạy với quyền người gọi (security invoker) nên RLS của profiles (hồ sơ công khai, người bị chặn) vẫn áp dụng.

create extension if not exists pg_trgm with schema extensions;
create index if not exists profiles_display_name_trgm_idx on public.profiles using gin (display_name extensions.gin_trgm_ops);
create index if not exists profiles_city_trgm_idx on public.profiles using gin (city extensions.gin_trgm_ops);

create or replace function public.escape_like(p_text text)
returns text language sql immutable as $$
  select replace(replace(replace(p_text, '\', '\\'), '%', '\%'), '_', '\_');
$$;

create or replace function public.search_profiles(
  p_name text default null,
  p_city text default null,
  p_interest text default null,
  p_limit integer default 24,
  p_offset integer default 0
)
returns table (
  id uuid, display_name text, bio text, interests text[], city text,
  avatar_data jsonb, zodiac text, planet text, soul_scores jsonb, total_count bigint
)
language sql stable security invoker set search_path = public as $$
  select p.id, p.display_name, p.bio, p.interests, p.city,
         p.avatar_data, p.zodiac, p.planet, p.soul_scores,
         count(*) over () as total_count
    from public.profiles p
   where p.is_visible = true
     and (nullif(trim(p_name), '') is null
          or p.display_name ilike '%' || public.escape_like(trim(p_name)) || '%')
     and (nullif(trim(p_city), '') is null
          or p.city ilike '%' || public.escape_like(trim(p_city)) || '%')
     and (nullif(trim(p_interest), '') is null
          or exists (select 1 from unnest(coalesce(p.interests, '{}'::text[])) i
                      where i ilike '%' || public.escape_like(trim(p_interest)) || '%'))
   order by p.display_name asc nulls last, p.id
   limit least(greatest(coalesce(p_limit, 24), 1), 48)
  offset greatest(coalesce(p_offset, 0), 0);
$$;
-- Hồ sơ công khai vốn xem được khi chưa đăng nhập (policy profiles_read_public_or_own), nên anon cũng được gọi.
revoke all on function public.search_profiles(text, text, text, integer, integer) from public;
grant execute on function public.search_profiles(text, text, text, integer, integer) to anon, authenticated;

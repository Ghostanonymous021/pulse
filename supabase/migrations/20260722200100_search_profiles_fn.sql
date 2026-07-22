-- RPC used by /explorar account search.
--
-- Previously: the client sent `username.ilike,display_name.ilike,...`
-- (OR'd substring match) and got rows back in whatever order Postgres
-- felt like, then JS re-sorted client-side. That still couldn't find
-- "joao" when someone typed "joão" without the diacritic, or recover
-- from a single typo — pure ILIKE has no notion of "close enough".
--
-- This function keeps the substring match (still the strongest signal
-- when correct) but ORs it with pg_trgm similarity() so near-misses
-- surface too, and does the ranking in the database against the
-- trgm-indexed columns (profiles_*_trgm_idx, see the previous
-- migration) instead of pulling rows into JS to sort.
--
-- SECURITY INVOKER (default for a plain SQL function, no DEFINER
-- clause) — runs as the calling user, so profiles_select_all_authenticated
-- RLS still applies exactly as it does for a normal table select.

create or replace function public.search_profiles(p_query text, p_limit int default 40)
returns setof public.profiles
language sql
stable
as $$
  select p.*
  from public.profiles p
  where
    p.username ilike '%' || p_query || '%'
    or p.display_name ilike '%' || p_query || '%'
    or p.university ilike '%' || p_query || '%'
    or p.campus ilike '%' || p_query || '%'
    or p.course ilike '%' || p_query || '%'
    or similarity(p.username, p_query) > 0.25
    or similarity(p.display_name, p_query) > 0.25
  order by
    greatest(
      similarity(p.username, p_query) * 1.0,
      similarity(p.display_name, p_query) * 0.85,
      similarity(coalesce(p.campus, ''), p_query) * 0.35,
      similarity(coalesce(p.course, ''), p_query) * 0.3,
      similarity(coalesce(p.university, ''), p_query) * 0.25,
      (case when p.username ilike p_query || '%' then 0.95 else 0 end),
      (case when p.display_name ilike p_query || '%' then 0.8 else 0 end)
    ) desc,
    (coalesce(p.is_verified, false) and (p.verification_expires_at is null or p.verification_expires_at > now())) desc,
    p.display_name asc
  limit greatest(p_limit, 1);
$$;

grant execute on function public.search_profiles(text, int) to authenticated;

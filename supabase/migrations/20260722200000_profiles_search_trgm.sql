-- Explorar account search: trigram indexes so ILIKE/similarity search
-- on profiles stays fast as the table grows, and so search tolerates
-- typos the way pg_trgm already lets chat message search do (see
-- 20260720110000_chat_delivery_and_search.sql). Query-side relevance
-- ranking lives in application code (rankAccountsByRelevance); this
-- migration only makes the underlying ILIKE/similarity lookups indexed
-- instead of full-table scans.
--
-- pg_trgm is already enabled (used by messages_body_trgm_idx).

create index if not exists profiles_username_trgm_idx
  on public.profiles using gin (username gin_trgm_ops);

create index if not exists profiles_display_name_trgm_idx
  on public.profiles using gin (display_name gin_trgm_ops);

create index if not exists profiles_university_trgm_idx
  on public.profiles using gin (university gin_trgm_ops)
  where university is not null;

create index if not exists profiles_campus_trgm_idx
  on public.profiles using gin (campus gin_trgm_ops)
  where campus is not null;

create index if not exists profiles_course_trgm_idx
  on public.profiles using gin (course gin_trgm_ops)
  where course is not null;

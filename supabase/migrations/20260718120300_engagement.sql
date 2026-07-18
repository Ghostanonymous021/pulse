-- Pulse: likes + comments (ranking signals)
-- Aligns with section 15

create table public.likes (
  user_id uuid not null references public.profiles (id) on delete cascade,
  post_id uuid not null references public.posts (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, post_id)
);

create index likes_post_id_idx on public.likes (post_id);

create table public.comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts (id) on delete cascade,
  author_id uuid not null references public.profiles (id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now(),
  constraint comments_body_length check (char_length(body) between 1 and 2000)
);

create index comments_post_id_idx on public.comments (post_id, created_at);

alter table public.likes enable row level security;
alter table public.comments enable row level security;

create policy "likes_select_if_post_visible"
  on public.likes
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.posts po
      join public.profiles pr on pr.id = po.author_id
      where po.id = post_id
        and public.can_view_post(po.author_id, pr.is_private)
    )
  );

create policy "likes_insert_own_if_visible"
  on public.likes
  for insert
  to authenticated
  with check (
    user_id = auth.uid()
    and exists (
      select 1
      from public.posts po
      join public.profiles pr on pr.id = po.author_id
      where po.id = post_id
        and public.can_view_post(po.author_id, pr.is_private)
    )
  );

create policy "likes_delete_own"
  on public.likes
  for delete
  to authenticated
  using (user_id = auth.uid());

create policy "comments_select_if_post_visible"
  on public.comments
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.posts po
      join public.profiles pr on pr.id = po.author_id
      where po.id = post_id
        and public.can_view_post(po.author_id, pr.is_private)
    )
  );

create policy "comments_insert_own_if_visible"
  on public.comments
  for insert
  to authenticated
  with check (
    author_id = auth.uid()
    and exists (
      select 1
      from public.posts po
      join public.profiles pr on pr.id = po.author_id
      where po.id = post_id
        and public.can_view_post(po.author_id, pr.is_private)
    )
  );

create policy "comments_delete_own"
  on public.comments
  for delete
  to authenticated
  using (author_id = auth.uid());

create policy "comments_update_own"
  on public.comments
  for update
  to authenticated
  using (author_id = auth.uid())
  with check (author_id = auth.uid());

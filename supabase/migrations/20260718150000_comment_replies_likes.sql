-- Comment replies (shallow tree) + likes on comments

alter table public.comments
  add column if not exists parent_id uuid references public.comments (id) on delete cascade;

create index if not exists comments_parent_id_idx
  on public.comments (parent_id)
  where parent_id is not null;

create or replace function public.enforce_comment_parent()
returns trigger
language plpgsql
as $$
declare
  parent_post uuid;
  grand uuid;
begin
  if new.parent_id is null then
    return new;
  end if;

  if new.parent_id = new.id then
    raise exception 'comment cannot parent itself';
  end if;

  select c.post_id, c.parent_id
    into parent_post, grand
  from public.comments c
  where c.id = new.parent_id;

  if parent_post is null then
    raise exception 'parent comment not found';
  end if;

  if parent_post is distinct from new.post_id then
    raise exception 'reply must belong to same post';
  end if;

  -- Flatten deeper than 1 reply level under the root of the thread
  if grand is not null then
    new.parent_id := grand;
  end if;

  return new;
end;
$$;

drop trigger if exists comments_enforce_parent on public.comments;
create trigger comments_enforce_parent
  before insert or update of parent_id, post_id on public.comments
  for each row execute function public.enforce_comment_parent();

create table if not exists public.comment_likes (
  user_id uuid not null references public.profiles (id) on delete cascade,
  comment_id uuid not null references public.comments (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, comment_id)
);

create index if not exists comment_likes_comment_id_idx
  on public.comment_likes (comment_id);

alter table public.comment_likes enable row level security;

drop policy if exists "comment_likes_select_if_post_visible" on public.comment_likes;
drop policy if exists "comment_likes_insert_own_if_visible" on public.comment_likes;
drop policy if exists "comment_likes_delete_own" on public.comment_likes;

create policy "comment_likes_select_if_post_visible"
  on public.comment_likes
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.comments c
      join public.posts po on po.id = c.post_id
      join public.profiles pr on pr.id = po.author_id
      where c.id = comment_id
        and public.can_view_post(po.author_id, pr.is_private)
    )
  );

create policy "comment_likes_insert_own_if_visible"
  on public.comment_likes
  for insert
  to authenticated
  with check (
    user_id = auth.uid()
    and exists (
      select 1
      from public.comments c
      join public.posts po on po.id = c.post_id
      join public.profiles pr on pr.id = po.author_id
      where c.id = comment_id
        and public.can_view_post(po.author_id, pr.is_private)
    )
  );

create policy "comment_likes_delete_own"
  on public.comment_likes
  for delete
  to authenticated
  using (user_id = auth.uid());

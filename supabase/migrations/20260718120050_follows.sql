-- Pulse: follows (public accept vs private pending)
-- Aligns with sections 6, 9, 12.5

create type public.follow_status as enum ('pending', 'accepted');

create table public.follows (
  follower_id uuid not null references public.profiles (id) on delete cascade,
  following_id uuid not null references public.profiles (id) on delete cascade,
  status public.follow_status not null,
  created_at timestamptz not null default now(),
  primary key (follower_id, following_id),
  constraint follows_no_self check (follower_id <> following_id)
);

create index follows_following_id_idx on public.follows (following_id, status);
create index follows_follower_id_idx on public.follows (follower_id, status);

create or replace function public.set_follow_status_on_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  target_private boolean;
begin
  if new.follower_id is distinct from auth.uid() then
    raise exception 'cannot follow as another user';
  end if;

  select is_private into target_private
  from public.profiles
  where id = new.following_id;

  if target_private is null then
    raise exception 'target profile not found';
  end if;

  if target_private then
    new.status := 'pending';
  else
    new.status := 'accepted';
  end if;

  return new;
end;
$$;

create trigger follows_set_status
  before insert on public.follows
  for each row execute function public.set_follow_status_on_insert();

alter table public.follows enable row level security;

create policy "follows_select_participants"
  on public.follows
  for select
  to authenticated
  using (follower_id = auth.uid() or following_id = auth.uid());

create policy "follows_insert_as_follower"
  on public.follows
  for insert
  to authenticated
  with check (follower_id = auth.uid());

-- Target may accept/reject; follower cannot force accepted on private
create policy "follows_update_target_status"
  on public.follows
  for update
  to authenticated
  using (following_id = auth.uid())
  with check (
    following_id = auth.uid()
    and status in ('pending', 'accepted')
  );

create policy "follows_delete_participants"
  on public.follows
  for delete
  to authenticated
  using (follower_id = auth.uid() or following_id = auth.uid());

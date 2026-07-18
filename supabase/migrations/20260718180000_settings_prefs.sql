-- Pulse: settings preferences — DM permission, notification toggles, blocks
-- Aligned with product settings surface (definicoes). RLS on every table.

-- Who may start a DM with this profile
alter table public.profiles
  add column if not exists dm_permission text not null default 'everyone'
  constraint profiles_dm_permission_check
    check (dm_permission in ('everyone', 'following', 'none'));

comment on column public.profiles.dm_permission is
  'Who can message: everyone | following (only people I follow) | none (no new requests)';

-- Per-type notification preferences (no master toggle)
create table if not exists public.notification_preferences (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  new_followers boolean not null default true,
  likes boolean not null default true,
  comments boolean not null default true,
  messages boolean not null default true,
  mentions boolean not null default true,
  updated_at timestamptz not null default now()
);

alter table public.notification_preferences enable row level security;

create policy "notification_preferences_select_own"
  on public.notification_preferences
  for select
  to authenticated
  using (user_id = auth.uid());

create policy "notification_preferences_insert_own"
  on public.notification_preferences
  for insert
  to authenticated
  with check (user_id = auth.uid());

create policy "notification_preferences_update_own"
  on public.notification_preferences
  for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "notification_preferences_no_delete"
  on public.notification_preferences
  for delete
  to authenticated
  using (false);

-- Blocks
create table if not exists public.blocks (
  blocker_id uuid not null references public.profiles (id) on delete cascade,
  blocked_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  constraint blocks_no_self check (blocker_id <> blocked_id)
);

create index if not exists blocks_blocked_id_idx on public.blocks (blocked_id);

alter table public.blocks enable row level security;

create policy "blocks_select_own"
  on public.blocks
  for select
  to authenticated
  using (blocker_id = auth.uid());

create policy "blocks_insert_own"
  on public.blocks
  for insert
  to authenticated
  with check (blocker_id = auth.uid());

create policy "blocks_delete_own"
  on public.blocks
  for delete
  to authenticated
  using (blocker_id = auth.uid());

create policy "blocks_no_update"
  on public.blocks
  for update
  to authenticated
  using (false);

-- Auto-create notification prefs on profile insert (backfill + trigger)
insert into public.notification_preferences (user_id)
select id from public.profiles
on conflict (user_id) do nothing;

create or replace function public.ensure_notification_preferences()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.notification_preferences (user_id)
  values (new.id)
  on conflict (user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists profiles_ensure_notification_prefs on public.profiles;
create trigger profiles_ensure_notification_prefs
  after insert on public.profiles
  for each row
  execute function public.ensure_notification_preferences();

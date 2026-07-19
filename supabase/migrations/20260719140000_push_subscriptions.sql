-- Web Push subscriptions (real device notifications with sound/vibration,
-- not just the in-app bell).

create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  created_at timestamptz not null default now()
);

create index if not exists push_subscriptions_profile_id_idx
  on public.push_subscriptions (profile_id);

alter table public.push_subscriptions enable row level security;

create policy "push_subscriptions_own_select"
  on public.push_subscriptions
  for select
  to authenticated
  using (profile_id = auth.uid());

create policy "push_subscriptions_own_insert"
  on public.push_subscriptions
  for insert
  to authenticated
  with check (profile_id = auth.uid());

create policy "push_subscriptions_own_delete"
  on public.push_subscriptions
  for delete
  to authenticated
  using (profile_id = auth.uid());

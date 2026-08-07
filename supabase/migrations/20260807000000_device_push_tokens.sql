-- Native device push tokens (FCM / APNs via FCM). Web Push remains in push_subscriptions.
create table if not exists public.device_push_tokens (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles(id) on delete cascade,
  token text not null,
  platform text not null check (platform in ('android', 'ios', 'web')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (token)
);

create index if not exists device_push_tokens_profile_id_idx
  on public.device_push_tokens (profile_id);

alter table public.device_push_tokens enable row level security;

drop policy if exists "device_push_tokens_select_own" on public.device_push_tokens;
drop policy if exists "device_push_tokens_insert_own" on public.device_push_tokens;
drop policy if exists "device_push_tokens_update_own" on public.device_push_tokens;
drop policy if exists "device_push_tokens_delete_own" on public.device_push_tokens;

create policy "device_push_tokens_select_own"
  on public.device_push_tokens for select
  using (auth.uid() = profile_id);

create policy "device_push_tokens_insert_own"
  on public.device_push_tokens for insert
  with check (auth.uid() = profile_id);

create policy "device_push_tokens_update_own"
  on public.device_push_tokens for update
  using (auth.uid() = profile_id)
  with check (auth.uid() = profile_id);

create policy "device_push_tokens_delete_own"
  on public.device_push_tokens for delete
  using (auth.uid() = profile_id);

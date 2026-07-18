-- Pulse: profiles + auth trigger
-- Aligns with PULSE_VISAO_PRODUTO sections 4, 6, 7, 12

create extension if not exists "pgcrypto";

create type public.account_type as enum ('pessoa', 'organizacao');

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  phone text,
  email text,
  username text not null,
  display_name text not null default '',
  avatar_url text,
  bio text,
  account_type public.account_type not null default 'pessoa',
  university text,
  campus text,
  course text,
  year text,
  is_private boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_username_format check (username ~ '^[a-z0-9_]{3,30}$'),
  constraint profiles_bio_length check (bio is null or char_length(bio) <= 160)
);

create unique index profiles_username_key on public.profiles (lower(username));
create unique index profiles_phone_key on public.profiles (phone) where phone is not null;
create unique index profiles_email_key on public.profiles (lower(email)) where email is not null;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  base_username text;
  final_username text;
  suffix int := 0;
begin
  base_username := coalesce(
    nullif(regexp_replace(lower(coalesce(new.raw_user_meta_data->>'username', '')), '[^a-z0-9_]', '', 'g'), ''),
    'user' || substr(replace(new.id::text, '-', ''), 1, 8)
  );

  if char_length(base_username) < 3 then
    base_username := 'user' || substr(replace(new.id::text, '-', ''), 1, 8);
  end if;

  final_username := substr(base_username, 1, 30);

  while exists (select 1 from public.profiles p where lower(p.username) = lower(final_username)) loop
    suffix := suffix + 1;
    final_username := substr(base_username, 1, 30 - char_length(suffix::text) - 1) || '_' || suffix::text;
  end loop;

  insert into public.profiles (
    id,
    phone,
    email,
    username,
    display_name,
    account_type
  ) values (
    new.id,
    new.phone,
    new.email,
    final_username,
    coalesce(nullif(new.raw_user_meta_data->>'display_name', ''), final_username),
    coalesce(
      (new.raw_user_meta_data->>'account_type')::public.account_type,
      'pessoa'
    )
  );

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

alter table public.profiles enable row level security;

-- Profiles are discoverable (network existence). Content privacy is on posts.
create policy "profiles_select_all_authenticated"
  on public.profiles
  for select
  to authenticated
  using (true);

create policy "profiles_update_own"
  on public.profiles
  for update
  to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

-- No direct insert from clients; trigger owns creation
create policy "profiles_no_client_insert"
  on public.profiles
  for insert
  to authenticated
  with check (false);

create policy "profiles_no_client_delete"
  on public.profiles
  for delete
  to authenticated
  using (false);

-- Pulse: professional mode (org) request flow
-- Approval is manual in Supabase Table Editor — no admin UI in app.
-- account_type upgrade only via trigger on approved request.

-- Request status
do $$ begin
  create type public.professional_request_status as enum (
    'pending',
    'approved',
    'rejected'
  );
exception
  when duplicate_object then null;
end $$;

-- Organisation type declared in the form
do $$ begin
  create type public.professional_org_type as enum (
    'universidade',
    'instituicao',
    'empresa',
    'clube',
    'outro'
  );
exception
  when duplicate_object then null;
end $$;

create table if not exists public.professional_requests (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  nome_organizacao text not null,
  tipo_organizacao public.professional_org_type not null,
  descricao text not null,
  contacto text not null,
  status public.professional_request_status not null default 'pending',
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  constraint professional_requests_nome_len check (
    char_length(trim(nome_organizacao)) between 2 and 120
  ),
  constraint professional_requests_descricao_len check (
    char_length(trim(descricao)) between 1 and 200
  ),
  constraint professional_requests_contacto_len check (
    char_length(trim(contacto)) between 3 and 200
  ),
  constraint professional_requests_reviewed_at_status check (
    (status = 'pending' and reviewed_at is null)
    or (status in ('approved', 'rejected'))
  )
);

-- At most one open (pending) request per profile
create unique index if not exists professional_requests_one_pending_per_profile
  on public.professional_requests (profile_id)
  where status = 'pending';

create index if not exists professional_requests_profile_id_idx
  on public.professional_requests (profile_id, created_at desc);

create index if not exists professional_requests_status_idx
  on public.professional_requests (status, created_at desc);

alter table public.professional_requests enable row level security;

-- Owner can read own requests only
create policy "professional_requests_select_own"
  on public.professional_requests
  for select
  to authenticated
  using (profile_id = auth.uid());

-- Owner can insert own pending request (and only if still pessoa)
create policy "professional_requests_insert_own"
  on public.professional_requests
  for insert
  to authenticated
  with check (
    profile_id = auth.uid()
    and status = 'pending'
    and reviewed_at is null
    and exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.account_type = 'pessoa'
    )
  );

-- Clients never update or delete — admin uses service role / table editor
create policy "professional_requests_no_client_update"
  on public.professional_requests
  for update
  to authenticated
  using (false);

create policy "professional_requests_no_client_delete"
  on public.professional_requests
  for delete
  to authenticated
  using (false);

-- When admin sets status = approved, promote profile to organizacao
create or replace function public.apply_professional_request_decision()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- Only react to status transitions away from pending
  if tg_op = 'UPDATE'
     and old.status is distinct from new.status
     and new.status in ('approved', 'rejected')
  then
    if new.reviewed_at is null then
      new.reviewed_at := now();
    end if;

    if new.status = 'approved' then
      -- Allow protect_account_type trigger for this transaction
      perform set_config('pulse.allow_account_type_change', '1', true);
      update public.profiles
      set
        account_type = 'organizacao',
        updated_at = now()
      where id = new.profile_id
        and account_type = 'pessoa';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists professional_requests_apply_decision
  on public.professional_requests;

create trigger professional_requests_apply_decision
  before update on public.professional_requests
  for each row
  execute function public.apply_professional_request_decision();

-- Lock account_type against client self-service.
-- Only security definer functions (this trigger path) may change it after signup.
create or replace function public.protect_account_type()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'UPDATE'
     and old.account_type is distinct from new.account_type
  then
    -- Allowed paths:
    -- 1) approval trigger sets local config pulse.allow_account_type_change
    -- 2) service role / SQL editor (auth.uid() is null)
    if current_setting('pulse.allow_account_type_change', true) = '1' then
      return new;
    end if;
    if auth.uid() is not null then
      raise exception 'account_type cannot be changed by the client';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_protect_account_type on public.profiles;
create trigger profiles_protect_account_type
  before update on public.profiles
  for each row
  execute function public.protect_account_type();

-- Signup always creates pessoa — org only via professional approval
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
  raw_phone text;
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

  raw_phone := coalesce(
    nullif(new.phone, ''),
    nullif(new.raw_user_meta_data->>'phone', '')
  );

  insert into public.profiles (
    id,
    phone,
    email,
    username,
    display_name,
    account_type
  ) values (
    new.id,
    raw_phone,
    new.email,
    final_username,
    coalesce(nullif(new.raw_user_meta_data->>'display_name', ''), final_username),
    'pessoa'
  );

  return new;
end;
$$;

comment on table public.professional_requests is
  'Org mode requests. Approve/reject in Table Editor; trigger sets profiles.account_type.';

-- Force RLS so even elevated roles without BYPASSRLS cannot skip policies
alter table public.professional_requests force row level security;

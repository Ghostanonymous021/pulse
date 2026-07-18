-- Pulse: harden paid verification (RLS + protected columns)
-- Clients must not self-activate seal, self-set is_verified, or forge payments.

-- ---------------------------------------------------------------------------
-- verified_type on profiles (pessoa | organizacao at activation time)
-- Badge rendering uses this when present; falls back to account_type.
-- ---------------------------------------------------------------------------
alter table public.profiles
  add column if not exists verified_type public.account_type;

comment on column public.profiles.is_verified is
  'Paid verification seal active. NEVER used in feed ranking score.';
comment on column public.profiles.verified_type is
  'Seal flavour at activation: pessoa (blue check) or organizacao (institutional).';

-- ---------------------------------------------------------------------------
-- Protect verification columns on profiles (client cannot self-verify)
-- ---------------------------------------------------------------------------
create or replace function public.protect_verification_fields()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'UPDATE' and auth.uid() is not null then
    if current_setting('pulse.allow_verification_change', true) = '1' then
      return new;
    end if;

    if old.is_verified is distinct from new.is_verified
       or old.verified_at is distinct from new.verified_at
       or old.verification_expires_at is distinct from new.verification_expires_at
       or old.priority_support is distinct from new.priority_support
       or old.early_access is distinct from new.early_access
       or old.verified_type is distinct from new.verified_type
    then
      raise exception 'verification fields cannot be changed by the client';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_protect_verification on public.profiles;
create trigger profiles_protect_verification
  before update on public.profiles
  for each row
  execute function public.protect_verification_fields();

-- ---------------------------------------------------------------------------
-- Clients cannot escalate request status to active/rejected/expired
-- ---------------------------------------------------------------------------
create or replace function public.protect_verification_request_status()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  allowed_client_statuses public.verification_request_status[] :=
    array['draft', 'pending_payment', 'cancelled']::public.verification_request_status[];
begin
  if tg_op = 'UPDATE'
     and old.status is distinct from new.status
     and auth.uid() is not null
     and current_setting('pulse.allow_verification_status', true) is distinct from '1'
  then
    -- Client may only move between draft / pending_payment / cancelled
    if not (new.status = any (allowed_client_statuses)) then
      raise exception 'verification status % cannot be set by the client', new.status;
    end if;
    -- Cannot leave terminal states
    if old.status in ('active', 'rejected', 'expired') then
      raise exception 'terminal verification request cannot be modified by the client';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists verification_requests_protect_status on public.verification_requests;
create trigger verification_requests_protect_status
  before update of status on public.verification_requests
  for each row
  execute function public.protect_verification_request_status();

-- Insert only as draft (cannot bootstrap active)
drop policy if exists "verification_requests_insert_own" on public.verification_requests;
create policy "verification_requests_insert_own"
  on public.verification_requests for insert to authenticated
  with check (
    profile_id = auth.uid()
    and status = 'draft'
  );

-- Restrict updates: only own row, open statuses
drop policy if exists "verification_requests_update_own" on public.verification_requests;
create policy "verification_requests_update_own"
  on public.verification_requests for update to authenticated
  using (
    profile_id = auth.uid()
    and status in ('draft', 'pending_payment')
  )
  with check (
    profile_id = auth.uid()
    and status in ('draft', 'pending_payment', 'cancelled')
  );

-- ---------------------------------------------------------------------------
-- Payments: no client insert (API uses service_role only)
-- ---------------------------------------------------------------------------
drop policy if exists "verification_payments_insert_own" on public.verification_payments;

-- ---------------------------------------------------------------------------
-- apply_verification_seal: set verified_type + allow protect bypass
-- ---------------------------------------------------------------------------
create or replace function public.apply_verification_seal(
  p_profile_id uuid,
  p_account_type public.account_type
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  expires timestamptz := now() + interval '30 days';
begin
  perform set_config('pulse.allow_verification_change', '1', true);

  update public.profiles
  set
    is_verified = true,
    verified_type = p_account_type,
    verified_at = now(),
    verification_expires_at = expires,
    priority_support = true,
    early_access = true,
    updated_at = now()
  where id = p_profile_id;

  if p_account_type = 'organizacao' then
    insert into public.profile_admins (profile_id, admin_user_id, role)
    values (p_profile_id, p_profile_id, 'owner')
    on conflict (profile_id, admin_user_id) do nothing;

    insert into public.profile_stats (profile_id)
    values (p_profile_id)
    on conflict (profile_id) do nothing;
  end if;
end;
$$;

create or replace function public.activate_verification(p_request_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  r public.verification_requests%rowtype;
begin
  select * into r from public.verification_requests where id = p_request_id;
  if not found then
    raise exception 'request not found';
  end if;

  perform set_config('pulse.allow_verification_status', '1', true);

  update public.verification_requests
  set
    status = 'active',
    activated_at = now(),
    reviewed_at = coalesce(reviewed_at, now()),
    updated_at = now()
  where id = p_request_id;

  perform public.apply_verification_seal(r.profile_id, r.account_type);
end;
$$;

create or replace function public.revoke_verification(p_profile_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  perform set_config('pulse.allow_verification_change', '1', true);
  perform set_config('pulse.allow_verification_status', '1', true);

  update public.profiles
  set
    is_verified = false,
    verified_type = null,
    priority_support = false,
    early_access = false,
    verification_expires_at = now(),
    updated_at = now()
  where id = p_profile_id;

  update public.verification_requests
  set status = 'expired', updated_at = now()
  where profile_id = p_profile_id
    and status = 'active';
end;
$$;

-- Status side-effects (Table Editor admin path) must allow protected updates
create or replace function public.verification_request_status_side_effects()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status is distinct from old.status then
    if new.status = 'active' then
      perform public.apply_verification_seal(new.profile_id, new.account_type);
      new.activated_at := coalesce(new.activated_at, now());
      new.reviewed_at := coalesce(new.reviewed_at, now());
    elsif new.status = 'rejected' then
      new.reviewed_at := coalesce(new.reviewed_at, now());
    elsif new.status = 'expired' then
      perform set_config('pulse.allow_verification_change', '1', true);
      update public.profiles
      set
        is_verified = false,
        verified_type = null,
        priority_support = false,
        early_access = false,
        updated_at = now()
      where id = new.profile_id;
    end if;
  end if;
  new.updated_at := now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Priority support: flag reports from verified accounts
-- ---------------------------------------------------------------------------
alter table public.reports
  add column if not exists is_priority boolean not null default false;

create or replace function public.reports_set_priority_from_reporter()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  select coalesce(p.priority_support, false)
    into new.is_priority
  from public.profiles p
  where p.id = new.reporter_id;
  return new;
end;
$$;

drop trigger if exists reports_set_priority on public.reports;
create trigger reports_set_priority
  before insert on public.reports
  for each row
  execute function public.reports_set_priority_from_reporter();

create index if not exists reports_priority_open_idx
  on public.reports (is_priority desc, created_at desc)
  where status = 'open';

-- ---------------------------------------------------------------------------
-- account_admins synonym view (product name) → profile_admins
-- ---------------------------------------------------------------------------
create or replace view public.account_admins
  with (security_invoker = true)
as
  select
    profile_id,
    admin_user_id,
    role,
    created_at as criado_em
  from public.profile_admins;

grant select on public.account_admins to authenticated;

comment on table public.profile_admins is
  'Multi-admin for verified org accounts (product: account_admins). Owner + listed admins.';

comment on table public.verification_requests is
  'Paid verification requests. Client: own select/insert; status only draft|pending_payment. Active/reject via service_role or Table Editor.';

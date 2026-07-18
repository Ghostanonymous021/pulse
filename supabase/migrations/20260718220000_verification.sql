-- Pulse: paid verification seal (Meta Verified-style)
-- Decision override of product doc §6 (no free mass verification — paid optional only).
-- NEVER used in feed ranking score. Explore boost + org extras only.

-- ---------------------------------------------------------------------------
-- Profile flags
-- ---------------------------------------------------------------------------
alter table public.profiles
  add column if not exists is_verified boolean not null default false;

alter table public.profiles
  add column if not exists verified_at timestamptz;

alter table public.profiles
  add column if not exists verification_expires_at timestamptz;

alter table public.profiles
  add column if not exists priority_support boolean not null default false;

alter table public.profiles
  add column if not exists early_access boolean not null default false;

create index if not exists profiles_verified_idx
  on public.profiles (is_verified)
  where is_verified = true;

-- ---------------------------------------------------------------------------
-- Requests + payments
-- ---------------------------------------------------------------------------
do $$ begin
  create type public.verification_request_status as enum (
    'draft',
    'pending_payment',
    'pending_review',
    'active',
    'rejected',
    'expired',
    'cancelled'
  );
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.verification_payment_status as enum (
    'pending',
    'simulated',
    'paid',
    'failed',
    'refunded'
  );
exception when duplicate_object then null;
end $$;

create table if not exists public.verification_requests (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  account_type public.account_type not null,
  status public.verification_request_status not null default 'draft',
  -- Documents (storage paths in verification-docs bucket)
  id_document_path text,
  selfie_path text,
  org_document_path text,
  org_email_domain text,
  admin_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  reviewed_at timestamptz,
  activated_at timestamptz,
  constraint verification_requests_org_email_len check (
    org_email_domain is null or char_length(trim(org_email_domain)) between 3 and 120
  )
);

create index if not exists verification_requests_profile_idx
  on public.verification_requests (profile_id, created_at desc);

create index if not exists verification_requests_status_idx
  on public.verification_requests (status, created_at desc);

-- One open request at a time (not terminal)
create unique index if not exists verification_requests_one_open_per_profile
  on public.verification_requests (profile_id)
  where status in ('draft', 'pending_payment', 'pending_review');

create table if not exists public.verification_payments (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references public.verification_requests (id) on delete cascade,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  amount_mzn int not null check (amount_mzn > 0),
  currency text not null default 'MZN',
  is_first_month boolean not null default true,
  provider text not null default 'mpesa',
  provider_ref text,
  status public.verification_payment_status not null default 'pending',
  period_start timestamptz,
  period_end timestamptz,
  created_at timestamptz not null default now(),
  paid_at timestamptz
);

create index if not exists verification_payments_profile_idx
  on public.verification_payments (profile_id, created_at desc);

create index if not exists verification_payments_request_idx
  on public.verification_payments (request_id);

-- ---------------------------------------------------------------------------
-- Org multi-admin
-- ---------------------------------------------------------------------------
create table if not exists public.profile_admins (
  profile_id uuid not null references public.profiles (id) on delete cascade,
  admin_user_id uuid not null references public.profiles (id) on delete cascade,
  role text not null default 'admin' check (role in ('owner', 'admin')),
  created_at timestamptz not null default now(),
  primary key (profile_id, admin_user_id),
  constraint profile_admins_no_self_as_only check (true)
);

create index if not exists profile_admins_admin_user_idx
  on public.profile_admins (admin_user_id);

-- ---------------------------------------------------------------------------
-- Basic profile stats (verified org analytics v1)
-- ---------------------------------------------------------------------------
create table if not exists public.profile_stats (
  profile_id uuid primary key references public.profiles (id) on delete cascade,
  profile_views bigint not null default 0,
  post_reach bigint not null default 0,
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------
alter table public.verification_requests enable row level security;
alter table public.verification_payments enable row level security;
alter table public.profile_admins enable row level security;
alter table public.profile_stats enable row level security;

create policy "verification_requests_select_own"
  on public.verification_requests for select to authenticated
  using (profile_id = auth.uid());

create policy "verification_requests_insert_own"
  on public.verification_requests for insert to authenticated
  with check (profile_id = auth.uid());

create policy "verification_requests_update_own"
  on public.verification_requests for update to authenticated
  using (profile_id = auth.uid())
  with check (profile_id = auth.uid());

create policy "verification_requests_no_delete"
  on public.verification_requests for delete to authenticated
  using (false);

create policy "verification_payments_select_own"
  on public.verification_payments for select to authenticated
  using (profile_id = auth.uid());

create policy "verification_payments_insert_own"
  on public.verification_payments for insert to authenticated
  with check (profile_id = auth.uid());

create policy "verification_payments_no_client_update"
  on public.verification_payments for update to authenticated
  using (false);

create policy "verification_payments_no_delete"
  on public.verification_payments for delete to authenticated
  using (false);

-- Admins: owner of org profile can manage; admins can read
create policy "profile_admins_select"
  on public.profile_admins for select to authenticated
  using (
    profile_id = auth.uid()
    or admin_user_id = auth.uid()
  );

create policy "profile_admins_insert_owner"
  on public.profile_admins for insert to authenticated
  with check (
    profile_id = auth.uid()
    and exists (
      select 1 from public.profiles p
      where p.id = auth.uid()
        and p.account_type = 'organizacao'
        and p.is_verified = true
    )
  );

create policy "profile_admins_delete_owner"
  on public.profile_admins for delete to authenticated
  using (profile_id = auth.uid());

-- Stats: public read of aggregates for verified orgs; owner write via RPC
create policy "profile_stats_select"
  on public.profile_stats for select to authenticated
  using (true);

create policy "profile_stats_insert_own"
  on public.profile_stats for insert to authenticated
  with check (profile_id = auth.uid());

create policy "profile_stats_update_own"
  on public.profile_stats for update to authenticated
  using (profile_id = auth.uid());

-- ---------------------------------------------------------------------------
-- Activate / revoke helpers
-- ---------------------------------------------------------------------------
-- Apply profile seal flags (no status write — avoids recursive triggers)
create or replace function public.apply_verification_seal(p_profile_id uuid, p_account_type public.account_type)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  expires timestamptz := now() + interval '30 days';
begin
  update public.profiles
  set
    is_verified = true,
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
  update public.profiles
  set
    is_verified = false,
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

-- Table Editor: setting status=active applies seal without recursion
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
      update public.profiles
      set is_verified = false, priority_support = false, early_access = false, updated_at = now()
      where id = new.profile_id;
    end if;
  end if;
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists verification_requests_status_effects on public.verification_requests;
create trigger verification_requests_status_effects
  before update of status on public.verification_requests
  for each row execute function public.verification_request_status_side_effects();

-- ---------------------------------------------------------------------------
-- Highlight weekly limit: 3 default, 6 if verified org
-- ---------------------------------------------------------------------------
create or replace function public.highlight_weekly_limit_for(p_org_id uuid)
returns int
language sql
stable
security definer
set search_path = public
as $$
  select case
    when exists (
      select 1
      from public.profiles p
      where p.id = p_org_id
        and p.account_type = 'organizacao'
        and p.is_verified = true
        and (
          p.verification_expires_at is null
          or p.verification_expires_at > now()
        )
    ) then 6
    else 3
  end;
$$;

-- Keep old immutable function for compatibility; enforce uses per-org
create or replace function public.highlight_weekly_limit()
returns int
language sql
immutable
as $$
  select 3;
$$;

create or replace function public.enforce_post_highlight()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  author_type public.account_type;
  used int;
  wk date;
  lim int;
begin
  if new.is_highlighted is distinct from old.is_highlighted
     or (tg_op = 'INSERT' and new.is_highlighted) then
    if new.is_highlighted then
      select account_type into author_type
      from public.profiles
      where id = new.author_id;

      if author_type is distinct from 'organizacao' then
        raise exception 'only organization accounts can highlight posts';
      end if;

      if new.author_id is distinct from auth.uid() then
        raise exception 'cannot highlight posts for another author';
      end if;

      wk := public.week_start_utc(now());
      lim := public.highlight_weekly_limit_for(new.author_id);

      select count(*) into used
      from public.highlight_usage
      where org_id = new.author_id
        and week_start = wk;

      if used >= lim then
        raise exception 'weekly highlight limit reached';
      end if;

      new.highlighted_at := coalesce(new.highlighted_at, now());

      insert into public.highlight_usage (org_id, post_id, week_start)
      values (new.author_id, new.id, wk)
      on conflict (post_id) do nothing;
    else
      new.highlighted_at := null;
    end if;
  end if;

  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Increment profile view (security definer; any authenticated can bump others)
-- ---------------------------------------------------------------------------
create or replace function public.increment_profile_view(p_profile_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_profile_id = auth.uid() then
    return;
  end if;
  insert into public.profile_stats (profile_id, profile_views, updated_at)
  values (p_profile_id, 1, now())
  on conflict (profile_id) do update
  set
    profile_views = public.profile_stats.profile_views + 1,
    updated_at = now();
end;
$$;

grant execute on function public.increment_profile_view(uuid) to authenticated;
grant execute on function public.highlight_weekly_limit_for(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Storage: verification documents (private)
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'verification-docs',
  'verification-docs',
  false,
  10485760,
  array['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
)
on conflict (id) do nothing;

drop policy if exists "verification_docs_select_own" on storage.objects;
drop policy if exists "verification_docs_insert_own" on storage.objects;
drop policy if exists "verification_docs_delete_own" on storage.objects;

create policy "verification_docs_select_own"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'verification-docs'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "verification_docs_insert_own"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'verification-docs'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "verification_docs_delete_own"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'verification-docs'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

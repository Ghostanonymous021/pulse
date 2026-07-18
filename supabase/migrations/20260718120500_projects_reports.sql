-- Pulse: portfolio projects + reports
-- Aligns with sections 4, 9, 12.3

create table public.projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  title text not null,
  description text,
  link text,
  repo_url text,
  image_url text,
  position int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint projects_title_length check (char_length(title) between 1 and 120),
  constraint projects_description_length check (description is null or char_length(description) <= 1000),
  constraint projects_position_nonneg check (position >= 0)
);

create index projects_user_id_idx on public.projects (user_id, position);

create trigger projects_set_updated_at
  before update on public.projects
  for each row execute function public.set_updated_at();

create type public.report_target_type as enum ('post', 'profile', 'message');
create type public.report_status as enum ('open', 'reviewed', 'actioned');

create table public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.profiles (id) on delete cascade,
  target_type public.report_target_type not null,
  target_id uuid not null,
  reason text not null,
  status public.report_status not null default 'open',
  created_at timestamptz not null default now(),
  constraint reports_reason_length check (char_length(reason) between 1 and 1000)
);

create index reports_status_idx on public.reports (status, created_at desc);
create index reports_reporter_id_idx on public.reports (reporter_id);

alter table public.projects enable row level security;
alter table public.reports enable row level security;

create policy "projects_select_visible"
  on public.projects
  for select
  to authenticated
  using (
    public.can_view_post(
      user_id,
      (select p.is_private from public.profiles p where p.id = user_id)
    )
  );

create policy "projects_insert_own"
  on public.projects
  for insert
  to authenticated
  with check (user_id = auth.uid());

create policy "projects_update_own"
  on public.projects
  for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "projects_delete_own"
  on public.projects
  for delete
  to authenticated
  using (user_id = auth.uid());

create policy "reports_insert_own"
  on public.reports
  for insert
  to authenticated
  with check (reporter_id = auth.uid());

create policy "reports_select_own"
  on public.reports
  for select
  to authenticated
  using (reporter_id = auth.uid());

-- Status changes only via service role / future admin
create policy "reports_no_client_update"
  on public.reports
  for update
  to authenticated
  using (false);

create policy "reports_no_client_delete"
  on public.reports
  for delete
  to authenticated
  using (false);

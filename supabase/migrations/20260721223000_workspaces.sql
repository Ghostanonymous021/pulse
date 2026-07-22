-- Pulse: workspaces (espacos colaborativos)
-- Migracao idempotente — cria schema completo para workspaces.

-- ===========================================================================
-- 1. ENUMS
-- ===========================================================================
do $$ begin
  create type public.project_visibility as enum ('public', 'private', 'unlisted');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.project_role as enum ('owner', 'admin', 'member');
exception when duplicate_object then null;
end $$;

do $$ begin
  create type public.project_entry_type as enum ('text', 'file', 'link', 'image');
exception when duplicate_object then null;
end $$;

-- ===========================================================================
-- 2. NOTIFICATIONS tipos adicionais
-- ===========================================================================
alter type public.notification_type add value if not exists 'membro_espaco';
alter type public.notification_type add value if not exists 'entrada_espaco';

-- ===========================================================================
-- 3. PROJECTS — rename + novas colunas
-- ===========================================================================
do $$
begin
  if exists (select 1 from information_schema.columns where table_name = 'projects' and column_name = 'title') then
    alter table public.projects rename column title to name;
    alter table public.projects drop constraint if exists projects_title_length;
    alter table public.projects add constraint projects_name_length check (char_length(name) between 1 and 120);
  end if;
end $$;

alter table public.projects add column if not exists visibility public.project_visibility not null default 'public';
alter table public.projects add column if not exists type text not null default 'project';
alter table public.projects add column if not exists settings jsonb default '{}'::jsonb;
alter table public.projects add column if not exists cover_image text;

create index if not exists projects_visibility_idx on public.projects (visibility);
create index if not exists projects_type_user_idx on public.projects (type, user_id);

-- ===========================================================================
-- 4. PROJECT_MEMBERS
-- ===========================================================================
create table if not exists public.project_members (
  project_id uuid not null references public.projects (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role public.project_role not null default 'member',
  created_at timestamptz not null default now(),
  primary key (project_id, user_id)
);

create index if not exists project_members_user_idx on public.project_members (user_id);
create index if not exists project_members_project_idx on public.project_members (project_id);

alter table public.project_members enable row level security;

create policy "project_members_select"
  on public.project_members
  for select to authenticated
  using (
    user_id = auth.uid()
    or exists (
      select 1 from public.project_members pm
      where pm.project_id = project_members.project_id
        and pm.user_id = auth.uid()
        and pm.role in ('owner', 'admin')
    )
    or exists (
      select 1 from public.projects p
      where p.id = project_members.project_id
        and p.visibility in ('public', 'unlisted')
    )
  );

create policy "project_members_insert_admin"
  on public.project_members
  for insert to authenticated
  with check (
    exists (
      select 1 from public.project_members pm
      where pm.project_id = project_members.project_id
        and pm.user_id = auth.uid()
        and pm.role in ('owner', 'admin')
    )
    and project_members.role != 'owner'
  );

create policy "project_members_update_admin"
  on public.project_members
  for update to authenticated
  using (
    exists (
      select 1 from public.project_members pm
      where pm.project_id = project_members.project_id
        and pm.user_id = auth.uid()
        and pm.role = 'owner'
    )
    or (
      project_members.role != 'owner'
      and exists (
        select 1 from public.project_members pm
        where pm.project_id = project_members.project_id
          and pm.user_id = auth.uid()
          and pm.role = 'admin'
      )
    )
  )
  with check (
    exists (
      select 1 from public.project_members pm
      where pm.project_id = project_members.project_id
        and pm.user_id = auth.uid()
        and pm.role = 'owner'
    )
    or (
      project_members.role != 'owner'
      and exists (
        select 1 from public.project_members pm
        where pm.project_id = project_members.project_id
          and pm.user_id = auth.uid()
          and pm.role = 'admin'
      )
    )
  );

create policy "project_members_delete_admin"
  on public.project_members
  for delete to authenticated
  using (
    exists (
      select 1 from public.project_members pm
      where pm.project_id = project_members.project_id
        and pm.user_id = auth.uid()
        and pm.role = 'owner'
    )
    or (
      project_members.role != 'owner'
      and exists (
        select 1 from public.project_members pm
        where pm.project_id = project_members.project_id
          and pm.user_id = auth.uid()
          and pm.role = 'admin'
      )
    )
  );

-- ===========================================================================
-- 5. PROJECT_ENTRIES
-- ===========================================================================
create table if not exists public.project_entries (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  author_id uuid not null references public.profiles (id) on delete cascade,
  entry_type public.project_entry_type not null default 'text',
  body text,
  file_path text,
  file_name text,
  file_size int check (file_size is null or file_size <= 10485760),
  mime_type text,
  url text,
  link_preview_id uuid,
  position int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists project_entries_project_idx on public.project_entries (project_id, position, created_at);
create index if not exists project_entries_author_idx on public.project_entries (author_id);

alter table public.project_entries enable row level security;

create policy "project_entries_select"
  on public.project_entries
  for select to authenticated
  using (
    exists (
      select 1 from public.projects p
      where p.id = project_entries.project_id
        and (
          p.visibility in ('public', 'unlisted')
          or exists (
            select 1 from public.project_members pm
            where pm.project_id = project_entries.project_id
              and pm.user_id = auth.uid()
          )
        )
    )
  );

create policy "project_entries_insert_member"
  on public.project_entries
  for insert to authenticated
  with check (
    author_id = auth.uid()
    and exists (
      select 1 from public.project_members pm
      where pm.project_id = project_entries.project_id
        and pm.user_id = auth.uid()
        and pm.role in ('owner', 'admin', 'member')
    )
  );

create policy "project_entries_update_own_or_admin"
  on public.project_entries
  for update to authenticated
  using (
    author_id = auth.uid()
    or exists (
      select 1 from public.project_members pm
      where pm.project_id = project_entries.project_id
        and pm.user_id = auth.uid()
        and pm.role in ('owner', 'admin')
    )
  )
  with check (
    author_id = auth.uid()
    or exists (
      select 1 from public.project_members pm
      where pm.project_id = project_entries.project_id
        and pm.user_id = auth.uid()
        and pm.role in ('owner', 'admin')
    )
  );

create policy "project_entries_delete_own_or_admin"
  on public.project_entries
  for delete to authenticated
  using (
    author_id = auth.uid()
    or exists (
      select 1 from public.project_members pm
      where pm.project_id = project_entries.project_id
        and pm.user_id = auth.uid()
        and pm.role in ('owner', 'admin')
    )
  );

-- ===========================================================================
-- 6. PROJECT_STARS
-- ===========================================================================
create table if not exists public.project_stars (
  project_id uuid not null references public.projects (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (project_id, user_id)
);

create index if not exists project_stars_user_idx on public.project_stars (user_id, created_at);

alter table public.project_stars enable row level security;

create policy "project_stars_select_admin_or_self"
  on public.project_stars
  for select to authenticated
  using (
    user_id = auth.uid()
    or exists (
      select 1 from public.project_members pm
      where pm.project_id = project_stars.project_id
        and pm.user_id = auth.uid()
        and pm.role in ('owner', 'admin')
    )
  );

create policy "project_stars_insert_visible"
  on public.project_stars
  for insert to authenticated
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.projects p
      where p.id = project_stars.project_id
        and (
          p.visibility != 'private'
          or exists (
            select 1 from public.project_members pm
            where pm.project_id = project_stars.project_id
              and pm.user_id = auth.uid()
          )
        )
    )
  );

create policy "project_stars_delete_own"
  on public.project_stars
  for delete to authenticated
  using (user_id = auth.uid());

-- ===========================================================================
-- 7. PROJECT_INVITES
-- ===========================================================================
create table if not exists public.project_invites (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  invited_by uuid not null references public.profiles (id) on delete cascade,
  invitee_id uuid not null references public.profiles (id) on delete cascade,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'rejected')),
  expires_at timestamptz not null default (now() + interval '7 days'),
  created_at timestamptz not null default now(),
  unique (project_id, invitee_id)
);

create index if not exists project_invites_invitee_idx on public.project_invites (invitee_id, status);
create index if not exists project_invites_project_idx on public.project_invites (project_id);

alter table public.project_invites enable row level security;

create policy "project_invites_select"
  on public.project_invites
  for select to authenticated
  using (
    invitee_id = auth.uid()
    or exists (
      select 1 from public.project_members pm
      where pm.project_id = project_invites.project_id
        and pm.user_id = auth.uid()
        and pm.role in ('owner', 'admin')
    )
  );

create policy "project_invites_insert_admin"
  on public.project_invites
  for insert to authenticated
  with check (
    invited_by = auth.uid()
    and exists (
      select 1 from public.project_members pm
      where pm.project_id = project_invites.project_id
        and pm.user_id = auth.uid()
        and pm.role in ('owner', 'admin')
    )
    and project_invites.invitee_id != auth.uid()
  );

create policy "project_invites_update"
  on public.project_invites
  for update to authenticated
  using (
    invitee_id = auth.uid()
    or exists (
      select 1 from public.project_members pm
      where pm.project_id = project_invites.project_id
        and pm.user_id = auth.uid()
        and pm.role in ('owner', 'admin')
    )
  );

create policy "project_invites_delete"
  on public.project_invites
  for delete to authenticated
  using (
    invitee_id = auth.uid()
    or exists (
      select 1 from public.project_members pm
      where pm.project_id = project_invites.project_id
        and pm.user_id = auth.uid()
        and pm.role = 'owner'
    )
  );

-- ===========================================================================
-- 8. RLS PROJECTS atualizado
-- ===========================================================================
drop policy if exists "projects_select_visible" on public.projects;
drop policy if exists "projects_update_own" on public.projects;
drop policy if exists "projects_delete_own" on public.projects;

create policy "projects_select"
  on public.projects
  for select to authenticated
  using (
    user_id = auth.uid()
    or exists (
      select 1 from public.project_members pm
      where pm.project_id = projects.id
        and pm.user_id = auth.uid()
    )
    or projects.visibility in ('public', 'unlisted')
  );

create policy "projects_update_own_or_admin"
  on public.projects
  for update to authenticated
  using (
    user_id = auth.uid()
    or exists (
      select 1 from public.project_members pm
      where pm.project_id = projects.id
        and pm.user_id = auth.uid()
        and pm.role in ('owner', 'admin')
    )
  )
  with check (
    user_id = auth.uid()
    or exists (
      select 1 from public.project_members pm
      where pm.project_id = projects.id
        and pm.user_id = auth.uid()
        and pm.role in ('owner', 'admin')
    )
  );

create policy "projects_delete_owner"
  on public.projects
  for delete to authenticated
  using (user_id = auth.uid());

-- ===========================================================================
-- 9. FUNCOES AUXILIARES
-- ===========================================================================
create or replace function public.can_view_project(p_project_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.projects p
    where p.id = p_project_id
      and (
        exists (
          select 1 from public.project_members pm
          where pm.project_id = p_project_id
            and pm.user_id = auth.uid()
        )
        or p.visibility in ('public', 'unlisted')
      )
  );
$$;

grant execute on function public.can_view_project(uuid) to authenticated;

-- Verificar se o utilizador e membro do espaco
create or replace function public.is_project_member(p_project_id uuid, p_user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.project_members
    where project_id = p_project_id
      and user_id = p_user_id
  );
$$;

grant execute on function public.is_project_member(uuid, uuid) to authenticated;

-- Obter role do utilizador num espaco
create or replace function public.get_project_role(p_project_id uuid, p_user_id uuid default auth.uid())
returns public.project_role
language sql
stable
security definer
set search_path = public
as $$
  select role
  from public.project_members
  where project_id = p_project_id
    and user_id = p_user_id
  limit 1;
$$;

grant execute on function public.get_project_role(uuid, uuid) to authenticated;

-- ===========================================================================
-- 10. NOTIFICACOES WORKSPACE
-- ===========================================================================
create or replace function public.notify_project_members(p_project_id uuid, p_actor_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  member record;
begin
  for member in
    select pm.user_id
    from public.project_members pm
    where pm.project_id = p_project_id
      and pm.user_id != p_actor_id
  loop
    perform public.emit_notification(
      member.user_id,
      'membro_espaco',
      p_actor_id,
      p_project_id,
      false
    );
  end loop;
end;
$$;

grant execute on function public.notify_project_members(uuid, uuid) to authenticated;

-- Trigger para notificar owner+admins ao criar entrada no espaco
create or replace function public.notify_project_entry_created()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  member record;
begin
  if tg_op = 'INSERT' then
    for member in
      select pm.user_id
      from public.project_members pm
      where pm.project_id = new.project_id
        and pm.role in ('owner', 'admin')
        and pm.user_id != new.author_id
    loop
      perform public.emit_notification(
        member.user_id,
        'entrada_espaco',
        new.author_id,
        new.project_id,
        false
      );
    end loop;
  end if;
  return new;
end;
$$;

drop trigger if exists project_entry_notify on public.project_entries;
create trigger project_entry_notify
  after insert on public.project_entries
  for each row execute function public.notify_project_entry_created();

-- Trigger para adicionar owner automaticamente ao criar projecto
create or replace function public.project_owner_membership()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.project_members (project_id, user_id, role)
  values (new.id, new.user_id, 'owner')
  on conflict (project_id, user_id) do nothing;
  return new;
end;
$$;

drop trigger if exists project_owner_membership on public.projects;
create trigger project_owner_membership
  after insert on public.projects
  for each row execute function public.project_owner_membership();

-- ===========================================================================
-- 11. STORAGE: workspace-media bucket
-- ===========================================================================
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'workspace-media',
  'workspace-media',
  false,
  10485760,
  array['image/jpeg', 'image/png', 'image/webp', 'application/pdf', 'text/plain']
)
on conflict (id) do nothing;

drop policy if exists "workspace_media_select_member" on storage.objects;
drop policy if exists "workspace_media_insert_member" on storage.objects;
drop policy if exists "workspace_media_delete_member" on storage.objects;

create policy "workspace_media_select_member"
  on storage.objects for select to authenticated
  using (
    bucket_id = 'workspace-media'
    and exists (
      select 1 from public.project_members pm
      where pm.project_id = (storage.foldername(name))[1]::uuid
        and pm.user_id = auth.uid()
    )
  );

create policy "workspace_media_insert_member"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'workspace-media'
    and exists (
      select 1 from public.project_members pm
      where pm.project_id = (storage.foldername(name))[1]::uuid
        and pm.user_id = auth.uid()
        and pm.role in ('owner', 'admin', 'member')
    )
  );

create policy "workspace_media_delete_member"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'workspace-media'
    and exists (
      select 1 from public.project_members pm
      where pm.project_id = (storage.foldername(name))[1]::uuid
        and pm.user_id = auth.uid()
    )
  );

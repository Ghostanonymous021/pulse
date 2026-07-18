-- Pulse: apply all v1 migrations (safe to run on empty project)
-- Generated for remote project uwqvkrmqauvlvzvjeecb
-- Run in Supabase Dashboard > SQL Editor, or via psql with DB password

-- ========== 20260718120000_profiles.sql ==========
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


-- ========== 20260718120050_follows.sql ==========
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


-- ========== 20260718120100_posts.sql ==========
-- Pulse: posts, media, highlight helpers
-- Aligns with sections 4, 5, 12.2, 15

create table public.posts (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references public.profiles (id) on delete cascade,
  body text,
  is_highlighted boolean not null default false,
  highlighted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint posts_body_length check (body is null or char_length(body) <= 5000),
  constraint posts_has_content check (body is null or length(trim(body)) > 0)
);

create index posts_author_id_idx on public.posts (author_id);
create index posts_created_at_idx on public.posts (created_at desc);
create index posts_highlighted_idx on public.posts (is_highlighted, highlighted_at desc)
  where is_highlighted = true;

create trigger posts_set_updated_at
  before update on public.posts
  for each row execute function public.set_updated_at();

create table public.post_media (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts (id) on delete cascade,
  storage_path text not null,
  mime_type text not null,
  width int,
  height int,
  position int not null default 0,
  created_at timestamptz not null default now(),
  constraint post_media_mime check (mime_type in ('image/jpeg', 'image/png', 'image/webp', 'image/gif')),
  constraint post_media_position_nonneg check (position >= 0)
);

create index post_media_post_id_idx on public.post_media (post_id, position);

-- Weekly highlight quota (default cap: 3 per org per week)
create table public.highlight_usage (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.profiles (id) on delete cascade,
  post_id uuid not null references public.posts (id) on delete cascade,
  week_start date not null,
  created_at timestamptz not null default now(),
  constraint highlight_usage_post_unique unique (post_id)
);

create index highlight_usage_org_week_idx on public.highlight_usage (org_id, week_start);

create or replace function public.week_start_utc(ts timestamptz default now())
returns date
language sql
immutable
as $$
  select (date_trunc('week', ts at time zone 'utc'))::date;
$$;

-- Max highlights per org per ISO week (configurable later via app settings)
create or replace function public.highlight_weekly_limit()
returns int
language sql
immutable
as $$
  select 3;
$$;

create or replace function public.can_view_post(p_author_id uuid, p_is_private boolean)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    p_author_id = auth.uid()
    or not coalesce(p_is_private, false)
    or exists (
      select 1
      from public.follows f
      where f.follower_id = auth.uid()
        and f.following_id = p_author_id
        and f.status = 'accepted'
    );
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

      select count(*) into used
      from public.highlight_usage
      where org_id = new.author_id
        and week_start = wk;

      if used >= public.highlight_weekly_limit() then
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

create trigger posts_enforce_highlight
  before insert or update of is_highlighted on public.posts
  for each row execute function public.enforce_post_highlight();

alter table public.posts enable row level security;
alter table public.post_media enable row level security;
alter table public.highlight_usage enable row level security;

create policy "posts_select_visible"
  on public.posts
  for select
  to authenticated
  using (
    public.can_view_post(
      author_id,
      (select p.is_private from public.profiles p where p.id = author_id)
    )
  );

create policy "posts_insert_own"
  on public.posts
  for insert
  to authenticated
  with check (author_id = auth.uid());

create policy "posts_update_own"
  on public.posts
  for update
  to authenticated
  using (author_id = auth.uid())
  with check (author_id = auth.uid());

create policy "posts_delete_own"
  on public.posts
  for delete
  to authenticated
  using (author_id = auth.uid());

create policy "post_media_select_visible"
  on public.post_media
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.posts po
      join public.profiles pr on pr.id = po.author_id
      where po.id = post_id
        and public.can_view_post(po.author_id, pr.is_private)
    )
  );

create policy "post_media_insert_own"
  on public.post_media
  for insert
  to authenticated
  with check (
    exists (
      select 1 from public.posts po
      where po.id = post_id and po.author_id = auth.uid()
    )
  );

create policy "post_media_delete_own"
  on public.post_media
  for delete
  to authenticated
  using (
    exists (
      select 1 from public.posts po
      where po.id = post_id and po.author_id = auth.uid()
    )
  );

create policy "highlight_usage_select_own"
  on public.highlight_usage
  for select
  to authenticated
  using (org_id = auth.uid());

-- Inserts only via trigger (security definer)
create policy "highlight_usage_no_client_write"
  on public.highlight_usage
  for all
  to authenticated
  using (false)
  with check (false);


-- ========== 20260718120300_engagement.sql ==========
-- Pulse: likes + comments (ranking signals)
-- Aligns with section 15

create table public.likes (
  user_id uuid not null references public.profiles (id) on delete cascade,
  post_id uuid not null references public.posts (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, post_id)
);

create index likes_post_id_idx on public.likes (post_id);

create table public.comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts (id) on delete cascade,
  author_id uuid not null references public.profiles (id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now(),
  constraint comments_body_length check (char_length(body) between 1 and 2000)
);

create index comments_post_id_idx on public.comments (post_id, created_at);

alter table public.likes enable row level security;
alter table public.comments enable row level security;

create policy "likes_select_if_post_visible"
  on public.likes
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.posts po
      join public.profiles pr on pr.id = po.author_id
      where po.id = post_id
        and public.can_view_post(po.author_id, pr.is_private)
    )
  );

create policy "likes_insert_own_if_visible"
  on public.likes
  for insert
  to authenticated
  with check (
    user_id = auth.uid()
    and exists (
      select 1
      from public.posts po
      join public.profiles pr on pr.id = po.author_id
      where po.id = post_id
        and public.can_view_post(po.author_id, pr.is_private)
    )
  );

create policy "likes_delete_own"
  on public.likes
  for delete
  to authenticated
  using (user_id = auth.uid());

create policy "comments_select_if_post_visible"
  on public.comments
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.posts po
      join public.profiles pr on pr.id = po.author_id
      where po.id = post_id
        and public.can_view_post(po.author_id, pr.is_private)
    )
  );

create policy "comments_insert_own_if_visible"
  on public.comments
  for insert
  to authenticated
  with check (
    author_id = auth.uid()
    and exists (
      select 1
      from public.posts po
      join public.profiles pr on pr.id = po.author_id
      where po.id = post_id
        and public.can_view_post(po.author_id, pr.is_private)
    )
  );

create policy "comments_delete_own"
  on public.comments
  for delete
  to authenticated
  using (author_id = auth.uid());

create policy "comments_update_own"
  on public.comments
  for update
  to authenticated
  using (author_id = auth.uid())
  with check (author_id = auth.uid());


-- ========== 20260718120400_messages.sql ==========
-- Pulse: simple 1:1 DMs
-- Aligns with sections 8, 9, 12.2

create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now()
);

create table public.conversation_participants (
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (conversation_id, user_id)
);

create index conversation_participants_user_id_idx
  on public.conversation_participants (user_id);

create table public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  sender_id uuid not null references public.profiles (id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now(),
  constraint messages_body_length check (char_length(body) between 1 and 4000)
);

create index messages_conversation_id_idx
  on public.messages (conversation_id, created_at);

create or replace function public.is_conversation_participant(conv_id uuid, uid uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.conversation_participants cp
    where cp.conversation_id = conv_id
      and cp.user_id = uid
  );
$$;

alter table public.conversations enable row level security;
alter table public.conversation_participants enable row level security;
alter table public.messages enable row level security;

create policy "conversations_select_participant"
  on public.conversations
  for select
  to authenticated
  using (public.is_conversation_participant(id));

create policy "conversations_insert_authenticated"
  on public.conversations
  for insert
  to authenticated
  with check (true);

create policy "participants_select_if_member"
  on public.conversation_participants
  for select
  to authenticated
  using (public.is_conversation_participant(conversation_id));

create policy "participants_insert_self"
  on public.conversation_participants
  for insert
  to authenticated
  with check (
    user_id = auth.uid()
    or public.is_conversation_participant(conversation_id)
  );

create policy "messages_select_participant"
  on public.messages
  for select
  to authenticated
  using (public.is_conversation_participant(conversation_id));

create policy "messages_insert_sender_participant"
  on public.messages
  for insert
  to authenticated
  with check (
    sender_id = auth.uid()
    and public.is_conversation_participant(conversation_id)
  );


-- ========== 20260718120500_projects_reports.sql ==========
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


-- ========== 20260718120600_storage.sql ==========
-- Pulse: storage buckets + path-scoped policies
-- Aligns with sections 11, 12.3, 12.4

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  (
    'avatars',
    'avatars',
    true,
    5242880,
    array['image/jpeg', 'image/png', 'image/webp']
  ),
  (
    'post-media',
    'post-media',
    false,
    10485760,
    array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
  ),
  (
    'project-images',
    'project-images',
    true,
    5242880,
    array['image/jpeg', 'image/png', 'image/webp']
  )
on conflict (id) do nothing;

-- Avatars: public read; write only under own folder
create policy "avatars_public_read"
  on storage.objects
  for select
  to public
  using (bucket_id = 'avatars');

create policy "avatars_owner_insert"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "avatars_owner_update"
  on storage.objects
  for update
  to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "avatars_owner_delete"
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Post media: authenticated read if post visible is enforced at app/query layer;
-- storage path must start with author user id for ownership.
create policy "post_media_authenticated_read"
  on storage.objects
  for select
  to authenticated
  using (bucket_id = 'post-media');

create policy "post_media_owner_insert"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'post-media'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "post_media_owner_delete"
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'post-media'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "project_images_public_read"
  on storage.objects
  for select
  to public
  using (bucket_id = 'project-images');

create policy "project_images_owner_insert"
  on storage.objects
  for insert
  to authenticated
  with check (
    bucket_id = 'project-images'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "project_images_owner_delete"
  on storage.objects
  for delete
  to authenticated
  using (
    bucket_id = 'project-images'
    and (storage.foldername(name))[1] = auth.uid()::text
  );



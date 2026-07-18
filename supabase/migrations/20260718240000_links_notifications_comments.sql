-- Pulse: profile links, link previews, notifications, true comment trees
-- Product: links + activity + visual-flatten comments (any DB depth)

-- =============================================================================
-- 1. PROFILE LINKS
-- =============================================================================
create table if not exists public.profile_links (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references public.profiles (id) on delete cascade,
  rotulo text not null,
  url text not null,
  ordem int not null default 0,
  created_at timestamptz not null default now(),
  constraint profile_links_rotulo_len check (char_length(trim(rotulo)) between 1 and 40),
  constraint profile_links_url_len check (char_length(trim(url)) between 4 and 500),
  constraint profile_links_ordem_nonneg check (ordem >= 0)
);

create index if not exists profile_links_profile_idx
  on public.profile_links (profile_id, ordem);

-- Max 5 links per profile
create or replace function public.enforce_profile_links_limit()
returns trigger
language plpgsql
as $$
declare
  n int;
begin
  select count(*) into n
  from public.profile_links
  where profile_id = new.profile_id
    and (tg_op = 'INSERT' or id is distinct from new.id);

  if n >= 5 then
    raise exception 'maximum 5 profile links';
  end if;
  return new;
end;
$$;

drop trigger if exists profile_links_limit on public.profile_links;
create trigger profile_links_limit
  before insert on public.profile_links
  for each row execute function public.enforce_profile_links_limit();

alter table public.profile_links enable row level security;

create policy "profile_links_select_all"
  on public.profile_links for select to authenticated
  using (true);

create policy "profile_links_insert_own"
  on public.profile_links for insert to authenticated
  with check (profile_id = auth.uid());

create policy "profile_links_update_own"
  on public.profile_links for update to authenticated
  using (profile_id = auth.uid())
  with check (profile_id = auth.uid());

create policy "profile_links_delete_own"
  on public.profile_links for delete to authenticated
  using (profile_id = auth.uid());

-- =============================================================================
-- 2. LINK PREVIEWS (cached at publish time — never scrape per view)
-- =============================================================================
create table if not exists public.link_previews (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts (id) on delete cascade,
  url text not null,
  titulo text,
  imagem_url text,
  dominio text,
  fetched_at timestamptz not null default now(),
  constraint link_previews_url_len check (char_length(url) between 4 and 2000)
);

create unique index if not exists link_previews_post_url_uidx
  on public.link_previews (post_id, url);

create index if not exists link_previews_post_idx
  on public.link_previews (post_id);

alter table public.link_previews enable row level security;

-- Readable when post is visible
create policy "link_previews_select_if_post_visible"
  on public.link_previews for select to authenticated
  using (
    exists (
      select 1
      from public.posts po
      join public.profiles pr on pr.id = po.author_id
      where po.id = post_id
        and public.can_view_post(po.author_id, pr.is_private)
    )
  );

-- Author inserts/updates own post previews
create policy "link_previews_insert_author"
  on public.link_previews for insert to authenticated
  with check (
    exists (
      select 1 from public.posts po
      where po.id = post_id and po.author_id = auth.uid()
    )
  );

create policy "link_previews_update_author"
  on public.link_previews for update to authenticated
  using (
    exists (
      select 1 from public.posts po
      where po.id = post_id and po.author_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.posts po
      where po.id = post_id and po.author_id = auth.uid()
    )
  );

create policy "link_previews_delete_author"
  on public.link_previews for delete to authenticated
  using (
    exists (
      select 1 from public.posts po
      where po.id = post_id and po.author_id = auth.uid()
    )
  );

-- =============================================================================
-- 3. NOTIFICATIONS
-- =============================================================================
do $$ begin
  create type public.notification_type as enum (
    'novo_seguidor',
    'curtida',
    'comentario',
    'mensagem',
    'mencao',
    'aprovacao_modo_profissional',
    'aprovacao_verificacao'
  );
exception when duplicate_object then null;
end $$;

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references public.profiles (id) on delete cascade,
  type public.notification_type not null,
  actor_id uuid references public.profiles (id) on delete set null,
  reference_id uuid,
  -- Aggregation (likes etc.): list of actor ids + count in window
  actor_ids uuid[] not null default '{}',
  actor_count int not null default 1 check (actor_count >= 1),
  is_read boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists notifications_recipient_created_idx
  on public.notifications (recipient_id, created_at desc);

create index if not exists notifications_recipient_unread_idx
  on public.notifications (recipient_id)
  where is_read = false;

-- Open group lookup for aggregation
create index if not exists notifications_group_idx
  on public.notifications (recipient_id, type, reference_id, updated_at desc)
  where is_read = false;

alter table public.notifications enable row level security;

create policy "notifications_select_own"
  on public.notifications for select to authenticated
  using (recipient_id = auth.uid());

create policy "notifications_update_own"
  on public.notifications for update to authenticated
  using (recipient_id = auth.uid())
  with check (recipient_id = auth.uid());

-- No client insert/delete — only security definer emit
create policy "notifications_no_client_insert"
  on public.notifications for insert to authenticated
  with check (false);

create policy "notifications_no_client_delete"
  on public.notifications for delete to authenticated
  using (false);

-- Pref check + optional aggregation (6h window for curtida)
create or replace function public.emit_notification(
  p_recipient_id uuid,
  p_type public.notification_type,
  p_actor_id uuid,
  p_reference_id uuid default null,
  p_aggregate boolean default false
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  prefs public.notification_preferences%rowtype;
  allowed boolean := true;
  existing_id uuid;
  window_start timestamptz := now() - interval '6 hours';
  new_id uuid;
  ids uuid[];
begin
  if p_recipient_id is null then
    return null;
  end if;
  -- Never notify self
  if p_actor_id is not null and p_recipient_id = p_actor_id then
    return null;
  end if;

  -- Preferences (defaults true when row missing)
  select * into prefs
  from public.notification_preferences
  where user_id = p_recipient_id;

  if found then
    allowed := case p_type
      when 'novo_seguidor' then prefs.new_followers
      when 'curtida' then prefs.likes
      when 'comentario' then prefs.comments
      when 'mensagem' then prefs.messages
      when 'mencao' then prefs.mentions
      else true -- approvals always notify
    end;
  end if;

  if not allowed then
    return null;
  end if;

  -- Aggregate likes (and similar) into one row within window
  if p_aggregate and p_reference_id is not null and p_actor_id is not null then
    select n.id, n.actor_ids into existing_id, ids
    from public.notifications n
    where n.recipient_id = p_recipient_id
      and n.type = p_type
      and n.reference_id = p_reference_id
      and n.updated_at >= window_start
    order by n.updated_at desc
    limit 1
    for update;

    if existing_id is not null then
      if p_actor_id = any (ids) then
        -- Same actor again: bump timestamp, keep count
        update public.notifications
        set actor_id = p_actor_id,
            updated_at = now(),
            is_read = false
        where id = existing_id;
        return existing_id;
      end if;

      update public.notifications
      set
        actor_id = p_actor_id,
        actor_ids = array_append(ids, p_actor_id),
        actor_count = coalesce(array_length(ids, 1), 0) + 1,
        updated_at = now(),
        is_read = false,
        created_at = now() -- surface as newest
      where id = existing_id;
      return existing_id;
    end if;
  end if;

  insert into public.notifications (
    recipient_id, type, actor_id, reference_id, actor_ids, actor_count
  ) values (
    p_recipient_id,
    p_type,
    p_actor_id,
    p_reference_id,
    case when p_actor_id is not null then array[p_actor_id] else '{}' end,
    1
  )
  returning id into new_id;

  return new_id;
end;
$$;

grant execute on function public.emit_notification(uuid, public.notification_type, uuid, uuid, boolean)
  to authenticated, service_role;

-- Like → notify post author (aggregated)
create or replace function public.notify_on_like()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  author uuid;
begin
  select author_id into author from public.posts where id = new.post_id;
  perform public.emit_notification(
    author, 'curtida', new.user_id, new.post_id, true
  );
  return new;
end;
$$;

drop trigger if exists likes_notify on public.likes;
create trigger likes_notify
  after insert on public.likes
  for each row execute function public.notify_on_like();

-- Comment → post author; reply also → parent author
create or replace function public.notify_on_comment()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  post_author uuid;
  parent_author uuid;
begin
  select author_id into post_author from public.posts where id = new.post_id;
  perform public.emit_notification(
    post_author, 'comentario', new.author_id, new.post_id, false
  );

  if new.parent_id is not null then
    select author_id into parent_author
    from public.comments where id = new.parent_id;
    if parent_author is distinct from post_author then
      perform public.emit_notification(
        parent_author, 'comentario', new.author_id, new.post_id, false
      );
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists comments_notify on public.comments;
create trigger comments_notify
  after insert on public.comments
  for each row execute function public.notify_on_comment();

-- Follow accepted (or public immediate accept) → novo_seguidor
create or replace function public.notify_on_follow()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'accepted' then
    if tg_op = 'INSERT' or old.status is distinct from 'accepted' then
      perform public.emit_notification(
        new.following_id, 'novo_seguidor', new.follower_id, new.follower_id, false
      );
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists follows_notify on public.follows;
create trigger follows_notify
  after insert or update of status on public.follows
  for each row execute function public.notify_on_follow();

-- Message → other participant
create or replace function public.notify_on_message()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  other uuid;
begin
  select cp.user_id into other
  from public.conversation_participants cp
  where cp.conversation_id = new.conversation_id
    and cp.user_id is distinct from new.sender_id
  limit 1;

  if other is not null then
    perform public.emit_notification(
      other, 'mensagem', new.sender_id, new.conversation_id, false
    );
  end if;
  return new;
end;
$$;

drop trigger if exists messages_notify on public.messages;
create trigger messages_notify
  after insert on public.messages
  for each row execute function public.notify_on_message();

-- Professional approval
create or replace function public.notify_professional_decision()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'UPDATE'
     and old.status is distinct from new.status
     and new.status = 'approved'
  then
    perform public.emit_notification(
      new.profile_id,
      'aprovacao_modo_profissional',
      null,
      new.id,
      false
    );
  end if;
  return new;
end;
$$;

drop trigger if exists professional_requests_notify on public.professional_requests;
create trigger professional_requests_notify
  after update of status on public.professional_requests
  for each row execute function public.notify_professional_decision();

-- Verification activation
create or replace function public.notify_verification_active()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status is distinct from old.status and new.status = 'active' then
    perform public.emit_notification(
      new.profile_id,
      'aprovacao_verificacao',
      null,
      new.id,
      false
    );
  end if;
  return new;
end;
$$;

drop trigger if exists verification_requests_notify on public.verification_requests;
create trigger verification_requests_notify
  after update of status on public.verification_requests
  for each row execute function public.notify_verification_active();

-- Realtime: notifications table
do $$ begin
  alter publication supabase_realtime add table public.notifications;
exception
  when duplicate_object then null;
  when undefined_object then null;
end $$;

-- =============================================================================
-- 4. COMMENTS: true tree depth (no DB reparent) + reply target metadata
-- =============================================================================
alter table public.comments
  add column if not exists reply_to_username text;

comment on column public.comments.reply_to_username is
  'Author username of the comment being replied to (for visual flatten prefix).';

-- Allow any depth in data; only validate same-post + no self-loop
create or replace function public.enforce_comment_parent()
returns trigger
language plpgsql
as $$
declare
  parent_post uuid;
  parent_author uuid;
  parent_username text;
begin
  if new.parent_id is null then
    new.reply_to_username := null;
    return new;
  end if;

  if new.parent_id = new.id then
    raise exception 'comment cannot parent itself';
  end if;

  select c.post_id, c.author_id, p.username
    into parent_post, parent_author, parent_username
  from public.comments c
  join public.profiles p on p.id = c.author_id
  where c.id = new.parent_id;

  if parent_post is null then
    raise exception 'parent comment not found';
  end if;

  if parent_post is distinct from new.post_id then
    raise exception 'reply must belong to same post';
  end if;

  -- Store who is being replied to (visual "Respondendo a @x")
  new.reply_to_username := parent_username;

  return new;
end;
$$;

drop trigger if exists comments_enforce_parent on public.comments;
create trigger comments_enforce_parent
  before insert or update of parent_id, post_id on public.comments
  for each row execute function public.enforce_comment_parent();

-- Mark all as read helper
create or replace function public.mark_all_notifications_read()
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  n int;
begin
  update public.notifications
  set is_read = true, updated_at = now()
  where recipient_id = auth.uid()
    and is_read = false;
  get diagnostics n = row_count;
  return n;
end;
$$;

grant execute on function public.mark_all_notifications_read() to authenticated;

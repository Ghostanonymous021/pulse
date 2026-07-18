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

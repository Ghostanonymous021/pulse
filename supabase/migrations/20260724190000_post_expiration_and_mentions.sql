-- Pulse: publicacoes com tempo de vida opcional (expires_at) + notificacao de mencao
-- Alinhado com PULSE_VISAO_PRODUTO: existe apenas UM tipo de publicacao;
-- expires_at nulo = permanente. Nao ha cron de limpeza: a expiracao e
-- resolvida por filtro de leitura (RLS + queries), nunca por exclusao fisica
-- imediata (mantem auditabilidade e evita corrida com storage).

alter table public.posts
  add column expires_at timestamptz;

alter table public.posts
  add constraint posts_expires_after_created
  check (expires_at is null or expires_at > created_at);

-- Index parcial: acelera "listar publicacoes temporarias ainda validas"
-- sem penalizar o caso comum (permanentes), que fica fora do indice.
create index posts_expires_at_idx
  on public.posts (expires_at)
  where expires_at is not null;

-- Helper: publicacao ainda visivel do ponto de vista de expiracao.
create or replace function public.post_not_expired(p_expires_at timestamptz)
returns boolean
language sql
immutable
as $$
  select p_expires_at is null or p_expires_at > now();
$$;

-- RLS: publicacoes expiradas deixam de ser retornadas para qualquer leitor,
-- incluindo o proprio autor (nao existe "ver publicacao expirada").
drop policy if exists "posts_select_visible" on public.posts;
create policy "posts_select_visible"
  on public.posts
  for select
  to authenticated
  using (
    public.post_not_expired(expires_at)
    and public.can_view_post(
      author_id,
      (select p.is_private from public.profiles p where p.id = author_id)
    )
  );

-- post_media segue a mesma regra (junta-se a posts, que ja filtra expiracao).
drop policy if exists "post_media_select_visible" on public.post_media;
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
        and public.post_not_expired(po.expires_at)
        and public.can_view_post(po.author_id, pr.is_private)
    )
  );

-- Propaga a mesma regra de expiracao para tabelas dependentes de posts:
-- likes, comments, comment_likes e link_previews. Uma publicacao expirada
-- nao deve poder ser curtida/comentada, mesmo que o id ainda seja conhecido.
drop policy if exists "likes_select_if_post_visible" on public.likes;
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
        and public.post_not_expired(po.expires_at)
        and public.can_view_post(po.author_id, pr.is_private)
    )
  );

drop policy if exists "likes_insert_own_if_visible" on public.likes;
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
        and public.post_not_expired(po.expires_at)
        and public.can_view_post(po.author_id, pr.is_private)
    )
  );

drop policy if exists "comments_select_if_post_visible" on public.comments;
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
        and public.post_not_expired(po.expires_at)
        and public.can_view_post(po.author_id, pr.is_private)
    )
  );

drop policy if exists "comments_insert_own_if_visible" on public.comments;
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
        and public.post_not_expired(po.expires_at)
        and public.can_view_post(po.author_id, pr.is_private)
    )
  );

drop policy if exists "comment_likes_select_if_post_visible" on public.comment_likes;
create policy "comment_likes_select_if_post_visible"
  on public.comment_likes
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.comments c
      join public.posts po on po.id = c.post_id
      join public.profiles pr on pr.id = po.author_id
      where c.id = comment_id
        and public.post_not_expired(po.expires_at)
        and public.can_view_post(po.author_id, pr.is_private)
    )
  );

drop policy if exists "comment_likes_insert_own_if_visible" on public.comment_likes;
create policy "comment_likes_insert_own_if_visible"
  on public.comment_likes
  for insert
  to authenticated
  with check (
    user_id = auth.uid()
    and exists (
      select 1
      from public.comments c
      join public.posts po on po.id = c.post_id
      join public.profiles pr on pr.id = po.author_id
      where c.id = comment_id
        and public.post_not_expired(po.expires_at)
        and public.can_view_post(po.author_id, pr.is_private)
    )
  );

drop policy if exists "link_previews_select_if_post_visible" on public.link_previews;
create policy "link_previews_select_if_post_visible"
  on public.link_previews for select to authenticated
  using (
    exists (
      select 1
      from public.posts po
      join public.profiles pr on pr.id = po.author_id
      where po.id = post_id
        and public.post_not_expired(po.expires_at)
        and public.can_view_post(po.author_id, pr.is_private)
    )
  );

-- Storage: ficheiros de media de uma publicacao expirada tambem deixam de
-- ser legiveis (senao a imagem continuaria acessivel por URL direta).
drop policy if exists "post_media_select_if_visible" on storage.objects;
create policy "post_media_select_if_visible"
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'post-media'
    and (
      (storage.foldername(name))[1] = auth.uid()::text
      or (
        (storage.foldername(name))[2] ~ '^[0-9a-fA-F-]{36}$'
        and exists (
          select 1
          from public.posts po
          join public.profiles pr on pr.id = po.author_id
          where po.id = ((storage.foldername(name))[2])::uuid
            and public.post_not_expired(po.expires_at)
            and public.can_view_post(po.author_id, pr.is_private)
        )
      )
    )
  );

-- Mencoes em publicacoes: notifica apenas seguidores mutuos do autor
-- (a UI de composicao ja restringe sugestoes a quem o autor segue,
-- mas o trigger valida de novo no servidor -- nunca confiar so no cliente).
create or replace function public.notify_on_post_mentions()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  usernames text[];
  mentioned record;
begin
  if new.body is null or length(trim(new.body)) = 0 then
    return new;
  end if;

  -- Extrai @username (mesma regra de src/lib/mentions/active.ts:
  -- inicio ou apos espaco/abre-parenteses, 1-30 chars [a-z0-9._])
  select array_agg(distinct lower(m[1]))
  into usernames
  from regexp_matches(new.body, '(?:^|[\s([{])@([a-zA-Z0-9._]{1,30})\b', 'g') as m;

  if usernames is null then
    return new;
  end if;

  for mentioned in
    select p.id
    from public.profiles p
    where lower(p.username) = any(usernames)
      and p.id <> new.author_id
      and exists (
        -- so notifica quem segue o autor (mesma regra da sugestao de @)
        select 1 from public.follows f
        where f.follower_id = p.id
          and f.following_id = new.author_id
          and f.status = 'accepted'
      )
  loop
    perform public.emit_notification(
      mentioned.id, 'mencao', new.author_id, new.id, false
    );
  end loop;

  return new;
end;
$$;

drop trigger if exists posts_notify_mentions on public.posts;
create trigger posts_notify_mentions
  after insert or update of body on public.posts
  for each row execute function public.notify_on_post_mentions();

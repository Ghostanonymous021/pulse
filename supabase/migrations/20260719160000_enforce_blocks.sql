-- The blocks table existed (list UI worked) but blocking a user did
-- nothing: they could still follow you, message you, comment, like,
-- and see your posts. This wires it into the actual enforcement
-- points.

-- Central check, reused everywhere: true if there's a block in
-- either direction between me (auth.uid()) and other_id.
create or replace function public.is_blocked_either_way(other_id uuid)
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $$
  select exists (
    select 1 from public.blocks b
    where (b.blocker_id = auth.uid() and b.blocked_id = other_id)
       or (b.blocker_id = other_id and b.blocked_id = auth.uid())
  );
$$;

-- can_view_post already gates posts/comments/likes select+insert
-- everywhere -- add the block check once here and it propagates.
create or replace function public.can_view_post(p_author_id uuid, p_is_private boolean)
returns boolean
language sql
stable
security definer
set search_path to 'public'
as $$
  select
    p_author_id = auth.uid()
    or (
      not public.is_blocked_either_way(p_author_id)
      and (
        not coalesce(p_is_private, false)
        or exists (
          select 1
          from public.follows f
          where f.follower_id = auth.uid()
            and f.following_id = p_author_id
            and f.status = 'accepted'
        )
      )
    );
$$;

-- Follows: can't send/receive a follow request across a block.
-- RESTRICTIVE (not the default permissive) -- multiple permissive
-- INSERT policies combine with OR, which would make this a no-op
-- alongside follows_insert_as_follower. Restrictive policies AND
-- together with permissive ones, which is what we actually need here.
create policy "follows_insert_not_blocked"
  on public.follows
  as restrictive
  for insert
  to authenticated
  with check (not public.is_blocked_either_way(following_id));

-- DMs: can't open a new conversation across a block (existing
-- threads are handled separately below, since blocking should also
-- stop messages in an existing thread, not just new ones).
create or replace function public.get_or_create_dm(other_id uuid)
returns uuid
language plpgsql
security definer
set search_path to 'public'
as $$
    declare
      conv_id uuid;
      me uuid := auth.uid();
      other_permission text;
      other_follows_me boolean;
    begin
      if me is null then
        raise exception 'not authenticated';
      end if;
      if other_id is null or other_id = me then
        raise exception 'invalid participant';
      end if;

      if public.is_blocked_either_way(other_id) then
        raise exception 'blocked';
      end if;

      select cp1.conversation_id into conv_id
      from public.conversation_participants cp1
      join public.conversation_participants cp2
        on cp1.conversation_id = cp2.conversation_id
      where cp1.user_id = me and cp2.user_id = other_id
      limit 1;

      if conv_id is not null then
        return conv_id;
      end if;

      if not exists (select 1 from public.profiles p where p.id = other_id) then
        raise exception 'user not found';
      end if;

      select coalesce(p.dm_permission, 'everyone') into other_permission
      from public.profiles p
      where p.id = other_id;

      if other_permission = 'none' then
        raise exception 'messages_disabled';
      end if;

      if other_permission = 'following' then
        select exists (
          select 1 from public.follows f
          where f.follower_id = other_id
            and f.following_id = me
            and f.status = 'accepted'
        ) into other_follows_me;

        if not other_follows_me then
          raise exception 'messages_restricted';
        end if;
      end if;

      insert into public.conversations default values returning id into conv_id;
      insert into public.conversation_participants (conversation_id, user_id)
      values (conv_id, me), (conv_id, other_id);
      return conv_id;
    end;
    $$;

-- Existing conversations: block also stops new messages in a thread
-- that already existed before the block (not just new threads).
-- RESTRICTIVE for the same reason as follows_insert_not_blocked above.
create policy "messages_insert_not_blocked"
  on public.messages
  as restrictive
  for insert
  to authenticated
  with check (
    not exists (
      select 1
      from public.conversation_participants cp
      join public.blocks b
        on (b.blocker_id = auth.uid() and b.blocked_id = cp.user_id)
        or (b.blocker_id = cp.user_id and b.blocked_id = auth.uid())
      where cp.conversation_id = messages.conversation_id
        and cp.user_id != auth.uid()
    )
  );

-- Blocking someone also removes any existing follow relationship in
-- either direction, matching how Instagram/most apps behave.
create or replace function public.on_block_remove_follows()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $$
begin
  delete from public.follows
  where (follower_id = new.blocker_id and following_id = new.blocked_id)
     or (follower_id = new.blocked_id and following_id = new.blocker_id);
  return new;
end;
$$;

drop trigger if exists blocks_remove_follows on public.blocks;
create trigger blocks_remove_follows
  after insert on public.blocks
  for each row
  execute function public.on_block_remove_follows();

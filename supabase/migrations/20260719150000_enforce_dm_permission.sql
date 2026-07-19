-- dm_permission (everyone/following/none) exists on profiles but was
-- never enforced anywhere -- the "Mensagem" button always worked and
-- get_or_create_dm never checked it. Enforce it server-side, which is
-- the only enforcement that actually matters (client hides the button
-- too, but that alone is not security).
--
-- Existing conversations are never blocked by this -- only creation of
-- a brand new thread. Matches "ninguem novo" (none) meaning no new
-- conversations, not "delete old ones".

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

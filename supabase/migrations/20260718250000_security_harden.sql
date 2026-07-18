-- Pulse: security harden (audit P0/P1)
-- F-03: revoke EXECUTE on sensitive verification definer functions
-- F-05: tighten storage SELECT for post-media and chat-media
-- F-07: username availability without service_role

-- ---------------------------------------------------------------------------
-- F-03: Sensitive RPCs — only service_role may execute
-- ---------------------------------------------------------------------------
revoke all on function public.activate_verification(uuid) from public;
revoke all on function public.activate_verification(uuid) from anon, authenticated;
grant execute on function public.activate_verification(uuid) to service_role;

revoke all on function public.apply_verification_seal(uuid, public.account_type) from public;
revoke all on function public.apply_verification_seal(uuid, public.account_type) from anon, authenticated;
grant execute on function public.apply_verification_seal(uuid, public.account_type) to service_role;

revoke all on function public.revoke_verification(uuid) from public;
revoke all on function public.revoke_verification(uuid) from anon, authenticated;
grant execute on function public.revoke_verification(uuid) to service_role;

-- ---------------------------------------------------------------------------
-- F-07: Username check for unauthenticated signup (no service_role)
-- ---------------------------------------------------------------------------
create or replace function public.check_username_available(p_username text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select not exists (
    select 1
    from public.profiles
    where lower(username) = lower(trim(p_username))
  );
$$;

revoke all on function public.check_username_available(text) from public;
grant execute on function public.check_username_available(text) to anon, authenticated;

comment on function public.check_username_available(text) is
  'Public username availability for signup. Returns true if free. No profile rows leaked.';

-- ---------------------------------------------------------------------------
-- F-05: post-media — SELECT only if can_view_post (path: authorId/postId/file)
-- ---------------------------------------------------------------------------
drop policy if exists "post_media_authenticated_read" on storage.objects;

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
            and public.can_view_post(po.author_id, pr.is_private)
        )
      )
    )
  );

-- ---------------------------------------------------------------------------
-- F-05: chat-media — SELECT only owner path or conversation participant
-- path: userId/conversationId/messageId/file
-- ---------------------------------------------------------------------------
drop policy if exists "chat_media_select" on storage.objects;

create policy "chat_media_select_participants"
  on storage.objects
  for select
  to authenticated
  using (
    bucket_id = 'chat-media'
    and (
      (storage.foldername(name))[1] = auth.uid()::text
      or (
        (storage.foldername(name))[2] ~ '^[0-9a-fA-F-]{36}$'
        and public.is_conversation_participant(
          ((storage.foldername(name))[2])::uuid
        )
      )
    )
  );

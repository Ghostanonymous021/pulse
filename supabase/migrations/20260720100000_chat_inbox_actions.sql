-- Inbox actions: mute, archive, pin conversation (WhatsApp-style).
-- All per-participant (my mute doesn't affect the other person).

alter table public.conversation_participants
  add column if not exists muted boolean not null default false,
  add column if not exists archived_at timestamptz,
  add column if not exists pinned_at timestamptz;

-- Existing policy already covers these columns (row-scoped to
-- user_id = auth.uid(), not column-scoped) — rename only, for clarity,
-- since it now backs more than last_read_at.
drop policy if exists "participants_update_own_last_read" on public.conversation_participants;
create policy "participants_update_own"
  on public.conversation_participants
  for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create or replace function public.set_conversation_muted(conv_id uuid, value boolean)
returns void
language sql
security invoker
set search_path = public
as $$
  update public.conversation_participants
  set muted = value
  where conversation_id = conv_id
    and user_id = auth.uid();
$$;

create or replace function public.set_conversation_archived(conv_id uuid, value boolean)
returns void
language sql
security invoker
set search_path = public
as $$
  update public.conversation_participants
  set archived_at = case when value then now() else null end
  where conversation_id = conv_id
    and user_id = auth.uid();
$$;

create or replace function public.set_conversation_pinned(conv_id uuid, value boolean)
returns void
language sql
security invoker
set search_path = public
as $$
  update public.conversation_participants
  set pinned_at = case when value then now() else null end
  where conversation_id = conv_id
    and user_id = auth.uid();
$$;

grant execute on function public.set_conversation_muted(uuid, boolean) to authenticated;
grant execute on function public.set_conversation_archived(uuid, boolean) to authenticated;
grant execute on function public.set_conversation_pinned(uuid, boolean) to authenticated;

-- Muted / archived conversations don't ring the footer badge, but
-- still show bold/dot in the inbox itself (WhatsApp behaviour).
create or replace function public.unread_conversations_count()
returns integer
language sql
stable
security invoker
set search_path = public
as $$
  select count(distinct m.conversation_id)::int
  from public.messages m
  join public.conversation_participants cp
    on cp.conversation_id = m.conversation_id
   and cp.user_id = auth.uid()
  where m.sender_id != auth.uid()
    and m.created_at > cp.last_read_at
    and cp.muted = false
    and cp.archived_at is null;
$$;

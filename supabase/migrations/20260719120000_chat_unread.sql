-- Unread tracking for DMs: last_read_at per participant.

alter table public.conversation_participants
  add column if not exists last_read_at timestamptz not null default now();

create policy "participants_update_own_last_read"
  on public.conversation_participants
  for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- Marks a conversation as read for the current user (bump last_read_at to now).
create or replace function public.mark_conversation_read(conv_id uuid)
returns void
language sql
security invoker
set search_path = public
as $$
  update public.conversation_participants
  set last_read_at = now()
  where conversation_id = conv_id
    and user_id = auth.uid();
$$;

-- Count of conversations with at least one message from the other
-- participant created after my last_read_at. Used for the Mensagens
-- tab badge in the footer nav.
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
    and m.created_at > cp.last_read_at;
$$;

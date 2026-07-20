-- Delivery ticks (sent -> delivered), never "seen"/read receipts
-- (docs/UX_CHAT.md keeps read receipts + typing indicator out of v1
-- on purpose). Delivery is a weaker signal: "reached the peer's
-- client while online", tracked the same shape as last_read_at.

alter table public.conversation_participants
  add column if not exists last_delivered_at timestamptz not null default now();

create or replace function public.mark_conversation_delivered(conv_id uuid)
returns void
language sql
security invoker
set search_path = public
as $$
  update public.conversation_participants
  set last_delivered_at = now()
  where conversation_id = conv_id
    and user_id = auth.uid()
    and last_delivered_at < now();
$$;

grant execute on function public.mark_conversation_delivered(uuid) to authenticated;

-- Delete-for-me: hide a message from my own view without touching
-- the sender's copy or the other participant's (WhatsApp "Apagar
-- para mim"). Independent from deleted_at (which is "apagar para
-- todos", sender-only, already in 20260718170000_chat_whatsapp.sql).

create table if not exists public.message_hides (
  message_id uuid not null references public.messages (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  hidden_at timestamptz not null default now(),
  primary key (message_id, user_id)
);

alter table public.message_hides enable row level security;

create policy "message_hides_select_own"
  on public.message_hides for select to authenticated
  using (user_id = auth.uid());

create policy "message_hides_insert_own"
  on public.message_hides for insert to authenticated
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.messages m
      where m.id = message_id
        and public.is_conversation_participant(m.conversation_id)
    )
  );

create policy "message_hides_delete_own"
  on public.message_hides for delete to authenticated
  using (user_id = auth.uid());

-- Pinned messages: any participant can pin/unpin (WhatsApp 1:1
-- behaviour — pin is shared, not per-user). Separate table so this
-- never needs to touch messages_update_own (sender-only).

create table if not exists public.conversation_pinned_messages (
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  message_id uuid not null references public.messages (id) on delete cascade,
  pinned_by uuid not null references public.profiles (id) on delete cascade,
  pinned_at timestamptz not null default now(),
  primary key (conversation_id)
);

alter table public.conversation_pinned_messages enable row level security;

create policy "conversation_pinned_select_participant"
  on public.conversation_pinned_messages for select to authenticated
  using (public.is_conversation_participant(conversation_id));

create policy "conversation_pinned_upsert_participant"
  on public.conversation_pinned_messages for insert to authenticated
  with check (
    pinned_by = auth.uid()
    and public.is_conversation_participant(conversation_id)
    and exists (
      select 1 from public.messages m
      where m.id = message_id and m.conversation_id = conversation_pinned_messages.conversation_id
    )
  );

create policy "conversation_pinned_update_participant"
  on public.conversation_pinned_messages for update to authenticated
  using (public.is_conversation_participant(conversation_id))
  with check (
    pinned_by = auth.uid()
    and public.is_conversation_participant(conversation_id)
  );

create policy "conversation_pinned_delete_participant"
  on public.conversation_pinned_messages for delete to authenticated
  using (public.is_conversation_participant(conversation_id));

-- Forwarded flag: WhatsApp shows a small "Reencaminhada" label,
-- with no attribution to the original chat (privacy — matches how
-- WhatsApp itself treats forwards).

alter table public.messages
  add column if not exists forwarded boolean not null default false;

-- In-thread message search ("jump to message"). RLS already scopes
-- visibility (messages_select_participant) — this only adds an index
-- so ilike/trigram search on body stays fast as threads grow.

create extension if not exists pg_trgm;

create index if not exists messages_body_trgm_idx
  on public.messages using gin (body gin_trgm_ops)
  where deleted_at is null;

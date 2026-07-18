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

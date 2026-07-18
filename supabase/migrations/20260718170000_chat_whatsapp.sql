-- WhatsApp-grade DM features: reply, soft-delete, reactions, attachments

-- Soften body constraint (media-only messages allowed)
alter table public.messages
  alter column body drop not null;

alter table public.messages
  drop constraint if exists messages_body_length;

alter table public.messages
  add constraint messages_body_length
  check (body is null or char_length(body) between 1 and 4000);

alter table public.messages
  add column if not exists reply_to_id uuid references public.messages (id) on delete set null;

alter table public.messages
  add column if not exists deleted_at timestamptz;

alter table public.messages
  add column if not exists message_type text not null default 'text';

alter table public.messages
  drop constraint if exists messages_type_check;

alter table public.messages
  add constraint messages_type_check
  check (message_type in ('text', 'image', 'document', 'sticker'));

-- Must have body or will attach media (enforced in app; sticker can be body emoji)
create index if not exists messages_reply_to_id_idx on public.messages (reply_to_id);

create table if not exists public.message_attachments (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references public.messages (id) on delete cascade,
  storage_path text not null,
  mime_type text not null,
  file_name text,
  size_bytes int,
  kind text not null check (kind in ('image', 'document', 'sticker')),
  created_at timestamptz not null default now()
);

create index if not exists message_attachments_message_id_idx
  on public.message_attachments (message_id);

create table if not exists public.message_reactions (
  message_id uuid not null references public.messages (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  emoji text not null,
  created_at timestamptz not null default now(),
  primary key (message_id, user_id)
);

create index if not exists message_reactions_message_id_idx
  on public.message_reactions (message_id);

alter table public.message_attachments enable row level security;
alter table public.message_reactions enable row level security;

-- Attachments: same visibility as parent message conversation
drop policy if exists "message_attachments_select" on public.message_attachments;
drop policy if exists "message_attachments_insert" on public.message_attachments;
drop policy if exists "message_attachments_delete" on public.message_attachments;

create policy "message_attachments_select"
  on public.message_attachments for select to authenticated
  using (
    exists (
      select 1 from public.messages m
      where m.id = message_id
        and public.is_conversation_participant(m.conversation_id)
    )
  );

create policy "message_attachments_insert"
  on public.message_attachments for insert to authenticated
  with check (
    exists (
      select 1 from public.messages m
      where m.id = message_id
        and m.sender_id = auth.uid()
        and public.is_conversation_participant(m.conversation_id)
    )
  );

create policy "message_attachments_delete"
  on public.message_attachments for delete to authenticated
  using (
    exists (
      select 1 from public.messages m
      where m.id = message_id
        and m.sender_id = auth.uid()
    )
  );

drop policy if exists "message_reactions_select" on public.message_reactions;
drop policy if exists "message_reactions_insert" on public.message_reactions;
drop policy if exists "message_reactions_update" on public.message_reactions;
drop policy if exists "message_reactions_delete" on public.message_reactions;

create policy "message_reactions_select"
  on public.message_reactions for select to authenticated
  using (
    exists (
      select 1 from public.messages m
      where m.id = message_id
        and public.is_conversation_participant(m.conversation_id)
    )
  );

create policy "message_reactions_insert"
  on public.message_reactions for insert to authenticated
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.messages m
      where m.id = message_id
        and public.is_conversation_participant(m.conversation_id)
    )
  );

create policy "message_reactions_update"
  on public.message_reactions for update to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "message_reactions_delete"
  on public.message_reactions for delete to authenticated
  using (user_id = auth.uid());

-- Soft delete + edit body only by sender
drop policy if exists "messages_update_own" on public.messages;
create policy "messages_update_own"
  on public.messages for update to authenticated
  using (sender_id = auth.uid())
  with check (sender_id = auth.uid());

-- Chat storage bucket
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'chat-media',
  'chat-media',
  false,
  20971520,
  array[
    'image/jpeg', 'image/png', 'image/webp', 'image/gif',
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/plain',
    'application/zip'
  ]
)
on conflict (id) do nothing;

drop policy if exists "chat_media_select" on storage.objects;
drop policy if exists "chat_media_insert" on storage.objects;
drop policy if exists "chat_media_delete" on storage.objects;

create policy "chat_media_select"
  on storage.objects for select to authenticated
  using (bucket_id = 'chat-media');

create policy "chat_media_insert"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'chat-media'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "chat_media_delete"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'chat-media'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Link previews in chat, mirroring public.link_previews (feed posts):
-- OG fetch happens once server-side after send, never in the render
-- path, and only the sender can trigger/write it for their own
-- message. Visibility follows the same rule as the message itself
-- (conversation participant only).

create table if not exists public.message_link_previews (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null references public.messages (id) on delete cascade,
  url text not null check (char_length(url) >= 4 and char_length(url) <= 2000),
  titulo text,
  imagem_url text,
  dominio text,
  fetched_at timestamptz not null default now(),
  unique (message_id, url)
);

create index if not exists message_link_previews_message_idx
  on public.message_link_previews (message_id);

alter table public.message_link_previews enable row level security;

create policy "message_link_previews_select_if_participant"
  on public.message_link_previews for select to authenticated
  using (
    exists (
      select 1 from public.messages m
      where m.id = message_link_previews.message_id
        and public.is_conversation_participant(m.conversation_id)
    )
  );

create policy "message_link_previews_insert_sender"
  on public.message_link_previews for insert to authenticated
  with check (
    exists (
      select 1 from public.messages m
      where m.id = message_link_previews.message_id
        and m.sender_id = auth.uid()
    )
  );

create policy "message_link_previews_update_sender"
  on public.message_link_previews for update to authenticated
  using (
    exists (
      select 1 from public.messages m
      where m.id = message_link_previews.message_id
        and m.sender_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from public.messages m
      where m.id = message_link_previews.message_id
        and m.sender_id = auth.uid()
    )
  );

create policy "message_link_previews_delete_sender"
  on public.message_link_previews for delete to authenticated
  using (
    exists (
      select 1 from public.messages m
      where m.id = message_link_previews.message_id
        and m.sender_id = auth.uid()
    )
  );

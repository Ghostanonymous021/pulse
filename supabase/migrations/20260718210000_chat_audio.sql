-- Voice notes in DMs: message_type + attachment kind + storage mimes

alter table public.messages
  drop constraint if exists messages_type_check;

alter table public.messages
  add constraint messages_type_check
  check (message_type in ('text', 'image', 'document', 'sticker', 'audio'));

alter table public.message_attachments
  drop constraint if exists message_attachments_kind_check;

alter table public.message_attachments
  add constraint message_attachments_kind_check
  check (kind in ('image', 'document', 'sticker', 'audio'));

update storage.buckets
set
  allowed_mime_types = array[
    'image/jpeg', 'image/png', 'image/webp', 'image/gif',
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/plain',
    'application/zip',
    'audio/webm',
    'audio/mp4',
    'audio/mpeg',
    'audio/ogg',
    'audio/wav',
    'audio/aac',
    'audio/x-m4a',
    'audio/x-wav'
  ],
  file_size_limit = 20971520
where id = 'chat-media';

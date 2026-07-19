-- Message notifications are redundant with the Mensagens tab's own
-- unread system (last_read_at + badge, see 20260719120000_chat_unread.sql):
-- every single DM was creating its own notification row, never
-- aggregated, flooding the bell for something the inbox already
-- signals better (bold name + dot + tab badge).
--
-- Stop emitting them, and clear out existing ones so the bell isn't
-- left full of stale "enviou-te uma mensagem" entries.

drop trigger if exists messages_notify on public.messages;

delete from public.notifications where type = 'mensagem';

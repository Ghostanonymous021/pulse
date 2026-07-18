-- get_or_create_dm: Instagram/FB style open or resume 1:1 thread
-- security definer so both participants can be inserted under RLS

create or replace function public.get_or_create_dm(other_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  conv_id uuid;
  me uuid := auth.uid();
begin
  if me is null then
    raise exception 'not authenticated';
  end if;

  if other_id is null or other_id = me then
    raise exception 'invalid participant';
  end if;

  if not exists (select 1 from public.profiles p where p.id = other_id) then
    raise exception 'user not found';
  end if;

  select cp1.conversation_id into conv_id
  from public.conversation_participants cp1
  join public.conversation_participants cp2
    on cp1.conversation_id = cp2.conversation_id
  where cp1.user_id = me
    and cp2.user_id = other_id
  limit 1;

  if conv_id is not null then
    return conv_id;
  end if;

  insert into public.conversations default values
  returning id into conv_id;

  insert into public.conversation_participants (conversation_id, user_id)
  values
    (conv_id, me),
    (conv_id, other_id);

  return conv_id;
end;
$$;

revoke all on function public.get_or_create_dm(uuid) from public;
grant execute on function public.get_or_create_dm(uuid) to authenticated;

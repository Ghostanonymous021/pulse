-- Ensure phone from user_metadata is written on profile when auth.phone is empty
-- (phone provider disabled; we use confirmed email under the hood)

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  base_username text;
  final_username text;
  suffix int := 0;
  meta_phone text;
begin
  meta_phone := nullif(new.raw_user_meta_data->>'phone', '');

  base_username := coalesce(
    nullif(regexp_replace(lower(coalesce(new.raw_user_meta_data->>'username', '')), '[^a-z0-9_]', '', 'g'), ''),
    'user' || substr(replace(new.id::text, '-', ''), 1, 8)
  );

  if char_length(base_username) < 3 then
    base_username := 'user' || substr(replace(new.id::text, '-', ''), 1, 8);
  end if;

  final_username := substr(base_username, 1, 30);

  while exists (select 1 from public.profiles p where lower(p.username) = lower(final_username)) loop
    suffix := suffix + 1;
    final_username := substr(base_username, 1, 30 - char_length(suffix::text) - 1) || '_' || suffix::text;
  end loop;

  insert into public.profiles (
    id,
    phone,
    email,
    username,
    display_name,
    account_type
  ) values (
    new.id,
    coalesce(nullif(new.phone, ''), meta_phone),
    new.email,
    final_username,
    coalesce(nullif(new.raw_user_meta_data->>'display_name', ''), final_username),
    coalesce(
      (new.raw_user_meta_data->>'account_type')::public.account_type,
      'pessoa'
    )
  );

  return new;
end;
$$;

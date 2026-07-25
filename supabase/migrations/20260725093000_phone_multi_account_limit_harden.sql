-- Pulse: corrige e reforca o limite de contas por numero de telefone
-- Corrige o que ficou incompleto na alteracao anterior (aplicada sem
-- ficheiro versionado — ver nota de auditoria em
-- 20260725060000_phone_multi_account_limit.sql):
--
--   1. Limite deve ser 6 contas por numero, nao 5.
--   2. O check "conta quantos ha" + "insere" nao era atomico: sob
--      concorrencia real (dois signups quase simultaneos com o mesmo
--      numero), o limite podia ser ultrapassado. Corrigido com
--      pg_advisory_xact_lock por numero de telefone, dentro da mesma
--      transacao do signup (lock automaticamente libertado no commit/rollback).
--   3. find_accounts_by_phone tinha EXECUTE concedido a `anon`: permitia
--      enumerar contas (username, nome, foto) de qualquer numero de
--      telefone sem autenticacao nem rate limit — falha de privacidade.
--      Revogado de anon; apenas authenticated + service_role.

-- ---------------------------------------------------------------------------
-- 1) handle_new_user: limite correto (6) + lock transacional por telefone.
-- ---------------------------------------------------------------------------
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
  candidate_phone text;
  existing_phone_count int;
  phone_account_limit constant int := 6;
begin
  meta_phone := nullif(new.raw_user_meta_data->>'phone', '');
  candidate_phone := coalesce(nullif(new.phone, ''), meta_phone);

  if candidate_phone is not null then
    -- Lock por numero de telefone (hash em bigint) para tornar o
    -- count+insert atomico entre transacoes concorrentes. Libertado
    -- automaticamente no fim desta transacao (commit ou rollback).
    perform pg_advisory_xact_lock(hashtext('pulse_phone_limit:' || candidate_phone));

    select count(*) into existing_phone_count
    from public.profiles p
    where p.phone = candidate_phone;

    if existing_phone_count >= phone_account_limit then
      raise exception 'PHONE_ACCOUNT_LIMIT_REACHED: numero % ja tem % contas (limite %)',
        candidate_phone, existing_phone_count, phone_account_limit
        using errcode = 'P0001';
    end if;
  end if;

  base_username := coalesce(
    nullif(regexp_replace(lower(coalesce(new.raw_user_meta_data->>'username', '')), '[^a-z0-9._]', '', 'g'), ''),
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
    candidate_phone,
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

comment on function public.handle_new_user is
  'Cria o profile ao registar um auth.users novo. Aplica limite de 6 contas '
  'por numero de telefone (pulse.phone_account_limit), atomico via '
  'pg_advisory_xact_lock para evitar corrida entre signups concorrentes.';

-- ---------------------------------------------------------------------------
-- 2) find_accounts_by_phone: fecha a fuga de privacidade (remove anon).
--    Mantido para authenticated (ex: selector "qual conta e a tua" no
--    login, chamado depois de o utilizador provar posse do numero via
--    outro factor) e service_role (admin/scripts).
-- ---------------------------------------------------------------------------
revoke execute on function public.find_accounts_by_phone(text) from anon;
revoke execute on function public.find_accounts_by_phone(text) from public;

comment on function public.find_accounts_by_phone is
  'Lista (username, display_name, avatar_url, account_type) das contas '
  'associadas a um numero de telefone, mais antiga primeiro, max 5. '
  'EXECUTE restrito a authenticated + service_role (nunca anon) — evita '
  'enumeracao de contas por numero sem autenticacao.';

-- ---------------------------------------------------------------------------
-- 3) Documenta a decisao de produto na propria coluna (schema autoexplicativo).
-- ---------------------------------------------------------------------------
comment on column public.profiles.phone is
  'Numero de telefone (E.164). Multiplas contas por numero sao permitidas '
  'ate ao limite de 6 (aplicado em handle_new_user); nao ha mais unique '
  'constraint nesta coluna. Indice nao-unico profiles_phone_idx mantido '
  'para performance de lookup.';

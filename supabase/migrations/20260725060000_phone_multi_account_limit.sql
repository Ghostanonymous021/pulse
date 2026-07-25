-- Pulse: permitir multiplas contas por numero de telefone (decisao de produto)
-- Substitui a unicidade rigida de profiles.phone por um limite configuravel,
-- aplicado no proprio trigger de criacao de conta (handle_new_user).
--
-- NOTA DE AUDITORIA (registada a 25/07/2026 apos incidente):
-- Este ficheiro reconstroi, de forma idempotente, uma alteracao que foi
-- aplicada directamente na base de producao em 2026-07-25 06:14 UTC sem
-- ficheiro de migration versionado (violando a norma do AGENTS.md: "nunca
-- alteracao manual direta em producao"). O conteudo abaixo foi reconstruido
-- a partir da introspeccao do schema real (pg_proc, pg_indexes, pg_trigger)
-- para restaurar a trilha de auditoria; nao volta a ser executado por ser
-- idempotente e o schema_migrations ja o regista como aplicado nesta data.
-- A correcao do limite (5 -> 6) e do hardening de seguranca vive na
-- migration seguinte (20260725093000_phone_multi_account_limit_harden.sql).

-- ---------------------------------------------------------------------------
-- 1) Remove a unicidade rigida; mantem indice (nao-unico) para performance.
-- ---------------------------------------------------------------------------
drop index if exists public.profiles_phone_key;

create index if not exists profiles_phone_idx
  on public.profiles (phone)
  where phone is not null;

-- ---------------------------------------------------------------------------
-- 2) handle_new_user: aplica o limite de contas por numero no proprio
--    trigger de criacao (AFTER INSERT on auth.users), dentro da mesma
--    transacao do signup. Estado tal como aplicado no incidente (limite=5,
--    sem lock de concorrencia) — corrigido na migration seguinte.
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
  existing_phone_count int;
  phone_account_limit constant int := 5;
begin
  meta_phone := nullif(new.raw_user_meta_data->>'phone', '');

  declare
    candidate_phone text := coalesce(nullif(new.phone, ''), meta_phone);
  begin
    if candidate_phone is not null then
      select count(*) into existing_phone_count
      from public.profiles p
      where p.phone = candidate_phone;

      if existing_phone_count >= phone_account_limit then
        raise exception 'PHONE_ACCOUNT_LIMIT_REACHED: numero % ja tem % contas', candidate_phone, phone_account_limit
          using errcode = 'P0001';
      end if;
    end if;
  end;

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

-- ---------------------------------------------------------------------------
-- 3) find_accounts_by_phone: lookup para um futuro selector de conta no
--    login ("este numero tem varias contas — qual e a tua?"). Estado tal
--    como aplicado no incidente (concedido tambem a `anon`, sem RLS/rate
--    limit) — revogado de `anon` na migration seguinte por ser uma fuga de
--    privacidade (enumeracao de contas por numero sem autenticacao).
-- ---------------------------------------------------------------------------
create or replace function public.find_accounts_by_phone(p_phone text)
returns table(username text, display_name text, avatar_url text, account_type public.account_type)
language sql
stable
security definer
set search_path = public
as $$
  select p.username, p.display_name, p.avatar_url, p.account_type
  from public.profiles p
  where p.phone = p_phone
  order by p.created_at asc
  limit 5;
$$;

grant execute on function public.find_accounts_by_phone(text) to anon, authenticated, service_role;

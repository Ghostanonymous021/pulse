-- When tipo_organizacao = 'outro', require a short free-text detail.
alter table public.professional_requests
  add column if not exists tipo_detalhe text;

-- Backfill before check constraint
update public.professional_requests
set tipo_detalhe = coalesce(nullif(trim(tipo_detalhe), ''), 'Nao especificado')
where tipo_organizacao = 'outro';

update public.professional_requests
set tipo_detalhe = null
where tipo_organizacao <> 'outro'
  and tipo_detalhe is not null;

alter table public.professional_requests
  drop constraint if exists professional_requests_tipo_detalhe_check;

alter table public.professional_requests
  add constraint professional_requests_tipo_detalhe_check check (
    (
      tipo_organizacao = 'outro'
      and tipo_detalhe is not null
      and char_length(trim(tipo_detalhe)) between 2 and 80
    )
    or (
      tipo_organizacao <> 'outro'
      and (tipo_detalhe is null or char_length(trim(tipo_detalhe)) = 0)
    )
  );

comment on column public.professional_requests.tipo_detalhe is
  'Required free-text when tipo_organizacao = outro';

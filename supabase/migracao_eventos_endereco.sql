-- =============================================================
-- Migração: eventos de um dia + endereço próprio da atividade
-- Rode UMA vez no Supabase: SQL Editor → New query → cole TUDO → Run.
-- (Para quem já criou o banco com o schema.sql antigo. Pode rodar de novo sem problema.)
-- =============================================================

alter table public.turmas
  add column if not exists tipo_atividade text not null default 'continua',
  add column if not exists data_evento date,
  add column if not exists hora_inicio text,
  add column if not exists hora_fim text,
  add column if not exists endereco text not null default '',
  add column if not exists bairro text not null default '',
  add column if not exists latitude double precision,
  add column if not exists longitude double precision,
  add column if not exists precisao_localizacao text;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'turmas_tipo_atividade_check') then
    alter table public.turmas add constraint turmas_tipo_atividade_check check (tipo_atividade in ('continua','pontual'));
  end if;
  if not exists (select 1 from pg_constraint where conname = 'turmas_evento_data') then
    alter table public.turmas add constraint turmas_evento_data check (tipo_atividade <> 'pontual' or data_evento is not null);
  end if;
  if not exists (select 1 from pg_constraint where conname = 'turmas_horas_formato') then
    alter table public.turmas add constraint turmas_horas_formato check (
      (hora_inicio is null or hora_inicio ~ '^[0-2][0-9]:[0-5][0-9]$') and (hora_fim is null or hora_fim ~ '^[0-2][0-9]:[0-5][0-9]$'));
  end if;
end $$;

-- avisa a API do Supabase que a estrutura mudou
notify pgrst, 'reload schema';

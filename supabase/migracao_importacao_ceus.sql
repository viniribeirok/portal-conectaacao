-- =============================================================
-- Importação automática dos CEUs (Prefeitura de SP) — novas colunas e proteções.
-- Supabase → SQL Editor → New query → cole TUDO → Run.   (pode rodar de novo sem problema)
-- Instituições e turmas importadas ficam marcadas com origem = 'ceu_sme'; as cadastradas
-- pelo portal têm origem = 'cadastro' (valor padrão).
-- =============================================================

-- ---------------- instituições
alter table public.instituicoes add column if not exists origem        text not null default 'cadastro';
alter table public.instituicoes add column if not exists id_externo    text;          -- ex.: 'ceu-parque-do-carmo'
alter table public.instituicoes add column if not exists url_origem    text;          -- página oficial da unidade
alter table public.instituicoes add column if not exists atualizado_em timestamptz;   -- última sincronização
create unique index if not exists instituicoes_origem_idext_uq on public.instituicoes (origem, id_externo);

-- ---------------- turmas
alter table public.turmas add column if not exists origem            text not null default 'cadastro';
alter table public.turmas add column if not exists id_externo        text;
alter table public.turmas add column if not exists url_origem        text;            -- página oficial da atividade
alter table public.turmas add column if not exists atualizado_em     timestamptz;
alter table public.turmas add column if not exists horario_texto     text not null default '';  -- ex.: 'Quinta, 20h às 21h'
alter table public.turmas add column if not exists data_fim          date;            -- eventos de vários dias
alter table public.turmas add column if not exists publico_alvo      text not null default '';
alter table public.turmas add column if not exists local_na_unidade  text not null default '';  -- ex.: 'Dojô'
alter table public.turmas add column if not exists observacoes       text not null default '';  -- ex.: 'Informações na secretaria…'
alter table public.turmas add column if not exists descricao         text not null default '';

alter table public.turmas drop constraint if exists turmas_data_fim_check;
alter table public.turmas add constraint turmas_data_fim_check
  check (data_fim is null or data_evento is null or data_fim >= data_evento);

-- ---------------- proteções: só o admin mexe nos campos de origem
create or replace function public.proteger_campos_instituicao() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null and not public.eh_admin() then
    if new.status          is distinct from old.status
    or new.owner_id        is distinct from old.owner_id
    or new.motivo_recusa   is distinct from old.motivo_recusa
    or new.revisado_em     is distinct from old.revisado_em
    or new.documento_path  is distinct from old.documento_path
    or new.documento_nome  is distinct from old.documento_nome
    or new.email_contato   is distinct from old.email_contato
    or new.origem          is distinct from old.origem
    or new.id_externo      is distinct from old.id_externo
    or new.url_origem      is distinct from old.url_origem then
      raise exception 'Você não tem permissão para alterar esses campos.';
    end if;
  end if;
  return new;
end;
$$;

create or replace function public.proteger_origem_turma() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is not null and not public.eh_admin() then
    if tg_op = 'INSERT' then
      new.origem := 'cadastro'; new.id_externo := null; new.url_origem := null;
    else
      new.origem := old.origem; new.id_externo := old.id_externo; new.url_origem := old.url_origem;
    end if;
  end if;
  return new;
end;
$$;
drop trigger if exists trg_proteger_origem_turma on public.turmas;
create trigger trg_proteger_origem_turma before insert or update on public.turmas
  for each row execute function public.proteger_origem_turma();

-- ---------------- atividades já verificadas e ignoradas (só adultos, só estudantes...): evita ler a mesma página todo dia
create table if not exists public.importacao_ignoradas (
  origem        text        not null,
  id_externo    text        not null,
  motivo        text        not null,
  verificado_em timestamptz not null default now(),
  primary key (origem, id_externo)
);
alter table public.importacao_ignoradas enable row level security;  -- sem políticas: só a chave de serviço (importador) acessa

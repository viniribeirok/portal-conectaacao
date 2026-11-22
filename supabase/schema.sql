-- =============================================================
-- Portal ConectaAção — banco de dados (PostgreSQL / Supabase)
-- Como usar: Supabase → SQL Editor → New query → cole TUDO → Run.
-- Pode rodar de novo sem problema (usa "if not exists" / "drop ... if exists").
-- =============================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------- tabelas
create table if not exists public.instituicoes (
  id                   uuid primary key default gen_random_uuid(),
  owner_id             uuid references auth.users (id) on delete set null,  -- usuário (ONG) dono; null = cadastrada pelo admin
  nome                 text not null,
  tipo                 text not null check (tipo in ('ONG','CEU','Clube da Comunidade','Associação','Outro')),
  whatsapp             text not null default '',
  endereco             text not null default '',
  bairro               text not null default '',
  cep                  text not null default '',
  latitude             double precision,
  longitude            double precision,
  precisao_localizacao text,
  status               text not null default 'pendente' check (status in ('pendente','aprovada','recusada')),
  motivo_recusa        text,
  email_contato        text,
  documento_path       text,   -- caminho do arquivo no Storage (bucket "documentos")
  documento_nome       text,
  criado_em            timestamptz not null default now(),
  revisado_em          timestamptz
);

create table if not exists public.perfis (
  user_id        uuid primary key references auth.users (id) on delete cascade,
  papel          text not null check (papel in ('admin','ong')),
  instituicao_id uuid references public.instituicoes (id) on delete set null
);

create table if not exists public.turmas (
  instituicao_id uuid not null references public.instituicoes (id) on delete cascade,
  id             text not null,
  nome           text not null,
  categoria      text not null check (categoria in ('Esportes','Dança','Artes Marciais','Cultura','Reforço Escolar')),
  idade_min      int  not null check (idade_min between 0 and 99),
  idade_max      int  not null check (idade_max between 0 and 99 and idade_max >= idade_min),
  status         text not null default 'Abertas' check (status in ('Abertas','Fila de Espera','Encerradas')),
  atestado       boolean not null default false,
  historico      boolean not null default false,
  tipo_atividade text not null default 'continua' check (tipo_atividade in ('continua','pontual')),  -- continua = turma regular; pontual = evento de um dia
  data_evento    date,
  hora_inicio    text check (hora_inicio is null or hora_inicio ~ '^[0-2][0-9]:[0-5][0-9]$'),
  hora_fim       text check (hora_fim is null or hora_fim ~ '^[0-2][0-9]:[0-5][0-9]$'),
  endereco       text not null default '',   -- onde a atividade acontece (vazio = usa o endereço da instituição)
  bairro         text not null default '',
  latitude       double precision,
  longitude      double precision,
  precisao_localizacao text,
  constraint turmas_evento_data check (tipo_atividade <> 'pontual' or data_evento is not null),
  primary key (instituicao_id, id)
);

create index if not exists instituicoes_status_idx on public.instituicoes (status);
create index if not exists turmas_instituicao_idx  on public.turmas (instituicao_id);

-- ---------------------------------------------------------- permissões básicas
alter table public.instituicoes enable row level security;
alter table public.perfis       enable row level security;
alter table public.turmas       enable row level security;

grant usage on schema public to anon, authenticated;
grant select on public.instituicoes, public.turmas to anon;
grant select, insert, update, delete on public.instituicoes, public.turmas, public.perfis to authenticated;

-- ---------------------------------------------------------- funções auxiliares
create or replace function public.eh_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.perfis where user_id = auth.uid() and papel = 'admin');
$$;

-- ---------------------------------------------------------- regras (RLS)
-- INSTITUIÇÕES: qualquer pessoa vê as aprovadas; a ONG vê a própria; o admin vê tudo.
drop policy if exists instituicoes_select on public.instituicoes;
create policy instituicoes_select on public.instituicoes for select
  using (status = 'aprovada' or owner_id = auth.uid() or public.eh_admin());

-- Cadastro novo: a ONG só cria a própria e SEMPRE como "pendente" (não se aprova sozinha). Admin cria qualquer uma.
drop policy if exists instituicoes_insert on public.instituicoes;
create policy instituicoes_insert on public.instituicoes for insert to authenticated
  with check (public.eh_admin() or (owner_id = auth.uid() and status = 'pendente'));

-- Edição: o admin edita tudo; a ONG edita a própria (só depois de aprovada).
drop policy if exists instituicoes_update on public.instituicoes;
create policy instituicoes_update on public.instituicoes for update to authenticated
  using      (public.eh_admin() or (owner_id = auth.uid() and status = 'aprovada'))
  with check (public.eh_admin() or (owner_id = auth.uid() and status = 'aprovada'));

drop policy if exists instituicoes_delete on public.instituicoes;
create policy instituicoes_delete on public.instituicoes for delete to authenticated
  using (public.eh_admin());

-- A ONG só pode mudar os dados cadastrais — nunca status, dono, documento ou e-mail (só o admin).
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
    or new.email_contato   is distinct from old.email_contato then
      raise exception 'Você não tem permissão para alterar esses campos.';
    end if;
  end if;
  return new;
end;
$$;
drop trigger if exists trg_proteger_instituicao on public.instituicoes;
create trigger trg_proteger_instituicao before update on public.instituicoes
  for each row execute function public.proteger_campos_instituicao();

-- TURMAS: visíveis quando a instituição é visível; só o admin ou a ONG dona (aprovada) mexem.
drop policy if exists turmas_select on public.turmas;
create policy turmas_select on public.turmas for select
  using (exists (select 1 from public.instituicoes i where i.id = turmas.instituicao_id));

drop policy if exists turmas_escrita on public.turmas;
create policy turmas_escrita on public.turmas for all to authenticated
  using (public.eh_admin() or exists (
    select 1 from public.instituicoes i where i.id = turmas.instituicao_id and i.owner_id = auth.uid() and i.status = 'aprovada'))
  with check (public.eh_admin() or exists (
    select 1 from public.instituicoes i where i.id = turmas.instituicao_id and i.owner_id = auth.uid() and i.status = 'aprovada'));

-- PERFIS: cada pessoa vê o próprio perfil (o admin vê todos). Ao se cadastrar, a ONG cria o próprio perfil como "ong" (nunca "admin").
drop policy if exists perfis_select on public.perfis;
create policy perfis_select on public.perfis for select to authenticated
  using (user_id = auth.uid() or public.eh_admin());

drop policy if exists perfis_insert on public.perfis;
create policy perfis_insert on public.perfis for insert to authenticated
  with check (user_id = auth.uid() and papel = 'ong' and exists (
    select 1 from public.instituicoes i where i.id = perfis.instituicao_id and i.owner_id = auth.uid()));

-- ---------------------------------------------------------- documentos (Storage privado)
insert into storage.buckets (id, name, public) values ('documentos', 'documentos', false)
  on conflict (id) do nothing;

drop policy if exists documentos_enviar on storage.objects;
create policy documentos_enviar on storage.objects for insert to authenticated
  with check (bucket_id = 'documentos' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists documentos_ler on storage.objects;
create policy documentos_ler on storage.objects for select to authenticated
  using (bucket_id = 'documentos' and ((storage.foldername(name))[1] = auth.uid()::text or public.eh_admin()));

drop policy if exists documentos_apagar on storage.objects;
create policy documentos_apagar on storage.objects for delete to authenticated
  using (bucket_id = 'documentos' and public.eh_admin());

-- =============================================================
-- PRIMEIRO ADMIN — faça DEPOIS de rodar tudo acima:
--  1) Authentication → Users → Add user (e-mail + senha, marque "Auto Confirm User")
--  2) Rode o comando abaixo, trocando pelo e-mail que você criou:
--
-- insert into public.perfis (user_id, papel)
--   select id, 'admin' from auth.users where email = 'SEU-EMAIL@exemplo.org'
--   on conflict (user_id) do update set papel = 'admin';
-- =============================================================

-- =============================================================
-- Importação automática dos CEUs (Prefeitura de SP) — mesmo conteúdo de supabase/migracao_importacao_ceus.sql
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

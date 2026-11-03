-- =============================================================
-- Migração: libera idades de 0 a 99 anos nas turmas
-- (eventos de um dia podem ser para a família toda, não só crianças).
-- Rode UMA vez no Supabase: SQL Editor → New query → cole TUDO → Run.
-- Pode rodar de novo sem problema.
-- =============================================================

do $$
declare r record;
begin
  -- remove as regras antigas de idade (limite de 18 anos), seja qual for o nome delas
  for r in
    select conname from pg_constraint
    where conrelid = 'public.turmas'::regclass and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%idade_m%'
  loop
    execute format('alter table public.turmas drop constraint %I', r.conname);
  end loop;

  alter table public.turmas add constraint turmas_idades_check
    check (idade_min between 0 and 99 and idade_max between 0 and 99 and idade_max >= idade_min);
end $$;

notify pgrst, 'reload schema';

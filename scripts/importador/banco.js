import { createClient } from '@supabase/supabase-js';
import { ORIGEM } from './config.js';

const falha = (error) => {
  if (!error) return;
  if (error.code === '42703' || /column .* does not exist/i.test(error.message || '')) {
    throw new Error('O banco ainda não tem as colunas de importação. Rode supabase/migracao_importacao_ceus.sql no SQL Editor do Supabase.');
  }
  if (error.code === '42P01' || /relation .* does not exist/i.test(error.message || '')) {
    throw new Error('Falta uma tabela da importação. Rode (de novo) supabase/migracao_importacao_ceus.sql no SQL Editor do Supabase.');
  }
  throw new Error(error.message || String(error));
};

async function paginar(fabrica) {
  const linhas = [];
  for (let de = 0; ; de += 1000) {
    const { data, error } = await fabrica().range(de, de + 999);
    falha(error);
    linhas.push(...data);
    if (data.length < 1000) break;
  }
  return linhas;
}

/** Devolve um objeto com as operações de banco; `conectado` é false se faltarem as credenciais (modo de teste sem banco). */
export function criarBanco(url = process.env.SUPABASE_URL, chave = process.env.SUPABASE_SERVICE_ROLE_KEY) {
  if (!url || !chave) return { conectado: false };
  const sb = createClient(url, chave, { auth: { persistSession: false, autoRefreshToken: false } });
  return {
    conectado: true,
    async carregarExistentes() {
      const inst = await paginar(() => sb.from('instituicoes').select('id,id_externo,nome,whatsapp,endereco,bairro,cep,latitude,longitude,precisao_localizacao').eq('origem', ORIGEM));
      const turmas = await paginar(() => sb.from('turmas').select('instituicao_id,id,idade_min,idade_max,publico_alvo,local_na_unidade,observacoes,descricao').eq('origem', ORIGEM));
      return { instituicoes: new Map(inst.map((r) => [r.id_externo, r])), turmas };
    },
    async carregarIgnoradas() {
      const linhas = await paginar(() => sb.from('importacao_ignoradas').select('id_externo,motivo,verificado_em').eq('origem', ORIGEM));
      return new Map(linhas.map((r) => [r.id_externo, r]));
    },
    async gravarIgnoradas(linhas) {
      for (let i = 0; i < linhas.length; i += 200) {
        falha((await sb.from('importacao_ignoradas').upsert(linhas.slice(i, i + 200), { onConflict: 'origem,id_externo' })).error);
      }
    },
    async limparIgnoradas(ids) {
      for (let i = 0; i < ids.length; i += 100) {
        falha((await sb.from('importacao_ignoradas').delete().eq('origem', ORIGEM).in('id_externo', ids.slice(i, i + 100))).error);
      }
    },
    async gravarInstituicao(existente, dados) {
      if (existente) {
        falha((await sb.from('instituicoes').update(dados).eq('id', existente.id)).error);
        return existente.id;
      }
      const { data, error } = await sb.from('instituicoes').insert(dados).select('id').single();
      falha(error);
      return data.id;
    },
    async gravarTurmas(linhas) {
      for (let i = 0; i < linhas.length; i += 200) {
        falha((await sb.from('turmas').upsert(linhas.slice(i, i + 200), { onConflict: 'instituicao_id,id' })).error);
      }
    },
    async removerTurmas(pares) {
      const porInstituicao = new Map();
      for (const { instituicao_id: inst, id } of pares) porInstituicao.set(inst, [...(porInstituicao.get(inst) || []), id]);
      for (const [inst, ids] of porInstituicao) {
        for (let i = 0; i < ids.length; i += 100) {
          falha((await sb.from('turmas').delete().eq('instituicao_id', inst).eq('origem', ORIGEM).in('id', ids.slice(i, i + 100))).error);
        }
      }
    },
  };
}

import { supabase } from '../lib/supabase';
import { hojeISO, eventoJaPassou } from '../utils/eventos';

/**
 * Camada de dados — versão com Supabase (banco PostgreSQL online + login).
 * As telas continuam chamando as MESMAS funções de antes; só o "por dentro" mudou:
 * em vez do localStorage do navegador, lê e grava no banco compartilhado.
 * (A versão antiga em localStorage ficou em repositorioLocal.js, usada só nos testes.)
 * Quem pode ver/alterar o quê é decidido pelo banco (regras RLS em supabase/schema.sql).
 */

function dados({ data, error }) {
  if (error) throw error;
  return data;
}

// ---------------------------------------------- conversão linha do banco <-> objeto das telas
function deLinha(r) {
  return {
    id: r.id, nome: r.nome, tipo: r.tipo, whatsapp: r.whatsapp, endereco: r.endereco, bairro: r.bairro, cep: r.cep,
    latitude: r.latitude, longitude: r.longitude, precisaoLocalizacao: r.precisao_localizacao,
    status: r.status, motivoRecusa: r.motivo_recusa, emailContato: r.email_contato, ownerId: r.owner_id,
    documento: r.documento_path ? { nome: r.documento_nome, path: r.documento_path } : null,
    dataCadastro: r.criado_em, dataRevisao: r.revisado_em,
  };
}

const CAMPOS = {
  nome: 'nome', tipo: 'tipo', whatsapp: 'whatsapp', endereco: 'endereco', bairro: 'bairro', cep: 'cep',
  latitude: 'latitude', longitude: 'longitude', precisaoLocalizacao: 'precisao_localizacao',
  status: 'status', motivoRecusa: 'motivo_recusa', emailContato: 'email_contato', ownerId: 'owner_id', dataRevisao: 'revisado_em',
};

function paraLinha(campos) {
  const linha = {};
  for (const [chave, coluna] of Object.entries(CAMPOS)) {
    if (campos[chave] !== undefined) linha[coluna] = campos[chave];
  }
  if (campos.documento) {
    linha.documento_path = campos.documento.path;
    linha.documento_nome = campos.documento.nome;
  }
  return linha;
}

function deLinhaTurma(r) {
  return {
    id: r.id, nome: r.nome, categoria: r.categoria, idadeMin: r.idade_min, idadeMax: r.idade_max, status: r.status,
    atestado: r.atestado, historico: r.historico,
    tipoAtividade: r.tipo_atividade || 'continua', dataEvento: r.data_evento || '', horaInicio: r.hora_inicio || '', horaFim: r.hora_fim || '',
    endereco: r.endereco || '', bairro: r.bairro || '', latitude: r.latitude, longitude: r.longitude, precisaoLocalizacao: r.precisao_localizacao,
  };
}

function paraLinhaTurma(institucaoId, t) {
  return {
    instituicao_id: institucaoId, id: t.id, nome: t.nome, categoria: t.categoria,
    idade_min: Number(t.idadeMin), idade_max: Number(t.idadeMax), status: t.status,
    atestado: !!t.atestado, historico: !!t.historico,
    tipo_atividade: t.tipoAtividade === 'pontual' ? 'pontual' : 'continua',
    data_evento: t.tipoAtividade === 'pontual' && t.dataEvento ? t.dataEvento : null,
    hora_inicio: t.tipoAtividade === 'pontual' && t.horaInicio ? t.horaInicio : null,
    hora_fim: t.tipoAtividade === 'pontual' && t.horaFim ? t.horaFim : null,
    endereco: t.endereco || '', bairro: t.bairro || '',
    latitude: typeof t.latitude === 'number' ? t.latitude : null,
    longitude: typeof t.longitude === 'number' ? t.longitude : null,
    precisao_localizacao: t.precisaoLocalizacao || null,
  };
}

// ------------------------------------------------------- instituições --
export async function carregarTodasInstituicoes() {
  return dados(await supabase.from('instituicoes').select('*').order('nome')).map(deLinha);
}

// Só instituições com latitude e longitude numéricas aparecem no mapa e entram na ordenação por distância.
export function instituicaoTemCoordenadas(inst) {
  return typeof inst?.latitude === 'number' && typeof inst?.longitude === 'number';
}

export function instituicaoAprovada(inst) {
  return (inst.status || 'aprovada') === 'aprovada';
}

/** Admin cria direto (nasce aprovada); o cadastro público usa statusInicial='pendente'. */
export async function adicionarInstituicao(dadosNovos, statusInicial = 'aprovada') {
  const linha = { ...paraLinha(dadosNovos), status: statusInicial };
  const nova = deLinha(dados(await supabase.from('instituicoes').insert(linha).select().single()));
  const lista = await carregarTodasInstituicoes();
  return { lista, nova };
}

export async function editarInstituicao(institucaoId, campos) {
  dados(await supabase.from('instituicoes').update(paraLinha(campos)).eq('id', institucaoId));
  return carregarTodasInstituicoes();
}

/** Remove a instituição (as turmas saem junto, em cascata) e apaga o documento anexado. */
export async function removerInstituicao(institucaoId) {
  const antes = dados(await supabase.from('instituicoes').select('documento_path').eq('id', institucaoId).maybeSingle());
  dados(await supabase.from('instituicoes').delete().eq('id', institucaoId));
  if (antes?.documento_path) {
    try { await supabase.storage.from('documentos').remove([antes.documento_path]); } catch (e) { /* sem documento, tudo bem */ }
  }
  return carregarTodasInstituicoes();
}

export async function atualizarStatusInstituicao(institucaoId, novoStatus, extra = {}) {
  return editarInstituicao(institucaoId, { status: novoStatus, dataRevisao: new Date().toISOString(), ...extra });
}

// ------------------------------------------------------ perfis e documentos --
export async function carregarPerfil(userId) {
  const r = dados(await supabase.from('perfis').select('papel, instituicao_id').eq('user_id', userId).maybeSingle());
  return r ? { papel: r.papel, instituicaoId: r.instituicao_id } : null;
}

export async function criarPerfil({ userId, papel, instituicaoId }) {
  dados(await supabase.from('perfis').insert({ user_id: userId, papel, instituicao_id: instituicaoId }));
}

/** Link temporário (10 min) para abrir o documento anexado — o bucket é privado. */
export async function urlDocumento(caminho) {
  const r = dados(await supabase.storage.from('documentos').createSignedUrl(caminho, 600));
  return r.signedUrl;
}

// ------------------------------------------------------------- turmas --
export async function carregarTurmasDaInstituicao(institucaoId) {
  return dados(await supabase.from('turmas').select('*').eq('instituicao_id', institucaoId).order('nome')).map(deLinhaTurma);
}

/** Sincroniza a lista de turmas da instituição: grava as que estão na lista e apaga as que saíram dela. */
export async function salvarTurmasDaInstituicao(institucaoId, turmas) {
  const existentes = dados(await supabase.from('turmas').select('id').eq('instituicao_id', institucaoId));
  const manter = new Set(turmas.map((t) => t.id));
  const apagar = existentes.map((r) => r.id).filter((id) => !manter.has(id));
  if (turmas.length > 0) {
    dados(await supabase.from('turmas').upsert(turmas.map((t) => paraLinhaTurma(institucaoId, t)), { onConflict: 'instituicao_id,id' }));
  }
  if (apagar.length > 0) {
    dados(await supabase.from('turmas').delete().eq('instituicao_id', institucaoId).in('id', apagar));
  }
}

// --------------------------------------------------------- documentos --
/** Checklist de documentos a partir das exigências da turma (atestado médico / histórico escolar). */
export function construirDocumentos({ atestado = false, historico = false } = {}) {
  const docs = [
    { descricao: 'RG ou Certidão de Nascimento da criança', obrigatorio: true },
    { descricao: 'CPF do responsável', obrigatorio: true },
    { descricao: 'Comprovante de residência atualizado', obrigatorio: true },
  ];
  if (historico) docs.push({ descricao: 'Declaração ou histórico escolar', obrigatorio: true });
  if (atestado) docs.push({ descricao: 'Atestado médico (apto para atividade física)', obrigatorio: true });
  docs.push({ descricao: '1 foto 3x4 recente', obrigatorio: true });
  docs.push({ descricao: 'Comprovante de baixa renda / CadÚnico', obrigatorio: false });
  return docs;
}

// --------------------------------------------------- atividades (busca) --
/** Atividades de instituições APROVADAS, no formato "achatado" que a busca dos pais usa. Não precisa de login. */
export async function carregarAtividades() {
  const hoje = hojeISO();
  const linhas = dados(await supabase.from('instituicoes').select('*, turmas(*)').eq('status', 'aprovada').order('nome'));
  return linhas.flatMap((r) => {
    const inst = deLinha(r);
    return (r.turmas || [])
      .map(deLinhaTurma)
      .filter((t) => !eventoJaPassou(t, hoje)) // evento de um dia que já aconteceu não aparece na busca
      .map((t) => {
        // Endereço da atividade: o próprio da turma, se foi informado; senão, o da instituição.
        const enderecoProprio = !!(t.endereco.trim() || t.bairro.trim());
        return {
          id: `${inst.id}::${t.id}`, nome: t.nome, instituicao: inst.nome, tipo: inst.tipo, categoria: t.categoria,
          idadeMin: t.idadeMin, idadeMax: t.idadeMax,
          bairro: enderecoProprio ? t.bairro : inst.bairro,
          endereco: enderecoProprio ? t.endereco : inst.endereco,
          status: t.status, whatsapp: inst.whatsapp,
          // A posição no mapa acompanha o endereço. Se o endereço da atividade não foi localizado,
          // fica sem pino (em vez de apontar para a sede da instituição, que é outro lugar).
          latitude: enderecoProprio ? t.latitude : inst.latitude,
          longitude: enderecoProprio ? t.longitude : inst.longitude,
          tipoAtividade: t.tipoAtividade, dataEvento: t.dataEvento, horaInicio: t.horaInicio, horaFim: t.horaFim,
          // evento de um dia não tem checklist de matrícula
          documentos: t.tipoAtividade === 'pontual' ? [] : construirDocumentos(t),
        };
      });
  });
}

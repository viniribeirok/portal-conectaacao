import { storage } from '../lib/storage';
import { INSTITUICOES_SEED, TURMAS_SEED } from './instituicoes';

/**
 * Este arquivo é a ponte entre o painel de gestão e a busca dos pais.
 * As duas telas passam a ler e escrever exatamente pelas mesmas funções
 * daqui — então uma turma cadastrada no painel aparece na busca (e
 * vice-versa), desde que seja no mesmo navegador (ver README sobre os
 * limites do localStorage).
 */

// ------------------------------------------------------- instituições --
// Todas as instituições — as 18 "de fábrica" (INSTITUICOES_SEED) e as
// cadastradas depois — vivem numa lista só, editável de verdade (dá pra
// adicionar, editar e remover qualquer uma, não só as novas). Na primeira
// vez que o app roda, essa lista é "semeada" a partir de INSTITUICOES_SEED
// e passa a viver só no localStorage dali em diante.
const CHAVE_INSTITUICOES = 'instituicoes-todas';
const CHAVE_INSTITUICOES_ANTIGA = 'instituicoes-cadastradas'; // formato usado antes desta mudança

async function hidratarInstituicoes() {
  // Migração: se já existiam instituições cadastradas no formato antigo
  // (antes desta lista unificada existir), elas entram junto na semente,
  // pra não perder cadastros de teste já feitos.
  let extras = [];
  try {
    const rAntigo = await storage.get(CHAVE_INSTITUICOES_ANTIGA, false);
    extras = rAntigo ? JSON.parse(rAntigo.value) : [];
  } catch (e) { /* nada no formato antigo, segue só com a semente */ }

  const inicial = [
    ...INSTITUICOES_SEED.map((i) => ({ ...i, status: i.status || 'aprovada' })),
    ...extras,
  ];
  try { await storage.set(CHAVE_INSTITUICOES, JSON.stringify(inicial), false); } catch (e) { /* segue sem persistir */ }
  return inicial;
}

export async function carregarTodasInstituicoes() {
  try {
    const r = await storage.get(CHAVE_INSTITUICOES, false);
    return r ? JSON.parse(r.value) : await hidratarInstituicoes();
  } catch (e) {
    return await hidratarInstituicoes();
  }
}

export async function salvarTodasInstituicoes(lista) {
  await storage.set(CHAVE_INSTITUICOES, JSON.stringify(lista), false);
}

// Só instituições com latitude e longitude numéricas aparecem no mapa e
// entram na ordenação por distância.
export function instituicaoTemCoordenadas(inst) {
  return typeof inst?.latitude === 'number' && typeof inst?.longitude === 'number';
}

// Instituições sem campo `status` (não deve mais acontecer, mas por
// segurança) são tratadas como já aprovadas.
export function instituicaoAprovada(inst) {
  return (inst.status || 'aprovada') === 'aprovada';
}

/** Admin adiciona uma instituição diretamente (nasce aprovada, por padrão —
 * o admin já está vouching por ela). O cadastro público (com documento e
 * fila de aprovação) usa statusInicial='pendente' explicitamente. */
export async function adicionarInstituicao(dados, statusInicial = 'aprovada') {
  const lista = await carregarTodasInstituicoes();
  const nova = { id: `inst-${Date.now()}`, dataCadastro: new Date().toISOString(), status: statusInicial, ...dados };
  const novaLista = [...lista, nova];
  await salvarTodasInstituicoes(novaLista);
  return { lista: novaLista, nova };
}

/** Edita os dados de uma instituição já existente (admin, ou a própria
 * instituição editando os próprios dados). */
export async function editarInstituicao(institucaoId, campos) {
  const lista = await carregarTodasInstituicoes();
  const novaLista = lista.map((i) => (i.id === institucaoId ? { ...i, ...campos } : i));
  await salvarTodasInstituicoes(novaLista);
  return novaLista;
}

/** Remove uma instituição e limpa as turmas associadas a ela. */
export async function removerInstituicao(institucaoId) {
  const lista = await carregarTodasInstituicoes();
  const novaLista = lista.filter((i) => i.id !== institucaoId);
  await salvarTodasInstituicoes(novaLista);
  try { await storage.delete(`ong-turmas:${institucaoId}`, false); } catch (e) { /* não tinha turma salva, ok */ }
  return novaLista;
}

export async function atualizarStatusInstituicao(institucaoId, novoStatus, extra = {}) {
  return editarInstituicao(institucaoId, { status: novoStatus, dataRevisao: new Date().toISOString(), ...extra });
}

// ------------------------------------------------------------- turmas --
export async function carregarTurmasDaInstituicao(institucaoId) {
  try {
    const r = await storage.get(`ong-turmas:${institucaoId}`, false);
    return r ? JSON.parse(r.value) : (TURMAS_SEED[institucaoId] || []);
  } catch (e) {
    // primeira vez que essa instituição é acessada: usa a semente e já salva,
    // pra próxima leitura (de qualquer uma das duas telas) vir daqui.
    const semente = TURMAS_SEED[institucaoId] || [];
    try { await storage.set(`ong-turmas:${institucaoId}`, JSON.stringify(semente), false); } catch (e2) { /* segue sem persistir */ }
    return semente;
  }
}

export async function salvarTurmasDaInstituicao(institucaoId, turmas) {
  await storage.set(`ong-turmas:${institucaoId}`, JSON.stringify(turmas), false);
}

// --------------------------------------------------------- documentos --
/**
 * Monta o checklist de documentos a partir das exigências da turma
 * (atestado médico / histórico escolar). Mesma lógica usada no banco
 * (build_db.py) e no protótipo original do checklist.
 */
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
/**
 * Junta instituições + turmas de cada uma num formato "achatado", pronto
 * pro Portal (busca dos pais) usar — é o mesmo formato que antes vinha
 * fixo em DADOS_DO_BANCO, só que montado na hora a partir do que estiver
 * salvo (ou da semente, na primeira vez).
 */
export async function carregarAtividades() {
  const instituicoes = await carregarTodasInstituicoes();
  const aprovadas = instituicoes.filter(instituicaoAprovada);

  const listas = await Promise.all(
    aprovadas.map(async (inst) => {
      const turmas = await carregarTurmasDaInstituicao(inst.id);
      return turmas.map((t) => ({
        id: `${inst.id}::${t.id}`,
        nome: t.nome,
        instituicao: inst.nome,
        tipo: inst.tipo,
        categoria: t.categoria,
        idadeMin: t.idadeMin,
        idadeMax: t.idadeMax,
        bairro: inst.bairro,
        endereco: inst.endereco,
        status: t.status,
        whatsapp: inst.whatsapp,
        latitude: inst.latitude,
        longitude: inst.longitude,
        documentos: construirDocumentos(t),
      }));
    })
  );

  return listas.flat();
}

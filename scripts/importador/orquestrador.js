import { BASE_CEU, ORIGEM, MAX_PAGINAS_LISTAGEM } from './config.js';
import { listarUnidades, lerUnidade, listarCartoes, proximaPagina, lerAtividade } from './dom-ceu.js';
import { acharChaveDeNome, casarUnidade } from './geosampa.js';
import { montarHorarioTexto, mapearCategoria, ignorarPorCategoria } from './texto.js';

/** O que se extrai de cada tipo de página (em produção recebe o DOM; nos testes, um dublê devolve o resultado pronto). */
export const extratores = {
  unidades: (doc) => listarUnidades(doc, BASE_CEU),
  unidade: (doc) => lerUnidade(doc),
  listagem: (doc) => ({ ...listarCartoes(doc, BASE_CEU), proxima: proximaPagina(doc, BASE_CEU) }),
  atividade: (doc) => lerAtividade(doc),
};

// Motivos que não mudam com o tempo: a atividade fica registrada como "já verificada" e não é lida de novo por 30 dias.
const MOTIVOS_FIXOS = new Set(['só para adultos', 'sem faixa etária', 'restrita a estudantes ou servidores', 'reunião/formação (não é para o público)']);
const VALIDADE_IGNORADA_DIAS = 30;

export const hojeISO = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/** Esta atividade entra no portal? Só as abertas à comunidade, para crianças/adolescentes e que ainda não passaram. */
export function decidirImportacao(cartao, detalhe, hoje) {
  const q = cartao.quando?.tipo ? cartao.quando : detalhe.quando;
  if (!q || !q.tipo) return { ok: false, motivo: 'sem dia ou data informados' };
  if (ignorarPorCategoria(cartao.categorias, cartao.titulo)) return { ok: false, motivo: 'reunião/formação (não é para o público)' };
  const f = detalhe.faixa;
  if (!f || f.desconhecida) return { ok: false, motivo: 'sem faixa etária' };
  if (f.adulto || f.min > 17) return { ok: false, motivo: 'só para adultos' };
  if (detalhe.publicoAlvo && !/comunidade/i.test(detalhe.publicoAlvo)) return { ok: false, motivo: 'restrita a estudantes ou servidores' };
  if (q.tipo === 'datado' && q.fim < hoje) return { ok: false, motivo: 'já aconteceu' };
  return { ok: true, quando: q };
}

export function montarLinhaTurma({ cartao, detalhe, quando, instituicaoId, agora }) {
  const pontual = quando.tipo === 'datado';
  const h = quando.horarios[0];
  return {
    instituicao_id: instituicaoId,
    id: cartao.slugAtividade,
    nome: cartao.titulo.replace(/\s*\.\s*$/, '').trim(),
    categoria: mapearCategoria(cartao.categorias, cartao.titulo),
    idade_min: detalhe.faixa.min, idade_max: detalhe.faixa.max,
    status: 'Abertas', atestado: false, historico: false,
    tipo_atividade: pontual ? 'pontual' : 'continua',
    data_evento: pontual ? quando.inicio : null,
    data_fim: pontual && quando.fim !== quando.inicio ? quando.fim : null,
    hora_inicio: pontual && h ? h.ini : null,
    hora_fim: pontual && h && h.fim ? h.fim : null,
    endereco: '', bairro: '', latitude: null, longitude: null, precisao_localizacao: null,
    horario_texto: montarHorarioTexto(quando),
    publico_alvo: detalhe.publicoAlvo || '', local_na_unidade: detalhe.local || '', observacoes: detalhe.observacoes || '', descricao: detalhe.descricao || '',
    origem: ORIGEM, id_externo: `${cartao.slugUnidade}/${cartao.slugAtividade}`, url_origem: cartao.url, atualizado_em: agora,
  };
}

const detalheDoBanco = (r) => ({
  faixa: { min: r.idade_min, max: r.idade_max, adulto: false, desconhecida: false },
  publicoAlvo: r.publico_alvo || '', local: r.local_na_unidade || '', observacoes: r.observacoes || '', descricao: r.descricao || '',
  quando: { tipo: null }, unidade: null,
});

/** Percorre as listagens do portal (permanentes e próximas), página por página. */
async function coletarCartoes(op, deps, rel) {
  const log = deps.log;
  const todos = new Map();
  let completa = true;
  for (const tipo of ['permanente', 'proxima']) {
    let url = `${BASE_CEU}/?s=&tipo_atividade=${tipo}`;
    let pagina = 1;
    let anterior = '';
    const limitePaginas = op.paginasMax || MAX_PAGINAS_LISTAGEM;
    while (url && pagina <= limitePaginas) {
      let r;
      try {
        r = await deps.lerPagina(url, extratores.listagem, { salvarComo: pagina === 1 ? `listagem-${tipo}.html` : null });
      } catch (e) {
        if (e.codigo === 'ROBOTS') { rel.avisos.push(`O robots.txt não permite a listagem "${tipo}". Tentarei pelas páginas das unidades.`); completa = false; return { cartoes: [], completa: false, bloqueado: true }; }
        if (e.status === 404 && pagina > 1) break;
        throw e;
      }
      const novos = r.cartoes.filter((c) => !todos.has(c.url));
      for (const c of r.cartoes) todos.set(c.url, c);
      if (r.inesperados) rel.avisos.push(`${r.inesperados} cartão(ões) com estrutura inesperada (${tipo}, página ${pagina}): ${(r.detalhesInesperados || []).slice(0, 2).map((d) => `"${d.titulo}" — ${d.motivo}`).join('; ')}`);
      log(`  ${tipo}: página ${pagina} → ${r.cartoes.length} cartões (${novos.length} novos)`);
      if (novos.length === 0) break;
      const prox = r.proxima || `${BASE_CEU}/page/${pagina + 1}/?s=&tipo_atividade=${tipo}`;
      if (prox === url || prox === anterior) break;
      anterior = url; url = prox; pagina++;
    }
    if (pagina > limitePaginas) { completa = false; rel.avisos.push(`Parei na página ${limitePaginas} da listagem "${tipo}" (limite). Pode haver mais atividades.`); }
  }
  return { cartoes: [...todos.values()], completa, bloqueado: false };
}

/** Plano B: lê os cartões direto das páginas das unidades. */
async function coletarPorUnidade(unidades, deps, rel) {
  const todos = new Map();
  for (const u of unidades) {
    let url = u.url;
    let guarda = 0;
    while (url && guarda++ < 20) {
      let r;
      try { r = await deps.lerPagina(url, extratores.listagem); } catch (e) { rel.avisos.push(`Página da unidade ${u.slug}: ${e.message}`); break; }
      const novos = r.cartoes.filter((c) => !todos.has(c.url));
      for (const c of r.cartoes) todos.set(c.url, c);
      if (!novos.length || !r.proxima || r.proxima === url) break;
      url = r.proxima;
    }
  }
  return [...todos.values()];
}

export async function sincronizar(op, deps) {
  const log = deps.log;
  const banco = deps.banco;
  const agora = deps.agora ? deps.agora() : new Date();
  const hoje = hojeISO(agora);
  const rel = {
    unidades: { total: 0, comEndereco: 0, comTelefone: 0, comCoordenadasOficiais: 0, novas: 0, atualizadas: 0 },
    atividades: { noSite: 0, importaveis: 0, novas: 0, atualizadas: 0, removidas: 0, semDetalhe: 0, jaVerificadas: 0, ignoradas: {} },
    avisos: [], amostra: [],
  };

  // ------------------------------------------------ 1) unidades
  log('1/4  Unidades (CEUs)…');
  let unidades = await deps.lerPagina(`${BASE_CEU}/unidades-ceus/`, extratores.unidades, { salvarComo: 'unidades.html' });
  if (op.ceu) unidades = unidades.filter((u) => u.slug === op.ceu || u.slug === `ceu-${op.ceu}`);
  if (op.limiteUnidades) unidades = unidades.slice(0, op.limiteUnidades);
  if (!unidades.length) throw new Error('Nenhuma unidade encontrada na página "Unidades CEUs". Rode o diagnóstico (npm run importar:diagnostico).');
  log(`  ${unidades.length} unidades encontradas`);
  // a lista de unidades já traz o endereço; só abrimos a página da unidade quando faltar
  let primeiraAberta = true;
  for (const u of unidades) {
    if (u.endereco) continue;
    try {
      const d = await deps.lerPagina(u.url, extratores.unidade, { salvarComo: primeiraAberta ? 'unidade-exemplo.html' : null });
      primeiraAberta = false;
      if (d) Object.assign(u, { endereco: d.endereco, bairro: d.bairro, cep: d.cep, telefone: d.telefone || u.telefone });
    } catch (e) { rel.avisos.push(`Unidade ${u.slug}: ${e.message}`); }
  }

  // posição oficial (GeoSampa)
  let wfs = [];
  if (!op.semWfs) {
    try { wfs = await deps.carregarWFS(); log(`  GeoSampa: ${wfs.length} equipamentos recebidos`); }
    catch (e) { rel.avisos.push(`GeoSampa indisponível (${e.message}). A posição será calculada pelo endereço (OpenStreetMap).`); }
  }
  const chaveNome = acharChaveDeNome(wfs);
  for (const u of unidades) {
    const c = casarUnidade(u.slug, wfs, chaveNome);
    if (c) { u.coord = { latitude: c.latitude, longitude: c.longitude, precisao: 'endereco', fonte: 'geosampa' }; u.wfs = c.dados; }
  }

  const existentes = banco.conectado ? await banco.carregarExistentes() : null;
  const idsPorSlug = new Map(unidades.map((u) => [u.slug, existentes?.instituicoes.get(u.slug)?.id || `novo:${u.slug}`]));
  const unidadesPorSlug = new Map(unidades.map((u) => [u.slug, u]));
  rel.unidades.total = unidades.length;

  if (op.soUnidades) {
    completarComGeoSampa(unidades);
    await gravarUnidades(op, deps, unidades, existentes, idsPorSlug, rel, agora);
    return rel;
  }

  // ------------------------------------------------ 2) listagens de atividades
  log('2/4  Atividades (listagens do portal)…');
  let coleta = op.porUnidade ? { cartoes: await coletarPorUnidade(unidades, deps, rel), completa: false, bloqueado: false } : await coletarCartoes(op, deps, rel);
  if (coleta.bloqueado) coleta = { cartoes: await coletarPorUnidade(unidades, deps, rel), completa: false, bloqueado: false };
  const cartoes = coleta.cartoes.filter((c) => unidadesPorSlug.has(c.slugUnidade));
  rel.atividades.noSite = cartoes.length;
  log(`  ${cartoes.length} atividades das unidades selecionadas`);

  // ------------------------------------------------ 3) detalhes (faixa etária etc.) e decisão
  log('3/4  Detalhes e filtros…');
  const existentesTurmas = new Map((existentes?.turmas || []).map((r) => [`${r.instituicao_id}::${r.id}`, r]));
  const ignoradas = banco.conectado && banco.carregarIgnoradas ? await banco.carregarIgnoradas() : new Map();
  const novasIgnoradas = [];
  const paraLimpar = [];
  const limiteDetalhes = op.detalhesMax ?? (op.gravar ? 500 : 15);
  let consultados = 0;
  const linhas = [];
  const contarIgnorada = (m) => { rel.atividades.ignoradas[m] = (rel.atividades.ignoradas[m] || 0) + 1; };
  for (const c of cartoes) {
    const unid = unidadesPorSlug.get(c.slugUnidade);
    const idInst = idsPorSlug.get(c.slugUnidade);
    const antiga = existentesTurmas.get(`${idInst}::${c.slugAtividade}`);
    const extId = `${c.slugUnidade}/${c.slugAtividade}`;
    if (!antiga) {
      // já foi lida e recusada por um motivo que não muda (adulto, só estudantes...): não gasta leitura de página
      const ign = ignoradas.get(extId);
      if (ign && (agora - new Date(ign.verificado_em)) / 86400000 < VALIDADE_IGNORADA_DIAS) { contarIgnorada(ign.motivo); rel.atividades.jaVerificadas++; continue; }
    }
    let detalhe;
    if (antiga) detalhe = detalheDoBanco(antiga);
    else if (consultados < limiteDetalhes) {
      try {
        detalhe = await deps.lerPagina(c.url, extratores.atividade, { salvarComo: consultados === 0 ? 'atividade-exemplo.html' : null });
        consultados++;
        if (detalhe.unidade && !unid.endereco) Object.assign(unid, { endereco: detalhe.unidade.endereco, bairro: detalhe.unidade.bairro, cep: detalhe.unidade.cep, telefone: unid.telefone || detalhe.unidade.telefone });
        if (detalhe.unidade?.telefone && !unid.telefone) unid.telefone = detalhe.unidade.telefone;
      } catch (e) { rel.avisos.push(`Atividade ${c.slugUnidade}/${c.slugAtividade}: ${e.message}`); consultados++; continue; }
    } else { rel.atividades.semDetalhe++; continue; }

    const dec = decidirImportacao(c, detalhe, hoje);
    if (!dec.ok) {
      contarIgnorada(dec.motivo);
      if (MOTIVOS_FIXOS.has(dec.motivo) && !antiga) novasIgnoradas.push({ origem: ORIGEM, id_externo: extId, motivo: dec.motivo, verificado_em: agora.toISOString() });
      continue;
    }
    if (ignoradas.has(extId)) paraLimpar.push(extId);
    const linha = montarLinhaTurma({ cartao: c, detalhe, quando: dec.quando, instituicaoId: idInst, agora: agora.toISOString() });
    linhas.push(linha);
    if (rel.amostra.length < 12) rel.amostra.push({ unidade: c.slugUnidade, nome: linha.nome, categoria: linha.categoria, idades: `${linha.idade_min}–${linha.idade_max}`, quando: linha.horario_texto, tipo: linha.tipo_atividade });
  }
  rel.atividades.importaveis = linhas.length;
  if (rel.atividades.semDetalhe > 0) rel.avisos.push(`${rel.atividades.semDetalhe} atividade(s) novas ficaram para a próxima rodada (limite de ${limiteDetalhes} páginas de detalhe por execução).`);

  // ------------------------------------------------ 4) gravação (ou só relatório)
  log(op.gravar ? '4/4  Gravando no banco…' : '4/4  Resumo (modo de teste: nada será gravado)…');
  completarComGeoSampa(unidades);
  const ids = await gravarUnidades(op, deps, unidades, existentes, idsPorSlug, rel, agora);
  for (const l of linhas) l.instituicao_id = ids.get(l.id_externo.split('/')[0]) || l.instituicao_id;

  const chave = (l) => `${l.instituicao_id}::${l.id}`;
  rel.atividades.novas = linhas.filter((l) => !existentesTurmas.has(chave(l))).length;
  rel.atividades.atualizadas = linhas.length - rel.atividades.novas;

  const manter = new Set(linhas.map(chave));
  const processadas = new Set([...idsPorSlug.values()]);
  const ausentes = (existentes?.turmas || []).filter((r) => processadas.has(r.instituicao_id) && !manter.has(`${r.instituicao_id}::${r.id}`));
  const guardaOk = coleta.completa || op.forcarRemocao;
  const excessivo = existentes && existentes.turmas.length >= 20 && ausentes.length > existentes.turmas.length * 0.5 && !op.forcarRemocao;
  if (ausentes.length && !guardaOk) rel.avisos.push(`${ausentes.length} atividade(s) não apareceram, mas a coleta não foi completa — nada foi removido.`);
  else if (ausentes.length && excessivo) rel.avisos.push(`${ausentes.length} atividade(s) sumiriam de uma vez (mais da metade). Parece falha na coleta — nada foi removido. Use --forcar-remocao se for esperado.`);
  const remover = guardaOk && !excessivo ? ausentes : [];
  rel.atividades.removidas = remover.length;

  if (op.gravar && banco.conectado) {
    if (linhas.length) await banco.gravarTurmas(linhas);
    if (remover.length) await banco.removerTurmas(remover.map((r) => ({ instituicao_id: r.instituicao_id, id: r.id })));
    if (novasIgnoradas.length && banco.gravarIgnoradas) await banco.gravarIgnoradas(novasIgnoradas);
    if (paraLimpar.length && banco.limparIgnoradas) await banco.limparIgnoradas(paraLimpar);
  }
  return rel;
}

/** O que o portal dos CEUs não informou (endereço, telefone), o GeoSampa completa. */
function completarComGeoSampa(unidades) {
  for (const u of unidades) {
    if (!u.wfs) continue;
    if (!u.endereco && u.wfs.endereco) { u.endereco = u.wfs.endereco; u.bairro = u.bairro || u.wfs.bairro; u.cep = u.cep || u.wfs.cep; }
    if (!u.telefone && u.wfs.telefone) u.telefone = u.wfs.telefone;
  }
}

async function gravarUnidades(op, deps, unidades, existentes, idsPorSlug, rel, agora) {
  const banco = deps.banco;
  const ids = new Map(idsPorSlug);
  for (const u of unidades) {
    if (u.endereco) rel.unidades.comEndereco++;
    if (u.telefone) rel.unidades.comTelefone++;
    if (u.coord?.fonte === 'geosampa') rel.unidades.comCoordenadasOficiais++;
    const antiga = existentes?.instituicoes.get(u.slug);
    if (antiga) rel.unidades.atualizadas++; else rel.unidades.novas++;
    if (!op.gravar || !banco.conectado) continue;

    const endMudou = antiga && (antiga.endereco !== (u.endereco || '') || antiga.cep !== (u.cep || ''));
    let coord = u.coord;
    if (!coord && antiga?.latitude != null && !endMudou) coord = { latitude: antiga.latitude, longitude: antiga.longitude, precisao: antiga.precisao_localizacao };
    if (!coord && u.endereco && deps.geocodificar) {
      const g = await deps.geocodificar({ endereco: u.endereco, bairro: u.bairro, cep: u.cep });
      if (g) coord = { latitude: g.latitude, longitude: g.longitude, precisao: g.precisao };
      else rel.avisos.push(`Sem posição no mapa para ${u.slug} (endereço não localizado).`);
    }
    const dados = {
      nome: u.nome, tipo: 'CEU', whatsapp: u.telefone || antiga?.whatsapp || '',
      endereco: u.endereco || antiga?.endereco || '', bairro: u.bairro || antiga?.bairro || '', cep: u.cep || antiga?.cep || '',
      latitude: coord?.latitude ?? null, longitude: coord?.longitude ?? null, precisao_localizacao: coord?.precisao ?? null,
      origem: ORIGEM, id_externo: u.slug, url_origem: u.url, atualizado_em: agora.toISOString(),
    };
    if (!antiga) Object.assign(dados, { status: 'aprovada', owner_id: null });
    ids.set(u.slug, await banco.gravarInstituicao(antiga || null, dados));
  }
  return ids;
}

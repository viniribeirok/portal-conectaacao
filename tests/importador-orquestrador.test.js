import { describe, it, expect } from 'vitest';
import { sincronizar, decidirImportacao, montarLinhaTurma } from '../scripts/importador/orquestrador.js';

const B = 'https://ceu.sme.prefeitura.sp.gov.br';
const q = (tipo, extra = {}) => ({ tipo, dias: [], inicio: null, fim: null, horarios: [], horarioBruto: '', ...extra });
const permanente = (dia, ini, fim, bruto) => q('permanente', { dias: [dia], horarios: [{ ini, fim }], horarioBruto: bruto });
const datado = (inicio, fim, ini, fimH, bruto) => q('datado', { inicio, fim, horarios: ini ? [{ ini, fim: fimH }] : [], horarioBruto: bruto });
const cartao = (unid, slug, titulo, categorias, quando) => ({ url: `${B}/${unid}/${slug}/`, slugUnidade: unid, slugAtividade: slug, titulo, categorias, unidadeUrl: `${B}/unidade/${unid}/`, unidadeNome: unid, quando });
const faixa = (min, max, adulto = false) => ({ min, max, adulto, desconhecida: false });

const CARTOES = [
  cartao('ceu-parque-do-carmo', 'muay-thay', 'Muay Thay', ['Artes Marciais e Lutas'], permanente('Quinta', '20:00', '21:00', '20h às 21h')),
  cartao('ceu-parque-do-carmo', 'futsal-60', 'Futsal', ['Atividades Coletivas com bola'], permanente('Quinta', '15:00', '16:00', '15h às 16h')),
  cartao('ceu-taipas', 'baile-2', 'Baile da Consciência Negra.', ['Dança'], datado('2026-11-20', '2026-11-20', '11:00', '17:00', '11h às 17h')),
  cartao('ceu-carrao', 'games', 'Curso de desenvolvimento de games', [], datado('2026-11-02', '2026-11-20', '14:00', '17:00', '14h às 17h')),
  cartao('ceu-taipas', 'show-passado', 'Show antigo', ['Atividades Culturais'], datado('2026-11-10', '2026-11-10', '10:00', null, '10h')),
  cartao('ceu-taipas', 'reuniao-1', 'Reunião do conselho', ['Reunião'], datado('2026-11-25', '2026-11-25', '19:00', null, '19h')),
  cartao('ceu-taipas', 'aula-escola', 'Aula da escola', ['Atividades Culturais'], permanente('Segunda', '08:00', '09:00', '8h às 09h')),
  cartao('ceu-fora', 'outra', 'Atividade de unidade não selecionada', [], permanente('Sexta', '10:00', '11:00', '10h às 11h')),
];
const DETALHES = {
  'futsal-60': { faixa: faixa(6, 12), publicoAlvo: 'Comunidade', local: 'Quadra', observacoes: '', descricao: '', quando: q(null), unidade: null },
  'muay-thay': { faixa: faixa(18, 99, true), publicoAlvo: 'Comunidade', local: 'Dojô', observacoes: '', descricao: '', quando: q(null), unidade: null },
  'baile-2': { faixa: faixa(0, 99), publicoAlvo: 'Comunidade', local: 'Pátio', observacoes: 'Entrada gratuita', descricao: 'Baile', quando: q(null), unidade: null },
  games: { faixa: faixa(12, 17), publicoAlvo: 'Estudantes e Comunidade', local: '', observacoes: '', descricao: '', quando: q(null), unidade: null },
  'show-passado': { faixa: faixa(0, 99), publicoAlvo: 'Comunidade', local: '', observacoes: '', descricao: '', quando: q(null), unidade: null },
  'reuniao-1': { faixa: faixa(0, 99), publicoAlvo: 'Comunidade', local: '', observacoes: '', descricao: '', quando: q(null), unidade: null },
  'aula-escola': { faixa: faixa(6, 10), publicoAlvo: 'Estudantes da EMEF', local: '', observacoes: '', descricao: '', quando: q(null), unidade: null },
};

function montarDeps({ banco, wfs = true }) {
  const chamadas = { paginas: [], geocodificar: 0 };
  const deps = {
    log: () => {},
    agora: () => new Date(2026, 10, 18, 12, 0, 0), // 18/11/2026
    banco,
    carregarWFS: async () => {
      if (!wfs) throw new Error('fora do ar');
      const props = (nome) => ({ nm_classe_equipamento: 'CEU', nm_equipamento: nome, tx_numero_telefone: '23014801', tx_endereco_equipamento: 'RUA DO GEOSAMPA, 1', cd_cep_equipamento: '01000-000', nm_bairro_equipamento: 'CENTRO' });
      return [
        { props: props('CEU CEI PARQUE DO CARMO - JOÃO CÂNDIDO'), latitude: -23.58, longitude: -46.46 },
        { props: props('CEU EMEF TAIPAS'), latitude: -23.49, longitude: -46.74 },
        { props: props('CEU EMEI CARRAO'), latitude: -23.55, longitude: -46.55 },
      ];
    },
    geocodificar: async () => { chamadas.geocodificar++; return { latitude: -23.5, longitude: -46.5, precisao: 'rua' }; },
    lerPagina: async (url) => {
      chamadas.paginas.push(url);
      // a lista de unidades já traz nome e endereço (menos o Carrão, para exercitar a leitura da página da unidade)
      if (url.endsWith('/unidades-ceus/')) return [
        { slug: 'ceu-parque-do-carmo', url: `${B}/unidade/ceu-parque-do-carmo/`, nome: 'CEU Parque do Carmo – João Cândido (Almirante Negro)', endereco: 'Rua A, 10', bairro: 'Bairro X', cep: '08270-000' },
        { slug: 'ceu-taipas', url: `${B}/unidade/ceu-taipas/`, nome: 'CEU Taipas', endereco: 'Rua B, 20', bairro: 'Bairro Y', cep: '02000-000' },
        { slug: 'ceu-carrao', url: `${B}/unidade/ceu-carrao/`, nome: 'CEU Carrão', endereco: '', bairro: '', cep: '' },
      ];
      if (url.includes('/unidade/')) return { nome: '', endereco: 'Rua C, 30', bairro: 'Bairro Z', cep: '03000-000', telefone: '551122223333' };
      if (url.includes('tipo_atividade=permanente') && !url.includes('/page/')) return { cartoes: CARTOES.slice(0, 2), inesperados: 0, proxima: `${B}/page/2/?s=&tipo_atividade=permanente` };
      if (url.includes('/page/2/') && url.includes('permanente')) return { cartoes: CARTOES.slice(6, 8), inesperados: 0, proxima: null };
      if (url.includes('tipo_atividade=proxima') && !url.includes('/page/')) return { cartoes: CARTOES.slice(2, 6), inesperados: 0, proxima: null };
      const slug = url.split('/').filter(Boolean).pop();
      if (DETALHES[slug]) return DETALHES[slug];
      if (url.includes('/page/')) { const e = new Error('HTTP 404'); e.status = 404; throw e; }
      throw new Error(`url inesperada no teste: ${url}`);
    },
  };
  return { deps, chamadas };
}

describe('decisão de importação', () => {
  const hoje = '2026-11-18';
  const c = CARTOES[1];
  it('aceita atividade para criança aberta à comunidade', () => expect(decidirImportacao(c, { faixa: faixa(6, 12), publicoAlvo: 'Comunidade', quando: q(null) }, hoje).ok).toBe(true));
  it('recusa atividade só de adultos', () => expect(decidirImportacao(c, { faixa: faixa(18, 99, true), publicoAlvo: '', quando: q(null) }, hoje).motivo).toBe('só para adultos'));
  it('recusa quando não há faixa etária', () => expect(decidirImportacao(c, { faixa: { desconhecida: true }, publicoAlvo: '', quando: q(null) }, hoje).motivo).toBe('sem faixa etária'));
  it('recusa evento que já passou', () => expect(decidirImportacao(CARTOES[4], DETALHES['show-passado'], hoje).motivo).toBe('já aconteceu'));
  it('mantém curso em andamento (termina depois de hoje)', () => expect(decidirImportacao(CARTOES[3], DETALHES.games, hoje).ok).toBe(true));
});

describe('linha da turma', () => {
  it('evento de um dia com horário', () => {
    const l = montarLinhaTurma({ cartao: CARTOES[2], detalhe: DETALHES['baile-2'], quando: CARTOES[2].quando, instituicaoId: 'x', agora: 'agora' });
    expect(l).toMatchObject({ id: 'baile-2', nome: 'Baile da Consciência Negra', categoria: 'Dança', tipo_atividade: 'pontual', data_evento: '2026-11-20', data_fim: null, hora_inicio: '11:00', hora_fim: '17:00', idade_min: 0, idade_max: 99, origem: 'ceu_sme', id_externo: 'ceu-taipas/baile-2', horario_texto: '20/11/2026, 11h às 17h' });
  });
  it('curso de vários dias', () => {
    const l = montarLinhaTurma({ cartao: CARTOES[3], detalhe: DETALHES.games, quando: CARTOES[3].quando, instituicaoId: 'x', agora: 'agora' });
    expect(l).toMatchObject({ categoria: 'Reforço Escolar', data_evento: '2026-11-02', data_fim: '2026-11-20', horario_texto: '02/11/2026 a 20/11/2026, 14h às 17h' });
  });
  it('turma contínua não tem data nem hora marcada', () => {
    const l = montarLinhaTurma({ cartao: CARTOES[1], detalhe: { faixa: faixa(6, 12), publicoAlvo: 'Comunidade', local: '', observacoes: '', descricao: '' }, quando: CARTOES[1].quando, instituicaoId: 'x', agora: 'agora' });
    expect(l).toMatchObject({ tipo_atividade: 'continua', data_evento: null, hora_inicio: null, horario_texto: 'Quinta, 15h às 16h', status: 'Abertas' });
  });
});


function bancoFalso({ instituicoes = [], turmas = [], ignoradas = [] } = {}) {
  const reg = { inst: [], turmas: [], removidas: null, ignoradas: [], limpas: [] };
  return {
    reg, conectado: true,
    carregarExistentes: async () => ({ instituicoes: new Map(instituicoes.map((r) => [r.id_externo, r])), turmas }),
    gravarInstituicao: async (existente, dados) => { reg.inst.push({ existente, dados }); return existente ? existente.id : `uuid-${dados.id_externo}`; },
    gravarTurmas: async (linhas) => { reg.turmas.push(...linhas); },
    removerTurmas: async (pares) => { reg.removidas = pares; },
    carregarIgnoradas: async () => new Map(ignoradas.map((r) => [r.id_externo, r])),
    gravarIgnoradas: async (linhas) => { reg.ignoradas.push(...linhas); },
    limparIgnoradas: async (ids) => { reg.limpas.push(...ids); },
  };
}
const INST_CARMO = { id: 'inst-1', id_externo: 'ceu-parque-do-carmo', nome: 'CEU antigo', whatsapp: '551159903369', endereco: 'Rua A, 10', bairro: 'Bairro X', cep: '08270-000', latitude: -23.5, longitude: -46.5, precisao_localizacao: 'endereco' };
const TURMA_FUTSAL = { instituicao_id: 'inst-1', id: 'futsal-60', idade_min: 6, idade_max: 12, publico_alvo: 'Comunidade', local_na_unidade: 'Quadra', observacoes: '', descricao: '' };
const TURMA_SUMIU = { instituicao_id: 'inst-1', id: 'sumiu-123', idade_min: 6, idade_max: 12, publico_alvo: 'Comunidade', local_na_unidade: '', observacoes: '', descricao: '' };

describe('sincronização completa (com dublês)', () => {
  it('modo de teste sem banco: não grava nada e mostra o resumo', async () => {
    const { deps, chamadas } = montarDeps({ banco: { conectado: false } });
    const rel = await sincronizar({ gravar: false }, deps);
    expect(rel.unidades.total).toBe(3);
    expect(rel.unidades.comEndereco).toBe(3);
    expect(rel.unidades.comTelefone).toBe(3); // 2 pelo GeoSampa, 1 pela página da unidade
    expect(chamadas.paginas.filter((u) => u.includes('/unidade/')).length).toBe(1); // só o Carrão precisou da página da unidade
    expect(rel.unidades.comCoordenadasOficiais).toBe(3);
    expect(rel.atividades.noSite).toBe(7); // a atividade da unidade "ceu-fora" não conta
    expect(rel.atividades.importaveis).toBe(3); // futsal, baile e curso de games
    expect(rel.atividades.ignoradas['só para adultos']).toBe(1);
    expect(rel.atividades.ignoradas['já aconteceu']).toBe(1);
    expect(rel.atividades.ignoradas['restrita a estudantes ou servidores']).toBe(1);
    expect(rel.atividades.ignoradas['reunião/formação (não é para o público)']).toBe(1);
    expect(rel.amostra.length).toBe(3);
  });

  it('gravando: atualiza o que existe, cria o novo e remove o que sumiu do site', async () => {
    const banco = bancoFalso({ instituicoes: [INST_CARMO], turmas: [TURMA_FUTSAL, TURMA_SUMIU] });
    const { deps, chamadas } = montarDeps({ banco });
    const rel = await sincronizar({ gravar: true }, deps);
    expect(banco.reg.inst.length).toBe(3);
    expect(banco.reg.inst[0].existente.id).toBe('inst-1'); // a unidade que já existia é atualizada, não duplicada
    expect(banco.reg.inst[1].dados).toMatchObject({ nome: 'CEU Taipas', tipo: 'CEU', status: 'aprovada', origem: 'ceu_sme', owner_id: null, whatsapp: '551123014801', endereco: 'Rua B, 20' });
    expect(banco.reg.turmas.length).toBe(3);
    expect(banco.reg.turmas.map((t) => t.id)).toEqual(['futsal-60', 'baile-2', 'games']);
    expect(banco.reg.turmas[1].instituicao_id).toBe('uuid-ceu-taipas'); // usa o id real da instituição recém-criada
    expect(rel.atividades.novas).toBe(2);
    expect(rel.atividades.atualizadas).toBe(1);
    expect(rel.atividades.removidas).toBe(1);
    expect(banco.reg.removidas).toEqual([{ instituicao_id: 'inst-1', id: 'sumiu-123' }]);
    // o que foi recusado por motivo fixo fica registrado; o evento que "já aconteceu" não (isso muda com o tempo)
    expect(banco.reg.ignoradas.map((r) => `${r.id_externo}: ${r.motivo}`).sort()).toEqual([
      'ceu-parque-do-carmo/muay-thay: só para adultos',
      'ceu-taipas/aula-escola: restrita a estudantes ou servidores',
      'ceu-taipas/reuniao-1: reunião/formação (não é para o público)',
    ]);
    expect(chamadas.geocodificar).toBe(0); // a posição veio do GeoSampa
    // a atividade que já existia não precisou de nova leitura da página de detalhe
    expect(chamadas.paginas.some((u) => u.endsWith('/futsal-60/'))).toBe(false);
  });

  it('GeoSampa fora do ar: usa o endereço (OpenStreetMap) só para quem não tem posição', async () => {
    const banco = bancoFalso({ instituicoes: [INST_CARMO], turmas: [] });
    const { deps, chamadas } = montarDeps({ banco, wfs: false });
    const rel = await sincronizar({ gravar: true }, deps);
    expect(chamadas.geocodificar).toBe(2); // a unidade que já tinha posição e não mudou de endereço não é consultada de novo
    expect(rel.avisos.some((a) => a.includes('GeoSampa indisponível'))).toBe(true);
    expect(banco.reg.inst[1].dados).toMatchObject({ latitude: -23.5, precisao_localizacao: 'rua' });
  });

  it('coleta incompleta: não remove nada e avisa', async () => {
    const banco = bancoFalso({ instituicoes: [INST_CARMO], turmas: [TURMA_FUTSAL, TURMA_SUMIU] });
    const { deps } = montarDeps({ banco });
    const rel = await sincronizar({ gravar: true, paginasMax: 1 }, deps);
    expect(banco.reg.removidas).toBeNull();
    expect(rel.atividades.removidas).toBe(0);
    expect(rel.avisos.some((a) => a.includes('nada foi removido'))).toBe(true);
  });

  it('trava contra remoção em massa', async () => {
    const muitas = Array.from({ length: 25 }, (_, i) => ({ ...TURMA_SUMIU, id: `velha-${i}` }));
    const banco = bancoFalso({ instituicoes: [INST_CARMO], turmas: muitas });
    const { deps } = montarDeps({ banco });
    await sincronizar({ gravar: true }, deps);
    expect(banco.reg.removidas).toBeNull();
    const banco2 = bancoFalso({ instituicoes: [INST_CARMO], turmas: muitas });
    await sincronizar({ gravar: true, forcarRemocao: true }, montarDeps({ banco: banco2 }).deps);
    expect(banco2.reg.removidas.length).toBe(25);
  });

  it('limite de páginas de detalhe: o que não deu tempo fica para a próxima rodada', async () => {
    const { deps } = montarDeps({ banco: { conectado: false } });
    const rel = await sincronizar({ gravar: false, detalhesMax: 2 }, deps);
    expect(rel.atividades.semDetalhe).toBe(5);
    expect(rel.avisos.some((a) => a.includes('próxima rodada'))).toBe(true);
  });

  it('atividades já verificadas e ignoradas não gastam o limite de leituras', async () => {
    const recente = new Date(2026, 10, 10).toISOString();
    const banco = bancoFalso({ ignoradas: [{ id_externo: 'ceu-parque-do-carmo/muay-thay', motivo: 'só para adultos', verificado_em: recente }] });
    const { deps, chamadas } = montarDeps({ banco });
    const rel = await sincronizar({ gravar: false, detalhesMax: 2 }, deps);
    expect(chamadas.paginas.some((u) => u.endsWith('/muay-thay/'))).toBe(false); // não leu de novo
    expect(rel.atividades.jaVerificadas).toBe(1);
    expect(rel.atividades.ignoradas['só para adultos']).toBe(1);
    expect(rel.atividades.semDetalhe).toBe(4); // sem o cache seriam 5: o limite de 2 leituras foi para outras atividades
  });

  it('verificação antiga (mais de 30 dias) é refeita', async () => {
    const antiga = new Date(2026, 8, 1).toISOString();
    const banco = bancoFalso({ ignoradas: [{ id_externo: 'ceu-parque-do-carmo/muay-thay', motivo: 'só para adultos', verificado_em: antiga }] });
    const { deps, chamadas } = montarDeps({ banco });
    const rel = await sincronizar({ gravar: false }, deps);
    expect(chamadas.paginas.some((u) => u.endsWith('/muay-thay/'))).toBe(true);
    expect(rel.atividades.jaVerificadas).toBe(0);
  });
});

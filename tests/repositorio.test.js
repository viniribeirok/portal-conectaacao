import { describe, it, expect, beforeEach } from 'vitest';
import {
  carregarTodasInstituicoes,
  salvarTodasInstituicoes,
  adicionarInstituicao,
  editarInstituicao,
  removerInstituicao,
  carregarTurmasDaInstituicao,
  salvarTurmasDaInstituicao,
  construirDocumentos,
  carregarAtividades,
  instituicaoAprovada,
  atualizarStatusInstituicao,
} from '../src/data/repositorioLocal';
import { INSTITUICOES_SEED } from '../src/data/instituicoes';

beforeEach(() => {
  localStorage.clear();
});

describe('construirDocumentos', () => {
  it('turma sem exigência extra pede só os 3 documentos básicos + foto + cadúnico', () => {
    const docs = construirDocumentos({});
    expect(docs.map((d) => d.descricao)).toEqual([
      'RG ou Certidão de Nascimento da criança',
      'CPF do responsável',
      'Comprovante de residência atualizado',
      '1 foto 3x4 recente',
      'Comprovante de baixa renda / CadÚnico',
    ]);
  });

  it('turma com atestado adiciona o documento de atestado médico', () => {
    const docs = construirDocumentos({ atestado: true });
    expect(docs.some((d) => d.descricao.includes('Atestado médico'))).toBe(true);
  });

  it('turma com histórico adiciona declaração escolar', () => {
    const docs = construirDocumentos({ historico: true });
    expect(docs.some((d) => d.descricao.includes('histórico escolar'))).toBe(true);
  });

  it('CadÚnico é sempre opcional; o resto é sempre obrigatório', () => {
    const docs = construirDocumentos({ atestado: true, historico: true });
    const cadunico = docs.find((d) => d.descricao.includes('CadÚnico'));
    const outros = docs.filter((d) => d !== cadunico);
    expect(cadunico.obrigatorio).toBe(false);
    expect(outros.every((d) => d.obrigatorio)).toBe(true);
  });
});

describe('instituições — armazenamento unificado (semente + cadastradas, tudo editável)', () => {
  it('primeira carga "semeia" a lista a partir de INSTITUICOES_SEED', async () => {
    const todas = await carregarTodasInstituicoes();
    expect(todas).toHaveLength(INSTITUICOES_SEED.length);
    expect(todas.every(instituicaoAprovada)).toBe(true);
  });

  it('carregar de novo devolve a mesma lista já salva (não semeia duas vezes)', async () => {
    await carregarTodasInstituicoes();
    await adicionarInstituicao({ nome: 'ONG Extra', tipo: 'ONG', whatsapp: '', endereco: '', bairro: '', cep: '' });
    const todas = await carregarTodasInstituicoes();
    expect(todas).toHaveLength(INSTITUICOES_SEED.length + 1);
  });

  it('migra instituições do formato de armazenamento antigo, se existirem', async () => {
    // simula dado deixado por uma versão anterior do app, antes desta lista unificada existir
    localStorage.setItem('conectaacao:personal:instituicoes-cadastradas', JSON.stringify([
      { id: 'inst-antiga', nome: 'ONG De Antes', tipo: 'ONG', status: 'aprovada' },
    ]));
    const todas = await carregarTodasInstituicoes();
    expect(todas.find((i) => i.id === 'inst-antiga')).toBeTruthy();
    expect(todas).toHaveLength(INSTITUICOES_SEED.length + 1);
  });
});

describe('adicionarInstituicao / editarInstituicao / removerInstituicao (admin)', () => {
  it('adicionarInstituicao cria com status aprovada por padrão', async () => {
    const { nova, lista } = await adicionarInstituicao({ nome: 'ONG Nova do Admin', tipo: 'ONG', whatsapp: '5511900000003', endereco: '', bairro: '', cep: '' });
    expect(nova.status).toBe('aprovada');
    expect(instituicaoAprovada(nova)).toBe(true);
    expect(lista.find((i) => i.id === nova.id)).toBeTruthy();
  });

  it('adicionarInstituicao aceita um status inicial diferente (ex: pendente, pro cadastro público)', async () => {
    const { nova } = await adicionarInstituicao({ nome: 'ONG via formulário público', tipo: 'ONG' }, 'pendente');
    expect(nova.status).toBe('pendente');
  });

  it('editarInstituicao atualiza só os campos passados, preservando o resto', async () => {
    const { nova } = await adicionarInstituicao({ nome: 'Nome Original', tipo: 'ONG', whatsapp: '5511900000004', endereco: '', bairro: 'Bairro X', cep: '' });
    const listaEditada = await editarInstituicao(nova.id, { nome: 'Nome Corrigido', whatsapp: '5511900000099' });
    const editada = listaEditada.find((i) => i.id === nova.id);
    expect(editada.nome).toBe('Nome Corrigido');
    expect(editada.whatsapp).toBe('5511900000099');
    expect(editada.bairro).toBe('Bairro X'); // não foi tocado, continua igual
  });

  it('editarInstituicao funciona também pra instituições da semente', async () => {
    const todas = await carregarTodasInstituicoes();
    const alvo = todas[0];
    const listaEditada = await editarInstituicao(alvo.id, { nome: 'Nome Editado da Semente' });
    expect(listaEditada.find((i) => i.id === alvo.id).nome).toBe('Nome Editado da Semente');
  });

  it('removerInstituicao tira a instituição da lista e apaga as turmas dela', async () => {
    const { nova } = await adicionarInstituicao({ nome: 'ONG a Remover', tipo: 'ONG' });
    await salvarTurmasDaInstituicao(nova.id, [{ id: 't1', nome: 'Capoeira', categoria: 'Artes Marciais', idadeMin: 6, idadeMax: 12, status: 'Abertas' }]);

    const listaDepois = await removerInstituicao(nova.id);
    expect(listaDepois.find((i) => i.id === nova.id)).toBeFalsy();

    const turmasRestantes = await carregarTurmasDaInstituicao(nova.id);
    expect(turmasRestantes).toEqual([]); // sem semente pra esse id novo, e a chave salva foi apagada
  });
});

describe('turmas por instituição', () => {
  it('primeira vez que carrega, usa a semente (TURMAS_SEED)', async () => {
    const turmas = await carregarTurmasDaInstituicao('vila-esperanca');
    expect(turmas.length).toBeGreaterThan(0);
    expect(turmas[0].nome).toBe('Judô');
  });

  it('depois de salvar, carrega o que foi salvo (não mais a semente)', async () => {
    await salvarTurmasDaInstituicao('vila-esperanca', [
      { id: 't1', nome: 'Judô', categoria: 'Artes Marciais', idadeMin: 6, idadeMax: 12, status: 'Encerradas', atestado: true, historico: false },
      { id: 't-novo', nome: 'Karatê', categoria: 'Artes Marciais', idadeMin: 5, idadeMax: 10, status: 'Abertas', atestado: true, historico: false },
    ]);
    const turmas = await carregarTurmasDaInstituicao('vila-esperanca');
    expect(turmas).toHaveLength(2);
    expect(turmas.find((t) => t.nome === 'Karatê')).toBeTruthy();
  });

  it('instituição sem semente e sem nada salvo devolve lista vazia (não quebra)', async () => {
    const turmas = await carregarTurmasDaInstituicao('instituicao-que-nao-existe');
    expect(turmas).toEqual([]);
  });
});

describe('carregarAtividades (a ponte painel -> busca)', () => {
  it('uma turma nova salva no painel aparece na lista que a busca usa', async () => {
    await salvarTurmasDaInstituicao('vila-esperanca', [
      { id: 't1', nome: 'Judô', categoria: 'Artes Marciais', idadeMin: 6, idadeMax: 12, status: 'Abertas', atestado: true, historico: false },
      { id: 't-nova', nome: 'Karatê Infantil', categoria: 'Artes Marciais', idadeMin: 5, idadeMax: 9, status: 'Abertas', atestado: true, historico: false },
    ]);

    const atividades = await carregarAtividades();
    const karate = atividades.find((a) => a.nome === 'Karatê Infantil');

    expect(karate).toBeTruthy();
    expect(karate.instituicao).toBe('Centro Comunitário Vila Esperança');
    expect(karate.tipo).toBe('ONG');
    expect(karate.bairro).toBe('Ipiranga');
    expect(karate.documentos.length).toBeGreaterThan(0);
  });

  it('cada atividade tem um id único mesmo com turmas de instituições diferentes', async () => {
    const atividades = await carregarAtividades();
    const ids = atividades.map((a) => a.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('uma instituição cadastrada pelo formulário (sem lat/long) ainda aparece na busca', async () => {
    const { nova } = await adicionarInstituicao({ nome: 'ONG Recém-Cadastrada', tipo: 'ONG', whatsapp: '5511900000000', endereco: 'Rua Nova, 1', bairro: 'Centro', cep: '' });
    await salvarTurmasDaInstituicao(nova.id, [
      { id: 't1', nome: 'Contação de Histórias', categoria: 'Cultura', idadeMin: 4, idadeMax: 8, status: 'Abertas', atestado: false, historico: false },
    ]);

    const atividades = await carregarAtividades();
    const encontrada = atividades.find((a) => a.nome === 'Contação de Histórias');
    expect(encontrada).toBeTruthy();
    expect(encontrada.latitude).toBeUndefined();
  });
});

describe('aprovação de instituições cadastradas', () => {
  it('instituição da semente é considerada aprovada mesmo sem campo status', () => {
    expect(instituicaoAprovada(INSTITUICOES_SEED[0])).toBe(true);
  });

  it('instituição recém-cadastrada (status pendente) NÃO é considerada aprovada', () => {
    expect(instituicaoAprovada({ id: 'x', status: 'pendente' })).toBe(false);
  });

  it('instituição recusada não é considerada aprovada', () => {
    expect(instituicaoAprovada({ id: 'x', status: 'recusada' })).toBe(false);
  });

  it('turma de instituição pendente não aparece na busca pública até ser aprovada', async () => {
    const { nova } = await adicionarInstituicao({ nome: 'ONG Aguardando Análise', tipo: 'ONG', whatsapp: '5511900000002', endereco: '', bairro: '', cep: '' }, 'pendente');
    await salvarTurmasDaInstituicao(nova.id, [
      { id: 't1', nome: 'Aula de Violão', categoria: 'Cultura', idadeMin: 8, idadeMax: 16, status: 'Abertas', atestado: false, historico: false },
    ]);

    const antes = await carregarAtividades();
    expect(antes.some((a) => a.nome === 'Aula de Violão')).toBe(false);

    await atualizarStatusInstituicao(nova.id, 'aprovada');
    const depois = await carregarAtividades();
    expect(depois.some((a) => a.nome === 'Aula de Violão')).toBe(true);
  });

  it('atualizarStatusInstituicao registra a data de revisão e dados extras (ex: motivo de recusa)', async () => {
    const { nova } = await adicionarInstituicao({ nome: 'ONG X', tipo: 'Outro', whatsapp: '', endereco: '', bairro: '', cep: '' }, 'pendente');
    const lista = await atualizarStatusInstituicao(nova.id, 'recusada', { motivoRecusa: 'Documento inválido' });
    const achada = lista.find((i) => i.id === nova.id);
    expect(achada.status).toBe('recusada');
    expect(achada.motivoRecusa).toBe('Documento inválido');
    expect(achada.dataRevisao).toBeTruthy();
  });
});

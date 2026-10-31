/**
 * ATENÇÃO — login e cadastro de PROTÓTIPO, não segurança de verdade.
 * As senhas ficam em texto puro neste arquivo, que faz parte do bundle
 * que roda no navegador de qualquer pessoa que abrir o site — dá pra ler
 * essas senhas só de abrir o "inspecionar elemento".
 *
 * Serve pra demonstrar o comportamento (ONG x admin, cadastro novo). Num
 * backend real: senha com hash, verificação no servidor, token de sessão
 * — o Supabase Auth (ou similar) já resolve isso pronto.
 *
 * As 18 instituições/turmas abaixo são as mesmas do banco (conectaacao.db)
 * — servem de ponto de partida (semente) na primeira vez que o app roda;
 * dali em diante, o que manda é o que estiver salvo no localStorage
 * (ver src/data/repositorio.js).
 */
export const INSTITUICOES_SEED = [
  { id: 'vila-esperanca', nome: 'Centro Comunitário Vila Esperança', tipo: 'ONG', whatsapp: '5511999990001', endereco: 'Rua das Palmeiras, 210', bairro: 'Ipiranga', cep: '04263-000', latitude: -23.588, longitude: -46.61 },
  { id: 'jardim-rosas', nome: 'CEU Jardim das Rosas', tipo: 'CEU', whatsapp: '5511999990002', endereco: 'Av. das Rosas, 880', bairro: 'Sacomã', cep: '04283-000', latitude: -23.619, longitude: -46.608 },
  { id: 'passo-a-passo', nome: 'Associação Cultural Passo a Passo', tipo: 'Associação', whatsapp: '5511999990003', endereco: 'Rua Domingos de Morais, 1450', bairro: 'Vila Mariana', cep: '04036-100', latitude: -23.5895, longitude: -46.6345 },
  { id: 'nova-aurora', nome: 'Clube da Comunidade Nova Aurora', tipo: 'Clube da Comunidade', whatsapp: '5511999990004', endereco: 'Rua Aurora, 305', bairro: 'Jabaquara', cep: '04347-000', latitude: -23.647, longitude: -46.6425 },
  { id: 'girassol', nome: 'Espaço Criativo Girassol', tipo: 'ONG', whatsapp: '5511999990005', endereco: 'Rua Girassol, 90', bairro: 'Saúde', cep: '04141-000', latitude: -23.617, longitude: -46.633 },
  { id: 'semear-futuro', nome: 'ONG Semear Futuro', tipo: 'ONG', whatsapp: '5511999990006', endereco: 'Rua Botucatu, 620', bairro: 'Vila Clementino', cep: '04023-061', latitude: -23.5978, longitude: -46.643 },
  { id: 'cursino', nome: 'Casa de Cultura do Cursino', tipo: 'CEU', whatsapp: '5511999990007', endereco: 'Rua do Cursino, 512', bairro: 'Cursino', cep: '04133-000', latitude: -23.6296, longitude: -46.619 },
  { id: 'maos-que-criam', nome: 'Instituto Mãos que Criam', tipo: 'ONG', whatsapp: '5511999990008', endereco: 'Rua União, 77', bairro: 'Jardim União', cep: '04285-000', latitude: -23.6105, longitude: -46.6055 },
  { id: 'estrela-do-sul', nome: 'Grêmio Recreativo Estrela do Sul', tipo: 'Clube da Comunidade', whatsapp: '5511999990009', endereco: 'Rua Estrela do Sul, 140', bairro: 'Sacomã', cep: '04284-000', latitude: -23.62, longitude: -46.607 },
  { id: 'passos-de-luz', nome: 'Projeto Passos de Luz', tipo: 'Associação', whatsapp: '5511999990010', endereco: 'Rua da Luz, 33', bairro: 'Ipiranga', cep: '04262-000', latitude: -23.5865, longitude: -46.612 },
  { id: 'amigos-do-saber', nome: 'Centro Social Amigos do Saber', tipo: 'ONG', whatsapp: '5511999990011', endereco: 'Rua do Saber, 145', bairro: 'Vila Prudente', cep: '03138-000', latitude: -23.578, longitude: -46.587 },
  { id: 'nova-moema', nome: 'Clube Recreativo Nova Moema', tipo: 'Clube da Comunidade', whatsapp: '5511999990012', endereco: 'Av. Moema, 620', bairro: 'Moema', cep: '04077-020', latitude: -23.605, longitude: -46.66 },
  { id: 'rodas-livres', nome: 'Associação Rodas Livres', tipo: 'Associação', whatsapp: '5511999990013', endereco: 'Rua Campo Belo, 310', bairro: 'Campo Belo', cep: '04613-001', latitude: -23.619, longitude: -46.658 },
  { id: 'vozes-do-bairro', nome: 'Coral Vozes do Bairro', tipo: 'ONG', whatsapp: '5511999990014', endereco: 'Rua Água Funda, 88', bairro: 'Água Funda', cep: '04293-000', latitude: -23.653, longitude: -46.633 },
  { id: 'aprender-mais', nome: 'Espaço Aprender Mais', tipo: 'ONG', whatsapp: '5511999990015', endereco: 'Rua Cidade Ademar, 501', bairro: 'Cidade Ademar', cep: '04381-000', latitude: -23.672, longitude: -46.65 },
  { id: 'guerreiros-do-bem', nome: 'Academia Comunitária Guerreiros do Bem', tipo: 'ONG', whatsapp: '5511999990016', endereco: 'Rua Vila Guarani, 212', bairro: 'Vila Guarani', cep: '04303-000', latitude: -23.643, longitude: -46.622 },
  { id: 'movimento-e-arte', nome: 'Núcleo Cultural Movimento e Arte', tipo: 'Associação', whatsapp: '5511999990017', endereco: 'Rua Sacomã, 470', bairro: 'Sacomã', cep: '04274-000', latitude: -23.628, longitude: -46.612 },
  { id: 'aguias-do-ipiranga', nome: 'Time Comunitário Águias do Ipiranga', tipo: 'Clube da Comunidade', whatsapp: '5511999990018', endereco: 'Rua Águia de Haia, 88', bairro: 'Ipiranga', cep: '04274-070', latitude: -23.593, longitude: -46.598 },
];

export const USUARIOS_SEED = [
  { email: 'vilaesperanca@conectaacao.org', senha: 'ong123', papel: 'ong', instituicaoId: 'vila-esperanca' },
  { email: 'jardimrosas@conectaacao.org', senha: 'ong123', papel: 'ong', instituicaoId: 'jardim-rosas' },
  { email: 'passoapasso@conectaacao.org', senha: 'ong123', papel: 'ong', instituicaoId: 'passo-a-passo' },
  { email: 'novaaurora@conectaacao.org', senha: 'ong123', papel: 'ong', instituicaoId: 'nova-aurora' },
  { email: 'girassol@conectaacao.org', senha: 'ong123', papel: 'ong', instituicaoId: 'girassol' },
  { email: 'admin', senha: 'admin', papel: 'admin' },
];

export const TURMAS_SEED = {
  'vila-esperanca': [{ id: 't1', nome: 'Judô', categoria: 'Artes Marciais', idadeMin: 6, idadeMax: 12, status: 'Abertas', atestado: true, historico: false }],
  'jardim-rosas': [{ id: 't2', nome: 'Balé Infantil', categoria: 'Dança', idadeMin: 4, idadeMax: 8, status: 'Abertas', atestado: true, historico: false }],
  'passo-a-passo': [{ id: 't3', nome: 'Capoeira', categoria: 'Artes Marciais', idadeMin: 7, idadeMax: 15, status: 'Fila de Espera', atestado: true, historico: false }],
  'nova-aurora': [{ id: 't4', nome: 'Futsal', categoria: 'Esportes', idadeMin: 8, idadeMax: 14, status: 'Abertas', atestado: true, historico: false }],
  'girassol': [{ id: 't5', nome: 'Reforço de Matemática e Português', categoria: 'Reforço Escolar', idadeMin: 6, idadeMax: 11, status: 'Abertas', atestado: false, historico: true }],
  'semear-futuro': [{ id: 't6', nome: 'Natação', categoria: 'Esportes', idadeMin: 5, idadeMax: 10, status: 'Encerradas', atestado: true, historico: false }],
  'cursino': [{ id: 't7', nome: 'Teatro Infantil', categoria: 'Cultura', idadeMin: 9, idadeMax: 15, status: 'Abertas', atestado: false, historico: false }],
  'maos-que-criam': [{ id: 't8', nome: 'Artesanato e Desenho', categoria: 'Cultura', idadeMin: 6, idadeMax: 13, status: 'Abertas', atestado: false, historico: false }],
  'estrela-do-sul': [{ id: 't9', nome: 'Vôlei', categoria: 'Esportes', idadeMin: 10, idadeMax: 16, status: 'Fila de Espera', atestado: true, historico: false }],
  'passos-de-luz': [{ id: 't10', nome: 'Hip Hop / Dança Urbana', categoria: 'Dança', idadeMin: 10, idadeMax: 17, status: 'Abertas', atestado: true, historico: false }],
  'amigos-do-saber': [{ id: 't11', nome: 'Xadrez', categoria: 'Cultura', idadeMin: 6, idadeMax: 14, status: 'Abertas', atestado: false, historico: false }],
  'nova-moema': [{ id: 't12', nome: 'Ginástica Artística', categoria: 'Esportes', idadeMin: 4, idadeMax: 9, status: 'Abertas', atestado: true, historico: false }],
  'rodas-livres': [{ id: 't13', nome: 'Skate', categoria: 'Esportes', idadeMin: 8, idadeMax: 16, status: 'Fila de Espera', atestado: true, historico: false }],
  'vozes-do-bairro': [{ id: 't14', nome: 'Coral Infantil', categoria: 'Cultura', idadeMin: 7, idadeMax: 13, status: 'Abertas', atestado: false, historico: false }],
  'aprender-mais': [{ id: 't15', nome: 'Inglês Básico', categoria: 'Reforço Escolar', idadeMin: 8, idadeMax: 15, status: 'Abertas', atestado: false, historico: true }],
  'guerreiros-do-bem': [{ id: 't16', nome: 'Jiu-Jitsu', categoria: 'Artes Marciais', idadeMin: 6, idadeMax: 14, status: 'Abertas', atestado: true, historico: false }],
  'movimento-e-arte': [{ id: 't17', nome: 'Break Dance', categoria: 'Dança', idadeMin: 9, idadeMax: 17, status: 'Fila de Espera', atestado: true, historico: false }],
  'aguias-do-ipiranga': [{ id: 't18', nome: 'Handebol', categoria: 'Esportes', idadeMin: 10, idadeMax: 15, status: 'Encerradas', atestado: true, historico: false }],
};

export const TIPOS_INSTITUICAO = ['ONG', 'CEU', 'Clube da Comunidade', 'Associação', 'Outro'];

// Sigla mostrada no pino do mapa, de acordo com o tipo da instituição.
export const SIGLA_TIPO = {
  'ONG': 'ONG',
  'CEU': 'CEU',
  'Clube da Comunidade': 'CC',
  'Associação': 'A',
  'Outro': 'O',
};

export const FORM_VAZIO = { nome: '', categoria: 'Esportes', idadeMin: 6, idadeMax: 12, status: 'Abertas', atestado: false, historico: false, institucaoId: INSTITUICOES_SEED[0].id };

-- Dados de exemplo: as 18 instituições e turmas do protótipo (já aprovadas, sem dono/login).
-- Rode DEPOIS do schema.sql. Pode rodar de novo (não duplica).

insert into public.instituicoes (id, nome, tipo, whatsapp, endereco, bairro, cep, latitude, longitude, status) values
  ('8b1ea3e6-19bd-5df8-8a24-e4c7b97a3375', 'Centro Comunitário Vila Esperança', 'ONG', '5511999990001', 'Rua das Palmeiras, 210', 'Ipiranga', '04263-000', -23.588, -46.61, 'aprovada'),
  ('cb5ea118-3f04-50b1-b092-255f313aaf90', 'CEU Jardim das Rosas', 'CEU', '5511999990002', 'Av. das Rosas, 880', 'Sacomã', '04283-000', -23.619, -46.608, 'aprovada'),
  ('8a433d2f-e8f7-5999-9f46-ecfb3fd22ad0', 'Associação Cultural Passo a Passo', 'Associação', '5511999990003', 'Rua Domingos de Morais, 1450', 'Vila Mariana', '04036-100', -23.5895, -46.6345, 'aprovada'),
  ('d275e40a-be28-5f2a-a60b-dfd39aa5bd0d', 'Clube da Comunidade Nova Aurora', 'Clube da Comunidade', '5511999990004', 'Rua Aurora, 305', 'Jabaquara', '04347-000', -23.647, -46.6425, 'aprovada'),
  ('d17e8fa8-88bb-5fbd-9acd-71337fbc1e5c', 'Espaço Criativo Girassol', 'ONG', '5511999990005', 'Rua Girassol, 90', 'Saúde', '04141-000', -23.617, -46.633, 'aprovada'),
  ('be46a36d-5319-5c82-95d4-5f5673a6a244', 'ONG Semear Futuro', 'ONG', '5511999990006', 'Rua Botucatu, 620', 'Vila Clementino', '04023-061', -23.5978, -46.643, 'aprovada'),
  ('1f526a1b-064b-5872-9978-1e5d873482d3', 'Casa de Cultura do Cursino', 'CEU', '5511999990007', 'Rua do Cursino, 512', 'Cursino', '04133-000', -23.6296, -46.619, 'aprovada'),
  ('215e0c9e-8949-5994-9a41-016022fa3c07', 'Instituto Mãos que Criam', 'ONG', '5511999990008', 'Rua União, 77', 'Jardim União', '04285-000', -23.6105, -46.6055, 'aprovada'),
  ('fef68f57-1eb5-53f3-aab0-9b07c504ab22', 'Grêmio Recreativo Estrela do Sul', 'Clube da Comunidade', '5511999990009', 'Rua Estrela do Sul, 140', 'Sacomã', '04284-000', -23.62, -46.607, 'aprovada'),
  ('fa72a1e7-03c3-5aad-8762-2402065e7ed3', 'Projeto Passos de Luz', 'Associação', '5511999990010', 'Rua da Luz, 33', 'Ipiranga', '04262-000', -23.5865, -46.612, 'aprovada'),
  ('a7b17099-65d1-5a27-8372-6a1df1361d5d', 'Centro Social Amigos do Saber', 'ONG', '5511999990011', 'Rua do Saber, 145', 'Vila Prudente', '03138-000', -23.578, -46.587, 'aprovada'),
  ('5f6cc1eb-f263-5c6b-8fc6-31850e3258ed', 'Clube Recreativo Nova Moema', 'Clube da Comunidade', '5511999990012', 'Av. Moema, 620', 'Moema', '04077-020', -23.605, -46.66, 'aprovada'),
  ('a910fddf-9eb3-5318-93c3-018232c67b30', 'Associação Rodas Livres', 'Associação', '5511999990013', 'Rua Campo Belo, 310', 'Campo Belo', '04613-001', -23.619, -46.658, 'aprovada'),
  ('2d87025c-15a6-595d-bdee-6ac8c171a909', 'Coral Vozes do Bairro', 'ONG', '5511999990014', 'Rua Água Funda, 88', 'Água Funda', '04293-000', -23.653, -46.633, 'aprovada'),
  ('7d82151a-55c0-595b-91db-d973043224e5', 'Espaço Aprender Mais', 'ONG', '5511999990015', 'Rua Cidade Ademar, 501', 'Cidade Ademar', '04381-000', -23.672, -46.65, 'aprovada'),
  ('b76436e2-5eb4-59b6-839e-e0894dc55b64', 'Academia Comunitária Guerreiros do Bem', 'ONG', '5511999990016', 'Rua Vila Guarani, 212', 'Vila Guarani', '04303-000', -23.643, -46.622, 'aprovada'),
  ('ef0ebc4e-a7f5-521e-acee-19a3db73acd8', 'Núcleo Cultural Movimento e Arte', 'Associação', '5511999990017', 'Rua Sacomã, 470', 'Sacomã', '04274-000', -23.628, -46.612, 'aprovada'),
  ('c9009623-cf56-5d0e-975e-88eaa8627a25', 'Time Comunitário Águias do Ipiranga', 'Clube da Comunidade', '5511999990018', 'Rua Águia de Haia, 88', 'Ipiranga', '04274-070', -23.593, -46.598, 'aprovada')
on conflict (id) do nothing;

insert into public.turmas (instituicao_id, id, nome, categoria, idade_min, idade_max, status, atestado, historico) values
  ('8b1ea3e6-19bd-5df8-8a24-e4c7b97a3375', 't1', 'Judô', 'Artes Marciais', 6, 12, 'Abertas', true, false),
  ('cb5ea118-3f04-50b1-b092-255f313aaf90', 't2', 'Balé Infantil', 'Dança', 4, 8, 'Abertas', true, false),
  ('8a433d2f-e8f7-5999-9f46-ecfb3fd22ad0', 't3', 'Capoeira', 'Artes Marciais', 7, 15, 'Fila de Espera', true, false),
  ('d275e40a-be28-5f2a-a60b-dfd39aa5bd0d', 't4', 'Futsal', 'Esportes', 8, 14, 'Abertas', true, false),
  ('d17e8fa8-88bb-5fbd-9acd-71337fbc1e5c', 't5', 'Reforço de Matemática e Português', 'Reforço Escolar', 6, 11, 'Abertas', false, true),
  ('be46a36d-5319-5c82-95d4-5f5673a6a244', 't6', 'Natação', 'Esportes', 5, 10, 'Encerradas', true, false),
  ('1f526a1b-064b-5872-9978-1e5d873482d3', 't7', 'Teatro Infantil', 'Cultura', 9, 15, 'Abertas', false, false),
  ('215e0c9e-8949-5994-9a41-016022fa3c07', 't8', 'Artesanato e Desenho', 'Cultura', 6, 13, 'Abertas', false, false),
  ('fef68f57-1eb5-53f3-aab0-9b07c504ab22', 't9', 'Vôlei', 'Esportes', 10, 16, 'Fila de Espera', true, false),
  ('fa72a1e7-03c3-5aad-8762-2402065e7ed3', 't10', 'Hip Hop / Dança Urbana', 'Dança', 10, 17, 'Abertas', true, false),
  ('a7b17099-65d1-5a27-8372-6a1df1361d5d', 't11', 'Xadrez', 'Cultura', 6, 14, 'Abertas', false, false),
  ('5f6cc1eb-f263-5c6b-8fc6-31850e3258ed', 't12', 'Ginástica Artística', 'Esportes', 4, 9, 'Abertas', true, false),
  ('a910fddf-9eb3-5318-93c3-018232c67b30', 't13', 'Skate', 'Esportes', 8, 16, 'Fila de Espera', true, false),
  ('2d87025c-15a6-595d-bdee-6ac8c171a909', 't14', 'Coral Infantil', 'Cultura', 7, 13, 'Abertas', false, false),
  ('7d82151a-55c0-595b-91db-d973043224e5', 't15', 'Inglês Básico', 'Reforço Escolar', 8, 15, 'Abertas', false, true),
  ('b76436e2-5eb4-59b6-839e-e0894dc55b64', 't16', 'Jiu-Jitsu', 'Artes Marciais', 6, 14, 'Abertas', true, false),
  ('ef0ebc4e-a7f5-521e-acee-19a3db73acd8', 't17', 'Break Dance', 'Dança', 9, 17, 'Fila de Espera', true, false),
  ('c9009623-cf56-5d0e-975e-88eaa8627a25', 't18', 'Handebol', 'Esportes', 10, 15, 'Encerradas', true, false)
on conflict (instituicao_id, id) do nothing;

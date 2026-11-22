# Portal ConectaAção

Plataforma web que aproxima famílias de **atividades gratuitas ou de baixo custo** para crianças e adolescentes (0 a 18 anos), oferecidas por **ONGs, CEUs, clubes da comunidade e associações**.

- **Site publicado:** https://portalconectaacao.vercel.app
- **Código-fonte:** https://github.com/viniribeirok/portal-conectaacao

---

## Sumário

1. [Sobre o projeto](#sobre-o-projeto)
2. [Funcionalidades](#funcionalidades)
3. [Como o sistema funciona](#como-o-sistema-funciona)
4. [Tecnologias](#tecnologias)
5. [Estrutura do projeto](#estrutura-do-projeto)
6. [Pré-requisitos](#pré-requisitos)
7. [Instalação e execução local](#instalação-e-execução-local)
8. [Configuração do Supabase](#configuração-do-supabase)
9. [Recuperação de senha por e-mail](#recuperação-de-senha-por-e-mail)
   - [Importação automática dos CEUs](#importação-automática-dos-ceus)
10. [Comandos disponíveis](#comandos-disponíveis)
11. [Publicação na internet](#publicação-na-internet)
12. [Testes automatizados](#testes-automatizados)
13. [Solução de problemas](#solução-de-problemas)
14. [Limitações conhecidas e próximos passos](#limitações-conhecidas-e-próximos-passos)
15. [Equipe](#equipe)

---

## Sobre o projeto

Famílias de baixa renda têm dificuldade para descobrir quais projetos sociais existem perto de casa, se há vagas, quais documentos são exigidos e como falar com a instituição. As instituições, em geral sem equipe de tecnologia, dependem de panfletos e do boca a boca.

O Portal ConectaAção reúne essas informações em um só lugar — gratuito e acessível pelo celular ou pelo computador — e oferece às instituições um painel simples para manter suas turmas e eventos atualizados.

Projeto desenvolvido como atividade extensionista na **PUC-SP** (disciplina LPS).

## Funcionalidades

### Para famílias e responsáveis (sem login)
- Busca por texto (bairro, atividade ou instituição), categoria, faixa etária e tipo de atividade (**turma contínua** ou **evento de um dia**), em **lista e em mapa real**.
- Ordenação por **proximidade**, usando a localização do aparelho.
- Detalhes da atividade e da instituição, com contato por **WhatsApp** (celular) ou **ligação** (telefone fixo).
- **Checklist de documentos** para a matrícula, com marcação do que já foi providenciado e impressão.
- Modo de exibição **normal ou escuro**, escolhido na tela inicial.
- **CEUs da Prefeitura de São Paulo** e suas atividades, atualizados automaticamente (veja [Importação automática dos CEUs](#importação-automática-dos-ceus)).

### Para instituições (com login)
- **Cadastro** com documento comprobatório (PDF ou imagem de até 2 MB); o cadastro fica *pendente* até a aprovação do administrador.
- Painel para cadastrar, editar e remover **turmas e eventos de um dia**, com status das vagas (abertas, fila de espera, encerradas), faixa etária (ou "todas as idades") e **endereço próprio da atividade**.
- Edição dos próprios dados da instituição.
- **Esqueci minha senha**: link de recuperação enviado ao e-mail cadastrado.

### Para o administrador
- Análise de **cadastros pendentes**: abre o documento, **aprova** ou **recusa** (com motivo).
- Gerenciamento de **todas as instituições** (adicionar, editar, remover) e de todas as turmas.

## Como o sistema funciona

```
GitHub ──(deploy automático)──► Vercel ──(entrega o site)──► Navegador
                                                              │   │
                                   login, dados e documentos  │   │  mapa e endereços
                                                              ▼   ▼
                                                   Supabase   OpenStreetMap
                                     (Auth + PostgreSQL + Storage)  (Leaflet + Nominatim)
```

O portal é um site que roda **no navegador** de quem o usa. A Vercel apenas entrega o site (com https). Login, leitura e gravação de dados e envio de documentos são feitos diretamente com o **Supabase**; o mapa e a localização de endereços vêm do **OpenStreetMap**. Não há servidor próprio: **as regras de acesso são aplicadas pelo próprio banco de dados** (Row Level Security).

**Ciclo de vida de uma instituição:**

1. A instituição se cadastra, anexa o documento e fica **pendente** (nada é publicado).
2. O administrador confere o documento e **aprova** ou **recusa**.
3. Aprovada, ela entra no painel e cadastra turmas e eventos.
4. O sistema localiza o endereço no mapa e a atividade aparece na busca pública.
5. As famílias encontram a atividade e entram em contato.
6. Eventos de um dia saem da busca depois da data.

**Regras principais**

- O público vê **apenas instituições aprovadas**.
- Cada instituição altera **somente os próprios dados** e só depois de aprovada; o administrador gerencia tudo.
- Telefone com DDD + **9 dígitos** é celular (WhatsApp); com DDD + **8 dígitos** é fixo (ligar).
- Faixa etária de **0 a 99 anos** equivale a "todas as idades".
- Atividade usa o endereço da sede, a menos que tenha **endereço próprio**.
- Documentos ficam em armazenamento **privado**; o portal **não guarda dados de crianças**.

## Tecnologias

| Tecnologia | Uso |
|---|---|
| React 18 + Vite | Interface e ambiente de desenvolvimento |
| Supabase (Auth, PostgreSQL, Storage) | Login, banco de dados e documentos |
| Leaflet + OpenStreetMap (Nominatim) | Mapa e localização de endereços (sem chave de API) |
| Vitest | Testes automatizados |
| Vercel + GitHub | Publicação e controle de versões |

## Estrutura do projeto

```
conecta-acao-projeto/
├── src/
│   ├── App.jsx                  # telas e escolha do tema (normal/escuro)
│   ├── main.jsx
│   ├── index.css
│   ├── components/
│   │   ├── TelaInicio.jsx       # tela inicial
│   │   ├── Portal.jsx           # busca das famílias (lista, mapa, detalhes)
│   │   └── PainelGestao.jsx     # login, cadastro, recuperação de senha e painéis
│   ├── data/
│   │   ├── repositorio.js       # acesso aos dados (Supabase)
│   │   ├── repositorioLocal.js  # versão local (usada nos testes)
│   │   ├── atividades.js        # categorias, status e ícones
│   │   └── instituicoes.js      # dados de exemplo e tipos
│   ├── lib/
│   │   ├── supabase.js          # cliente do Supabase
│   │   ├── geocodificacao.js    # endereço → latitude/longitude
│   │   ├── email.js             # e-mail de aprovação (simulado)
│   │   └── storage.js           # armazenamento local do navegador
│   └── utils/                   # filtros, distância, eventos, idades, telefones
├── scripts/importador/          # importação automática dos CEUs (Prefeitura de SP)
├── .github/workflows/           # rotina diária de sincronização (GitHub Actions)
├── supabase/
│   ├── schema.sql               # tabelas e regras de acesso
│   ├── seed.sql                 # 18 instituições e turmas de exemplo
│   ├── migracao_*.sql           # só para bancos criados com versão anterior (inclui a da importação dos CEUs)
│   ├── LEIAME.md
│   ├── LEIAME-recuperar-senha.md
│   └── email-recuperar-senha.html
├── tests/                       # testes automatizados
├── .env.example                 # modelo do .env.local
├── .nvmrc                       # versão do Node sugerida
├── package.json
└── README.md
```

## Pré-requisitos

| Item | Observação |
|---|---|
| **Node.js 20 (LTS) ou superior** | Inclui o npm — [nodejs.org](https://nodejs.org) |
| **Navegador atual** | Chrome, Edge, Firefox ou Safari |
| **Conta no Supabase** (plano gratuito) | [supabase.com](https://supabase.com) |
| Editor de código | Recomendado: Visual Studio Code |
| Git e conta no GitHub | Opcional (histórico e publicação) |
| Conta na Vercel | Opcional (publicar na internet) |

## Instalação e execução local

1. **Instale o Node.js 20** e confirme no terminal:
   ```bash
   node --version
   ```
2. **Extraia o projeto** e abra a pasta no VS Code (ou em um terminal).
3. **Instale as dependências:**
   ```bash
   npm install
   ```
4. **Configure o Supabase** (próxima seção) e anote a *Project URL* e a *chave pública*.
5. **Crie o arquivo `.env.local`** na raiz do projeto (ao lado do `package.json`), copiando o `.env.example`:
   ```env
   VITE_SUPABASE_URL=https://SEU-PROJETO.supabase.co
   VITE_SUPABASE_ANON_KEY=sua-chave-publica
   ```
6. **Inicie o site:**
   ```bash
   npm run dev
   ```
   Abra o endereço mostrado no terminal (normalmente **http://localhost:5173**).
7. **Entre como administrador** e confira se a busca mostra as 18 atividades de exemplo.

> Sempre que alterar o `.env.local`, pare o servidor (Ctrl+C) e rode `npm run dev` de novo.

## Configuração do Supabase

Faça uma única vez.

1. Crie uma conta e um **projeto** em [supabase.com](https://supabase.com) (guarde a senha do banco).
2. **Authentication → Providers → Email:** mantenha o provedor **ligado** e **desligue "Confirm email"** — sem isso, o cadastro de instituições não consegue enviar o documento na hora.
3. **SQL Editor:** rode, **nesta ordem**, o conteúdo de:
   1. `supabase/schema.sql` — cria as tabelas, as regras de acesso e o armazenamento de documentos;
   2. `supabase/seed.sql` — carrega as 18 instituições e turmas de exemplo.

   > O `schema.sql` já inclui eventos de um dia, endereço da atividade e faixa etária de 0 a 99 anos. Os arquivos `migracao_eventos_endereco.sql` e `migracao_idades.sql` servem **apenas** para bancos criados com uma versão anterior do schema.
4. **Crie o administrador:** em *Authentication → Users → Add user*, cadastre e-mail e senha (marque *Auto Confirm User*). Depois, no SQL Editor, rode (trocando o e-mail):
   ```sql
   insert into public.perfis (user_id, papel)
     select id, 'admin' from auth.users where email = 'SEU-EMAIL@exemplo.org'
     on conflict (user_id) do update set papel = 'admin';
   ```
5. **Project Settings → API:** copie a **Project URL** e a **chave pública** (*anon* ou *publishable*) para o `.env.local`.
   **Nunca** use a chave `service_role` / `secret` no site.

## Recuperação de senha por e-mail

O código do "Esqueci minha senha" já está pronto; faltam duas configurações no Supabase (detalhes em `supabase/LEIAME-recuperar-senha.md`):

1. **Authentication → URL Configuration**
   - **Site URL:** o endereço do site publicado.
   - **Redirect URLs:** `http://localhost:5173/**` e `https://SEU-SITE/**`.
2. **Envio do e-mail:** o envio padrão do Supabase só entrega para **membros do time do projeto** (limite de 2 e-mails por hora).
   - *Para testar:* use o e-mail da sua própria conta do Supabase.
   - *Para qualquer pessoa receber:* configure um **SMTP próprio** em *Authentication → Emails → SMTP Settings* (por exemplo, uma conta Gmail dedicada ao projeto com *senha de app*).

## Importação automática dos CEUs

O portal pode manter **os CEUs de São Paulo, seus endereços/telefones e as atividades que oferecem** atualizados sozinho, a partir de fontes públicas da Prefeitura (Portal dos CEUs e camada de CEUs do GeoSampa). Não existe uma API oficial única, então o importador lê as páginas públicas **devagar**, identificando-se como robô e **respeitando o robots.txt**.

```bash
npm run importar:diagnostico      # mostra o que o robô enxerga (não grava)
npm run importar:ceus             # teste completo (não grava)
npm run importar:ceus:gravar      # grava no banco (precisa do .env.importador)
```

- Precisa rodar `supabase/migracao_importacao_ceus.sql` (já incluso no `schema.sql` mais novo) e criar o `.env.importador` com a chave **service_role** (secreta — copie de `.env.importador.example`).
- A rotina diária está em `.github/workflows/sincronizar-ceus.yml` e só liga depois que você criar a variável `SINCRONIZACAO_ATIVA = true` no GitHub.
- Só entram atividades abertas à comunidade, para até 17 anos e que ainda não aconteceram.
- **Guia completo:** `scripts/importador/LEIAME.md`.

## Comandos disponíveis

| Comando | O que faz |
|---|---|
| `npm install` | Instala as dependências |
| `npm run dev` | Inicia o site em modo de desenvolvimento |
| `npm run build` | Gera a pasta `dist` com o site pronto para publicar |
| `npm run preview` | Testa localmente a versão gerada pelo `build` |
| `npm test` | Executa os testes automatizados uma vez |
| `npm run test:watch` | Executa os testes e reexecuta ao salvar arquivos |
| `npm run importar:diagnostico` | Mostra o que o importador dos CEUs enxerga nas fontes (não grava) |
| `npm run importar:diagnostico-api` | Mostra o que a API do WordPress do portal dos CEUs oferece (não grava) |
| `npm run importar:ceus` | Teste completo da importação dos CEUs (não grava) |
| `npm run importar:ceus:gravar` | Importa os CEUs e suas atividades para o banco |

## Publicação na internet

1. Envie o projeto para um repositório no **GitHub** (o `.gitignore` já exclui `node_modules`, `dist` e `.env.local`).
2. Na **Vercel**, importe o repositório — o *preset* do Vite é detectado sozinho (comando `npm run build`, pasta `dist`).
3. Em *Settings → Environment Variables*, cadastre `VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY`.
4. A cada `git push` na branch principal, a Vercel publica a nova versão automaticamente.

> As variáveis só valem para novos deploys: se cadastrar depois de publicar, use **Redeploy**.

## Testes automatizados

```bash
npm test
```

Os testes cobrem a lógica do sistema (cálculo de distância, filtros de busca, armazenamento local, gestão de instituições e turmas e e-mail simulado) usando a versão local dos dados (`repositorioLocal.js`). Eles **não** acessam o Supabase.

## Solução de problemas

| Sintoma | Causa provável | O que fazer |
|---|---|---|
| `npm não é reconhecido` | Node.js não instalado, ou terminal aberto antes da instalação | Instale o Node.js e abra um novo terminal |
| Tela "Carregando" sem fim / erro de variável no console | `.env.local` ausente, fora da raiz, com nome errado, ou servidor não reiniciado | Confira o arquivo na raiz, com os dois nomes exatos, e reinicie `npm run dev` |
| `Invalid API key` | Chave copiada errada ou chave secreta | Use a chave pública (*anon* / *publishable*) |
| Não consigo entrar como administrador | Usuário sem a linha de administrador na tabela `perfis` | Rode o comando do passo 4 da configuração do Supabase |
| Erro ao enviar o cadastro de instituição | "Confirm email" ligado | Desligue em *Authentication → Providers → Email* |
| Erro ao salvar turma (`column not found`) | Banco criado com versão anterior do schema | Rode `migracao_eventos_endereco.sql` e `migracao_idades.sql` |
| E-mail de recuperação não chega | Envio padrão só entrega ao time do projeto, ou URL Configuration/SMTP não configurados | Configure o SMTP e a URL Configuration; confira o spam |
| Mapa em branco | Sem internet ou bloqueio das imagens do OpenStreetMap | Verifique a conexão |
| "Perto de mim" não funciona | O navegador exige https (ou `localhost`) e permissão | Use `localhost` ou o site publicado e permita a localização |

## Limitações conhecidas e próximos passos

**Limitações**

- A importação dos CEUs depende de páginas públicas sem API oficial: se o site mudar de layout, o importador precisa de ajuste. Atividades de CEU não têm checklist de documentos.
- O e-mail de aprovação/recusa de cadastro é **simulado** (registrado em log, sem envio real).
- A confirmação de e-mail está desativada; a barreira contra cadastros indevidos é a aprovação do administrador.
- O plano gratuito do Supabase **pausa o projeto** após cerca de 1 semana sem uso.
- Endereços são buscados em **São Paulo** por padrão, e o OpenStreetMap nem sempre conhece o número exato.
- Documentos anexados têm limite de **2 MB** e não passam por verificação de conteúdo.
- Ainda não há política de privacidade nem termo de consentimento (LGPD).
- Uma instituição criada pelo administrador **não tem login**; para acessar o painel, ela precisa fazer o próprio cadastro.

**Próximos passos**

1. Enviar e-mails reais de aprovação e recusa.
2. LGPD: política de privacidade, consentimento e retenção de dados.
3. Piloto com instituições reais e testes de usabilidade.
4. Proteger o cadastro público (CAPTCHA) e reativar a confirmação de e-mail.
5. Cópias de segurança periódicas e domínio próprio.

## Equipe

**Grupo 8** — PUC-SP, Atividade Extensionista (LPS)

- [Nome completo dos integrantes — a preencher]

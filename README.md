# Portal ConectaAção — protótipo

Projeto React (Vite) com três telas: início, busca dos pais (sem login) e
painel de gestão das ONGs/CEUs (com login e cadastro).

## Esta versão usa o Supabase (login + banco online)

Siga o passo a passo em `supabase/LEIAME.md`. Resumo: criar o projeto no Supabase,
rodar `supabase/schema.sql` e `supabase/seed.sql`, criar o administrador, preencher o
`.env.local` (modelo em `.env.example`) e rodar `npm install` e `npm run dev`.

As seções abaixo sobre `admin`/`admin`, contas de teste e dados no `localStorage` descrevem
o modo protótipo anterior, que continua em `src/data/repositorioLocal.js` (usado nos testes
automáticos). Nesta versão: o login é por e-mail e senha (Supabase Auth), os dados ficam no
banco compartilhado, os documentos vão para um armazenamento privado e o e-mail de
aprovação ainda é simulado.

## Como rodar no VSCode

Pré-requisito: [Node.js](https://nodejs.org) 18 ou mais novo instalado.

```bash
# 1. instalar as dependências
npm install

# 2. rodar em modo desenvolvimento
npm run dev
```

Abre o link que aparecer no terminal (geralmente `http://localhost:5173`).
Qualquer alteração salva no código atualiza a página sozinha.

Outros comandos úteis:

```bash
npm run build     # gera a versão de produção em dist/
npm run preview   # serve a versão de produção localmente, pra conferir
npm test          # roda os testes automatizados uma vez
npm run test:watch  # roda os testes de novo a cada alteração salva
```

## Estrutura do projeto

```
src/
  main.jsx              # ponto de entrada (monta o React na página)
  App.jsx                # roteador simples: início / portal / painel
  components/
    TelaInicio.jsx         # tela de início (duas opções)
    Portal.jsx              # busca dos pais — lista, mapa, checklist
    PainelGestao.jsx        # login, cadastro de ONG, gestão de turmas e instituições
  data/
    atividades.js            # categorias, ícones, status (constantes)
    instituicoes.js           # instituições e turmas semente (18), usuários de teste
    repositorio.js             # ponte painel <-> busca (ver seção abaixo)
  utils/
    geo.js                      # cálculo de distância (Haversine)
    filtros.js                   # lógica de busca/ordenação (testável)
  lib/
    storage.js                    # ver seção abaixo
    email.js                       # e-mail simulado do fluxo de aprovação
    geocodificacao.js               # endereço -> latitude/longitude (Nominatim/OpenStreetMap)
tests/
  geo.test.js
  filtros.test.js
  storage.test.js
  repositorio.test.js
  email.test.js
```

## O painel e a busca agora usam os mesmos dados

Antes, a busca dos pais lia de uma lista fixa no código, e o painel de
gestão salvava as turmas separado — cadastrar uma turma no painel não
aparecia pra ninguém. Isso mudou: `src/data/repositorio.js` é o único
lugar que lê/escreve turmas e instituições, e as duas telas usam essas
mesmas funções.

**Testando isso na prática:** roda `npm run dev`, entra no painel (`admin`
/ `admin`), cadastra uma turma nova em qualquer instituição, volta pro
início e entra na busca dos pais — a turma nova aparece. Isso só funciona
no mesmo navegador (ver seção sobre `localStorage` logo abaixo) — não é
um banco compartilhado entre pessoas diferentes ainda.

Uma instituição cadastrada pela aba "Cadastrar minha ONG" também aparece na busca depois de aprovada, e o endereço dela é localizado no mapa automaticamente (ver a seção sobre geocodificação).

## Sobre o `src/lib/storage.js`

O protótipo original foi construído pra rodar dentro do Claude.ai, que
oferece uma API global `window.storage` pra persistir dados (usada aqui
pra guardar sessão de login, turmas cadastradas e progresso do checklist).
Essa API **não existe** num navegador comum.

`src/lib/storage.js` reimplementa a mesma assinatura (`get`/`set`/`delete`/
`list`, todas assíncronas) usando `localStorage`, então o resto do código
não precisou mudar. Se um dia vocês trocarem isso por uma API de verdade
(backend + banco hospedado), o ponto de troca é só esse arquivo.

## Contas de teste (login do painel)

⚠️ **Isto é autenticação de protótipo, não segurança de verdade.** As
senhas estão em texto puro em `src/data/instituicoes.js`, visível pra
qualquer um que abrir o código do site no navegador. Não usem isso com
dados reais de famílias e instituições sem trocar por autenticação de
verdade antes (ex: Supabase Auth).

| Papel | E-mail / usuário | Senha |
|---|---|---|
| Administrador (acesso total) | `admin` | `admin` |
| ONG — Vila Esperança | `vilaesperanca@conectaacao.org` | `ong123` |
| ONG — CEU Jardim das Rosas | `jardimrosas@conectaacao.org` | `ong123` |
| ONG — Passo a Passo | `passoapasso@conectaacao.org` | `ong123` |
| ONG — Nova Aurora | `novaaurora@conectaacao.org` | `ong123` |
| ONG — Girassol | `girassol@conectaacao.org` | `ong123` |

## Cadastro de ONG novo: documento + aprovação do admin

Uma ONG que se cadastra pela aba "Cadastrar minha ONG" **não entra direto**:

1. Preenche o formulário e **anexa um documento** que comprove a
   instituição (estatuto, CNPJ, etc. — PDF ou imagem, até 2 MB)
2. O cadastro fica com status **pendente**. A ONG vê uma tela de "em
   análise" e não consegue entrar no painel ainda (se tentar logar, vê
   uma mensagem explicando)
3. As turmas de uma instituição pendente **não aparecem na busca dos
   pais** — só depois de aprovada
4. O administrador entra (`admin` / `admin`), abre a aba **"Cadastros
   pendentes"** (mostra um contador quando há algo esperando), confere
   os dados e o documento anexado, e clica em **Aprovar** ou **Recusar**
   (a recusa aceita um motivo opcional)
5. O sistema "envia" um e-mail automático avisando o resultado

Pra testar de ponta a ponta: cadastra uma ONG nova → tenta entrar (vai
ver a mensagem de análise) → sai → entra como `admin` → aprova → sai →
entra com a conta da ONG (agora funciona) → cadastra uma turma → confere
que ela aparece na busca dos pais.

### ⚠️ O e-mail é simulado — não chega na caixa de entrada de ninguém

Mandar e-mail de verdade exige um **servidor**: as credenciais de um
serviço de e-mail (Resend, SendGrid, AWS SES...) não podem ficar no código
que roda no navegador — qualquer visitante conseguiria ler e usar. Por
isso `src/lib/email.js` apenas **registra** o e-mail que seria enviado
(destinatário, assunto, corpo, data), e o admin consegue ver esse
registro no botão **"Ver e-mails simulados"**, dentro da aba de cadastros
pendentes.

Quando o projeto tiver um backend, só o miolo de `enviarEmailSimulado`
precisa mudar (pra uma chamada `fetch('/api/enviar-email', ...)`) — o
resto do código não sabe a diferença.

### Sobre o documento anexado

O arquivo é guardado no `localStorage` (convertido em texto/base64), por
isso o limite de 2 MB — o `localStorage` tem poucos MB no total. Num
sistema de verdade, arquivos vão pra um armazenamento próprio para isso
(ex.: Supabase Storage, S3), e o banco guarda só o link.

Instituições que já vêm no código (as 18 do exemplo) são tratadas como
**já aprovadas**.

## Admin edita qualquer instituição; a própria instituição edita a si mesma

O admin tem uma terceira aba no painel — **"Instituições"** — com uma
lista de todas elas (as 18 de exemplo + qualquer uma cadastrada depois),
cada uma com botões **Editar** e **Remover**, e um botão **"+ Nova
instituição"** no topo pra cadastrar uma direto (sem passar pela fila de
aprovação — o admin já está confirmando que é válida).

Isso só foi possível porque as 18 instituições de exemplo deixaram de
ser uma lista fixa no código: na primeira vez que o app roda, elas são
"semeadas" pro `localStorage` (`src/data/repositorio.js`,
`carregarTodasInstituicoes`) e passam a viver lá — editáveis de verdade,
igual qualquer uma cadastrada depois. Se o projeto já tinha dados salvos
de antes dessa mudança, eles são migrados automaticamente na primeira
carga.

Ao adicionar uma instituição nova, o admin pode (opcionalmente) já criar
o e-mail e a senha de acesso dela — se deixar em branco, só o cadastro é
criado, sem login (dá pra criar depois).

Quem está logado como **ONG** vê um botão **"Editar dados da
instituição"** que abre o mesmo formulário, mas só pra editar os próprios
dados — nome, tipo, WhatsApp, endereço, bairro e CEP. Não aparece opção
de adicionar ou remover (isso continua exclusivo do admin).

Remover uma instituição também apaga as turmas dela e qualquer login
associado a ela (pra não sobrar uma conta que funciona mas aponta pra
uma instituição que não existe mais).

## Posição das instituições no mapa (geocodificação)

O pino de cada instituição no mapa vem de **latitude e longitude** salvas
nela. As 18 de exemplo já trazem isso; as que são cadastradas depois só
têm o endereço escrito, então o app converte o endereço em coordenadas
(`src/lib/geocodificacao.js`, usando o Nominatim — a busca de endereços do
OpenStreetMap, gratuita e sem chave de API).

Quando isso acontece: ao **adicionar** uma instituição, ao **editar** (se o
endereço mudou ou se ela ainda não tem posição), ao **aprovar** um cadastro
pendente, e no botão **"Localizar no mapa"** da aba Instituições (aparece
nas que estão sem posição, marcadas com o selo "Sem posição no mapa").

A busca vai do mais preciso ao menos preciso: rua e número → só a rua →
bairro → CEP. O OpenStreetMap nem sempre conhece o número de cada casa,
então o pino pode cair na rua ou no centro do bairro — o aviso na tela diz
qual foi o caso.

Limites: o endereço é buscado em **São Paulo** por padrão (não há campo de
cidade nos cadastros); precisa de internet; e o serviço público do
Nominatim pede no máximo 1 consulta por segundo e uso leve — suficiente
para o protótipo, mas um produto com muito uso deve hospedar o próprio
Nominatim ou usar um geocodificador pago.

## Impressão do checklist

O botão "Salvar / imprimir checklist" abre a impressão do navegador só com
a folha do checklist (nome da atividade, instituição, endereço, data e a
lista de documentos com caixinhas — marcadas nos que já foram providenciados).
Na janela de impressão dá pra escolher "Salvar como PDF".

## Sobre o mapa

O mapa é real agora — [Leaflet](https://leafletjs.com/) com tiles do
[OpenStreetMap](https://www.openstreetmap.org/), gratuito e sem precisar
de chave de API (diferente do Google Maps). Os pinos mostram a sigla do
**tipo da instituição** (ONG, CEU, CC, A, O — ver legenda abaixo do mapa)
coloridos pelo **status da vaga**.

Carrega tiles de `tile.openstreetmap.org` pela internet — então, ao
contrário do resto do app, essa parte específica não funciona sem
conexão.

## Sobre a busca "perto de mim"

Usa a API nativa do navegador (`navigator.geolocation`), sem depender de
nenhum serviço externo pra pegar a localização em si. Funciona em
`localhost` (é considerado "contexto seguro"), mas em produção só
funciona servido por **HTTPS**.

Depois de permitir o acesso, o mapa dá um "voo" (zoom + centraliza) até
sua posição real, marcada com um ponto azul — e a lista já reordena pra
mostrar as atividades mais próximas primeiro, com a distância escrita em
cada card.

Como as 18 atividades são dados fictícios fixados em bairros de São
Paulo, se vocês testarem de um lugar fisicamente longe dali, o mapa vai
mostrar sua localização de verdade só que bem distante dos pinos — e a
distância calculada nos cards vai aparecer corretamente (é matemática
real), só que grande. Isso é o comportamento esperado, não um bug.

## O que ainda falta pra virar produto de verdade

- Trocar `src/data/repositorio.js` por chamadas a uma API real, que leia
  do banco hospedado (o `conectaacao.db` / schema já existem noutra parte
  do projeto) — hoje ele já centraliza tudo num só lugar, então trocar o
  "por dentro" dessas funções por `fetch()` é a mudança principal
- Trocar o login de protótipo por autenticação de verdade
- Hospedar (Vercel, Netlify, etc. servem bem pro front; Supabase é uma
  opção prática pro banco + autenticação juntos)

## Aviso sobre os testes automatizados

Os testes em `tests/` cobrem a lógica pura (cálculo de distância, busca/
filtro, o polyfill de storage, e a ponte painel↔busca em
`repositorio.js`) — a parte mais fácil de quebrar sem perceber e mais
valiosa de testar automaticamente. Eles **não cobrem** os componentes
React em si (cliques, formulários renderizados). Se quiserem esse tipo
de teste depois, a base já está pronta: `@testing-library/react` já está
nas dependências, é só escrever os testes em `tests/*.test.jsx` chamando
`render()` nos componentes.

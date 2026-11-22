# Importador dos CEUs (Prefeitura de São Paulo)

Mantém o banco do portal atualizado com **os CEUs, seus endereços/telefones e as atividades que eles oferecem**, lendo fontes públicas da Prefeitura:

| Dado | Fonte | Como |
|---|---|---|
| Lista de unidades, endereço, CEP, telefone | Portal dos CEUs (`ceu.sme.prefeitura.sp.gov.br`) | leitura das páginas |
| Atividades (permanentes e com data), horário, faixa etária, público | Portal dos CEUs | leitura das páginas |
| Posição no mapa (latitude/longitude) | GeoSampa — camada `geoportal:equipamento_educacao_ceu` | WFS oficial; se não achar, usa o endereço (OpenStreetMap) |

> Não existe uma API oficial única com tudo isso. Por isso o importador lê as páginas públicas, devagar (1 requisição a cada 1,5 s), identificando-se como `ConectaAcaoBot` e **respeitando o robots.txt** do site. O ideal, a médio prazo, é pedir à SME um feed oficial (e-SIC / SP156).

## O que entra no portal

Só entram atividades que: sejam **abertas à comunidade**, tenham **faixa etária que inclua até 17 anos**, tenham dia/horário ou data definidos, e **ainda não tenham acontecido**. Ficam de fora: atividades só para adultos ou idosos, reuniões e instâncias de participação, atividades restritas a estudantes, e atividades sem faixa etária. Tudo o que é ignorado aparece no relatório, com o motivo.

- **Atividade permanente** (ex.: "Quinta, 20h às 21h") → turma **contínua**.
- **Atividade com data** → **evento** (curso de vários dias também; some depois do último dia).
- Instituição importada nasce **aprovada**, tipo **CEU**, sem login (`origem = 'ceu_sme'`).
- Atividades importadas **não têm o checklist de matrícula** do portal (os CEUs não exigem o mesmo); o painel lateral mostra o local, o público, as observações da secretaria e o link para a página oficial.

## 1) Preparar o banco (uma vez)

No Supabase → SQL Editor, rode `supabase/migracao_importacao_ceus.sql` (se o banco foi criado com o `schema.sql` mais novo, isso já está incluído). Ele cria as colunas de origem, horário, data final etc. e a tabela `importacao_ignoradas`. Pode rodar de novo quando houver versão nova do arquivo.

## 2) Testar sem gravar nada

```bash
npm install
npm run importar:diagnostico
```
Mostra o que o robô enxerga: robots.txt, camada do GeoSampa (campos e exemplo), lista de unidades, uma listagem de atividades, uma atividade aberta. **Copie a saída inteira** se algo vier diferente do esperado — é com ela que se ajusta a leitura.

O portal dos CEUs tem a API pública do WordPress (`/wp-json/`). Para conferir o que ela oferece:
```bash
npm run importar:diagnostico-api
```
**Resultado da conferência (nov/2026):** a API só expõe as "unidades" (sem endereço) e os "destaques". **As atividades não estão na API**, por isso o importador lê as páginas da programação.

Depois, o teste do fluxo completo (não grava; lê poucas atividades):
```bash
npm run importar:ceus
```
Opções úteis para testar rápido:
```bash
npm run importar:ceus -- --ceu=ceu-perus --paginas-max=3 --detalhes-max=10
```
Para guardar o HTML lido (para análise): acrescente `--salvar-html` (vai para `scripts/importador/amostras/`, que não vai para o GitHub).

## 3) Gravar no banco (primeira vez, no seu computador)

1. Copie `.env.importador.example` para `.env.importador` e preencha `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` (Supabase → Project Settings → API → chave **service_role / secret**). **Essa chave é secreta**: nunca vai para o site nem para o GitHub.
2. Teste de gravação pequeno:
   ```bash
   npm run importar:ceus:gravar -- --ceu=ceu-perus --paginas-max=3 --detalhes-max=10
   ```
3. Confira no site e no painel (as itens importadas aparecem com o aviso "Importada da Prefeitura").
4. Rodada completa:
   ```bash
   npm run importar:ceus:gravar
   ```
   Por padrão lê até **500 páginas de atividades novas por execução**; o resto entra nas rodadas seguintes (as já importadas não são lidas de novo).

## 4) Automatizar (todo dia, sozinho)

O arquivo `.github/workflows/sincronizar-ceus.yml` roda no GitHub, de graça.

1. GitHub → **Settings → Secrets and variables → Actions → Secrets**: crie `SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY`.
2. Aba **Actions → Sincronizar CEUs → Run workflow**: rode primeiro **sem** marcar "gravar" (teste) e depois **marcando** "gravar".
3. Só quando estiver tudo certo: **Settings → Secrets and variables → Actions → Variables** → crie `SINCRONIZACAO_ATIVA` = `true`. A partir daí roda todo dia às 06h (horário de Brasília).

## Como a atualização funciona

- Cada unidade e cada atividade guarda **origem** e **identificador externo**, então rodar de novo **atualiza** em vez de duplicar.
- Atividade que **sumiu do site** é removida do portal — mas só se a coleta foi completa; se a leitura falhou ou se **mais da metade** sumiria de uma vez, nada é removido e o relatório avisa (use `--forcar-remocao` se for esperado).
- A posição no mapa só é recalculada se o endereço mudou.
- Atividades lidas e recusadas por um motivo que não muda (só para adultos, só para estudantes, reuniões, sem faixa etária) ficam registradas na tabela `importacao_ignoradas` e **não são lidas de novo por 30 dias**. Sem isso, o limite diário de leituras seria gasto sempre nas mesmas atividades de adultos.
- Edições manuais em itens importados **serão sobrescritas** na próxima sincronização (o painel avisa que são "atualizadas automaticamente").

## Se algo der errado

| Sintoma | O que fazer |
|---|---|
| `robots.txt ... não permite` | O site pediu para não acessar aquele caminho. O importador tenta pelas páginas das unidades; se não bastar, peça o feed à SME. |
| `0 cartões lidos` no diagnóstico | O layout da listagem é diferente do esperado. Envie a saída do diagnóstico (e os HTMLs com `--salvar-html`). |
| `O banco ainda não tem as colunas de importação` | Rode `supabase/migracao_importacao_ceus.sql`. |
| Unidades "sem posição no mapa" | O endereço não foi achado no OpenStreetMap; ajuste no painel (Instituições → Localizar no mapa). |
| `GeoSampa indisponível` | Sem problema: a posição sai do endereço. |

## Testes

`npm test` cobre as funções de leitura (datas, horários, faixa etária, endereço, telefone, categoria) e a lógica de sincronização (o que entra, o que é ignorado, o que é atualizado ou removido e as travas de segurança), usando dados de exemplo — **não** acessa a internet.

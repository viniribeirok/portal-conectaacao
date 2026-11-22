import { BASE_CEU, WFS_CAMADA } from './config.js';
import { extratores } from './orquestrador.js';
import { acharChaveDeNome } from './geosampa.js';

const compacto = (o) => JSON.stringify(o, (k, v) => (typeof v === 'string' && v.length > 140 ? `${v.slice(0, 140)}…` : v));

export async function diagnosticar(deps) {
  const log = deps.log;
  const passo = async (titulo, fn) => {
    log(`\n── ${titulo}`);
    try { await fn(); } catch (e) { log(`   ✗ FALHOU: ${e.message}`); }
  };

  await passo('1. robots.txt do portal dos CEUs', async () => {
    const r = await deps.iniciarRobots(BASE_CEU);
    log(`   HTTP ${r.status}; ${r.regras.length} regra(s) para o nosso robô`);
    for (const linha of r.texto.split(/\r?\n/).slice(0, 25)) log(`   | ${linha}`);
    for (const caminho of ['/programacao/', '/unidades-ceus/', '/unidade/ceu-perus/', '/?s=&tipo_atividade=permanente', '/wp-json/', '/wp-sitemap.xml']) {
      log(`   ${deps.permitido(`${BASE_CEU}${caminho}`) ? '✓ permitido ' : '✗ BLOQUEADO'}  ${caminho}`);
    }
  });

  await passo('2. GeoSampa (camada de CEUs, WFS)', async () => {
    const itens = await deps.carregarWFS();
    log(`   ${itens.length} equipamentos em ${WFS_CAMADA}`);
    if (itens.length) {
      log(`   campos do primeiro item: ${Object.keys(itens[0].props).join(', ')}`);
      log(`   exemplo: ${compacto(itens[0].props)}`);
      log(`   coordenadas do primeiro: lat ${itens[0].latitude.toFixed(5)}, lon ${itens[0].longitude.toFixed(5)}`);
      log(`   campo com o nome do CEU: ${acharChaveDeNome(itens) || '(não identificado)'}`);
    }
  });

  let unidades = [];
  await passo('3. Lista de unidades', async () => {
    unidades = await deps.lerPagina(`${BASE_CEU}/unidades-ceus/`, extratores.unidades, { salvarComo: 'unidades.html' });
    log(`   ${unidades.length} unidades`);
    for (const u of unidades.slice(0, 3)) log(`   ${u.slug}  →  ${u.nome}`);
  });

  await passo('4. Página de uma unidade', async () => {
    const u = unidades.find((x) => x.slug === 'ceu-perus') || unidades[0];
    if (!u) throw new Error('sem unidades');
    const d = await deps.lerPagina(u.url, extratores.unidade, { salvarComo: 'unidade-exemplo.html' });
    log(`   ${u.slug}: ${d ? compacto(d) : 'endereço NÃO encontrado na página da unidade (será buscado nas páginas das atividades)'}`);
  });

  let primeiroCartao = null;
  await passo('5. Listagem de atividades permanentes (1ª página)', async () => {
    const r = await deps.lerPagina(`${BASE_CEU}/?s=&tipo_atividade=permanente`, extratores.listagem, { salvarComo: 'listagem-permanente.html' });
    log(`   ${r.cartoes.length} cartões lidos; ${r.inesperados} com estrutura inesperada; próxima página: ${r.proxima || '(não encontrada)'}`);
    for (const c of r.cartoes.slice(0, 3)) log(`   • ${compacto(c)}`);
    primeiroCartao = r.cartoes[0] || null;
  });

  await passo('6. Listagem de próximas atividades (1ª página)', async () => {
    const r = await deps.lerPagina(`${BASE_CEU}/?s=&tipo_atividade=proxima`, extratores.listagem, { salvarComo: 'listagem-proxima.html' });
    log(`   ${r.cartoes.length} cartões lidos; ${r.inesperados} com estrutura inesperada; próxima página: ${r.proxima || '(não encontrada)'}`);
    for (const c of r.cartoes.slice(0, 2)) log(`   • ${compacto(c)}`);
  });

  await passo('7. Página de uma atividade', async () => {
    if (!primeiroCartao) throw new Error('nenhum cartão para abrir');
    const d = await deps.lerPagina(primeiroCartao.url, extratores.atividade, { salvarComo: 'atividade-exemplo.html' });
    log(`   ${primeiroCartao.url}`);
    log(`   ${compacto(d)}`);
  });

  await passo('8. Outras vias (API do WordPress e mapa do site) — para o detalhe da API, rode: npm run importar:diagnostico-api', async () => {
    for (const caminho of ['/wp-json/', '/wp-sitemap.xml', '/sitemap_index.xml']) {
      const url = `${BASE_CEU}${caminho}`;
      if (!deps.permitido(url)) { log(`   ${caminho}: bloqueado pelo robots.txt`); continue; }
      const r = await deps.baixar(url);
      log(`   ${caminho}: HTTP ${r.status}${r.status === 200 ? ` (${r.texto.length} caracteres)` : ''}`);
    }
  });

  log('\nFim do diagnóstico. Copie tudo isso e envie para ajustar o importador, se algo estiver diferente do esperado.');
}


/** Explora a API do WordPress do portal: quais tipos de conteúdo existem e se as atividades estão lá, com quais campos. */
export async function diagnosticarAPI(deps) {
  const log = deps.log;
  const json = async (caminho) => {
    const url = `${BASE_CEU}${caminho}`;
    if (!deps.permitido(url)) throw new Error('bloqueado pelo robots.txt');
    const r = await deps.baixar(url);
    if (r.status !== 200) throw new Error(`HTTP ${r.status}`);
    return { dados: JSON.parse(r.texto), total: r.total, paginas: r.paginas };
  };
  const passo = async (titulo, fn) => { log(`\n── ${titulo}`); try { await fn(); } catch (e) { log(`   ✗ FALHOU: ${e.message}`); } };
  const NUCLEO = new Set(['post', 'page', 'attachment', 'nav_menu_item', 'wp_block', 'wp_template', 'wp_template_part', 'wp_navigation', 'wp_global_styles', 'wp_font_family', 'wp_font_face']);
  let tipos = [];

  await passo('A. Índice da API (/wp-json/)', async () => {
    const { dados } = await json('/wp-json/');
    log(`   site: ${dados.name} | namespaces: ${(dados.namespaces || []).join(', ')}`);
    const rotas = Object.keys(dados.routes || {});
    log(`   ${rotas.length} rotas; as que parecem ligadas a atividades/unidades:`);
    for (const r of rotas.filter((x) => /ativ|unid|ceu|event|program|agenda/i.test(x)).slice(0, 25)) log(`   • ${r}`);
  });

  await passo('B. Tipos de conteúdo (/wp-json/wp/v2/types)', async () => {
    const { dados } = await json('/wp-json/wp/v2/types');
    tipos = Object.values(dados).map((t) => ({ slug: t.slug, base: t.rest_base, nome: t.name }));
    for (const t of tipos) log(`   ${NUCLEO.has(t.slug) ? '·' : '★'} ${t.slug}  (rest_base: ${t.base})  ${t.nome}`);
  });

  await passo('C. Taxonomias (categorias, faixa etária, unidade etc.)', async () => {
    const { dados } = await json('/wp-json/wp/v2/taxonomies');
    for (const t of Object.values(dados)) log(`   ${t.slug}  (rest_base: ${t.rest_base}; tipos: ${(t.types || []).join(', ')})  ${t.name}`);
  });

  for (const t of tipos.filter((x) => !NUCLEO.has(x.slug)).slice(0, 6)) {
    await passo(`D. Exemplo do tipo "${t.slug}"`, async () => {
      const { dados, total, paginas } = await json(`/wp-json/wp/v2/${t.base}?per_page=1`);
      log(`   total de itens: ${total ?? '?'} | páginas de 1: ${paginas ?? '?'}`);
      const item = Array.isArray(dados) ? dados[0] : dados;
      if (!item) { log('   (nenhum item)'); return; }
      log(`   campos: ${Object.keys(item).join(', ')}`);
      const resumo = { ...item }; delete resumo._links; delete resumo.guid; delete resumo.yoast_head; delete resumo.yoast_head_json;
      log(`   exemplo: ${JSON.stringify(resumo, (k, v) => (typeof v === 'string' && v.length > 160 ? `${v.slice(0, 160)}…` : v)).slice(0, 2200)}`);
    });
  }
  log('\nFim do diagnóstico da API. Copie tudo e envie.');
}

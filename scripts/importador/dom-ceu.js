/**
 * Leitura das páginas do portal dos CEUs a partir de um `document` (DOM). Não usa rede nem classes CSS do site:
 * procura por links e por padrões de texto (data, horário, "Faixa etária - ...", "...CEP: ..."), que mudam menos que o layout.
 * Recebe o `document` por parâmetro — em produção vem do jsdom; nos testes, de um navegador.
 */
import { parseQuando, parseFaixaEtaria, ehLinhaDeEndereco, parseEndereco, parseTelefone, semAcento, normalizar } from './texto.js';

const BLOCOS = new Set(['ADDRESS', 'ARTICLE', 'ASIDE', 'BLOCKQUOTE', 'BR', 'DD', 'DIV', 'DL', 'DT', 'FIGCAPTION', 'FIGURE', 'FOOTER', 'FORM', 'H1', 'H2', 'H3', 'H4', 'H5', 'H6', 'HEADER', 'HR', 'LI', 'MAIN', 'NAV', 'OL', 'P', 'PRE', 'SECTION', 'TABLE', 'TBODY', 'TD', 'TFOOT', 'TH', 'THEAD', 'TR', 'UL']);

/** Texto de um trecho da página, uma linha por bloco (célula, parágrafo, <br>...). */
export function linhasDe(raiz) {
  const partes = [];
  const visita = (no) => {
    if (no.nodeType === 3) { partes.push(no.nodeValue); return; }
    if (no.nodeType !== 1) return;
    const tag = no.tagName.toUpperCase();
    if (tag === 'SCRIPT' || tag === 'STYLE' || tag === 'NOSCRIPT') return;
    const bloco = BLOCOS.has(tag);
    if (bloco) partes.push('\n');
    for (const f of no.childNodes) visita(f);
    if (bloco) partes.push('\n');
  };
  visita(raiz);
  return partes.join('').split('\n').map((l) => l.replace(/\s+/g, ' ').trim()).filter(Boolean);
}

export function absoluto(href, base) {
  try { return new URL(href, base).toString(); } catch (e) { return null; }
}
export function segmentos(url) {
  try { return new URL(url).pathname.split('/').filter(Boolean); } catch (e) { return []; }
}
const limpo = (s) => String(s || '').replace(/\s+/g, ' ').trim();

/** Atividade = link no formato /ceu-xxx/nome-da-atividade/ (atividades "toda a rede" não têm unidade e ficam de fora). */
export function ehUrlDeAtividade(url, base) {
  if (!url) return false;
  try {
    if (new URL(url).host !== new URL(base).host) return false;
  } catch (e) { return false; }
  const seg = segmentos(url);
  return seg.length === 2 && /^ceu-/.test(seg[0]);
}

const MINUSCULAS = new Set(['de', 'da', 'do', 'das', 'dos', 'e']);
export function nomeDoSlug(slug) {
  return String(slug).split('-').map((p, i) => (i === 0 ? p.toUpperCase() : MINUSCULAS.has(p) ? p : p.charAt(0).toUpperCase() + p.slice(1))).join(' ');
}

const INICIO_LOGRADOURO = /\s(?=(?:Rua|Avenida|Av\.?|Estrada|Travessa|Pra[çc]a|Alameda|Largo|Rodovia|Viela|Caminho|Beco|Passarela|Rod\.|Al\.|Tv\.)(?:\s|,))/;
const TEXTO_CEP = /CEP:?\s*\d{5}-?\d{3}/i;

/** Cartão de uma unidade na lista: "CEU X – Fulano <Rua...> - Bairro - CEP: 00000000 DRE Y Acessar página do CEU". */
export function interpretarCartaoUnidade(a) {
  const linhas = linhasDe(a).filter((l) => !/^Acessar p[áa]gina/i.test(l));
  const texto = limpo(a.textContent).replace(/\s*Acessar p[áa]gina do CEU\s*$/i, '');
  // "DRE Guaianases": primeiro como linha própria; senão, no texto corrido (só maiúsculas, para não pegar "Alexandre")
  const dre = (linhas.find((l) => /^DRE\s+/.test(l)) || '').replace(/^DRE\s+/, '') || (texto.match(/(?:^|[^A-Za-z])DRE\s+(.+?)\s*$/) || [])[1] || '';
  let nome = '';
  let linhaEndereco = '';
  if (linhas.length >= 2 && /^ceu\b/i.test(semAcento(linhas[0])) && linhas[0].length <= 120 && !TEXTO_CEP.test(linhas[0])) {
    nome = linhas[0];
    linhaEndereco = linhas.find((l) => TEXTO_CEP.test(l)) || '';
  } else {
    const iCep = texto.search(TEXTO_CEP);
    if (iCep >= 0) {
      const antes = texto.slice(0, iCep);
      const iRua = antes.search(INICIO_LOGRADOURO);
      if (iRua > 0) {
        nome = antes.slice(0, iRua).trim();
        linhaEndereco = `${antes.slice(iRua).trim()} ${texto.slice(iCep).match(TEXTO_CEP)[0]}`;
      }
    }
    if (!nome) nome = texto.split(/\s+DRE\s+/i)[0].trim();
  }
  const end = linhaEndereco ? parseEndereco(linhaEndereco.replace(/\s+DRE\s+.*$/i, '')) : null;
  return { nome, endereco: end?.logradouro || '', bairro: end?.bairro || '', cep: end?.cep || '', dre };
}

/** Lista de unidades (CEUs) a partir da página "Unidades CEUs" — já com nome oficial, endereço, bairro e CEP. */
export function listarUnidades(doc, base) {
  const melhores = new Map();
  for (const a of doc.querySelectorAll('a[href*="/unidade/"]')) {
    const url = absoluto(a.getAttribute('href'), base);
    if (!url) continue;
    const seg = segmentos(url);
    const i = seg.indexOf('unidade');
    const slug = i >= 0 ? seg[i + 1] : '';
    if (!slug || !/^ceu-/.test(slug)) continue;
    const tamanho = limpo(a.textContent).length;
    const atual = melhores.get(slug);
    if (!atual || tamanho > atual.tamanho) melhores.set(slug, { a, tamanho, url: `${new URL(url).origin}/unidade/${slug}/` });
  }
  return [...melhores.entries()].map(([slug, { a, url }]) => {
    const info = interpretarCartaoUnidade(a);
    return { slug, url, nome: info.nome || nomeDoSlug(slug), endereco: info.endereco, bairro: info.bairro, cep: info.cep, dre: info.dre };
  });
}

/** Nome, endereço, CEP e telefone da unidade — o bloco "CEU ...\nRua X, 10 - Bairro - CEP: 00000-000\n...\ntelefone". */
export function extrairBlocoUnidade(linhas) {
  let bloco = null;
  for (let i = 0; i < linhas.length; i++) {
    if (!ehLinhaDeEndereco(linhas[i])) continue;
    const end = parseEndereco(linhas[i]);
    const nome = i > 0 && /^ceu\b/i.test(semAcento(linhas[i - 1])) ? linhas[i - 1] : '';
    const telefone = parseTelefone(linhas.slice(i + 1, i + 13));
    if (!bloco) bloco = { nome, endereco: end.logradouro, bairro: end.bairro, cep: end.cep, telefone };
    else {
      if (!bloco.telefone && telefone) bloco.telefone = telefone;
      if (!bloco.nome && nome) bloco.nome = nome;
    }
  }
  return bloco;
}

export function lerUnidade(doc) {
  const bloco = extrairBlocoUnidade(linhasDe(doc.body));
  return bloco || null; // o nome vem da lista de unidades (o título desta página junta o menu de todos os CEUs)
}

/** Cartões de atividade de uma página de listagem. `inesperados` conta cartões cuja estrutura não deu pra entender. */
export function listarCartoes(doc, base) {
  const cartoes = [];
  const vistos = new Set();
  let inesperados = 0;
  const detalhesInesperados = [];
  const linkDeAtividade = (h) => { const a = h.querySelector('a[href]'); return a ? absoluto(a.getAttribute('href'), base) : null; };

  for (const h of doc.querySelectorAll('h2, h3, h4')) {
    const url = linkDeAtividade(h);
    if (!url || !ehUrlDeAtividade(url, base)) continue;
    const chave = url.replace(/[?#].*$/, '').replace(/\/+$/, '');
    if (vistos.has(chave)) continue;

    const titulo = limpo(h.textContent);
    const eTituloDeAtividade = (x) => ehUrlDeAtividade(linkDeAtividade(x), base);
    // sobe enquanto o bloco tiver só ESTE título de atividade e para no primeiro que já traz dia/data: esse é o cartão
    // (não depende de haver link da unidade: a unidade também está no começo da URL da atividade)
    let card = null;
    let ultimo = null;
    for (let atual = h.parentElement, subidas = 0; atual && subidas < 8; atual = atual.parentElement, subidas++) {
      if ([...atual.querySelectorAll('h2, h3, h4')].filter(eTituloDeAtividade).length !== 1) break;
      ultimo = atual;
      const ls = linhasDe(atual);
      const iT = ls.findIndex((l) => l === titulo);
      if (parseQuando(ls.slice(iT >= 0 ? iT + 1 : 0)).tipo) { card = atual; break; }
    }
    card = card || ultimo;
    if (!card) { inesperados++; detalhesInesperados.push({ titulo, url, motivo: 'não achei o bloco do cartão' }); continue; }
    vistos.add(chave);

    const categorias = [...card.querySelectorAll('a[href]')]
      .filter((x) => /atividades(%5B|\[)/i.test(x.getAttribute('href') || ''))
      .map((x) => limpo(x.textContent)).filter(Boolean);
    const linksUnidade = [...card.querySelectorAll('a[href*="/unidade/"]')];
    const unidadeUrl = linksUnidade.length ? absoluto(linksUnidade[0].getAttribute('href'), base) : `${new URL(base).origin}/unidade/${segmentos(url)[0]}/`;
    const unidadeNome = linksUnidade.map((x) => limpo(x.textContent)).sort((p, q) => q.length - p.length)[0] || '';

    const linhas = linhasDe(card);
    const iTitulo = linhas.findIndex((l) => l === titulo);
    const depois = iTitulo >= 0 ? linhas.slice(iTitulo + 1) : linhas;
    const quando = parseQuando(depois.filter((l) => l !== unidadeNome && !categorias.includes(l)));
    const seg = segmentos(url);
    cartoes.push({ url: url.replace(/[?#].*$/, ''), slugUnidade: seg[0], slugAtividade: seg[1], titulo, categorias, unidadeUrl, unidadeNome, quando });
  }
  return { cartoes, inesperados, detalhesInesperados };
}

/** Link da próxima página de resultados (paginação do WordPress), ou null. */
export function proximaPagina(doc, base) {
  const candidatos = [
    doc.querySelector('link[rel="next"]'),
    doc.querySelector('a[rel="next"]'),
    doc.querySelector('a.next, .nav-links a.next, .nav-next a, li.next a, .pagination .next a'),
  ].filter(Boolean);
  for (const el of candidatos) { const u = absoluto(el.getAttribute('href'), base); if (u) return u; }
  for (const a of doc.querySelectorAll('a[href]')) {
    const t = semAcento(a.textContent).toLowerCase().trim();
    if (/^(proxima|proximo|seguinte|next)\b/.test(t) || t === '›' || t === '»' || t === '>') {
      const u = absoluto(a.getAttribute('href'), base);
      if (u && !u.includes('#')) return u;
    }
  }
  return null;
}

/** Detalhes da página de uma atividade: faixa etária, público, local dentro da unidade, observações e descrição. */
export function lerAtividade(doc) {
  const linhas = linhasDe(doc.body);
  const titulo = limpo(doc.querySelector('h1')?.textContent);
  const pegar = (re) => { const l = linhas.find((x) => re.test(x)); return l ? l.replace(re, '').trim() : ''; };
  const faixaTexto = pegar(/^Faixa et[aá]ria\s*[-–:]\s*/i);
  const publicoAlvo = pegar(/^P[úu]blico[ -]?alvo\s*[-–:]\s*/i);

  const iEnd = linhas.findIndex(ehLinhaDeEndereco);
  let local = '';
  if (iEnd >= 0) {
    const prox = linhas[iEnd + 1] || '';
    if (prox && !/^(Informa[cç][õo]es|Descritivo|Faixa|P[úu]blico)/i.test(prox)) local = prox;
  }

  const iInfo = linhas.findIndex((l) => /^Informa[cç][õo]es/i.test(l));
  let observacoes = '';
  if (iInfo >= 0) {
    const pedacos = [];
    for (let k = iInfo; k < Math.min(linhas.length, iInfo + 4); k++) {
      if (k > iInfo && /^(Descritivo|Participe)/i.test(linhas[k])) break;
      pedacos.push(linhas[k]);
    }
    observacoes = pedacos.join(' ').slice(0, 300);
  }

  const iDesc = linhas.findIndex((l) => /^Descritivo/i.test(l));
  let descricao = '';
  if (iDesc >= 0) {
    const pedacos = [];
    for (let k = iDesc + 1; k < linhas.length; k++) {
      if (/^Participe/i.test(linhas[k])) break;
      pedacos.push(linhas[k]);
    }
    descricao = pedacos.join(' ').slice(0, 600);
  }

  const iFaixa = linhas.findIndex((l) => /^Faixa et[aá]ria/i.test(l));
  const iTit = titulo ? linhas.findIndex((l) => l === titulo) : -1;
  const ateFaixa = iFaixa > 0 ? linhas.slice(iTit >= 0 ? iTit + 1 : 0, iFaixa) : [];

  return {
    titulo, faixa: parseFaixaEtaria(faixaTexto), faixaTexto, publicoAlvo, unidade: extrairBlocoUnidade(linhas),
    local, observacoes, descricao, quando: parseQuando(ateFaixa), normalizado: normalizar(titulo),
  };
}

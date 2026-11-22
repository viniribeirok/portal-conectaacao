import { USER_AGENT, INTERVALO_MS, TIMEOUT_MS } from './config.js';

const dormir = (ms) => new Promise((r) => setTimeout(r, ms));
let ultimaRequisicao = 0;
let regrasRobots = null; // null = ainda não carregado (tudo permitido)

function padraoParaRegex(padrao) {
  const fim = padrao.endsWith('$');
  const corpo = (fim ? padrao.slice(0, -1) : padrao).replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*');
  return new RegExp(`^${corpo}${fim ? '$' : ''}`);
}

/** Lê o robots.txt e devolve as regras que valem para o nosso robô (ou para "*"). */
export function interpretarRobots(texto, agente = USER_AGENT) {
  const meu = agente.toLowerCase();
  const grupos = [];
  let atual = null;
  let lendoAgentes = false;
  for (const bruta of String(texto).split(/\r?\n/)) {
    const linha = bruta.replace(/#.*/, '').trim();
    if (!linha) continue;
    const i = linha.indexOf(':');
    if (i < 0) continue;
    const campo = linha.slice(0, i).trim().toLowerCase();
    const valor = linha.slice(i + 1).trim();
    if (campo === 'user-agent') {
      if (!lendoAgentes) { atual = { agentes: [], regras: [] }; grupos.push(atual); }
      atual.agentes.push(valor.toLowerCase());
      lendoAgentes = true;
    } else if (campo === 'allow' || campo === 'disallow') {
      lendoAgentes = false;
      if (atual && valor !== '') atual.regras.push({ permitir: campo === 'allow', padrao: valor, re: padraoParaRegex(valor) });
    } else lendoAgentes = false;
  }
  const especificos = grupos.filter((g) => g.agentes.some((a) => a !== '*' && meu.includes(a)));
  const escolhidos = especificos.length ? especificos : grupos.filter((g) => g.agentes.includes('*'));
  return escolhidos.flatMap((g) => g.regras);
}

/** Regra mais específica (padrão mais longo) vence; em empate, "Allow" vence. */
export function caminhoPermitido(regras, caminhoComQuery) {
  let melhor = null;
  for (const r of regras) {
    if (!r.re.test(caminhoComQuery)) continue;
    if (!melhor || r.padrao.length > melhor.padrao.length || (r.padrao.length === melhor.padrao.length && r.permitir)) melhor = r;
  }
  return melhor ? melhor.permitir : true;
}

export function definirRegras(regras) { regrasRobots = regras; }

export function permitido(url) {
  if (!regrasRobots) return true;
  try { const u = new URL(url); return caminhoPermitido(regrasRobots, `${u.pathname}${u.search}`); } catch (e) { return true; }
}

export async function baixar(url, { tentativas = 3, ignorarRobots = false } = {}) {
  if (!ignorarRobots && !permitido(url)) {
    const e = new Error(`O robots.txt do site não permite acessar: ${url}`);
    e.codigo = 'ROBOTS';
    throw e;
  }
  let erro;
  for (let t = 1; t <= tentativas; t++) {
    const espera = ultimaRequisicao + INTERVALO_MS - Date.now();
    if (espera > 0) await dormir(espera);
    ultimaRequisicao = Date.now();
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), TIMEOUT_MS);
    try {
      const resp = await fetch(url, {
        headers: { 'User-Agent': USER_AGENT, Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8', 'Accept-Language': 'pt-BR,pt;q=0.9' },
        signal: ctl.signal, redirect: 'follow',
      });
      clearTimeout(timer);
      if (resp.status === 429 || resp.status >= 500) throw new Error(`HTTP ${resp.status}`);
      return { status: resp.status, texto: resp.status === 200 ? await resp.text() : '', url: resp.url || url, total: resp.headers.get('x-wp-total'), paginas: resp.headers.get('x-wp-totalpages') };
    } catch (e) {
      clearTimeout(timer);
      erro = e;
      await dormir(2000 * t);
    }
  }
  throw new Error(`Não consegui baixar ${url}: ${erro?.message || erro}`);
}

/** Baixa e interpreta o robots.txt do site. Se não existir (404), tudo é permitido. */
export async function iniciarRobots(base) {
  const r = await baixar(`${base}/robots.txt`, { ignorarRobots: true });
  const texto = r.status === 200 ? r.texto : '';
  regrasRobots = interpretarRobots(texto);
  return { status: r.status, texto, regras: regrasRobots };
}

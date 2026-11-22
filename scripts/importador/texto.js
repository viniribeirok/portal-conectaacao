/**
 * Funções de texto do importador — puras (sem rede e sem DOM), por isso fáceis de testar.
 * Entendem o formato usado pelo portal dos CEUs: "20 Nov 2026", "02 a 20 Nov 2026", "Terça",
 * "8h30min às 10h30min / 15h às 17h", "Faixa etária - Adulto (a partir de 18 anos)",
 * "Rua Gaspar da Silva, 240 - Parque do Carmo - CEP: 08270000"...
 */
import { normalizarTelefone } from '../../src/utils/contato.js';

export const semAcento = (s) => String(s ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
export const normalizar = (s) => semAcento(s).toLowerCase().replace(/\s+/g, ' ').trim();
const pad = (n) => String(n).padStart(2, '0');
const iso = (a, m, d) => `${a}-${pad(m)}-${pad(d)}`;

// ------------------------------------------------------------------ datas
const MESES = { jan: 1, fev: 2, mar: 3, abr: 4, mai: 5, jun: 6, jul: 7, ago: 8, set: 9, out: 10, nov: 11, dez: 12 };
const MES = '(jan|fev|mar|abr|mai|jun|jul|ago|set|out|nov|dez)[a-z]*\\.?';
const DIA = '(\\d{1,2})';
const ANO = '(?:de\\s+)?(\\d{4})';
const DE = '(?:de\\s+)?';
const PADROES_DATA = [
  { re: new RegExp(`${DIA}\\s*${DE}${MES}\\s*${ANO}\\s*a\\s*${DIA}\\s*${DE}${MES}\\s*${ANO}`), g: (m) => [[m[3], m[2], m[1]], [m[6], m[5], m[4]]] },
  { re: new RegExp(`${DIA}\\s*${DE}${MES}\\s*a\\s*${DIA}\\s*${DE}${MES}\\s*${ANO}`), g: (m) => [[m[5], m[2], m[1]], [m[5], m[4], m[3]]] },
  { re: new RegExp(`${DIA}\\s*a\\s*${DIA}\\s*${DE}${MES}\\s*${ANO}`), g: (m) => [[m[4], m[3], m[1]], [m[4], m[3], m[2]]] },
  { re: new RegExp(`${DIA}\\s*${DE}${MES}\\s*${ANO}`), g: (m) => [[m[3], m[2], m[1]], [m[3], m[2], m[1]]] },
];

function dataValida(a, mesTxt, d) {
  const m = MESES[mesTxt.slice(0, 3)];
  const ano = Number(a), dia = Number(d);
  if (!m || ano < 2000 || ano > 2100 || dia < 1 || dia > 31) return null;
  const dt = new Date(ano, m - 1, dia);
  if (dt.getMonth() !== m - 1) return null;
  return iso(ano, m, dia);
}

/** "20 Nov 2026" | "02 a 20 Nov 2026" | "27 Jun a 29 Nov 2026" -> { inicio, fim } (AAAA-MM-DD) ou null. */
export function parseDatas(texto) {
  const t = normalizar(texto);
  for (const { re, g } of PADROES_DATA) {
    const m = t.match(re);
    if (!m) continue;
    const [[a1, m1, d1], [a2, m2, d2]] = g(m);
    const inicio = dataValida(a1, m1, d1), fim = dataValida(a2, m2, d2);
    if (inicio && fim) return { inicio, fim: fim < inicio ? inicio : fim };
  }
  return null;
}

export const formatarDataBR = (isoStr) => { const [a, m, d] = isoStr.split('-'); return `${d}/${m}/${a}`; };

// ------------------------------------------------------------------ dias da semana e horários
const DIAS = [['segunda', 'Segunda'], ['terca', 'Terça'], ['quarta', 'Quarta'], ['quinta', 'Quinta'], ['sexta', 'Sexta'], ['sabado', 'Sábado'], ['domingo', 'Domingo']];

export function parseDiasSemana(texto) {
  const t = normalizar(texto);
  return DIAS.filter(([chave]) => new RegExp(`\\b${chave}`).test(t)).map(([, nome]) => nome);
}

const H = '(\\d{1,2})\\s*h(?:\\s*(\\d{2}))?(?:\\s*min)?';
const hm = (h, m) => (Number(h) > 23 ? null : `${pad(h)}:${m ?? '00'}`);

/** "8h30min às 10h30min / 15h às 17h" -> [{ini:'08:30', fim:'10:30'}, {ini:'15:00', fim:'17:00'}]; "14h" -> [{ini:'14:00', fim:null}] */
export function parseHorarios(texto) {
  const t = normalizar(texto);
  const faixas = [];
  const reFaixa = new RegExp(`${H}\\s*(?:as|a|-|ate)\\s*${H}`, 'g');
  let m;
  while ((m = reFaixa.exec(t))) {
    const ini = hm(m[1], m[2]), fim = hm(m[3], m[4]);
    if (ini && fim) faixas.push({ ini, fim });
  }
  if (faixas.length) return faixas;
  const reUnico = new RegExp(H, 'g');
  while ((m = reUnico.exec(t))) { const ini = hm(m[1], m[2]); if (ini) faixas.push({ ini, fim: null }); }
  return faixas;
}

// linha que é só dia(s) da semana: "Terça", "Quinta / Quinta", "Sábado e Domingo" (e não "CEU Quinta do Sol")
const SO_DIAS = /^(?:(?:segunda|terca|quarta|quinta|sexta|sabado|domingo)(?:-feira)?(?:\s*(?:\/|,|e|\+|a)\s*)?)+$/;

/**
 * Recebe as linhas de "quando" de uma atividade (ex.: ['Terça', '8h às 09h'] ou ['02 a 20 Nov 2026', '14h às 17h'])
 * e devolve { tipo: 'permanente'|'datado'|null, dias, inicio, fim, horarios, horarioBruto }.
 */
export function parseQuando(linhas) {
  const lista = (linhas || []).map((l) => String(l).trim()).filter(Boolean);
  let datas = null;
  for (const l of lista) { datas = parseDatas(l); if (datas) break; }
  const semData = lista.filter((l) => !parseDatas(l));
  const soDias = semData.filter((l) => SO_DIAS.test(normalizar(l)));
  // se nenhuma linha for só de dias, aceita o dia dentro de outra linha — menos nas que começam com "CEU" (nome de unidade)
  const dias = parseDiasSemana((soDias.length ? soDias : semData.filter((l) => !/^ceu\b/.test(normalizar(l)))).join(' | '));
  const linhaHora = lista.find((l) => /\d\s*h/i.test(l) && !parseDatas(l)) || '';
  const horarios = linhaHora ? parseHorarios(linhaHora) : [];
  if (datas) return { tipo: 'datado', dias: [], inicio: datas.inicio, fim: datas.fim, horarios, horarioBruto: linhaHora };
  if (dias.length) return { tipo: 'permanente', dias, inicio: null, fim: null, horarios, horarioBruto: linhaHora };
  return { tipo: null, dias: [], inicio: null, fim: null, horarios, horarioBruto: linhaHora };
}

/** Texto para mostrar na tela: "Quinta, 20h às 21h" | "20/11/2026, 11h às 17h" | "02/11/2026 a 20/11/2026, 14h às 17h". */
export function montarHorarioTexto(q) {
  const hora = q.horarioBruto ? `, ${q.horarioBruto}` : '';
  if (q.tipo === 'permanente') return `${q.dias.join(' / ')}${hora}`;
  if (q.tipo === 'datado') return `${q.inicio === q.fim ? formatarDataBR(q.inicio) : `${formatarDataBR(q.inicio)} a ${formatarDataBR(q.fim)}`}${hora}`;
  return q.horarioBruto || '';
}

// ------------------------------------------------------------------ faixa etária
/** "Adulto (a partir de 18 anos)" -> adulto; "06 a 09 anos" -> 6–9; "Livre" -> 0–99; "Sub-11" -> 9–11... */
export function parseFaixaEtaria(texto) {
  const bruto = String(texto ?? '').trim();
  if (!bruto) return { desconhecida: true, adulto: false, min: null, max: null, bruto };
  const partes = bruto.split(/[;,\n]|\s\/\s/).map(normalizar).filter(Boolean);
  const faixas = [];
  let adultos = 0;
  let reconhecidas = 0;
  for (const p of partes) {
    let m;
    if ((m = p.match(/(\d{1,2})\s*a\s*(\d{1,2})\s*anos?/))) faixas.push([Number(m[1]), Number(m[2])]);
    else if ((m = p.match(/a partir de\s*(\d{1,2})\s*anos?/))) { if (Number(m[1]) >= 18) adultos++; else faixas.push([Number(m[1]), 99]); }
    else if ((m = p.match(/(\d{2})\s*\+/))) { if (Number(m[1]) >= 18) adultos++; else faixas.push([Number(m[1]), 99]); }
    else if ((m = p.match(/\bsub-?\s*(\d{1,2})\b/))) { const n = Number(m[1]); faixas.push([Math.max(0, n - 2), n]); }
    else if (/livre|todas as idades|todos/.test(p)) faixas.push([0, 99]);
    else if (/infantojuvenil/.test(p)) faixas.push([0, 17]);
    else if (/\binfantil\b/.test(p)) faixas.push([0, 10]);
    else if (/\bjuvenil\b/.test(p)) faixas.push([12, 17]);
    else if (/adulto|terceira idade|idoso|master/.test(p)) adultos++;
    else continue;
    reconhecidas++;
  }
  if (reconhecidas === 0) return { desconhecida: true, adulto: false, min: null, max: null, bruto };
  if (faixas.length === 0) return { desconhecida: false, adulto: true, min: 18, max: 99, bruto };
  let min = Math.min(...faixas.map((f) => f[0]));
  let max = Math.max(...faixas.map((f) => f[1]));
  if (adultos > 0) max = 99;
  min = Math.max(0, Math.min(99, min)); max = Math.max(min, Math.min(99, max));
  return { desconhecida: false, adulto: false, min, max, bruto };
}

// ------------------------------------------------------------------ endereço e telefone
/**
 * "Rua Gaspar da Silva, 240 - Parque do Carmo - CEP: 08270000" -> { logradouro, bairro, cep: '08270-000' } ou null.
 * Aceita endereços com complemento ("Av X, SN - Portaria 1 - Jardim Y - Iguatemi - CEP: ..."): o logradouro é o 1º trecho
 * e o bairro é o último trecho antes do CEP.
 */
export function parseEndereco(linha) {
  const t = String(linha ?? '').replace(/\s+/g, ' ').trim();
  const partes = t.split(/\s+-\s+/);
  if (partes.length < 2) return null;
  const mCep = partes[partes.length - 1].match(/^CEP:?\s*(\d{5})-?(\d{3})$/i);
  if (!mCep) return null;
  const logradouro = partes[0].replace(/\s+,/g, ',').trim();
  if (!logradouro) return null;
  return { logradouro, bairro: partes.length >= 3 ? partes[partes.length - 2].trim() : '', cep: `${mCep[1]}-${mCep[2]}` };
}

export function ehLinhaDeEndereco(linha) {
  return parseEndereco(linha) !== null && !/borges lagoa|viaduto do cha/i.test(semAcento(linha));
}

/** Procura o primeiro telefone ("5990-3369", "(11) 5990-3369") nas linhas; devolve no formato guardado no banco (55+DDD+número). DDD padrão: 11. */
export function parseTelefone(linhas) {
  for (const l of linhas || []) {
    if (/@|CEP/i.test(l)) continue;
    const m = String(l).match(/(?:\(?\b(\d{2})\)?[\s.-]*)?\b(9?\d{4})[-\s](\d{4})\b/);
    if (m) {
      const ddd = m[1] || '11';
      return normalizarTelefone(`${ddd}${m[2]}${m[3]}`);
    }
  }
  return '';
}

// ------------------------------------------------------------------ categoria
const REGRAS_CATEGORIA = [
  ['Artes Marciais', /artes marciais|\blutas?\b|judo|karate|muay|boxe|jiu|taekwondo|aikido|kung|capoeira|krav|kendo/],
  ['Dança', /danc|ritmic|ballet|\bbale\b|jazz|hip hop|zumba|ritmos|forro|samba|sapateado|folclor/],
  ['Esportes', /esporte|futsal|futebol|volei|basquete|natacao|aquatic|hidrogin|ginastic|atletismo|skate|handebol|corrida|caminhada|condicionamento|funcional|pilates|yoga|raquete|tenis|tabuleiro|xadrez|bocha|badminton|recreio|brincar|brincadeiras|jogos|piscina/],
  ['Reforço Escolar', /reforco|alfabetiz|matematic|portugues|ingles|espanhol|coreano|libras|idioma|informatica|robotica|programacao|\bgames?\b|maker|tecnologia|telecentro/],
  ['Cultura', /cultur|teatro|musica|cinema|circo|contacao|biblioteca|sarau|artes visuais|artesanato|exposicao|espetaculo|\bshow\b|orquestra|violao|coral|desenho|pintura|literar|leitura|fotografia|audiovisual/],
];

/** Escolhe uma das 5 categorias do portal a partir dos rótulos e do título da atividade do CEU. */
export function mapearCategoria(categorias, titulo) {
  const t = normalizar([...(categorias || []), titulo].join(' | '));
  for (const [nome, re] of REGRAS_CATEGORIA) if (re.test(t)) return nome;
  return 'Cultura';
}

/** Atividades que não são para o público do portal (reuniões, seminários, instâncias de participação...). */
export function ignorarPorCategoria(categorias, titulo) {
  const t = normalizar([...(categorias || []), titulo].join(' | '));
  return /reuniao|seminario|conselho gestor|colegiado|\bapm\b|gremio|encontro formativo|visita educativa|palestra|assembleia|instancias? de participacao/.test(t);
}

// ------------------------------------------------------------------ casamento de nomes (GeoSampa x portal dos CEUs)
const STOP = new Set(['ceu', 'cei', 'emei', 'emef', 'cemei', 'de', 'da', 'do', 'das', 'dos', 'e', 'prof', 'profa', 'professor', 'professora']);
export function tokensDoNome(nome) {
  return new Set(normalizar(nome).replace(/\(.*?\)/g, ' ').replace(/[^a-z0-9 ]/g, ' ').split(' ').filter((p) => p && !STOP.has(p)));
}
/** Todas as palavras do "apelido" da unidade (ex.: slug 'ceu-parque-do-carmo') aparecem no nome do equipamento? */
export function nomeCasa(apelido, nomeEquipamento) {
  const a = tokensDoNome(String(apelido).replace(/-/g, ' '));
  const b = tokensDoNome(nomeEquipamento);
  if (a.size === 0) return false;
  for (const p of a) if (!b.has(p)) return false;
  return true;
}

// ------------------------------------------------------------------ coordenadas (SIRGAS 2000 / UTM 23S -> latitude e longitude)
/** Plano B caso o GeoSampa devolva a coordenada original (EPSG:31983) em vez de latitude/longitude. */
export function utm23sParaLatLon(E, N) {
  const a = 6378137.0, f = 1 / 298.257222101, k0 = 0.9996, E0 = 500000, N0 = 10000000;
  const lon0 = (-45 * Math.PI) / 180;
  const n = f / (2 - f);
  const A = (a / (1 + n)) * (1 + (n * n) / 4 + n ** 4 / 64);
  const beta = [n / 2 - (2 * n * n) / 3 + (37 * n ** 3) / 96 - n ** 4 / 360, n * n / 48 + n ** 3 / 15 - (437 * n ** 4) / 1440, (17 * n ** 3) / 480 - (37 * n ** 4) / 840, (4397 * n ** 4) / 161280];
  const delta = [2 * n - (2 * n * n) / 3 - 2 * n ** 3, (7 * n * n) / 3 - (8 * n ** 3) / 5, (56 * n ** 3) / 15];
  const xi = (N - N0) / (k0 * A), eta = (E - E0) / (k0 * A);
  let xiP = xi, etaP = eta;
  for (let j = 1; j <= 4; j++) {
    xiP -= beta[j - 1] * Math.sin(2 * j * xi) * Math.cosh(2 * j * eta);
    etaP -= beta[j - 1] * Math.cos(2 * j * xi) * Math.sinh(2 * j * eta);
  }
  const chi = Math.asin(Math.sin(xiP) / Math.cosh(etaP));
  let phi = chi;
  for (let j = 1; j <= 3; j++) phi += delta[j - 1] * Math.sin(2 * j * chi);
  const lam = lon0 + Math.atan2(Math.sinh(etaP), Math.cos(xiP));
  return { latitude: (phi * 180) / Math.PI, longitude: (lam * 180) / Math.PI };
}

// ------------------------------------------------------------------ dados vindos do GeoSampa (tudo em MAIÚSCULAS, telefone sem DDD)
const MINUSCULAS_NOME = new Set(['de', 'da', 'do', 'das', 'dos', 'e']);
/** "JARDIM AVELINO" -> "Jardim Avelino" */
export function tituloCase(texto) {
  return String(texto ?? '').toLowerCase().replace(/\s+/g, ' ').trim()
    .split(' ').map((p, i) => (i > 0 && MINUSCULAS_NOME.has(p) ? p : p.charAt(0).toUpperCase() + p.slice(1))).join(' ');
}
/** "23014801" (sem DDD) -> '551123014801'; vazio/inválido -> '' */
export function telefoneDeDigitos(valor) {
  const d = String(valor ?? '').replace(/\D/g, '');
  if (d.length === 8 || d.length === 9) return normalizarTelefone(`11${d}`);
  if (d.length === 10 || d.length === 11) return normalizarTelefone(d);
  return '';
}

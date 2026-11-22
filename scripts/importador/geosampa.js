import { WFS_URL, WFS_CAMADA, USER_AGENT } from './config.js';
import { nomeCasa, utm23sParaLatLon, tituloCase, telefoneDeDigitos } from './texto.js';

function coordenadasDe(geom) {
  if (!geom || !geom.coordinates) return [];
  const todas = [];
  const varre = (c) => { if (typeof c[0] === 'number') todas.push(c); else c.forEach(varre); };
  varre(geom.coordinates);
  return todas;
}

function normalizarFeature(f) {
  const pontos = coordenadasDe(f.geometry);
  if (!pontos.length) return null;
  const x = pontos.reduce((s, p) => s + p[0], 0) / pontos.length;
  const y = pontos.reduce((s, p) => s + p[1], 0) / pontos.length;
  // pedimos EPSG:4326 (longitude, latitude); se vier a coordenada original (UTM 23S), convertemos
  const { latitude, longitude } = Math.abs(x) <= 180 && Math.abs(y) <= 90 ? { latitude: y, longitude: x } : utm23sParaLatLon(x, y);
  return { props: f.properties || {}, latitude, longitude };
}

/** Baixa a camada de CEUs do GeoSampa (WFS, GeoJSON) — cada item: { props, latitude, longitude }. */
export async function baixarCEUsWFS() {
  const params = new URLSearchParams({ service: 'WFS', version: '1.0.0', request: 'GetFeature', typeName: WFS_CAMADA, outputFormat: 'application/json', srsName: 'EPSG:4326' });
  const resp = await fetch(`${WFS_URL}?${params}`, { headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' }, signal: AbortSignal.timeout(120000) });
  if (!resp.ok) throw new Error(`GeoSampa respondeu HTTP ${resp.status}`);
  const texto = await resp.text();
  let json;
  try { json = JSON.parse(texto); } catch (e) { throw new Error(`GeoSampa não devolveu JSON (${texto.slice(0, 120).replace(/\s+/g, ' ')})`); }
  return (json.features || []).map(normalizarFeature).filter(Boolean);
}

/**
 * Qual propriedade guarda o nome do equipamento? Entre as que trazem a palavra "CEU", a que tem MAIS valores diferentes
 * (o campo "classe" vale "CEU" em todos; o nome, em cada um é diferente — ex.: nm_equipamento = "CEU CEMEI VILA ALPINA").
 */
export function acharChaveDeNome(itens) {
  const amostra = itens.slice(0, 150);
  const stats = {};
  for (const it of amostra) {
    for (const [k, v] of Object.entries(it.props)) {
      if (typeof v !== 'string' || !/\bceu\b/i.test(v)) continue;
      const e = (stats[k] ||= { n: 0, distintos: new Set(), tam: 0 });
      e.n++; e.distintos.add(v); e.tam += v.length;
    }
  }
  const candidatos = Object.entries(stats).filter(([, e]) => e.n >= Math.max(3, amostra.length * 0.2) && e.distintos.size >= Math.max(3, e.n * 0.3));
  candidatos.sort((a, b) => b[1].distintos.size - a[1].distintos.size || b[1].tam / b[1].n - a[1].tam / a[1].n);
  return candidatos[0]?.[0] || null;
}

/** Endereço, CEP e telefone que o GeoSampa informa (usados só quando o portal dos CEUs não traz). */
export function dadosDoEquipamento(props) {
  const v = (k) => (props[k] == null ? '' : String(props[k]).trim());
  const cep = v('cd_cep_equipamento').replace(/\D/g, '');
  return {
    endereco: tituloCase(v('tx_endereco_equipamento')), bairro: tituloCase(v('nm_bairro_equipamento')),
    cep: cep.length === 8 ? `${cep.slice(0, 5)}-${cep.slice(5)}` : '', telefone: telefoneDeDigitos(v('tx_numero_telefone')),
  };
}

/** Procura no GeoSampa os equipamentos da unidade (ex.: slug 'ceu-parque-do-carmo') e devolve a posição média. */
export function casarUnidade(slug, itens, chave) {
  const achados = itens.filter((it) => nomeCasa(slug, chave ? String(it.props[chave] ?? '') : Object.values(it.props).filter((v) => typeof v === 'string').join(' ')));
  if (!achados.length) return null;
  const latitude = achados.reduce((s, a) => s + a.latitude, 0) / achados.length;
  const longitude = achados.reduce((s, a) => s + a.longitude, 0) / achados.length;
  const comTelefone = achados.find((a) => telefoneDeDigitos(a.props.tx_numero_telefone)) || achados[0];
  return { latitude, longitude, quantidade: achados.length, nomes: achados.slice(0, 3).map((a) => (chave ? a.props[chave] : '')), dados: dadosDoEquipamento(comTelefone.props) };
}

/**
 * Geocodificação: transforma o endereço de uma instituição (texto) em
 * latitude/longitude, pra ela aparecer no mapa e entrar na ordenação por
 * distância.
 *
 * Usa o Nominatim, o serviço de busca de endereços do OpenStreetMap —
 * gratuito e sem chave de API, a mesma filosofia do mapa (Leaflet + OSM).
 * Política de uso do serviço (https://operations.osmfoundation.org/policies/nominatim/):
 * no máximo 1 requisição por segundo e uso leve. Aqui só buscamos quando uma
 * instituição é salva/aprovada, então o volume é baixíssimo — e as tentativas
 * em sequência respeitam o intervalo de 1,1 s. Para um produto de verdade,
 * com muito uso, vale hospedar o próprio Nominatim ou usar um geocodificador pago.
 *
 * A busca vai do mais preciso ao menos preciso:
 *   1. endereço completo (rua + número + bairro + cidade)  -> precisão "endereco"
 *   2. rua sem o número                                     -> precisão "rua"
 *   3. só o bairro (centro do bairro)                       -> precisão "bairro"
 *   4. CEP                                                  -> precisão "cep"
 * O OpenStreetMap nem sempre conhece o número de cada casa, então cair no
 * nível da rua é comum — e a precisão fica registrada pra avisar o admin.
 */

const URL_BASE = 'https://nominatim.openstreetmap.org/search';
const CIDADE_PADRAO = 'São Paulo'; // o projeto atende a cidade de São Paulo; uma instituição pode ter `cidade` própria
const INTERVALO_MS = 1100;

const dormir = (ms) => new Promise((r) => setTimeout(r, ms));

function montarConsultas({ endereco = '', bairro = '', cep = '', cidade = '' }) {
  const cid = (cidade || CIDADE_PADRAO).trim();
  const end = endereco.trim();
  const bai = bairro.trim();
  const cp = cep.trim();
  const semNumero = end.replace(/[,\s]+\d+.*$/, '').trim(); // "Rua Itamonte, 1921" -> "Rua Itamonte"

  const temNumero = end !== '' && semNumero !== end;
  const juntar = (...partes) => partes.filter(Boolean).join(', ');
  const consultas = [];
  // endereço como digitado; se não tinha número, já é uma busca no nível da rua
  if (end) consultas.push({ q: juntar(end, bai, cid, 'Brasil'), precisao: temNumero ? 'endereco' : 'rua' });
  if (temNumero && semNumero) consultas.push({ q: juntar(semNumero, bai, cid, 'Brasil'), precisao: 'rua' });
  if (bai) consultas.push({ q: juntar(bai, cid, 'Brasil'), precisao: 'bairro' });
  if (cp) consultas.push({ q: juntar(cp, cid, 'Brasil'), precisao: 'cep' });

  // remove consultas repetidas (mesmo texto), mantendo a ordem
  const vistas = new Set();
  return consultas.filter((c) => (vistas.has(c.q) ? false : vistas.add(c.q)));
}

async function buscarUma(q) {
  const url = `${URL_BASE}?format=jsonv2&limit=1&countrycodes=br&accept-language=pt-BR&q=${encodeURIComponent(q)}`;
  const resp = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!resp.ok) throw new Error(`Nominatim respondeu ${resp.status}`);
  const dados = await resp.json();
  if (!Array.isArray(dados) || dados.length === 0) return null;
  const latitude = parseFloat(dados[0].lat);
  const longitude = parseFloat(dados[0].lon);
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
  return { latitude, longitude };
}

/**
 * @param {{endereco?:string, bairro?:string, cep?:string, cidade?:string}} dados
 * @param {{esperar?: (ms:number)=>Promise<void>}} opcoes - `esperar` existe só pra os testes não esperarem de verdade
 * @returns {Promise<{latitude:number, longitude:number, precisao:string}|null>} null se não achou (ou se a rede falhou)
 */
export async function geocodificarEndereco(dados, { esperar = dormir } = {}) {
  const consultas = montarConsultas(dados || {});
  for (let i = 0; i < consultas.length; i++) {
    if (i > 0) await esperar(INTERVALO_MS);
    try {
      const achou = await buscarUma(consultas[i].q);
      if (achou) return { ...achou, precisao: consultas[i].precisao };
    } catch (e) {
      // falha de rede/serviço nessa tentativa: tenta a próxima, mais genérica
    }
  }
  return null;
}

export { montarConsultas };

// O Nominatim exige que quem consulta se identifique (User-Agent). O navegador faz isso sozinho; o Node, não.
import { USER_AGENT } from './config.js';

const fetchOriginal = globalThis.fetch;
globalThis.fetch = (url, opts = {}) => (String(url).includes('nominatim.openstreetmap.org')
  ? fetchOriginal(url, { ...opts, headers: { ...(opts.headers || {}), 'User-Agent': USER_AGENT } })
  : fetchOriginal(url, opts));

export { geocodificarEndereco } from '../../src/lib/geocodificacao.js';

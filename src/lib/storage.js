/**
 * Substituto do `window.storage` usado nos artifacts do Claude.ai.
 *
 * O código dos componentes foi escrito contra essa API (get/set/delete,
 * todas assíncronas, com um parâmetro `shared`). Fora do Claude.ai essa
 * API não existe — este módulo implementa a MESMA assinatura usando
 * localStorage, então os componentes rodam sem precisar mudar a lógica.
 *
 * Diferença de comportamento a saber: `get()` de uma chave que não existe
 * lança um erro (igual ao comportamento documentado do window.storage
 * original) — o código dos componentes já trata isso com try/catch.
 */

const PREFIXO = 'conectaacao';

function chaveCompleta(key, shared) {
  return `${PREFIXO}:${shared ? 'shared' : 'personal'}:${key}`;
}

export const storage = {
  async get(key, shared = false) {
    const raw = localStorage.getItem(chaveCompleta(key, shared));
    if (raw === null) {
      throw new Error(`Chave não encontrada: ${key}`);
    }
    return { key, value: raw, shared };
  },

  async set(key, value, shared = false) {
    localStorage.setItem(chaveCompleta(key, shared), value);
    return { key, value, shared };
  },

  async delete(key, shared = false) {
    const completa = chaveCompleta(key, shared);
    const existia = localStorage.getItem(completa) !== null;
    localStorage.removeItem(completa);
    return { key, deleted: existia, shared };
  },

  async list(prefix = '', shared = false) {
    const escopo = `${PREFIXO}:${shared ? 'shared' : 'personal'}:`;
    const keys = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith(escopo + prefix)) keys.push(k.slice(escopo.length));
    }
    return { keys, prefix, shared };
  },
};

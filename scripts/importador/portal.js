import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { JSDOM } from 'jsdom';
import { baixar } from './http.js';

const AMOSTRAS = path.join(path.dirname(fileURLToPath(import.meta.url)), 'amostras');

/**
 * Baixa a página, entrega o `document` para `extrator(doc)` e fecha a janela (libera memória).
 * Se `salvarComo` for informado e a variável SALVAR_HTML estiver ligada, guarda o HTML em scripts/importador/amostras/.
 */
export async function lerPagina(url, extrator, { salvarComo = null } = {}) {
  const r = await baixar(url);
  if (r.status !== 200) {
    const e = new Error(`HTTP ${r.status} em ${url}`);
    e.status = r.status;
    throw e;
  }
  if (salvarComo && process.env.SALVAR_HTML === '1') {
    fs.mkdirSync(AMOSTRAS, { recursive: true });
    fs.writeFileSync(path.join(AMOSTRAS, salvarComo), r.texto, 'utf8');
  }
  const dom = new JSDOM(r.texto, { url: r.url || url });
  try { return await extrator(dom.window.document); } finally { dom.window.close(); }
}

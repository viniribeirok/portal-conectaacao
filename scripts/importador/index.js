#!/usr/bin/env node
/**
 * Importador dos CEUs (Prefeitura de São Paulo) -> banco do portal.
 *   node scripts/importador/index.js diagnostico
 *   node scripts/importador/index.js unidades   [--gravar]
 *   node scripts/importador/index.js tudo       [--gravar]
 * Sem --gravar é só um TESTE: mostra o que seria importado e não escreve nada.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { BASE_CEU } from './config.js';
import { iniciarRobots, permitido, baixar } from './http.js';
import { lerPagina } from './portal.js';
import { baixarCEUsWFS } from './geosampa.js';
import { geocodificarEndereco } from './geocodificar.js';
import { criarBanco } from './banco.js';
import { sincronizar } from './orquestrador.js';
import { diagnosticar, diagnosticarAPI } from './diagnostico.js';

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
(function carregarEnv() {
  const f = path.join(raiz, '.env.importador');
  if (!fs.existsSync(f)) return;
  for (const linha of fs.readFileSync(f, 'utf8').split(/\r?\n/)) {
    const m = linha.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/);
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
})();

const args = process.argv.slice(2);
const comando = args.find((a) => !a.startsWith('--')) || 'ajuda';
const tem = (n) => args.includes(`--${n}`);
const valor = (n) => { const a = args.find((x) => x.startsWith(`--${n}=`)); return a ? a.slice(n.length + 3) : undefined; };
const numero = (n) => (valor(n) !== undefined ? Number(valor(n)) : undefined);

function imprimirRelatorio(rel, gravou, banco) {
  const u = rel.unidades, a = rel.atividades;
  console.log('\n================ RESUMO ================');
  console.log(`Modo: ${gravou ? 'GRAVANDO no banco' : 'TESTE (nada foi gravado)'}${banco.conectado ? '' : ' — sem comparação com o banco (credenciais não informadas)'}`);
  console.log(`Unidades: ${u.total} | com endereço: ${u.comEndereco} | com telefone: ${u.comTelefone} | posição oficial (GeoSampa): ${u.comCoordenadasOficiais}`);
  if (banco.conectado) console.log(`          novas: ${u.novas} | já existentes: ${u.atualizadas}`);
  if (a.noSite || a.importaveis) {
    console.log(`Atividades: ${a.noSite} no site | ${a.importaveis} importáveis${banco.conectado ? ` (novas: ${a.novas}, atualizadas: ${a.atualizadas}, removidas: ${a.removidas})` : ''}`);
    const ign = Object.entries(a.ignoradas).sort((x, y) => y[1] - x[1]);
    if (ign.length) { console.log('Ignoradas:'); for (const [m, n] of ign) console.log(`   ${String(n).padStart(5)}  ${m}`); }
    if (a.jaVerificadas) console.log(`   (${a.jaVerificadas} dessas já tinham sido verificadas antes e não precisaram ser lidas de novo)`);
    if (a.semDetalhe) console.log(`Aguardando a próxima rodada (limite de detalhes): ${a.semDetalhe}`);
    if (rel.amostra.length) { console.log(`\nAmostra do que ${gravou ? 'foi importado' : 'seria importado'}:`); console.table(rel.amostra); }
  }
  if (rel.avisos.length) { console.log('\nAvisos:'); for (const av of rel.avisos.slice(0, 25)) console.log(`  - ${av}`); if (rel.avisos.length > 25) console.log(`  … e mais ${rel.avisos.length - 25}`); }
  if (process.env.GITHUB_STEP_SUMMARY) {
    const md = [`### Sincronização dos CEUs — ${gravou ? 'gravou no banco' : 'teste'}`, `- Unidades: **${u.total}** (novas ${u.novas})`, `- Atividades importáveis: **${a.importaveis}** (novas ${a.novas}, atualizadas ${a.atualizadas}, removidas ${a.removidas})`, ...rel.avisos.slice(0, 10).map((x) => `- ⚠️ ${x}`)].join('\n');
    fs.appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${md}\n`);
  }
}

async function main() {
  if (comando === 'ajuda' || tem('ajuda')) {
    console.log('Uso: node scripts/importador/index.js <diagnostico|diagnostico-api|unidades|tudo> [opções]\n  --gravar               grava no banco (sem isso, é só um teste)\n  --ceu=ceu-perus        só uma unidade\n  --limite-unidades=N    só as N primeiras unidades\n  --detalhes-max=N       máximo de páginas de atividade lidas por execução\n  --paginas-max=N        máximo de páginas de listagem\n  --sem-wfs              não usa o GeoSampa\n  --por-unidade          lê as atividades pelas páginas das unidades\n  --forcar-remocao       permite remover muitas atividades de uma vez\n  --salvar-html          guarda o HTML lido em scripts/importador/amostras/');
    return;
  }
  if (tem('salvar-html')) process.env.SALVAR_HTML = '1';
  const banco = criarBanco();
  const deps = { log: console.log, lerPagina, carregarWFS: baixarCEUsWFS, geocodificar: geocodificarEndereco, banco, iniciarRobots, permitido, baixar };

  if (comando === 'diagnostico') { await diagnosticar(deps); return; }
  if (comando === 'diagnostico-api') { await iniciarRobots(BASE_CEU); await diagnosticarAPI(deps); return; }
  if (comando !== 'unidades' && comando !== 'tudo' && comando !== 'atividades') throw new Error(`Comando desconhecido: ${comando}`);

  const gravar = tem('gravar');
  if (gravar && !banco.conectado) throw new Error('Para gravar, informe SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY (arquivo .env.importador ou variáveis de ambiente).');
  const robots = await iniciarRobots(BASE_CEU);
  console.log(`robots.txt do portal: HTTP ${robots.status}, ${robots.regras.length} regra(s)`);
  const op = {
    gravar, ceu: valor('ceu'), limiteUnidades: numero('limite-unidades'), detalhesMax: numero('detalhes-max'), paginasMax: numero('paginas-max'),
    semWfs: tem('sem-wfs'), porUnidade: tem('por-unidade'), forcarRemocao: tem('forcar-remocao'), soUnidades: comando === 'unidades',
  };
  const rel = await sincronizar(op, deps);
  imprimirRelatorio(rel, gravar, banco);
}

main().catch((e) => { console.error(`\nERRO: ${e.message}`); process.exitCode = 1; });

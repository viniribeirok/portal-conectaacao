import { useState, useEffect, useMemo } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import {
  Search, MapPin, List, Map as MapIcon, MessageCircle, X, Printer, ArrowLeft, Navigation, CalendarDays, ChevronRight, Building2, Phone,
} from 'lucide-react';
import { CATEGORIAS, ICONE_CATEGORIA, STATUS_INFO } from '../data/atividades';
import { SIGLA_TIPO } from '../data/instituicoes';
import { carregarAtividades } from '../data/repositorio';
import { filtrarAtividades } from '../utils/filtros';
import { formatarDistancia } from '../utils/geo';
import { formatarQuando } from '../utils/eventos';
import { formatarIdades, todasAsIdades } from '../utils/idades';
import { formatarTelefone, tipoTelefone, rotuloTelefone, normalizarTelefone, linkLigar } from '../utils/contato';
import { storage } from '../lib/storage';

// ---------------------------------------------------------------------------
// Ícones dos pinos do mapa (Leaflet usa divIcon com HTML/CSS em vez de SVG
// próprio — assim os pinos ficam exatamente com a cara do resto do app, sem
// depender dos ícones padrão do Leaflet, que têm um problema conhecido de
// não carregar direito com bundlers como o Vite).
// ---------------------------------------------------------------------------
function iconePino(sigla, cor, ativo) {
  const tamanho = ativo ? 34 : 27;
  const fonte = sigla.length >= 3 ? 7 : sigla.length === 2 ? 9 : 11;
  return L.divIcon({
    className: '',
    html: `<div style="width:${tamanho}px;height:${tamanho}px;border-radius:50%;background:${cor};border:2px solid #fff;display:flex;align-items:center;justify-content:center;color:#fff;font-weight:700;font-size:${fonte}px;font-family:'IBM Plex Sans',system-ui,sans-serif;box-shadow:0 1px 5px rgba(27,58,43,0.35);">${sigla}</div>`,
    iconSize: [tamanho, tamanho],
    iconAnchor: [tamanho / 2, tamanho / 2],
    popupAnchor: [0, -tamanho / 2],
  });
}

const ICONE_VOCE = L.divIcon({
  className: '',
  html: `<div style="width:16px;height:16px;border-radius:50%;background:#2563EB;border:3px solid #fff;box-shadow:0 0 0 6px rgba(37,99,235,0.25);"></div>`,
  iconSize: [16, 16],
  iconAnchor: [8, 8],
});

// Centraliza/dá zoom no mapa quando a localização do usuário muda, e força
// o Leaflet a recalcular o tamanho quando a aba "Mapa" fica visível no
// celular (senão ele renderiza cinza, porque nasceu escondido).
function AjustarMapa({ centro, zoom, view }) {
  const map = useMap();
  useEffect(() => {
    const t = setTimeout(() => map.invalidateSize(), 250);
    return () => clearTimeout(t);
  }, [view, map]);
  useEffect(() => {
    if (centro) map.flyTo(centro, zoom, { duration: 0.8 });
  }, [centro, zoom, map]);
  return null;
}

const CTA_LIGAR = { 'Abertas': 'Ligar para a instituição', 'Fila de Espera': 'Ligar para entrar na fila', 'Encerradas': 'Ligar para perguntar sobre novas turmas' };

export default function Portal({ voltar, tema = 'claro' }) {
  const [atividades, setAtividades] = useState([]);
  const [carregandoAtividades, setCarregandoAtividades] = useState(true);
  const [erroCarregar, setErroCarregar] = useState('');
  const [busca, setBusca] = useState('');
  const [categoria, setCategoria] = useState('Todas');
  const [idade, setIdade] = useState('');
  const [tipoAtividade, setTipoAtividade] = useState('todas');
  const [view, setView] = useState('lista');
  const [selecionadaId, setSelecionadaId] = useState(null);
  const [marcadosDocs, setMarcadosDocs] = useState({});
  const [carregandoDocs, setCarregandoDocs] = useState(false);
  const [erroDocs, setErroDocs] = useState(false);
  const [minhaLocalizacao, setMinhaLocalizacao] = useState(null);
  const [localizando, setLocalizando] = useState(false);
  const [erroLocalizacao, setErroLocalizacao] = useState('');

  useEffect(() => {
    let cancelado = false;
    (async () => {
      try {
        const dados = await carregarAtividades();
        if (!cancelado) { setAtividades(dados); setCarregandoAtividades(false); }
      } catch (e) {
        console.error(e);
        if (!cancelado) setErroCarregar('Não foi possível carregar as atividades agora. Verifique sua conexão e recarregue a página.');
      }
    })();
    return () => { cancelado = true; };
  }, []);

  function usarMinhaLocalizacao() {
    if (!navigator.geolocation) { setErroLocalizacao('Seu navegador não suporta localização.'); return; }
    setLocalizando(true); setErroLocalizacao('');
    navigator.geolocation.getCurrentPosition(
      (pos) => { setMinhaLocalizacao({ lat: pos.coords.latitude, lon: pos.coords.longitude }); setLocalizando(false); },
      (err) => {
        setLocalizando(false);
        setErroLocalizacao(err.code === err.PERMISSION_DENIED ? 'Você não permitiu o acesso à localização.' : 'Não consegui pegar sua localização agora.');
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  }
  function limparLocalizacao() { setMinhaLocalizacao(null); setErroLocalizacao(''); }

  const resultados = useMemo(
    () => filtrarAtividades(atividades, { busca, categoria, idade, minhaLocalizacao, tipoAtividade }),
    [atividades, busca, categoria, idade, minhaLocalizacao, tipoAtividade]
  );

  const atividadeSelecionada = atividades.find((a) => a.id === selecionadaId) || null;

  const centroInicial = useMemo(() => {
    const comCoordenadas = atividades.filter((a) => typeof a.latitude === 'number' && typeof a.longitude === 'number');
    if (comCoordenadas.length === 0) return [-23.61, -46.62]; // fallback: zona sul de São Paulo
    const lat = comCoordenadas.reduce((s, a) => s + a.latitude, 0) / comCoordenadas.length;
    const lon = comCoordenadas.reduce((s, a) => s + a.longitude, 0) / comCoordenadas.length;
    return [lat, lon];
  }, [atividades]);

  useEffect(() => {
    if (!selecionadaId) return;
    let cancelado = false;
    setCarregandoDocs(true); setErroDocs(false);
    (async () => {
      try {
        const r = await storage.get(`portal-checklist:${selecionadaId}`, false);
        if (!cancelado) setMarcadosDocs(r ? JSON.parse(r.value) : {});
      } catch (e) {
        if (!cancelado) setMarcadosDocs({});
      } finally {
        if (!cancelado) setCarregandoDocs(false);
      }
    })();
    return () => { cancelado = true; };
  }, [selecionadaId]);

  async function alternarDoc(indice) {
    const atualizado = { ...marcadosDocs, [indice]: !marcadosDocs[indice] };
    setMarcadosDocs(atualizado);
    try { await storage.set(`portal-checklist:${selecionadaId}`, JSON.stringify(atualizado), false); } catch (e) { setErroDocs(true); }
  }

  function linkWhatsapp(a) {
    const msg = idade
      ? `Olá! Vi "${a.nome}" no Portal ConectaAção e queria saber sobre vagas para meu filho(a) de ${idade} anos.`
      : `Olá! Vi "${a.nome}" no Portal ConectaAção e queria saber mais sobre as vagas.`;
    return `https://wa.me/${normalizarTelefone(a.whatsapp)}?text=${encodeURIComponent(msg)}`;
  }

  function limparFiltros() { setBusca(''); setCategoria('Todas'); setIdade(''); setTipoAtividade('todas'); }
  const hoje = new Date().toLocaleDateString('pt-BR');

  return (
    <div className="pt-page" data-tema={tema}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,600;9..144,700&family=IBM+Plex+Sans:wght@400;500;600&display=swap');
        .pt-page { --paper:#EEF2EA; --ink:#1B3A2B; --coral:#E85A3B; --marigold:#E8A23B; --muted:#6B7A6E; --card:#FFFFFF;
          font-family:'IBM Plex Sans',system-ui,sans-serif; background:var(--paper); color:var(--texto); min-height:100vh; }
        .pt-page * { box-sizing:border-box; }
        .pt-page { --cabecalho:#1B3A2B; --texto:#111111; --texto-suave:#333333; --placeholder:#666666; --sobre-ink:#EEF2EA;
          --borda:rgba(27,58,43,0.14); --borda-forte:rgba(27,58,43,0.24); --fundo-suave:rgba(27,58,43,0.06); --campo-bg:#FFFFFF; --scrim:rgba(27,58,43,0.42); --mapa-bg:#E2EAE0;
          --tag-evento-bg:rgba(37,99,235,0.14); --tag-todas-bg:rgba(232,162,59,0.28); --tag-aviso-bg:rgba(232,162,59,0.24); --tag-status-bg:rgba(232,90,58,0.16); }
        .pt-page[data-tema='escuro'] { --paper:#0F1311; --card:#1A201D; --ink:#2F6F4F; --texto:#FFFFFF; --texto-suave:#D8DEDB; --placeholder:#9AA5A0; --sobre-ink:#FFFFFF;
          --borda:rgba(255,255,255,0.18); --borda-forte:rgba(255,255,255,0.30); --fundo-suave:rgba(255,255,255,0.09); --campo-bg:#232A26; --scrim:rgba(0,0,0,0.66); --mapa-bg:#1A201D;
          --tag-evento-bg:rgba(96,150,255,0.32); --tag-todas-bg:rgba(232,162,59,0.36); --tag-aviso-bg:rgba(232,162,59,0.32); --tag-status-bg:rgba(232,90,58,0.36); color-scheme:dark; }
        .pt-page[data-tema='escuro'] .leaflet-tile-pane { filter:invert(1) hue-rotate(180deg) brightness(0.92) contrast(0.92); }
        .pt-page[data-tema='escuro'] .leaflet-container { background:var(--mapa-bg); }
        .pt-page[data-tema='escuro'] .leaflet-popup-content-wrapper, .pt-page[data-tema='escuro'] .leaflet-popup-tip { background:var(--card); color:var(--texto); }
        .pt-page[data-tema='escuro'] .leaflet-bar a { background:var(--card); color:var(--texto); border-bottom-color:var(--borda); }
        .pt-page[data-tema='escuro'] .leaflet-control-attribution { background:rgba(15,19,17,0.8); color:var(--texto-suave); }
        .pt-page[data-tema='escuro'] .leaflet-control-attribution a { color:var(--texto); }
        .pt-header { background:var(--cabecalho); color:#EEF2EA; padding:16px 0 40px; }
        .pt-header-inner { max-width:1100px; margin:0 auto; padding:0 20px; }
        .pt-voltar { display:inline-flex; align-items:center; gap:5px; border:none; background:transparent; color:rgba(238,242,234,0.75); font-family:inherit; font-size:12.5px; cursor:pointer; padding:0 0 12px; }
        .pt-wordmark { display:flex; align-items:center; gap:8px; font-family:'Fraunces',Georgia,serif; font-weight:700; font-size:26px; }
        .pt-wordmark svg { color:var(--marigold); flex-shrink:0; }
        .pt-tagline { margin:6px 0 0; font-size:13.5px; color:rgba(238,242,234,0.72); line-height:1.4; max-width:42ch; }
        .pt-shell { max-width:1100px; margin:0 auto; padding:0 20px 40px; }
        .pt-searchcard { background:var(--card); margin:-24px 0 0; max-width:560px; border-radius:14px; padding:12px; box-shadow:0 6px 20px rgba(27,58,43,0.14); position:relative; z-index:2; }
        .pt-searchrow { display:flex; align-items:center; gap:8px; border:1px solid var(--borda); border-radius:10px; padding:11px 12px; }
        .pt-searchrow svg { color:var(--texto-suave); flex-shrink:0; }
        .pt-searchrow input { border:none; outline:none; font-family:inherit; font-size:15.5px; color:var(--texto); width:100%; background:transparent; }
        .pt-searchrow input::placeholder { color:var(--placeholder); }
        .pt-chips { display:flex; gap:8px; overflow-x:auto; padding:14px 0 4px; scrollbar-width:none; }
        .pt-chips::-webkit-scrollbar { display:none; }
        .pt-local-row { padding:12px 0 0; }
        .pt-chip-local { display:inline-flex; align-items:center; gap:7px; border:1px solid var(--borda); background:var(--card); color:var(--texto); padding:8px 14px; border-radius:999px; font-size:13px; font-family:inherit; cursor:pointer; }
        .pt-chip-local.ativo { background:var(--ink); color:var(--sobre-ink); border-color:var(--texto); }
        .pt-chip-local:disabled { opacity:0.6; cursor:default; }
        .pt-erro-local { font-size:12px; color:var(--coral); margin:8px 0 0; }
        .pt-distancia { display:flex; align-items:center; gap:5px; font-size:12px; color:var(--texto); font-weight:500; margin:6px 0 0; }
        .pt-chip { flex-shrink:0; border:1px solid var(--borda); background:var(--card); color:var(--texto); padding:8px 15px; border-radius:999px; font-size:14px; font-family:inherit; cursor:pointer; }
        .pt-chip.ativo { background:var(--ink); color:var(--sobre-ink); border-color:var(--texto); }
        .pt-filtros-linha2 { padding:6px 0 4px; }
        .pt-idade { display:flex; align-items:center; gap:8px; font-size:14px; color:var(--texto-suave); }
        .pt-idade select { font-family:inherit; font-size:14px; color:var(--texto); border:1px solid var(--borda); border-radius:8px; padding:6px 9px; background:var(--card); }
        .pt-toggle-wrap { padding:12px 0 0; }
        .pt-toggle { display:flex; gap:4px; background:var(--fundo-suave); border-radius:10px; padding:4px; max-width:320px; }
        .pt-toggle button { display:flex; align-items:center; gap:6px; flex:1; justify-content:center; border:none; background:transparent; color:var(--texto-suave); font-family:inherit; font-size:14px; font-weight:500; padding:8px 0; border-radius:7px; cursor:pointer; }
        .pt-toggle button.ativo { background:var(--card); color:var(--texto); box-shadow:0 1px 3px rgba(27,58,43,0.12); }
        .pt-contagem { padding:16px 0 8px; font-size:13.5px; color:var(--texto-suave); }
        .pt-coluna-lista, .pt-coluna-mapa { display:none; }
        .pt-coluna-lista.ativa, .pt-coluna-mapa.ativa { display:block; }
        .pt-lista { display:flex; flex-direction:column; gap:10px; }
        .pt-card { background:var(--card); border:1px solid var(--borda); border-left:4px solid var(--status-cor,var(--muted)); border-radius:10px; padding:14px 16px; cursor:pointer; }
        .pt-card.encerrada { opacity:0.68; }
        .pt-card-top { display:flex; justify-content:space-between; align-items:flex-start; gap:10px; }
        .pt-card h3 { margin:0 0 2px; font-size:16px; font-weight:600; }
        .pt-instituicao { margin:0; font-size:13px; color:var(--texto-suave); }
        .pt-status { display:flex; align-items:center; gap:5px; font-size:12px; font-weight:500; white-space:nowrap; flex-shrink:0; padding-top:2px; }
        .pt-status .dot { width:7px; height:7px; border-radius:50%; background:var(--status-cor,var(--muted)); flex-shrink:0; }
        .pt-tags { display:flex; flex-wrap:wrap; gap:6px; margin:10px 0; }
        .pt-tag { display:flex; align-items:center; gap:5px; font-size:12.5px; background:var(--fundo-suave); color:var(--texto); padding:4px 9px; border-radius:7px; }
        .pt-tag svg { width:13px; height:13px; }
        .pt-endereco { display:flex; align-items:center; gap:5px; font-size:12.5px; color:var(--texto-suave); margin:0 0 12px; }
        .pt-endereco svg { width:13px; height:13px; flex-shrink:0; }
        .pt-quando { display:flex; align-items:center; gap:5px; font-size:13px; font-weight:600; color:var(--texto); margin:0 0 6px; }
        .pt-quando svg { width:13px; height:13px; flex-shrink:0; }
        .pt-tag-evento { background:var(--tag-evento-bg); color:var(--texto); font-weight:600; }
        .pt-tag-todas { background:var(--tag-todas-bg); color:var(--texto); font-weight:600; }
        .pt-ver-mais { display:flex; align-items:center; justify-content:flex-end; gap:2px; margin:10px 0 0; font-size:13px; font-weight:600; color:var(--texto); }
        .pt-card:hover .pt-ver-mais { text-decoration:underline; }
        .pt-inst-dados { display:flex; flex-direction:column; gap:12px; }
        .pt-inst-linha { display:flex; gap:10px; align-items:flex-start; font-size:14px; color:var(--texto); line-height:1.4; }
        .pt-inst-linha svg { flex-shrink:0; margin-top:2px; color:var(--texto-suave); }
        .pt-inst-linha small { display:block; color:var(--texto-suave); font-size:12px; }
        .pt-inst-tel { color:var(--texto); font-weight:600; text-decoration:underline; }
        .pt-filtros-linha2 { display:flex; flex-wrap:wrap; gap:8px 18px; }
        .pt-cta { display:flex; align-items:center; justify-content:center; gap:7px; width:100%; border:none; border-radius:8px; padding:11px 0; font-family:inherit; font-size:14px; font-weight:600; color:#fff; background:var(--coral); text-decoration:none; cursor:pointer; }
        .pt-card.encerrada .pt-cta { background:var(--muted); }
        .pt-vazio { text-align:center; padding:48px 24px; color:var(--texto-suave); background:var(--card); border-radius:10px; border:1px dashed var(--borda-forte); }
        .pt-vazio p { font-size:14px; margin:6px 0 16px; line-height:1.5; }
        .pt-vazio button { border:1px solid var(--borda-forte); background:var(--card); color:var(--texto); font-family:inherit; font-size:13.5px; padding:9px 18px; border-radius:8px; cursor:pointer; }
        .pt-mapa-wrap { border-radius:12px; overflow:hidden; border:1px solid var(--borda); }
        .pt-mapa-leaflet { width:100%; height:420px; background:var(--mapa-bg); }
        .pt-mapa-leaflet .leaflet-popup-content { font-family:'IBM Plex Sans', system-ui, sans-serif; font-size:12.5px; color:var(--texto); line-height:1.5; }
        .pt-legenda { display:flex; gap:14px; flex-wrap:wrap; padding:10px 2px 0; font-size:12px; color:var(--texto-suave); }
        .pt-legenda span { display:flex; align-items:center; gap:5px; }
        .pt-legenda .dot { width:7px; height:7px; border-radius:50%; }
        .pt-legenda-tipo { padding-top:6px; font-size:11px; gap:12px; }
        .pt-mapa-nota { font-size:11.5px; color:var(--texto-suave); padding:8px 2px 0; line-height:1.4; }
        .pt-rodape { text-align:center; font-size:11.5px; color:var(--texto-suave); padding:30px 24px 40px; line-height:1.5; }
        .pt-backdrop { position:fixed; inset:0; background:var(--scrim); z-index:40; }
        .pt-drawer { position:fixed; top:0; right:0; height:100vh; width:min(100%,440px); background:var(--card); z-index:41; overflow-y:auto; box-shadow:-10px 0 28px rgba(27,58,43,0.2); padding:20px; }
        .pt-drawer-top { display:flex; justify-content:space-between; align-items:flex-start; gap:10px; margin-bottom:4px; }
        .pt-drawer-top button { border:none; background:var(--fundo-suave); color:var(--texto); border-radius:8px; padding:7px; cursor:pointer; display:flex; }
        .pt-drawer h2 { font-family:'Fraunces',Georgia,serif; font-size:22px; margin:6px 0 2px; }
        .pt-divider { height:1px; background:var(--fundo-suave); margin:18px 0; }
        .pt-drawer h3 { font-size:14.5px; margin:0 0 10px; }
        .pt-progresso-texto { display:flex; justify-content:space-between; font-size:12.5px; color:var(--texto-suave); margin-bottom:6px; }
        .pt-progresso-barra { height:8px; border-radius:999px; background:var(--fundo-suave); overflow:hidden; margin-bottom:14px; }
        .pt-progresso-fill { height:100%; border-radius:999px; background:var(--marigold); transition:width 0.25s ease; }
        .pt-lista-docs { border:1px solid var(--borda); border-radius:10px; overflow:hidden; margin-bottom:14px; }
        .pt-doc-row { display:flex; align-items:center; gap:12px; padding:12px 14px; border-bottom:1px solid var(--borda); cursor:pointer; }
        .pt-doc-row:last-child { border-bottom:none; }
        .pt-doc-row input { width:19px; height:19px; accent-color:var(--texto); flex-shrink:0; }
        .pt-doc-texto { flex:1; font-size:14px; line-height:1.4; }
        .pt-doc-texto.marcado { color:var(--texto-suave); text-decoration:line-through; }
        .pt-doc-opcional { font-size:10.5px; color:var(--texto-suave); background:var(--fundo-suave); padding:2px 7px; border-radius:999px; flex-shrink:0; }
        .pt-btn-print { display:flex; align-items:center; justify-content:center; gap:7px; width:100%; border:1px solid var(--borda); background:var(--card); color:var(--texto); font-family:inherit; font-size:13.5px; font-weight:600; padding:10px 0; border-radius:8px; cursor:pointer; }
        .pt-folha-impressao { display:none; }
        @page { margin: 16mm; }
        @media print {
          /* esconde tudo da página (cabeçalho, busca, lista, mapa, rodapé, fundo escuro) menos o painel do checklist */
          .pt-page > *:not(.pt-drawer) { display:none !important; }
          .pt-page { min-height:0 !important; background:#fff !important; color:#000 !important; }
          .pt-drawer { position:static !important; height:auto !important; width:100% !important; max-width:none !important; overflow:visible !important; box-shadow:none !important; padding:0 !important; background:#fff !important; }
          .pt-drawer > *:not(.pt-folha-impressao) { display:none !important; }
          .pt-folha-impressao { display:block !important; }
          .pt-folha-impressao, .pt-folha-impressao * { color:#000 !important; }
        }
        @media (min-width: 860px) {
          .pt-header { padding:22px 0 52px; }
          .pt-shell { padding:0 32px 56px; }
          .pt-toggle-wrap { display:none; }
          .pt-conteudo { display:flex; gap:22px; align-items:flex-start; }
          .pt-coluna-lista, .pt-coluna-mapa { display:block !important; }
          .pt-coluna-lista { width:420px; flex-shrink:0; max-height:74vh; overflow-y:auto; padding-right:4px; }
          .pt-coluna-mapa { flex:1; position:sticky; top:24px; }
          .pt-mapa-leaflet { height:74vh; }
        }
      `}</style>

      <header className="pt-header">
        <div className="pt-header-inner">
          <button className="pt-voltar" onClick={voltar}><ArrowLeft size={13} /> Início</button>
          <div className="pt-wordmark"><MapPin size={24} strokeWidth={2.2} />ConectaAção</div>
          <p className="pt-tagline">Atividades gratuitas ou de baixo custo pra seu filho, perto de você.</p>
        </div>
      </header>

      <div className="pt-shell">
        <div className="pt-searchcard">
          <div className="pt-searchrow">
            <Search size={17} />
            <input type="text" placeholder="Busque por bairro, atividade ou instituição" value={busca} onChange={(e) => setBusca(e.target.value)} />
            {busca && <button onClick={() => setBusca('')} style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--texto-suave)', display: 'flex' }} aria-label="Limpar busca"><X size={16} /></button>}
          </div>
        </div>

        <div className="pt-local-row">
          {!minhaLocalizacao ? (
            <button className="pt-chip-local" onClick={usarMinhaLocalizacao} disabled={localizando}>
              <Navigation size={14} /> {localizando ? 'Localizando…' : 'Usar minha localização'}
            </button>
          ) : (
            <button className="pt-chip-local ativo" onClick={limparLocalizacao}>
              <Navigation size={14} /> Ordenado por distância até você <X size={13} />
            </button>
          )}
          {erroLocalizacao && <p className="pt-erro-local">{erroLocalizacao}</p>}
        </div>

        <div className="pt-chips">
          {CATEGORIAS.map((c) => <button key={c} className={`pt-chip ${categoria === c ? 'ativo' : ''}`} onClick={() => setCategoria(c)}>{c}</button>)}
        </div>

        <div className="pt-filtros-linha2">
          <label className="pt-idade">Idade da criança
            <select value={idade} onChange={(e) => setIdade(e.target.value)}>
              <option value="">todas</option>
              {Array.from({ length: 18 }, (_, i) => i).map((n) => <option key={n} value={n}>{n} anos</option>)}
            </select>
          </label>
          <label className="pt-idade">Tipo
            <select value={tipoAtividade} onChange={(e) => setTipoAtividade(e.target.value)}>
              <option value="todas">todas</option>
              <option value="continua">contínuas</option>
              <option value="pontual">eventos de um dia</option>
            </select>
          </label>
        </div>

        <div className="pt-toggle-wrap">
          <div className="pt-toggle">
            <button className={view === 'lista' ? 'ativo' : ''} onClick={() => setView('lista')}><List size={15} /> Lista</button>
            <button className={view === 'mapa' ? 'ativo' : ''} onClick={() => setView('mapa')}><MapIcon size={15} /> Mapa</button>
          </div>
        </div>

        {carregandoAtividades ? (
          <p className="pt-contagem">{erroCarregar || 'Carregando atividades…'}</p>
        ) : (
          <>
            <div className="pt-contagem">{resultados.length === 0 ? 'Nenhuma atividade encontrada' : `${resultados.length} ${resultados.length === 1 ? 'atividade encontrada' : 'atividades encontradas'}`}</div>

            <div className="pt-conteudo">
          <div className={`pt-coluna-lista ${view === 'lista' ? 'ativa' : ''}`}>
            {resultados.length === 0 ? (
              <div className="pt-vazio"><p>Nenhuma turma bate com esses filtros por aqui ainda.<br />Tenta ampliar a busca ou trocar a idade.</p><button onClick={limparFiltros}>Limpar filtros</button></div>
            ) : (
              <div className="pt-lista">
                {resultados.map((a) => {
                  const st = STATUS_INFO[a.status];
                  const Icone = ICONE_CATEGORIA[a.categoria];
                  return (
                    <div key={a.id} className={`pt-card ${a.status === 'Encerradas' ? 'encerrada' : ''}`} style={{ '--status-cor': st.cor }} onClick={() => setSelecionadaId(a.id)}>
                      <div className="pt-card-top">
                        <div><h3>{a.nome}</h3><p className="pt-instituicao">{a.instituicao}</p></div>
                        <div className="pt-status" style={{ '--status-cor': st.cor }}><span className="dot" />{st.texto}</div>
                      </div>
                      {a.distanciaKm !== undefined && <p className="pt-distancia"><Navigation size={11} /> {formatarDistancia(a.distanciaKm)} de você</p>}
                      <div className="pt-tags"><span className="pt-tag"><Icone size={13} /> {a.categoria}</span><span className={`pt-tag ${todasAsIdades(a.idadeMin, a.idadeMax) ? 'pt-tag-todas' : ''}`}>{formatarIdades(a.idadeMin, a.idadeMax)}</span>{a.tipoAtividade === 'pontual' && <span className="pt-tag pt-tag-evento">Evento de um dia</span>}</div>
                      {a.tipoAtividade === 'pontual' && a.dataEvento && <p className="pt-quando"><CalendarDays size={13} /> {formatarQuando(a)}</p>}
                      <p className="pt-endereco"><MapPin size={13} /> {[a.endereco, a.bairro].filter(Boolean).join(' — ')}</p>
                      <p className="pt-ver-mais">Ver detalhes e contato <ChevronRight size={15} /></p>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className={`pt-coluna-mapa ${view === 'mapa' ? 'ativa' : ''}`}>
            <div className="pt-mapa-wrap">
              <MapContainer center={centroInicial} zoom={12} scrollWheelZoom className="pt-mapa-leaflet">
                <TileLayer
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                <AjustarMapa centro={minhaLocalizacao ? [minhaLocalizacao.lat, minhaLocalizacao.lon] : null} zoom={14} view={view} />

                {minhaLocalizacao && (
                  <Marker position={[minhaLocalizacao.lat, minhaLocalizacao.lon]} icon={ICONE_VOCE}>
                    <Popup>Você está aqui</Popup>
                  </Marker>
                )}

                {resultados
                  .filter((a) => typeof a.latitude === 'number' && typeof a.longitude === 'number')
                  .map((a) => {
                    const st = STATUS_INFO[a.status];
                    const sigla = SIGLA_TIPO[a.tipo] || '?';
                    return (
                      <Marker
                        key={a.id}
                        position={[a.latitude, a.longitude]}
                        icon={iconePino(sigla, st.cor, selecionadaId === a.id)}
                        eventHandlers={{ click: () => setSelecionadaId(a.id) }}
                      >
                        <Popup>
                          <strong>{a.nome}</strong><br />
                          {a.instituicao}<br />
                          {a.bairro}
                        </Popup>
                      </Marker>
                    );
                  })}
              </MapContainer>
            </div>
            <div className="pt-legenda">
              <span><span className="dot" style={{ background: 'var(--marigold)' }} /> Vagas abertas</span>
              <span><span className="dot" style={{ background: 'var(--coral)' }} /> Fila de espera</span>
              <span><span className="dot" style={{ background: 'var(--muted)' }} /> Encerradas</span>
              {minhaLocalizacao && <span><span className="dot" style={{ background: '#2563EB' }} /> Você</span>}
            </div>
            <div className="pt-legenda pt-legenda-tipo">
              <span>ONG = ONG</span>
              <span>CEU = CEU</span>
              <span>CC = Clube da Comunidade</span>
              <span>A = Associação</span>
              <span>O = Outro</span>
            </div>
            <p className="pt-mapa-nota">Mapa real (OpenStreetMap). A sigla no pino é o tipo da instituição; a cor é o status da vaga. Toque num pino pra ver os detalhes. O ponto azul é sua localização real, se você permitir o acesso.</p>
          </div>
        </div>
          </>
        )}
      </div>

      <p className="pt-rodape">Portal ConectaAção — atividades cadastradas pelas instituições parceiras.</p>

      {atividadeSelecionada && (
        <>
          <div className="pt-backdrop" onClick={() => setSelecionadaId(null)} />
          <div className="pt-drawer">
            <div className="pt-drawer-top">
              <div><h2>{atividadeSelecionada.nome}</h2><p className="pt-instituicao">{atividadeSelecionada.instituicao}</p></div>
              <button onClick={() => setSelecionadaId(null)} aria-label="Fechar"><X size={18} /></button>
            </div>
            <div className="pt-tags"><span className="pt-tag">{atividadeSelecionada.categoria}</span><span className={`pt-tag ${todasAsIdades(atividadeSelecionada.idadeMin, atividadeSelecionada.idadeMax) ? 'pt-tag-todas' : ''}`}>{formatarIdades(atividadeSelecionada.idadeMin, atividadeSelecionada.idadeMax)}</span>{atividadeSelecionada.tipoAtividade === 'pontual' && <span className="pt-tag pt-tag-evento">Evento de um dia</span>}</div>
            {atividadeSelecionada.tipoAtividade === 'pontual' && atividadeSelecionada.dataEvento && <p className="pt-quando"><CalendarDays size={13} /> {formatarQuando(atividadeSelecionada)}</p>}
            <p className="pt-endereco"><MapPin size={13} /> {[atividadeSelecionada.endereco, atividadeSelecionada.bairro].filter(Boolean).join(' — ')}</p>
            {tipoTelefone(atividadeSelecionada.whatsapp) === 'celular' && (
              <a className="pt-cta" href={linkWhatsapp(atividadeSelecionada)} target="_blank" rel="noopener noreferrer"><MessageCircle size={15} /> {STATUS_INFO[atividadeSelecionada.status].cta}</a>
            )}
            {tipoTelefone(atividadeSelecionada.whatsapp) === 'fixo' && (
              <a className="pt-cta" href={linkLigar(atividadeSelecionada.whatsapp)}><Phone size={15} /> {CTA_LIGAR[atividadeSelecionada.status]}</a>
            )}
            <div className="pt-divider" />
            {(() => {
              const at = atividadeSelecionada;
              const local = [at.endereco, at.bairro].filter(Boolean).join(' — ');
              const sede = [at.sedeEndereco, at.sedeBairro].filter(Boolean).join(' — ');
              return (
                <>
                  <h3>Sobre a instituição</h3>
                  <div className="pt-inst-dados">
                    <div className="pt-inst-linha"><Building2 size={15} /><div><strong>{at.instituicao}</strong><small>{at.tipo}</small></div></div>
                    {sede && sede !== local && <div className="pt-inst-linha"><MapPin size={15} /><div><small>Sede</small><span>{sede}</span></div></div>}
                    {at.whatsapp && (
                      <div className="pt-inst-linha"><Phone size={15} /><div><small>{rotuloTelefone(at.whatsapp)}</small>
                        {tipoTelefone(at.whatsapp) === 'celular' ? <a className="pt-inst-tel" href={linkWhatsapp(at)} target="_blank" rel="noopener noreferrer">{formatarTelefone(at.whatsapp)}</a>
                          : tipoTelefone(at.whatsapp) === 'fixo' ? <a className="pt-inst-tel" href={linkLigar(at.whatsapp)}>{formatarTelefone(at.whatsapp)}</a>
                          : <span>{at.whatsapp}</span>}
                      </div></div>
                    )}
                  </div>
                  <div className="pt-divider" />
                </>
              );
            })()}
            {atividadeSelecionada.tipoAtividade === 'pontual' ? (
              <p style={{ fontSize: 13.5, color: 'var(--texto-suave)', lineHeight: 1.5 }}>Este é um evento de um dia, então não há checklist de matrícula. Entre em contato com a instituição para confirmar se precisa de inscrição ou de algum documento.</p>
            ) : (
              <>
            <h3>Documentos para a matrícula</h3>
            {carregandoDocs ? <p style={{ fontSize: 13, color: 'var(--texto-suave)' }}>Carregando checklist salvo…</p> : (
              <>
                {(() => {
                  const obrigatorios = atividadeSelecionada.documentos.map((d, i) => ({ ...d, i })).filter((d) => d.obrigatorio);
                  const feitos = obrigatorios.filter((d) => marcadosDocs[d.i]).length;
                  const progresso = obrigatorios.length === 0 ? 0 : Math.round((feitos / obrigatorios.length) * 100);
                  return (<><div className="pt-progresso-texto"><span>{feitos} de {obrigatorios.length} obrigatórios prontos</span><span>{progresso}%</span></div><div className="pt-progresso-barra"><div className="pt-progresso-fill" style={{ width: `${progresso}%` }} /></div></>);
                })()}
                <div className="pt-lista-docs">
                  {atividadeSelecionada.documentos.map((d, i) => (
                    <label className="pt-doc-row" key={i}>
                      <input type="checkbox" checked={!!marcadosDocs[i]} onChange={() => alternarDoc(i)} />
                      <span className={`pt-doc-texto ${marcadosDocs[i] ? 'marcado' : ''}`}>{d.descricao}</span>
                      {!d.obrigatorio && <span className="pt-doc-opcional">opcional</span>}
                    </label>
                  ))}
                </div>
                {erroDocs && <p style={{ fontSize: 12, color: 'var(--coral)', marginTop: -6, marginBottom: 12 }}>Não deu pra salvar sua marcação agora.</p>}
                <button className="pt-btn-print" onClick={() => window.print()}><Printer size={15} /> Salvar / imprimir checklist</button>
              </>
            )}
              </>
            )}
            <div className="pt-folha-impressao">
              <h1 style={{ fontFamily: 'Fraunces, Georgia, serif', fontSize: 20, margin: '0 0 2px', color: '#000' }}>Checklist de matrícula — {atividadeSelecionada.nome}</h1>
              <p style={{ fontSize: 12.5, color: '#444', margin: '0 0 2px' }}>{atividadeSelecionada.instituicao}</p>
              {(atividadeSelecionada.endereco || atividadeSelecionada.bairro) && (
                <p style={{ fontSize: 12.5, color: '#444', margin: '0 0 2px' }}>{[atividadeSelecionada.endereco, atividadeSelecionada.bairro].filter(Boolean).join(' — ')}</p>
              )}
              <p style={{ fontSize: 11.5, color: '#666', margin: '0 0 16px' }}>Gerado pelo Portal ConectaAção em {hoje}</p>
              <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                {atividadeSelecionada.documentos.map((d, i) => (
                  <li key={i} style={{ fontSize: 13.5, padding: '8px 0', borderBottom: '1px solid #ddd', display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ width: 14, height: 14, border: '1.5px solid #000', borderRadius: 2, display: 'inline-block', flexShrink: 0, textAlign: 'center', lineHeight: '12px', fontSize: 12, fontWeight: 700 }}>{marcadosDocs[i] ? '✓' : ''}</span>
                    <span>{d.descricao}{!d.obrigatorio ? ' (opcional)' : ''}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

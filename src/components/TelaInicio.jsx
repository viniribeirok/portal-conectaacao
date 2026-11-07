import { MapPin, Search, Building2, Sun, Moon } from 'lucide-react';

export default function TelaInicio({ irPortal, irPainel, tema = 'claro', setTema = () => {} }) {
  return (
    <div className="ini-app">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,600;9..144,700&family=IBM+Plex+Sans:wght@400;500;600&display=swap');
        .ini-app { --paper:#EEF2EA; --ink:#1B3A2B; --coral:#E85A3B; --marigold:#E8A23B; --muted:#6B7A6E;
          font-family:'IBM Plex Sans',system-ui,sans-serif; background:var(--ink); color:var(--paper); min-height:100vh;
          display:flex; flex-direction:column; align-items:center; justify-content:center; padding:48px 24px; text-align:center; }
        .ini-app * { box-sizing:border-box; }
        .ini-wordmark { display:flex; align-items:center; gap:10px; font-family:'Fraunces',Georgia,serif; font-weight:700; font-size:32px; }
        .ini-wordmark svg { color:var(--marigold); flex-shrink:0; }
        .ini-tagline { margin:12px 0 44px; font-size:14.5px; color:rgba(238,242,234,0.75); max-width:34ch; line-height:1.55; }
        .ini-opcoes { display:flex; flex-direction:column; gap:14px; width:100%; max-width:360px; }
        .ini-btn { display:flex; align-items:center; gap:14px; text-align:left; border:none; border-radius:14px; padding:18px 20px; font-family:inherit; cursor:pointer; width:100%; }
        .ini-btn-icone { width:42px; height:42px; border-radius:11px; display:flex; align-items:center; justify-content:center; flex-shrink:0; }
        .ini-btn-titulo { font-size:15.5px; font-weight:600; margin:0; }
        .ini-btn-desc { font-size:12.5px; margin:3px 0 0; opacity:0.85; line-height:1.4; }
        .ini-btn.primario { background:var(--coral); color:#fff; }
        .ini-btn.primario .ini-btn-icone { background:rgba(255,255,255,0.22); }
        .ini-btn.secundario { background:rgba(238,242,234,0.07); color:var(--paper); border:1px solid rgba(238,242,234,0.22); }
        .ini-btn.secundario .ini-btn-icone { background:rgba(238,242,234,0.12); color:var(--marigold); }
        .ini-rodape { margin-top:40px; font-size:11px; color:rgba(238,242,234,0.5); }
        .ini-app { position:relative; }
        .ini-tema { position:absolute; top:16px; right:16px; display:flex; gap:3px; background:rgba(238,242,234,0.10); border:1px solid rgba(238,242,234,0.18); border-radius:999px; padding:3px; }
        .ini-tema button { display:flex; align-items:center; gap:5px; border:none; background:transparent; color:rgba(238,242,234,0.85); font-family:inherit; font-size:12px; font-weight:500; padding:6px 11px; border-radius:999px; cursor:pointer; }
        .ini-tema button.ativo { background:#EEF2EA; color:#111; }
      `}</style>
      <div className="ini-tema" role="group" aria-label="Aparência do portal">
        <button className={tema !== 'escuro' ? 'ativo' : ''} onClick={() => setTema('claro')}><Sun size={14} /> Normal</button>
        <button className={tema === 'escuro' ? 'ativo' : ''} onClick={() => setTema('escuro')}><Moon size={14} /> Escuro</button>
      </div>
      <div className="ini-wordmark"><MapPin size={28} strokeWidth={2.2} />ConectaAção</div>
      <p className="ini-tagline">Atividades gratuitas ou de baixo custo pra crianças e adolescentes, perto de casa.</p>
      <div className="ini-opcoes">
        <button className="ini-btn primario" onClick={irPortal}>
          <div className="ini-btn-icone"><Search size={19} /></div>
          <div><p className="ini-btn-titulo">Buscar atividades</p><p className="ini-btn-desc">Pra mães, pais e responsáveis — sem precisar de login</p></div>
        </button>
        <button className="ini-btn secundario" onClick={irPainel}>
          <div className="ini-btn-icone"><Building2 size={19} /></div>
          <div><p className="ini-btn-titulo">Sou uma ONG, CEU ou associação</p><p className="ini-btn-desc">Entrar ou cadastrar minha instituição</p></div>
        </button>
      </div>
      <p className="ini-rodape">Portal Conecta Ação</p>
    </div>
  );
}

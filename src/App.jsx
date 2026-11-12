import { useState, useEffect } from 'react';
import TelaInicio from './components/TelaInicio';
import Portal from './components/Portal';
import PainelGestao from './components/PainelGestao';

const CHAVE_TEMA = 'conectaacao:tema';

// Quando a pessoa clica no link do e-mail de "esqueci minha senha", o Supabase abre o site com algo assim
// no endereço: #access_token=...&type=recovery  (ou #error=...&error_code=otp_expired se o link venceu).
// Lemos isso uma vez, logo que o site carrega.
const HASH_INICIAL = typeof window !== 'undefined' ? window.location.hash : '';
const VEIO_DE_RECUPERACAO = /type=recovery/.test(HASH_INICIAL);
const LINK_COM_ERRO = !VEIO_DE_RECUPERACAO && /error_code=|error=/.test(HASH_INICIAL) ? 'expirado' : '';

function temaSalvo() {
  try { return localStorage.getItem(CHAVE_TEMA) === 'escuro' ? 'escuro' : 'claro'; } catch (e) { return 'claro'; }
}

export default function App() {
  const [tela, setTela] = useState(VEIO_DE_RECUPERACAO || LINK_COM_ERRO ? 'painel' : 'inicio');
  const [recuperando, setRecuperando] = useState(VEIO_DE_RECUPERACAO);
  const [tema, setTemaEstado] = useState(temaSalvo); // 'claro' (normal) ou 'escuro'

  function setTema(novo) {
    setTemaEstado(novo);
    try { localStorage.setItem(CHAVE_TEMA, novo); } catch (e) { /* sem armazenamento: vale só nesta visita */ }
  }

  // O fundo da página inteira (atrás do painel, no computador) acompanha o modo — bege no normal,
  // escuro no escuro — mas só depois da tela inicial, que continua verde nos dois modos.
  useEffect(() => {
    const escuro = tema === 'escuro' && tela !== 'inicio';
    const claroInterno = tema !== 'escuro' && tela !== 'inicio';
    document.body.style.background = escuro ? '#0F1311' : claroInterno ? '#FAF1CD' : '';
    document.documentElement.style.colorScheme = escuro ? 'dark' : 'light';
  }, [tema, tela]);

  if (tela === 'inicio') {
    return <TelaInicio irPortal={() => setTela('portal')} irPainel={() => setTela('painel')} tema={tema} setTema={setTema} />;
  }
  if (tela === 'portal') {
    return <Portal voltar={() => setTela('inicio')} tema={tema} />;
  }
  return (
    <PainelGestao
      voltar={() => setTela('inicio')}
      tema={tema}
      recuperacao={recuperando}
      erroLink={LINK_COM_ERRO}
      aoConcluirRecuperacao={() => setRecuperando(false)}
    />
  );
}

import { useState } from 'react';
import TelaInicio from './components/TelaInicio';
import Portal from './components/Portal';
import PainelGestao from './components/PainelGestao';

export default function App() {
  const [tela, setTela] = useState('inicio');

  if (tela === 'inicio') {
    return <TelaInicio irPortal={() => setTela('portal')} irPainel={() => setTela('painel')} />;
  }
  if (tela === 'portal') {
    return <Portal voltar={() => setTela('inicio')} />;
  }
  return <PainelGestao voltar={() => setTela('inicio')} />;
}

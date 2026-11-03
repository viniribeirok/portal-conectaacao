/**
 * Apoio para turmas "contínuas" x "eventos de um dia" (data específica).
 * Funções puras, fáceis de testar.
 */

// Data local de hoje no formato AAAA-MM-DD (o mesmo do <input type="date">).
export function hojeISO(agora = new Date()) {
  const a = agora.getFullYear();
  const m = String(agora.getMonth() + 1).padStart(2, '0');
  const d = String(agora.getDate()).padStart(2, '0');
  return `${a}-${m}-${d}`;
}

// Evento de um dia cuja data já passou (não deve aparecer na busca dos pais).
export function eventoJaPassou(turma, hoje = hojeISO()) {
  return turma.tipoAtividade === 'pontual' && !!turma.dataEvento && turma.dataEvento < hoje;
}

const DIAS = ['domingo', 'segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado'];

function hhmm(h) {
  const [hh, mm] = h.split(':');
  return mm === '00' ? `${Number(hh)}h` : `${Number(hh)}h${mm}`;
}

// "Domingo, 15/11/2026 das 19h às 21h30" (horário só aparece se foi informado).
export function formatarQuando(turma) {
  if (turma.tipoAtividade !== 'pontual' || !turma.dataEvento) return '';
  const [a, m, d] = turma.dataEvento.split('-').map(Number);
  const dia = DIAS[new Date(a, m - 1, d).getDay()];
  const base = `${dia.charAt(0).toUpperCase()}${dia.slice(1)}, ${String(d).padStart(2, '0')}/${String(m).padStart(2, '0')}/${a}`;
  if (!turma.horaInicio) return base;
  return turma.horaFim ? `${base} das ${hhmm(turma.horaInicio)} às ${hhmm(turma.horaFim)}` : `${base} às ${hhmm(turma.horaInicio)}`;
}

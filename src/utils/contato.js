// Telefones das instituições. Podem ser CELULAR (DDD + 9 dígitos, aceita WhatsApp)
// ou FIXO (DDD + 8 dígitos, só dá pra ligar). Aceita o número com ou sem +55 e com
// máscara: "(11) 99999-0000", "11999990000" e "5511999990000" são o mesmo número.

// Só os dígitos, sem zeros à esquerda e sem o 55 do país.
export function digitosTelefone(numero = '') {
  let d = String(numero).replace(/\D/g, '').replace(/^0+/, '');
  if (d.startsWith('55') && d.length >= 12) d = d.slice(2);
  return d;
}

// 'celular' (DDD + 9 dígitos), 'fixo' (DDD + 8 dígitos) ou 'invalido'.
export function tipoTelefone(numero) {
  const d = digitosTelefone(numero);
  if (d.length === 11) return 'celular';
  if (d.length === 10) return 'fixo';
  return 'invalido';
}

export function rotuloTelefone(numero) {
  const t = tipoTelefone(numero);
  return t === 'celular' ? 'WhatsApp' : t === 'fixo' ? 'Telefone' : 'Contato';
}

// Forma guardada no banco: 55 + DDD + número (formato que o wa.me exige).
export function normalizarTelefone(numero) {
  const d = digitosTelefone(numero);
  return d.length === 10 || d.length === 11 ? `55${d}` : String(numero).trim();
}

export function linkLigar(numero) {
  return `tel:+55${digitosTelefone(numero)}`;
}

// (11) 99999-0000  |  (11) 3333-4444
export function formatarTelefone(numero = '') {
  const d = digitosTelefone(numero);
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return String(numero);
}

// Número de WhatsApp guardado como 5511999990000 -> (11) 99999-0000.
export function formatarTelefone(numero = '') {
  let d = String(numero).replace(/\D/g, '');
  if (d.startsWith('55') && d.length >= 12) d = d.slice(2);
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return String(numero); // formato desconhecido: mostra como foi cadastrado
}

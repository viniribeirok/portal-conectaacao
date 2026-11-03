// Faixa etária de uma atividade. 0 a 99 anos é tratado como "todas as idades"
// (ex.: uma peça de teatro para a família toda).
export const IDADE_MAXIMA = 99;

export function todasAsIdades(min, max) {
  return Number(min) <= 0 && Number(max) >= IDADE_MAXIMA;
}

export function formatarIdades(min, max) {
  return todasAsIdades(min, max) ? 'Todas as idades' : `${min} a ${max} anos`;
}

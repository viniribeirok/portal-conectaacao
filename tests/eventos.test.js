import { describe, it, expect } from 'vitest';
import { eventoJaPassou, formatarQuando } from '../src/utils/eventos.js';

describe('eventos de um dia e de vários dias', () => {
  const hoje = '2026-11-18';
  it('evento de um dia só passa depois da data', () => {
    expect(eventoJaPassou({ tipoAtividade: 'pontual', dataEvento: '2026-11-17' }, hoje)).toBe(true);
    expect(eventoJaPassou({ tipoAtividade: 'pontual', dataEvento: '2026-11-18' }, hoje)).toBe(false);
  });
  it('curso de vários dias vale até o último dia', () => {
    expect(eventoJaPassou({ tipoAtividade: 'pontual', dataEvento: '2026-11-02', dataFim: '2026-11-20' }, hoje)).toBe(false);
    expect(eventoJaPassou({ tipoAtividade: 'pontual', dataEvento: '2026-11-02', dataFim: '2026-11-17' }, hoje)).toBe(true);
  });
  it('turma contínua nunca "passa"', () => expect(eventoJaPassou({ tipoAtividade: 'continua' }, hoje)).toBe(false));
  it('formato do evento cadastrado no portal continua igual', () => {
    expect(formatarQuando({ tipoAtividade: 'pontual', dataEvento: '2026-11-15', horaInicio: '19:00', horaFim: '21:30' })).toBe('Domingo, 15/11/2026 das 19h às 21h30');
  });
  it('atividade importada mostra o texto pronto', () => {
    expect(formatarQuando({ tipoAtividade: 'continua', horarioTexto: 'Quinta, 20h às 21h' })).toBe('Quinta, 20h às 21h');
    expect(formatarQuando({ tipoAtividade: 'continua' })).toBe('');
  });
});

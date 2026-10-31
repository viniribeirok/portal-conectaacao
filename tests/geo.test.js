import { describe, it, expect } from 'vitest';
import { distanciaKm, formatarDistancia } from '../src/utils/geo';

describe('distanciaKm', () => {
  it('retorna 0 quando os dois pontos são iguais', () => {
    expect(distanciaKm(-23.588, -46.61, -23.588, -46.61)).toBeCloseTo(0, 5);
  });

  it('calcula uma distância curta corretamente (Ipiranga -> Vila Mariana, ~2,5km)', () => {
    // Judô (Ipiranga) e Capoeira (Vila Mariana), coordenadas do seed do banco
    const d = distanciaKm(-23.588, -46.61, -23.5895, -46.6345);
    expect(d).toBeGreaterThan(2);
    expect(d).toBeLessThan(3);
  });

  it('é simétrica (distância de A pra B é igual de B pra A)', () => {
    const ab = distanciaKm(-23.588, -46.61, -23.647, -46.6425);
    const ba = distanciaKm(-23.647, -46.6425, -23.588, -46.61);
    expect(ab).toBeCloseTo(ba, 9);
  });
});

describe('formatarDistancia', () => {
  it('mostra em metros quando é menos de 1km', () => {
    expect(formatarDistancia(0.45)).toBe('450 m');
    expect(formatarDistancia(0.05)).toBe('50 m');
  });

  it('mostra em km com vírgula quando é 1km ou mais', () => {
    expect(formatarDistancia(2.1)).toBe('2,1 km');
    expect(formatarDistancia(1)).toBe('1,0 km');
    expect(formatarDistancia(12.34)).toBe('12,3 km');
  });
});

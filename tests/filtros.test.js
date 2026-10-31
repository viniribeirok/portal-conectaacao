import { describe, it, expect } from 'vitest';
import { filtrarAtividades } from '../src/utils/filtros';

const ATIVIDADES = [
  { id: 1, nome: 'Judô', instituicao: 'Centro Vila Esperança', categoria: 'Artes Marciais', idadeMin: 6, idadeMax: 12, bairro: 'Ipiranga', latitude: -23.588, longitude: -46.61 },
  { id: 2, nome: 'Balé Infantil', instituicao: 'CEU Jardim das Rosas', categoria: 'Dança', idadeMin: 4, idadeMax: 8, bairro: 'Sacomã', latitude: -23.619, longitude: -46.608 },
  { id: 3, nome: 'Capoeira', instituicao: 'Associação Passo a Passo', categoria: 'Artes Marciais', idadeMin: 7, idadeMax: 15, bairro: 'Vila Mariana', latitude: -23.5895, longitude: -46.6345 },
];

describe('filtrarAtividades', () => {
  it('sem filtros, devolve tudo', () => {
    const r = filtrarAtividades(ATIVIDADES, {});
    expect(r).toHaveLength(3);
  });

  it('filtra por texto no bairro', () => {
    const r = filtrarAtividades(ATIVIDADES, { busca: 'ipiranga' });
    expect(r.map((a) => a.nome)).toEqual(['Judô']);
  });

  it('filtra por texto na instituição, sem diferenciar maiúsculas', () => {
    const r = filtrarAtividades(ATIVIDADES, { busca: 'PASSO A PASSO' });
    expect(r.map((a) => a.nome)).toEqual(['Capoeira']);
  });

  it('filtra por categoria', () => {
    const r = filtrarAtividades(ATIVIDADES, { categoria: 'Dança' });
    expect(r.map((a) => a.nome)).toEqual(['Balé Infantil']);
  });

  it('filtra por idade dentro da faixa', () => {
    const r = filtrarAtividades(ATIVIDADES, { idade: 5 });
    expect(r.map((a) => a.nome)).toEqual(['Balé Infantil']);
  });

  it('idade fora de qualquer faixa não retorna nada', () => {
    const r = filtrarAtividades(ATIVIDADES, { idade: 1 });
    expect(r).toHaveLength(0);
  });

  it('combina texto + categoria + idade', () => {
    const r = filtrarAtividades(ATIVIDADES, { busca: 'Vila Mariana', categoria: 'Artes Marciais', idade: 10 });
    expect(r.map((a) => a.nome)).toEqual(['Capoeira']);
  });

  it('com localização, ordena da mais perto pra mais longe e adiciona distanciaKm', () => {
    const minhaLocalizacao = { lat: -23.5895, lon: -46.6345 }; // exatamente em cima da Capoeira
    const r = filtrarAtividades(ATIVIDADES, { minhaLocalizacao });
    expect(r[0].nome).toBe('Capoeira');
    expect(r[0].distanciaKm).toBeCloseTo(0, 3);
    expect(r[1].distanciaKm).toBeLessThanOrEqual(r[2].distanciaKm);
  });

  it('atividade sem latitude/longitude (ex: instituição recém-cadastrada) vai pro fim, sem quebrar', () => {
    const comUmaSemCoordenada = [
      ...ATIVIDADES,
      { id: 4, nome: 'Xadrez', instituicao: 'ONG Nova', categoria: 'Cultura', idadeMin: 6, idadeMax: 14, bairro: 'Centro' },
    ];
    const minhaLocalizacao = { lat: -23.5895, lon: -46.6345 };
    const r = filtrarAtividades(comUmaSemCoordenada, { minhaLocalizacao });
    expect(r).toHaveLength(4);
    expect(r[r.length - 1].nome).toBe('Xadrez');
    expect(r[r.length - 1].distanciaKm).toBeUndefined();
  });
});

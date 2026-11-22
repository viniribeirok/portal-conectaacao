import { describe, it, expect } from 'vitest';
import { acharChaveDeNome, casarUnidade, dadosDoEquipamento } from '../scripts/importador/geosampa.js';

// formato real da camada geoportal:equipamento_educacao_ceu (campos vistos no diagnóstico)
const item = (nome, lat, lon, extra = {}) => ({
  latitude: lat, longitude: lon,
  props: { nm_tipo_equipamento: 'CEMEI', tx_tipo_equipamento: 'CENTRO MUNICIPAL DE EDUCACAO INFANTIL', nm_classe_equipamento: 'CEU', tx_classe_equipamento: 'CEU',
    nm_equipamento: nome, tx_endereco_equipamento: 'JOAO PEDRO LECOR, 141', nm_bairro_equipamento: 'JARDIM AVELINO', cd_cep_equipamento: '03227-190', tx_numero_telefone: '23014801', ...extra },
});
const ITENS = [
  item('CEU CEMEI VILA ALPINA', -23.58561, -46.5662),
  item('CEU EMEF VILA ALPINA', -23.58565, -46.56624),
  item('CEU CEI PARQUE DO CARMO', -23.5801, -46.4611, { tx_numero_telefone: '' }),
  item('CEU EMEI PERUS', -23.4, -46.75),
  item('CEU EMEF PERUS', -23.4002, -46.7502),
];

describe('GeoSampa (formato real)', () => {
  it('escolhe o campo do nome, e não o da classe (que vale "CEU" em todos)', () => expect(acharChaveDeNome(ITENS)).toBe('nm_equipamento'));
  it('junta os equipamentos de um mesmo CEU e tira a média das posições', () => {
    const c = casarUnidade('ceu-vila-alpina', ITENS, 'nm_equipamento');
    expect(c.quantidade).toBe(2);
    expect(c.latitude).toBeGreaterThan(-23.5857); expect(c.latitude).toBeLessThan(-23.5855);
  });
  it('não confunde CEUs diferentes', () => expect(casarUnidade('ceu-perus', ITENS, 'nm_equipamento').quantidade).toBe(2));
  it('unidade que não está na camada', () => expect(casarUnidade('ceu-inexistente', ITENS, 'nm_equipamento')).toBeNull());
  it('endereço, CEP e telefone de apoio', () => {
    expect(dadosDoEquipamento(ITENS[0].props)).toEqual({ endereco: 'Joao Pedro Lecor, 141', bairro: 'Jardim Avelino', cep: '03227-190', telefone: '551123014801' });
  });
  it('prefere o equipamento que tem telefone', () => expect(casarUnidade('ceu-parque-do-carmo', [...ITENS, item('CEU EMEF PARQUE DO CARMO', -23.58, -46.46)], 'nm_equipamento').dados.telefone).toBe('551123014801'));
});

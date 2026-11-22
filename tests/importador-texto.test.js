import { describe, it, expect } from 'vitest';
import {
  parseDatas, parseDiasSemana, parseHorarios, parseQuando, montarHorarioTexto, parseFaixaEtaria,
  parseEndereco, ehLinhaDeEndereco, parseTelefone, mapearCategoria, ignorarPorCategoria, nomeCasa, utm23sParaLatLon, tituloCase, telefoneDeDigitos,
} from '../scripts/importador/texto.js';

describe('datas, dias e horários (formato do portal dos CEUs)', () => {
  it('data única', () => expect(parseDatas('20 Nov 2026')).toEqual({ inicio: '2026-11-20', fim: '2026-11-20' }));
  it('intervalo no mesmo mês', () => expect(parseDatas('02 a 20 Nov 2026')).toEqual({ inicio: '2026-11-02', fim: '2026-11-20' }));
  it('intervalo entre meses', () => expect(parseDatas('27 Jun a 29 Nov 2026')).toEqual({ inicio: '2026-06-27', fim: '2026-11-29' }));
  it('intervalo entre anos', () => expect(parseDatas('20 Dez 2026 a 10 Jan 2027')).toEqual({ inicio: '2026-12-20', fim: '2027-01-10' }));
  it('dia da semana não é data', () => expect(parseDatas('Terça')).toBeNull());
  it('dia inexistente é ignorado', () => expect(parseDatas('31 Nov 2026')).toBeNull());
  it('dias da semana', () => { expect(parseDiasSemana('Quinta / Quinta')).toEqual(['Quinta']); expect(parseDiasSemana('Sábado e Domingo')).toEqual(['Sábado', 'Domingo']); });
  it('faixa de horário', () => expect(parseHorarios('11h às 17h')).toEqual([{ ini: '11:00', fim: '17:00' }]));
  it('duas faixas no mesmo dia', () => expect(parseHorarios('8h30min às 10h30min / 15h às 17h')).toEqual([{ ini: '08:30', fim: '10:30' }, { ini: '15:00', fim: '17:00' }]));
  it('horário só de início', () => { expect(parseHorarios('14h')).toEqual([{ ini: '14:00', fim: null }]); expect(parseHorarios('10h30min')).toEqual([{ ini: '10:30', fim: null }]); });
  it('atividade permanente', () => {
    const q = parseQuando(['Terça', '8h às 09h']);
    expect(q.tipo).toBe('permanente'); expect(q.dias).toEqual(['Terça']); expect(q.horarios).toEqual([{ ini: '08:00', fim: '09:00' }]);
    expect(montarHorarioTexto(q)).toBe('Terça, 8h às 09h');
  });
  it('atividade com data', () => {
    const q = parseQuando(['20 Nov 2026', '11h às 17h']);
    expect(q.tipo).toBe('datado'); expect(q.inicio).toBe('2026-11-20'); expect(montarHorarioTexto(q)).toBe('20/11/2026, 11h às 17h');
  });
  it('curso de vários dias', () => expect(montarHorarioTexto(parseQuando(['02 a 20 Nov 2026', '14h às 17h']))).toBe('02/11/2026 a 20/11/2026, 14h às 17h'));
  it('sem informação de quando', () => expect(parseQuando(['CEU Perus']).tipo).toBeNull());
  it('nome de unidade com dia da semana não vira dia', () => {
    expect(parseQuando(['CEU Quinta do Sol', '20h às 21h']).tipo).toBeNull();
    expect(parseQuando(['CEU Quinta do Sol', 'Sexta', '20h às 21h']).dias).toEqual(['Sexta']);
  });
  it('dia com "-feira" e vários dias', () => { expect(parseQuando(['Quinta-feira', '10h']).dias).toEqual(['Quinta']); expect(parseQuando(['Segunda, Quarta e Sexta', '10h']).dias).toEqual(['Segunda', 'Quarta', 'Sexta']); });
});

describe('faixa etária', () => {
  it('adulto', () => { const f = parseFaixaEtaria('Adulto (a partir de 18 anos)'); expect(f.adulto).toBe(true); });
  it('faixas numéricas', () => { expect(parseFaixaEtaria('06 a 09 anos')).toMatchObject({ min: 6, max: 9, adulto: false }); expect(parseFaixaEtaria('00 a 02 anos')).toMatchObject({ min: 0, max: 2 }); });
  it('várias faixas juntas', () => expect(parseFaixaEtaria('06 a 09 anos, 10 a 11 anos')).toMatchObject({ min: 6, max: 11 }));
  it('a partir de N anos', () => expect(parseFaixaEtaria('a partir de 10 anos')).toMatchObject({ min: 10, max: 99, adulto: false }));
  it('livre = todas as idades', () => expect(parseFaixaEtaria('Livre')).toMatchObject({ min: 0, max: 99 }));
  it('rótulos com idade entre parênteses', () => {
    expect(parseFaixaEtaria('Infantil I (0 a 3 anos e 11 meses)')).toMatchObject({ min: 0, max: 3 });
    expect(parseFaixaEtaria('Juvenil (14 a 17 anos)')).toMatchObject({ min: 14, max: 17 });
    expect(parseFaixaEtaria('Recreio nas Férias (0 a 14 anos)')).toMatchObject({ min: 0, max: 14 });
  });
  it('categorias esportivas', () => expect(parseFaixaEtaria('Sub-11')).toMatchObject({ min: 9, max: 11 }));
  it('terceira idade e master são adultos', () => { expect(parseFaixaEtaria('Terceira Idade').adulto).toBe(true); expect(parseFaixaEtaria('Master 50+').adulto).toBe(true); });
  it('criança e adulto juntos', () => expect(parseFaixaEtaria('Infantojuvenil, Adulto')).toMatchObject({ min: 0, max: 99 }));
  it('texto desconhecido', () => { expect(parseFaixaEtaria('').desconhecida).toBe(true); expect(parseFaixaEtaria('Conforme inscrição').desconhecida).toBe(true); });
});

describe('endereço e telefone', () => {
  it('endereço completo', () => expect(parseEndereco('Rua Gaspar da Silva, 240 - Parque do Carmo - CEP: 08270000')).toEqual({ logradouro: 'Rua Gaspar da Silva, 240', bairro: 'Parque do Carmo', cep: '08270-000' }));
  it('endereço sem bairro', () => expect(parseEndereco('Av. Paulista, 1000 - CEP: 01310-100')).toEqual({ logradouro: 'Av. Paulista, 1000', bairro: '', cep: '01310-100' }));
  it('endereço da lista de unidades (espaço antes da vírgula)', () => expect(parseEndereco('Avenida dos Metalúrgicos , 1262 - Cidade Tiradentes - CEP: 08471000')).toEqual({ logradouro: 'Avenida dos Metalúrgicos, 1262', bairro: 'Cidade Tiradentes', cep: '08471-000' }));
  it('endereço com complemento: bairro é o último trecho antes do CEP', () => expect(parseEndereco('Av Bento Guelfi , SN - Portaria 1 na Rua Tamotsu Yabuta - Jardim Laranjeira - Iguatemi - CEP: 08381001')).toEqual({ logradouro: 'Av Bento Guelfi, SN', bairro: 'Iguatemi', cep: '08381-001' }));
  it('não é endereço', () => expect(parseEndereco('Dojô')).toBeNull());
  it('ignora o endereço da sede da Secretaria', () => expect(ehLinhaDeEndereco('Rua Borges Lagoa, 1230 - Vila Clementino - CEP: 04038-003')).toBe(false));
  it('telefone fixo sem DDD vira (11)', () => expect(parseTelefone(['pqdocarmo@baccarelli.org.br', '/ 5990-3369'])).toBe('551159903369'));
  it('telefone com DDD', () => expect(parseTelefone(['(11) 5990-3369'])).toBe('551159903369'));
  it('celular', () => expect(parseTelefone(['Contato: 11 98765-4321'])).toBe('5511987654321'));
  it('não confunde CEP com telefone', () => expect(parseTelefone(['Rua X, 10 - Bairro - CEP: 08270-000'])).toBe(''));
});

describe('categoria e filtros', () => {
  it('artes marciais', () => expect(mapearCategoria(['Artes Marciais e Lutas', 'Condicionamento Físico'], 'Muay Thay')).toBe('Artes Marciais'));
  it('dança', () => expect(mapearCategoria(['Dança'], 'Baile da Consciência Negra.')).toBe('Dança'));
  it('esportes', () => expect(mapearCategoria(['Atividades Coletivas com bola'], 'Futsal')).toBe('Esportes'));
  it('cultura', () => expect(mapearCategoria(['Biblioteca', 'Contação de História'], 'Contação de Histórias')).toBe('Cultura'));
  it('reforço', () => expect(mapearCategoria([], 'Curso de desenvolvimento de games')).toBe('Reforço Escolar'));
  it('ignora reuniões', () => { expect(ignorarPorCategoria(['Reunião'], 'Encontro')).toBe(true); expect(ignorarPorCategoria(['Dança'], 'Zumba')).toBe(false); });
});

describe('nomes e coordenadas', () => {
  it('casa o apelido da unidade com o nome do equipamento', () => {
    expect(nomeCasa('ceu-parque-do-carmo', 'CEU PARQUE DO CARMO - JOÃO CÂNDIDO')).toBe(true);
    expect(nomeCasa('ceu-perus', 'CEU PARQUE DO CARMO')).toBe(false);
  });
  it('converte UTM 23S para latitude/longitude (centro de São Paulo)', () => {
    const p = utm23sParaLatLon(333500, 7394500);
    expect(p.latitude).toBeGreaterThan(-23.6); expect(p.latitude).toBeLessThan(-23.5);
    expect(p.longitude).toBeGreaterThan(-46.7); expect(p.longitude).toBeLessThan(-46.6);
  });
});

describe('dados do GeoSampa', () => {
  it('maiúsculas viram nome próprio', () => { expect(tituloCase('JARDIM AVELINO')).toBe('Jardim Avelino'); expect(tituloCase('JOAO PEDRO LECOR, 141')).toBe('Joao Pedro Lecor, 141'); expect(tituloCase('VILA DOS REMEDIOS')).toBe('Vila dos Remedios'); });
  it('telefone sem DDD vira (11)', () => { expect(telefoneDeDigitos('23014801')).toBe('551123014801'); expect(telefoneDeDigitos('')).toBe(''); expect(telefoneDeDigitos('11987654321')).toBe('5511987654321'); });
});

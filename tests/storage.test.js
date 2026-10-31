import { describe, it, expect, beforeEach } from 'vitest';
import { storage } from '../src/lib/storage';

beforeEach(() => {
  localStorage.clear();
});

describe('storage (polyfill de window.storage com localStorage)', () => {
  it('get() de uma chave que não existe lança erro', async () => {
    await expect(storage.get('nao-existe')).rejects.toThrow();
  });

  it('set() seguido de get() devolve o mesmo valor', async () => {
    await storage.set('minha-chave', 'ola mundo');
    const r = await storage.get('minha-chave');
    expect(r.value).toBe('ola mundo');
  });

  it('personal e shared não se misturam', async () => {
    await storage.set('mesma-chave', 'pessoal', false);
    await storage.set('mesma-chave', 'compartilhado', true);
    const pessoal = await storage.get('mesma-chave', false);
    const compartilhado = await storage.get('mesma-chave', true);
    expect(pessoal.value).toBe('pessoal');
    expect(compartilhado.value).toBe('compartilhado');
  });

  it('delete() remove a chave', async () => {
    await storage.set('temporaria', 'x');
    await storage.delete('temporaria');
    await expect(storage.get('temporaria')).rejects.toThrow();
  });

  it('list() devolve as chaves com o prefixo dado', async () => {
    await storage.set('ong-turmas:vila-esperanca', '[]');
    await storage.set('ong-turmas:girassol', '[]');
    await storage.set('outra-coisa', '[]');
    const r = await storage.list('ong-turmas:');
    expect(r.keys.sort()).toEqual(['ong-turmas:girassol', 'ong-turmas:vila-esperanca']);
  });
});

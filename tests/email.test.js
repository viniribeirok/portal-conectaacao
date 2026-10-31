import { describe, it, expect, beforeEach } from 'vitest';
import { enviarEmailSimulado, carregarEmailsEnviados } from '../src/lib/email';

beforeEach(() => {
  localStorage.clear();
});

describe('e-mail simulado', () => {
  it('começa sem nenhum e-mail registrado', async () => {
    expect(await carregarEmailsEnviados()).toEqual([]);
  });

  it('registra destinatário, assunto, corpo e data de envio', async () => {
    const registro = await enviarEmailSimulado({
      destinatario: 'ong@exemplo.org',
      assunto: 'Cadastro aprovado',
      corpo: 'Parabéns!',
    });
    expect(registro.destinatario).toBe('ong@exemplo.org');
    expect(registro.assunto).toBe('Cadastro aprovado');
    expect(registro.corpo).toBe('Parabéns!');
    expect(registro.enviadoEm).toBeTruthy();
  });

  it('os e-mails mais recentes ficam no início da lista', async () => {
    await enviarEmailSimulado({ destinatario: 'a@x.org', assunto: 'Primeiro', corpo: '1' });
    await enviarEmailSimulado({ destinatario: 'b@x.org', assunto: 'Segundo', corpo: '2' });
    const lista = await carregarEmailsEnviados();
    expect(lista).toHaveLength(2);
    expect(lista[0].assunto).toBe('Segundo');
    expect(lista[1].assunto).toBe('Primeiro');
  });
});

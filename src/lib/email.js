import { storage } from './storage';

/**
 * ATENÇÃO — isto NÃO envia e-mail de verdade.
 *
 * Mandar e-mail de verdade precisa de um servidor: as credenciais de um
 * serviço de e-mail (Resend, SendGrid, AWS SES, etc.) não podem ficar no
 * código que roda no navegador de qualquer visitante — teria que rodar
 * num backend (ou numa function serverless) que o front-end chama.
 *
 * O que este módulo faz é registrar, localmente, o e-mail que SERIA
 * enviado — assunto, corpo e destinatário — pra que o fluxo de aprovação
 * possa ser demonstrado e testado de ponta a ponta. Quando o projeto
 * tiver um backend, é só trocar o miolo de `enviarEmailSimulado` por uma
 * chamada de API (ex.: fetch('/api/enviar-email', {...})) — quem chama
 * essa função (PainelGestao.jsx) não precisa mudar nada.
 */

const CHAVE = 'emails-enviados';

export async function enviarEmailSimulado({ destinatario, assunto, corpo }) {
  const registro = {
    id: `email-${Date.now()}`,
    destinatario,
    assunto,
    corpo,
    enviadoEm: new Date().toISOString(),
  };
  const atuais = await carregarEmailsEnviados();
  const novaLista = [registro, ...atuais];
  await storage.set(CHAVE, JSON.stringify(novaLista), false);
  return registro;
}

export async function carregarEmailsEnviados() {
  try {
    const r = await storage.get(CHAVE, false);
    return r ? JSON.parse(r.value) : [];
  } catch (e) {
    return [];
  }
}

# Esqueci minha senha — o que configurar no Supabase

O código já está pronto. Faltam 2 configurações no painel do Supabase:

## 1) Endereços do site (obrigatório)
Authentication → URL Configuration:
- **Site URL:** `https://portalconectaacao.vercel.app`
- **Redirect URLs** (Add URL):
  - `https://portalconectaacao.vercel.app/**`
  - `http://localhost:5173/**`  (para testar no computador)

Sem isso o link do e-mail abre o endereço errado.

## 2) Envio do e-mail
O envio padrão do Supabase só entrega para membros do time do projeto (limite de 2 e-mails por hora).
- **Para testar:** peça a recuperação com o e-mail da sua própria conta do Supabase — funciona sem configurar nada.
- **Para qualquer ONG receber:** configure um SMTP próprio. Opção gratuita simples: uma conta Gmail só do projeto.
  1. Crie uma conta Gmail dedicada (ex.: conectaacao.portal@gmail.com).
  2. Ative a **verificação em duas etapas** (Conta Google → Segurança).
  3. Crie uma **senha de app** (Segurança → Verificação em duas etapas → Senhas de app). Guarde o código de 16 letras.
  4. No Supabase: Authentication → Emails → **SMTP Settings** → ligue "Enable Custom SMTP":
     - Sender email: o Gmail da conta · Sender name: `Portal Conecta Ação`
     - Host: `smtp.gmail.com` · Port: `465` · Username: o Gmail · Password: a senha de app
  5. Salve e teste.
- Opcional: depois de configurar o SMTP, cole o modelo `email-recuperar-senha.html` em Authentication → Emails → Templates → Reset Password.

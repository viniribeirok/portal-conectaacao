# Supabase — passo a passo

1. Crie uma conta e um projeto em supabase.com (anote a senha do banco).
2. Authentication → Providers → Email: **desative "Confirm email"** (sem isso o cadastro de ONG não consegue enviar o documento na hora).
3. SQL Editor: rode `schema.sql` e depois `seed.sql`.
4. Crie o admin: Authentication → Users → Add user (e-mail + senha, "Auto Confirm User"); depois rode o comando que está no final do `schema.sql`.
5. Project Settings → API: copie a **Project URL** e a chave **anon / public** para um arquivo `.env.local` (modelo: `.env.example`). **Nunca** use a chave `service_role` no app.
6. `npm install` e `npm run dev`.
7. Para publicar, cadastre as mesmas duas variáveis no Netlify / Cloudflare Pages e gere o build de novo.

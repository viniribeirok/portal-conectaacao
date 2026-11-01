import { createClient } from '@supabase/supabase-js';

/**
 * Cliente do Supabase. As duas variáveis vêm do arquivo .env.local (veja .env.example)
 * ou das configurações do site na hospedagem. A chave "anon" é PÚBLICA por desenho —
 * quem protege os dados são as regras (RLS) do banco, em supabase/schema.sql.
 * Nunca coloque a chave "service_role" aqui.
 */
const url = import.meta.env.VITE_SUPABASE_URL;
const chave = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!url || !chave) {
  console.error('Faltam VITE_SUPABASE_URL e/ou VITE_SUPABASE_ANON_KEY — veja o arquivo .env.example.');
}

export const supabase = createClient(url || 'http://localhost:54321', chave || 'chave-nao-configurada');

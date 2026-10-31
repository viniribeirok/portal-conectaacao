import { Dumbbell, Music2, Swords, Palette, BookOpen } from 'lucide-react';

/**
 * Categorias, ícones e informações de status usados nas telas. Os dados
 * de atividades em si (quais turmas existem) agora vêm dinamicamente de
 * src/data/repositorio.js, que junta instituições + turmas salvas.
 */

export const CATEGORIAS = ['Todas', 'Esportes', 'Dança', 'Artes Marciais', 'Cultura', 'Reforço Escolar'];
export const CATEGORIAS_FORM = ['Esportes', 'Dança', 'Artes Marciais', 'Cultura', 'Reforço Escolar'];
export const ICONE_CATEGORIA = { 'Esportes': Dumbbell, 'Dança': Music2, 'Artes Marciais': Swords, 'Cultura': Palette, 'Reforço Escolar': BookOpen };
export const LETRA_CATEGORIA = { 'Esportes': 'E', 'Dança': 'D', 'Artes Marciais': 'A', 'Cultura': 'C', 'Reforço Escolar': 'R' };
export const STATUS_INFO = {
  'Abertas': { texto: 'Vagas abertas', cor: 'var(--marigold)', cta: 'Chamar no WhatsApp' },
  'Fila de Espera': { texto: 'Fila de espera', cor: 'var(--coral)', cta: 'Entrar na fila pelo WhatsApp' },
  'Encerradas': { texto: 'Vagas encerradas', cor: 'var(--muted)', cta: 'Perguntar sobre novas turmas' },
};
export const STATUS_OPCOES = ['Abertas', 'Fila de Espera', 'Encerradas'];
export const STATUS_COR_MAP = { 'Abertas': '#E8A23B', 'Fila de Espera': '#E85A3B', 'Encerradas': '#6B7A6E' };


/*
* ----------------------------------------------------
* @author: 4quarenta
* @author URI: https://github.com/4quarenta
* @copyright: (c) 2026 ConcursoMestre. All rights reserved
* ----------------------------------------------------
*
* @since 1.0.0
*
*/

import { BookOpen, Flag, User } from 'lucide-react';

export interface AdminDatabaseCategoryConfig {
  id: 'content' | 'people' | 'moderation';
  label: string;
  description: string;
  icon: typeof BookOpen;
  tabs: string[];
}

export interface AdminDatabaseSubTabMeta {
  label: string;
  description: string;
  category: AdminDatabaseCategoryConfig['id'];
}

/**
 * Define os dominios internos da aba Operacao.
 * Cada grupo explica o contexto da secao para reduzir ambiguidades no admin.
 *
 * @since 1.0.0
 */
export const ADMIN_DATABASE_CATEGORIES: AdminDatabaseCategoryConfig[] = [
  {
    id: 'content',
    label: 'Conteudo',
    description: 'Banco de questoes, importacao e taxonomias.',
    icon: BookOpen,
    tabs: ['questions', 'exams', 'import', 'filters'],
  },
  {
    id: 'people',
    label: 'Pessoas',
    description: 'Usuarios, perfis e acompanhamento da comunidade.',
    icon: User,
    tabs: ['users'],
  },
  {
    id: 'moderation',
    label: 'Moderacao',
    description: 'Materiais, rankings e revisao operacional.',
    icon: Flag,
    tabs: ['materials', 'rankings', 'blocked'],
  },
];

/**
 * Centraliza o nome e a descricao de cada secao operacional.
 *
 * @since 1.0.0
 */
export const ADMIN_DATABASE_SUBTAB_META: Record<string, AdminDatabaseSubTabMeta> = {
  questions: {
    label: 'Questoes',
    description: 'Cadastro, edicao, paginacao e revisao do banco principal.',
    category: 'content',
  },
  import: {
    label: 'Importador',
    description: 'Extracao assistida, revisao e publicacao em massa.',
    category: 'content',
  },
  exams: {
    label: 'Banco de provas',
    description: 'Cadastro global de provas para vinculo e manutencao no editor.',
    category: 'content',
  },
  filters: {
    label: 'Filtros e taxonomias',
    description: 'Bancas, orgaos, assuntos e relacionamentos da base.',
    category: 'content',
  },
  users: {
    label: 'Usuarios',
    description: 'Perfis, assinaturas, historico e acoes administrativas.',
    category: 'people',
  },
  rankings: {
    label: 'Rankings',
    description: 'Classificacoes, destaque competitivo e ajustes manuais.',
    category: 'moderation',
  },
  materials: {
    label: 'Materiais',
    description: 'Catalogo, moderacao e operacao do marketplace.',
    category: 'moderation',
  },
  reports: {
    label: 'Denuncias',
    description: 'Fila de moderacao com atalhos para acao imediata.',
    category: 'moderation',
  },
  blocked: {
    label: 'Revisao bloqueada',
    description: 'Materiais retidos aguardando nova analise.',
    category: 'moderation',
  },
};

export const ADMIN_DATABASE_SUBTAB_LABELS = Object.fromEntries(
  Object.entries(ADMIN_DATABASE_SUBTAB_META).map(([key, value]) => [key, value.label]),
);

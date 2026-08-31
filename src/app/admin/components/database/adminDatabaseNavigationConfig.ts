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

import { BookOpen, User } from 'lucide-react';

export interface AdminDatabaseCategoryConfig {
  id: 'content' | 'people';
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
 * Define os domínios internos da aba Operação.
 * Cada grupo explica o contexto da seção para reduzir ambiguidades no admin.
 *
 * @since 1.0.0
 */
export const ADMIN_DATABASE_CATEGORIES: AdminDatabaseCategoryConfig[] = [
  {
    id: 'content',
    label: 'Conteúdo',
    description: 'Banco de questões, importação e taxonomias.',
    icon: BookOpen,
    tabs: ['questions', 'question-groups', 'exams', 'import', 'gran-crawler', 'filters', 'lei-comentada'],
  },
  {
    id: 'people',
    label: 'Pessoas',
    description: 'Usuários, perfis e acompanhamento da comunidade.',
    icon: User,
    tabs: ['users'],
  },
];

/**
 * Centraliza o nome e a descrição de cada seção operacional.
 *
 * @since 1.0.0
 */
export const ADMIN_DATABASE_SUBTAB_META: Record<string, AdminDatabaseSubTabMeta> = {
  questions: {
    label: 'Questões',
    description: 'Cadastro, edição, paginação e revisão do banco principal.',
    category: 'content',
  },
  'question-groups': {
    label: 'Contexto de questões',
    description: 'Textos e imagens reutilizáveis vinculados aos enunciados.',
    category: 'content',
  },
  import: {
    label: 'Importador',
    description: 'Extração assistida, revisão e publicação em massa.',
    category: 'content',
  },
  'gran-crawler': {
    label: 'Crawler Gran',
    description: 'Acesso operacional ao crawler da Gran para ingestão guiada.',
    category: 'content',
  },
  exams: {
    label: 'Banco de provas',
    description: 'Cadastro global de provas para vínculo e manutenção no editor.',
    category: 'content',
  },
  filters: {
    label: 'Filtros e taxonomias',
    description: 'Bancas, órgãos, assuntos e relacionamentos da base.',
    category: 'content',
  },
  'lei-comentada': {
    label: 'Lei Comentada',
    description: 'Leis, artigos, comentários editoriais, súmulas e vínculo com matérias.',
    category: 'content',
  },
  users: {
    label: 'Usuários',
    description: 'Perfis, assinaturas, histórico e ações administrativas.',
    category: 'people',
  },
  rankings: {
    label: 'Rankings',
    description: 'Classificações, destaque competitivo e ajustes manuais.',
    category: 'people',
  },
  materials: {
    label: 'Materiais',
    description: 'Catálogo, moderação e operação do marketplace.',
    category: 'people',
  },
  reports: {
    label: 'Denúncias',
    description: 'Fila de moderação com atalhos para ação imediata.',
    category: 'people',
  },
  blocked: {
    label: 'Revisão bloqueada',
    description: 'Materiais retidos aguardando nova análise.',
    category: 'people',
  },
};

export const ADMIN_DATABASE_SUBTAB_LABELS = Object.fromEntries(
  Object.entries(ADMIN_DATABASE_SUBTAB_META).map(([key, value]) => [key, value.label]),
);

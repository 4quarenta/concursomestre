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

import { BookOpen, ShoppingBag, User } from 'lucide-react';

export const ADMIN_DATABASE_CATEGORIES = [
  { id: 'content', label: 'Conteudo', icon: BookOpen, tabs: ['questions', 'import', 'filters'] },
  { id: 'users', label: 'Usuarios', icon: User, tabs: ['users', 'blocked', 'rankings', 'reports'] },
  { id: 'marketplace', label: 'Marketplace', icon: ShoppingBag, tabs: ['materials'] },
];

export const ADMIN_DATABASE_SUBTAB_LABELS: Record<string, string> = {
  questions: 'Questoes',
  import: 'Importador',
  filters: 'Filtros (Taxonomia)',
  users: 'Gestao de Usuarios',
  blocked: 'Bloqueados',
  rankings: 'Rankings',
  materials: 'Materiais',
  reports: 'Denuncias',
};

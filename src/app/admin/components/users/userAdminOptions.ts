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

/**
 * Opcoes oficiais de papel do usuario no painel administrativo.
 *
 * @since 1.0.0
 */
export const ADMIN_USER_ROLE_OPTIONS = [
  { value: 'user', label: 'Usuario comum', helper: 'Aluno padrao sem privilegios internos.' },
  { value: 'staff', label: 'Staff', helper: 'Equipe interna com acesso ao painel administrativo.' },
  { value: 'partner', label: 'Parceiro', helper: 'Professor ou parceiro com acesso comercial.' },
  { value: 'admin', label: 'Admin', helper: 'Controle completo da plataforma.' },
] as const;

/**
 * Opcoes oficiais de status do usuario.
 *
 * @since 1.0.0
 */
export const ADMIN_USER_STATUS_OPTIONS = [
  { value: 'active', label: 'Ativo' },
  { value: 'pending', label: 'Pendente' },
  { value: 'suspended', label: 'Suspenso' },
  { value: 'banned', label: 'Banido' },
] as const;

/**
 * Retorna o rotulo amigavel do papel.
 *
 * @since 1.0.0
 */
export const getAdminUserRoleLabel = (role: string | null | undefined): string => {
  return ADMIN_USER_ROLE_OPTIONS.find((option) => option.value === role)?.label || 'Usuario comum';
};

/**
 * Retorna o rotulo amigavel do status.
 *
 * @since 1.0.0
 */
export const getAdminUserStatusLabel = (status: string | null | undefined): string => {
  return ADMIN_USER_STATUS_OPTIONS.find((option) => option.value === status)?.label || 'Ativo';
};

/**
 * Define o tom visual usado para o badge de papel.
 *
 * @since 1.0.0
 */
export const getAdminUserRoleBadgeClass = (role: string | null | undefined): string => {
  switch (role) {
    case 'admin':
      return 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300';
    case 'staff':
      return 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300';
    case 'partner':
      return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300';
    default:
      return 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300';
  }
};

/**
 * Define o tom visual usado para o badge de status.
 *
 * @since 1.0.0
 */
export const getAdminUserStatusBadgeClass = (status: string | null | undefined): string => {
  switch (status) {
    case 'banned':
      return 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300';
    case 'suspended':
      return 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300';
    case 'pending':
      return 'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300';
    default:
      return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300';
  }
};

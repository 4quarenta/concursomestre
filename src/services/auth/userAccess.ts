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

import type { UserProfile } from '@types';

/**
 * Papel oficial suportado pelo frontend autenticado.
 * Ele evita que o shell trate valores legados ou inesperados como papeis validos.
 *
 * @since 1.0.0
 */
export type PlatformUserRole = 'user' | 'staff' | 'partner' | 'admin';

const VALID_USER_ROLES = new Set<PlatformUserRole>(['user', 'staff', 'partner', 'admin']);

/**
 * Normaliza o papel retornado pela API para o contrato oficial do frontend.
 * Valores desconhecidos caem para `user` para nao abrir privilegios por engano.
 *
 * @since 1.0.0
 */
export const normalizeUserRole = (value: unknown): PlatformUserRole => {
  if (typeof value !== 'string') {
    return 'user';
  }

  return VALID_USER_ROLES.has(value as PlatformUserRole)
    ? (value as PlatformUserRole)
    : 'user';
};

/**
 * Informa se o usuario pode abrir o painel administrativo.
 * `staff` ganha acesso operacional ao admin sem virar superadmin global.
 *
 * @since 1.0.0
 */
export const canAccessAdminPanel = (
  user: Pick<UserProfile, 'role' | 'isAdmin' | 'isStaff' | 'canAccessAdmin'> | null | undefined,
): boolean => {
  if (!user) {
    return false;
  }

  return Boolean(
    user.canAccessAdmin
    || user.isAdmin
    || user.isStaff
    || user.role === 'admin'
    || user.role === 'staff',
  );
};

/**
 * Informa se o usuario tem acesso ao ecossistema de parceiro.
 *
 * @since 1.0.0
 */
export const canAccessPartnerArea = (
  user: Pick<UserProfile, 'role' | 'isPartner'> | null | undefined,
): boolean => {
  if (!user) {
    return false;
  }

  return Boolean(
    user.isPartner
    || user.role === 'partner'
    || user.role === 'admin',
  );
};

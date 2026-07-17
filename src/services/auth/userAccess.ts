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
 * O backend concede `admin.access` ao staff e ao admin autorizados. O frontend
 * apenas consome essa permissão; ele nunca deduz acesso pelo papel isoladamente.
 *
 * @since 1.0.0
 */
export const canAccessAdminPanel = (
  user: Pick<UserProfile, 'permissions'> | null | undefined,
): boolean => {
  if (!user) {
    return false;
  }

  return user.permissions?.includes('admin.access') === true;
};

/**
 * Informa se o usuario tem acesso ao ecossistema de parceiro.
 *
 * @since 1.0.0
 */
export const canAccessPartnerArea = (
  user: Pick<UserProfile, 'permissions' | 'partnershipStatus'> | null | undefined,
): boolean => {
  if (!user) {
    return false;
  }

  return user.permissions?.includes('partner.access') === true
    || user.partnershipStatus === 'active';
};

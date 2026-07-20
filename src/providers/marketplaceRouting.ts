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

const TRANSACTION_ROUTE_PREFIXES = [
  '/checkout',
  '/marketplace',
  '/partner-dashboard',
  '/admin/finance',
  '/admin/support/refunds',
  '/admin/marketplace',
] as const;

const routeMatchesAnyPrefix = (pathname: string, prefixes: readonly string[]) => (
  prefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))
);

/**
 * O perfil possui consulta transacional propria e nao deve acionar o provider
 * global de marketplace em paralelo.
 * @since 1.0.0
 */
export const shouldLoadMarketplaceTransactionsForPath = (pathname: string): boolean => (
  routeMatchesAnyPrefix(pathname, TRANSACTION_ROUTE_PREFIXES)
);


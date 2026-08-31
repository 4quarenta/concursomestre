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

import { redirect } from 'next/navigation';
import { resolveCanonicalAuthRedirectPath } from '@services/auth/canonicalAuthRedirect';

export type AuthAliasSearchParams = Record<string, string | string[] | undefined>;

export const redirectAuthAlias = (
  pathname: string,
  searchParams: AuthAliasSearchParams,
  fallbackPath: string,
): never => {
  const redirectPath = resolveCanonicalAuthRedirectPath(pathname, searchParams || {});
  redirect(redirectPath || fallbackPath);
};

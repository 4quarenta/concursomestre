import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { resolveCanonicalAuthRedirectPath } from '@services/auth/canonicalAuthRedirect';

export function proxy(request: NextRequest) {
  const redirectPath = resolveCanonicalAuthRedirectPath(request.nextUrl.pathname, request.nextUrl.searchParams);
  if (!redirectPath) {
    return NextResponse.next();
  }

  const currentPathWithSearch = request.nextUrl.search
    ? `${request.nextUrl.pathname}${request.nextUrl.search}`
    : request.nextUrl.pathname;
  if (currentPathWithSearch === redirectPath) {
    return NextResponse.next();
  }

  const redirectUrl = request.nextUrl.clone();
  const [pathname, search = ''] = redirectPath.split('?');
  redirectUrl.pathname = pathname;
  redirectUrl.search = search ? `?${search}` : '';

  return NextResponse.redirect(redirectUrl);
}

export const config = {
  matcher: ['/', '/auth', '/activate', '/activation', '/verify-email', '/confirm', '/confirm-email', '/recover', '/forgot-password', '/reset'],
};

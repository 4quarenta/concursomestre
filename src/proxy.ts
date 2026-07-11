import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { resolveCanonicalAuthRedirectPath } from '@services/auth/canonicalAuthRedirect';

export function proxy(request: NextRequest) {
  if (request.nextUrl.pathname.startsWith('/admin')) {
    // The refresh cookie is HttpOnly and is the only server-visible session
    // signal on the Next edge. Detailed admin/staff authorization remains in
    // the PHP API, but anonymous route enumeration must receive a real 404.
    const refreshCookieName = process.env.NEXT_PUBLIC_AUTH_REFRESH_COOKIE_NAME || 'cm_refresh';
    if (!request.cookies.has(refreshCookieName)) {
      return new NextResponse(null, {
        status: 404,
        headers: {
          'Cache-Control': 'no-store',
        },
      });
    }
  }

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
  matcher: [
    '/',
    '/auth',
    '/activate',
    '/activation',
    '/verify-email',
    '/confirm',
    '/confirm-email',
    '/recover',
    '/forgot-password',
    '/reset',
    '/admin/:path*',
  ],
};

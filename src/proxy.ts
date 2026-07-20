import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { resolveCanonicalAuthRedirectPath } from '@services/auth/canonicalAuthRedirect';
import { canAccessAdminRoute } from '@services/auth/adminRouteAccess';
import { hasAuthenticatedRouteSession } from '@services/auth/authenticatedRouteAccess';

const adminNotFound = () => new NextResponse(null, {
  status: 404,
  headers: {
    'Cache-Control': 'no-store',
  },
});

export async function proxy(request: NextRequest) {
  if (request.nextUrl.pathname.startsWith('/setup')) {
    try {
      const setupStatusUrl = new URL('/api/setup/status.php', request.url);
      const setupStatusResponse = await fetch(setupStatusUrl, {
        cache: 'no-store',
        headers: { Accept: 'application/json' },
      });
      if (!setupStatusResponse.ok) {
        return adminNotFound();
      }
    } catch {
      return adminNotFound();
    }
  }

  if (request.nextUrl.pathname.startsWith('/admin')) {
    // This is a server-side role check against the active refresh session.
    // Presence of a cookie alone is insufficient because a normal member has
    // the same refresh cookie as an admin or staff member.
    if (!(await canAccessAdminRoute(request))) {
      return adminNotFound();
    }
  }

  const redirectPath = resolveCanonicalAuthRedirectPath(request.nextUrl.pathname, request.nextUrl.searchParams);
  if (redirectPath) {
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

  if (request.nextUrl.pathname === '/' && await hasAuthenticatedRouteSession(request)) {
    const dashboardUrl = request.nextUrl.clone();
    dashboardUrl.pathname = '/dashboard';
    dashboardUrl.search = '';
    return NextResponse.redirect(dashboardUrl);
  }

  return NextResponse.next();
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
    '/setup/:path*',
    '/admin/:path*',
  ],
};

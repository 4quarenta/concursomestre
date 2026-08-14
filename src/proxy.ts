import type { NextRequest } from 'next/server';
import { NextResponse } from 'next/server';
import { resolveCanonicalAuthRedirectPath } from '@services/auth/canonicalAuthRedirect';
import { canAccessAdminRoute } from '@services/auth/adminRouteAccess';
import { hasAuthenticatedRouteSession } from '@services/auth/authenticatedRouteAccess';
import { publicRoutes, sanitizePublicRouteQuery } from '@services/routes/publicRoutes';

const adminNotFound = () => new NextResponse(null, {
  status: 404,
  headers: {
    'Cache-Control': 'no-store',
  },
});

const withoutInternalRscParameter = (parameters: URLSearchParams): URLSearchParams => {
  const output = new URLSearchParams(parameters);
  output.delete('_rsc');
  return output;
};

const resolveLegacyQuestionHubRedirect = (request: NextRequest): NextResponse | null => {
  const normalizedPath = request.nextUrl.pathname.replace(/\/+$/, '') || '/';
  if (normalizedPath !== '/practice' && normalizedPath !== '/questions') {
    return null;
  }

  const query = sanitizePublicRouteQuery('questions_hub', request.nextUrl.searchParams);
  return NextResponse.redirect(
    new URL(publicRoutes.questions.index(query), request.url),
    308,
  );
};

const resolveLegacyExamRedirect = (request: NextRequest): NextResponse | null => {
  const normalizedPath = request.nextUrl.pathname.replace(/\/+$/, '') || '/';
  if (normalizedPath !== '/blog/provas' && !normalizedPath.startsWith('/blog/provas/')) {
    return null;
  }

  const isDetail = normalizedPath.startsWith('/blog/provas/');
  const query = sanitizePublicRouteQuery(
    isDetail ? 'exam_detail' : 'exam_hub',
    request.nextUrl.searchParams,
  );
  let targetPath: string;

  if (isDetail) {
    const encodedSlug = normalizedPath.slice('/blog/provas/'.length);
    let persistedSlug = encodedSlug;
    try {
      persistedSlug = decodeURIComponent(encodedSlug);
    } catch {
      // Slug malformado continua identificavel e sera escapado pelo builder.
    }
    targetPath = publicRoutes.exams.detail(persistedSlug);
  } else {
    targetPath = publicRoutes.exams.index();
  }
  const redirectUrl = new URL(targetPath, request.url);
  redirectUrl.search = query.toString() ? `?${query.toString()}` : '';
  return NextResponse.redirect(redirectUrl, 308);
};

const resolveTrailingSlashRedirect = (request: NextRequest): NextResponse | null => {
  const pathname = request.nextUrl.pathname;
  if (pathname === '/' || !pathname.endsWith('/') || pathname.startsWith('/question/')) {
    return null;
  }

  const target = new URL(pathname.replace(/\/+$/, ''), request.url);
  const query = withoutInternalRscParameter(request.nextUrl.searchParams);
  target.search = query.toString() ? `?${query.toString()}` : '';
  return NextResponse.redirect(target, 308);
};

export async function proxy(request: NextRequest) {
  const legacyExamRedirect = resolveLegacyExamRedirect(request);
  if (legacyExamRedirect) {
    return legacyExamRedirect;
  }

  const legacyQuestionHubRedirect = resolveLegacyQuestionHubRedirect(request);
  if (legacyQuestionHubRedirect) {
    return legacyQuestionHubRedirect;
  }

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

  const trailingSlashRedirect = resolveTrailingSlashRedirect(request);
  if (trailingSlashRedirect) {
    return trailingSlashRedirect;
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/((?!api(?:/|$)|_next(?:/|$)|.*\\.[^/]+$).*)',
  ],
};

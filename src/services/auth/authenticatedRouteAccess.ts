import { resolveAbsoluteApiBaseUrl } from '@services/api/baseUrl';

const AUTHENTICATED_ROUTE_ACCESS_PATH = '/api/auth/session-route-access.php';
const AUTH_REFRESH_COOKIE_NAME = (
  process.env.NEXT_PUBLIC_AUTH_REFRESH_COOKIE_NAME
  || process.env.AUTH_REFRESH_COOKIE_NAME
  || 'cm_refresh'
).trim();

type AuthenticatedRouteRequest = Pick<Request, 'headers'>;

/**
 * Confirma no backend se o refresh cookie pertence a uma sessao ativa.
 * O endpoint nao retorna perfil, token ou permissoes: somente 204 ou 404.
 */
export const hasAuthenticatedRouteSession = async (request: AuthenticatedRouteRequest): Promise<boolean> => {
  const cookie = request.headers.get('cookie');
  const hasRefreshCookie = cookie?.split(';').some((entry) => (
    entry.trim().startsWith(`${AUTH_REFRESH_COOKIE_NAME}=`)
  ));
  if (!cookie || !hasRefreshCookie) {
    return false;
  }

  const headers = new Headers({
    Cookie: cookie,
    'X-ConcursoMestre-Session-Route-Check': '1',
  });
  const userAgent = request.headers.get('user-agent');
  if (userAgent) {
    headers.set('user-agent', userAgent);
  }

  try {
    const accessUrl = new URL(
      AUTHENTICATED_ROUTE_ACCESS_PATH.replace(/^\/api\//, ''),
      resolveAbsoluteApiBaseUrl(),
    ).toString();
    const response = await fetch(accessUrl, {
      method: 'GET',
      headers,
      cache: 'no-store',
      redirect: 'manual',
    });

    return response.status === 204;
  } catch {
    return false;
  }
};

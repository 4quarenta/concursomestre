const ADMIN_ROUTE_ACCESS_PATH = '/api/auth/admin-route-access.php';

type AdminRouteRequest = Pick<Request, 'headers' | 'url'>;

/**
 * Confirma a autorização de uma rota administrativa no servidor antes que o
 * shell do painel seja entregue. A API responde somente 204 ou 404 e usa a
 * sessão de refresh HttpOnly; nenhum perfil ou papel é transmitido ao edge.
 */
export const canAccessAdminRoute = async (request: AdminRouteRequest): Promise<boolean> => {
  const cookie = request.headers.get('cookie');
  if (!cookie) {
    return false;
  }

  const headers = new Headers({
    Cookie: cookie,
    'X-ConcursoMestre-Admin-Route-Check': '1',
  });
  for (const header of ['user-agent', 'x-forwarded-for', 'x-real-ip', 'cf-connecting-ip']) {
    const value = request.headers.get(header);
    if (value) {
      headers.set(header, value);
    }
  }

  try {
    const response = await fetch(new URL(ADMIN_ROUTE_ACCESS_PATH, request.url).toString(), {
      method: 'GET',
      headers,
      cache: 'no-store',
      redirect: 'manual',
    });

    return response.status === 204;
  } catch {
    // Fail closed: an unavailable authorization source must never reveal the
    // administrative shell to an unauthenticated or ordinary account.
    return false;
  }
};

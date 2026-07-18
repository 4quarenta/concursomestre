import { afterEach, describe, expect, it, vi } from 'vitest';
import { canAccessAdminRoute } from '@services/auth/adminRouteAccess';

const requestWithCookie = () => new Request('https://concursomestre.com/admin/operation/questions', {
  headers: {
    cookie: 'cm_refresh=opaque-refresh-token',
    'user-agent': 'vitest',
    'x-forwarded-for': '203.0.113.20',
  },
});

describe('admin route access guard', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns 404 to an anonymous visitor before calling the backend guard', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    await expect(canAccessAdminRoute(new Request('https://concursomestre.com/admin'))).resolves.toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it.each([
    ['aluno autenticado', 404],
    ['cookie com sessao invalida', 404],
    ['sessao expirada', 404],
    ['resposta proibida da API', 403],
    ['erro de autenticacao da API', 401],
  ])('returns 404 for %s', async (_scenario, status) => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status })));

    await expect(canAccessAdminRoute(requestWithCookie())).resolves.toBe(false);
  });

  it.each(['staff', 'admin'])('allows %s only after the backend confirms the active privileged session', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(canAccessAdminRoute(requestWithCookie())).resolves.toBe(true);
    expect(fetchMock).toHaveBeenCalledWith(
      'https://concursomestre.com/api/auth/admin-route-access.php',
      expect.objectContaining({ method: 'GET', cache: 'no-store', redirect: 'manual' }),
    );
  });

  it('uses the configured public origin when Next receives an internal upstream URL', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
    vi.stubGlobal('fetch', fetchMock);

    const internalRequest = new Request('http://127.0.0.1:3000/admin', {
      headers: {
        cookie: 'cm_refresh=opaque-refresh-token',
        host: 'concursomestre.com',
        'x-forwarded-proto': 'https',
      },
    });

    await expect(canAccessAdminRoute(internalRequest)).resolves.toBe(true);
    expect(fetchMock).toHaveBeenCalledWith(
      'https://concursomestre.com/api/auth/admin-route-access.php',
      expect.objectContaining({ method: 'GET' }),
    );
  });

  it('does not forge proxy-owned client IP headers in the server-to-server check', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(canAccessAdminRoute(new Request('https://concursomestre.com/admin', {
      headers: {
        cookie: 'cm_refresh=opaque-refresh-token',
        'user-agent': 'admin-browser',
        'x-forwarded-for': '198.51.100.20, 172.70.1.2',
        'x-real-ip': '172.70.1.2',
        'cf-connecting-ip': '198.51.100.20',
      },
    }))).resolves.toBe(true);

    const requestOptions = fetchMock.mock.calls[0]?.[1] as RequestInit;
    const forwardedHeaders = requestOptions.headers as Headers;
    expect(forwardedHeaders.get('user-agent')).toBe('admin-browser');
    expect(forwardedHeaders.has('x-forwarded-for')).toBe(false);
    expect(forwardedHeaders.has('x-real-ip')).toBe(false);
    expect(forwardedHeaders.has('cf-connecting-ip')).toBe(false);
  });

  it('fails closed for a network failure', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network unavailable')));
    await expect(canAccessAdminRoute(requestWithCookie())).resolves.toBe(false);
  });
});

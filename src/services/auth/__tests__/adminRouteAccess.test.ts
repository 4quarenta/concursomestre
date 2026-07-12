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

  it('denies a request without the refresh session cookie', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    await expect(canAccessAdminRoute(new Request('https://concursomestre.com/admin'))).resolves.toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('allows only the explicit backend authorization result', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(canAccessAdminRoute(requestWithCookie())).resolves.toBe(true);
    expect(fetchMock).toHaveBeenCalledWith(
      'https://concursomestre.com/api/auth/admin-route-access.php',
      expect.objectContaining({ method: 'GET', cache: 'no-store', redirect: 'manual' }),
    );
  });

  it('fails closed for a common user, an API error or a network failure', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 404 })));
    await expect(canAccessAdminRoute(requestWithCookie())).resolves.toBe(false);

    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network unavailable')));
    await expect(canAccessAdminRoute(requestWithCookie())).resolves.toBe(false);
  });
});

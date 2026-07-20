import { afterEach, describe, expect, it, vi } from 'vitest';
import { hasAuthenticatedRouteSession } from '@services/auth/authenticatedRouteAccess';

const requestWithCookie = () => new Request('https://concursomestre.com/', {
  headers: {
    cookie: 'cm_refresh=opaque-refresh-token; cm_csrf=csrf-token',
    'user-agent': 'vitest',
  },
});

describe('authenticated route access guard', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('does not call the backend without cookies', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    await expect(hasAuthenticatedRouteSession(new Request('https://concursomestre.com/'))).resolves.toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('ignores unrelated browser cookies', async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);

    const request = new Request('https://concursomestre.com/', {
      headers: { cookie: 'theme=dark; analytics_id=anonymous' },
    });
    await expect(hasAuthenticatedRouteSession(request)).resolves.toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('accepts only a backend-confirmed active session', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(hasAuthenticatedRouteSession(requestWithCookie())).resolves.toBe(true);
    expect(fetchMock).toHaveBeenCalledWith(
      'https://concursomestre.com/api/auth/session-route-access.php',
      expect.objectContaining({ method: 'GET', cache: 'no-store', redirect: 'manual' }),
    );
  });

  it.each([401, 403, 404, 500])('rejects backend status %s', async (status) => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status })));
    await expect(hasAuthenticatedRouteSession(requestWithCookie())).resolves.toBe(false);
  });

  it('fails closed on network errors', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network unavailable')));
    await expect(hasAuthenticatedRouteSession(requestWithCookie())).resolves.toBe(false);
  });
});

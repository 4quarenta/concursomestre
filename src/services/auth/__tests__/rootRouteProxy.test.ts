import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const { hasAuthenticatedRouteSession } = vi.hoisted(() => ({
  hasAuthenticatedRouteSession: vi.fn(),
}));

vi.mock('@services/auth/authenticatedRouteAccess', () => ({
  hasAuthenticatedRouteSession,
}));
vi.mock('@services/auth/adminRouteAccess', () => ({
  canAccessAdminRoute: vi.fn().mockResolvedValue(false),
}));

import { proxy } from '../../../proxy';

describe('root route server resolution', () => {
  beforeEach(() => {
    hasAuthenticatedRouteSession.mockReset();
  });

  it('redirects an authenticated root request to the dashboard before rendering', async () => {
    hasAuthenticatedRouteSession.mockResolvedValue(true);

    const response = await proxy(new NextRequest('https://concursomestre.com/', {
      headers: { cookie: 'cm_refresh=opaque-refresh-token' },
    }));

    expect(response.status).toBe(307);
    expect(response.headers.get('location')).toBe('https://concursomestre.com/dashboard');
  });

  it('keeps the public landing for an anonymous root request', async () => {
    hasAuthenticatedRouteSession.mockResolvedValue(false);

    const response = await proxy(new NextRequest('https://concursomestre.com/'));

    expect(response.status).toBe(200);
    expect(response.headers.get('x-middleware-next')).toBe('1');
  });

  it('preserves canonical password-reset redirects before checking a session', async () => {
    const response = await proxy(new NextRequest('https://concursomestre.com/?mode=reset-password&token=reset-123'));

    expect(response.status).toBe(307);
    expect(response.headers.get('location')).toBe('https://concursomestre.com/reset-password?token=reset-123');
    expect(hasAuthenticatedRouteSession).not.toHaveBeenCalled();
  });
});

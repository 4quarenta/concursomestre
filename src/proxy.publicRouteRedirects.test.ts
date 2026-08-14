import { describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

vi.mock('@services/auth/canonicalAuthRedirect', () => ({
  resolveCanonicalAuthRedirectPath: () => null,
}));
vi.mock('@services/auth/adminRouteAccess', () => ({
  canAccessAdminRoute: vi.fn(async () => false),
}));
vi.mock('@services/auth/authenticatedRouteAccess', () => ({
  hasAuthenticatedRouteSession: vi.fn(async () => false),
}));

import { proxy } from './proxy';

describe('public route cutover redirects', () => {
  it.each(['/practice/', '/questions'])(
    'redirects the legacy question hub %s directly and sanitizes its query',
    async (pathname) => {
      const response = await proxy(new NextRequest(
        `https://concursomestre.com${pathname}?materia=Auditoria&materia=Direito&utm_source=email&_rsc=volatile&secret=x`,
      ));

      expect(response.status).toBe(308);
      expect(response.headers.get('location')).toBe(
        'https://concursomestre.com/questoes?materia=Auditoria&materia=Direito&utm_source=email',
      );
    },
  );

  it('redirects the legacy hub in one permanent hop and preserves allowed repeated filters', async () => {
    const response = await proxy(new NextRequest(
      'https://concursomestre.com/blog/provas/?ano=2026&banca=FGV&banca=FCC&utm_source=email&_rsc=volatile&secret=x',
    ));

    expect(response.status).toBe(308);
    expect(response.headers.get('location')).toBe(
      'https://concursomestre.com/provas?ano=2026&banca=FGV&banca=FCC&utm_source=email',
    );
  });

  it('redirects a persisted exam slug directly and keeps only detail tracking parameters', async () => {
    const response = await proxy(new NextRequest(
      'https://concursomestre.com/blog/provas/prova-pm-pb-2026/?utm_campaign=share&ano=2026&_rsc=volatile',
    ));

    expect(response.status).toBe(308);
    expect(response.headers.get('location')).toBe(
      'https://concursomestre.com/provas/prova-pm-pb-2026?utm_campaign=share',
    );
  });

  it('normalizes a canonical trailing slash without retaining the internal RSC parameter', async () => {
    const response = await proxy(new NextRequest(
      'https://concursomestre.com/questoes/?utm_source=email&_rsc=volatile',
    ));

    expect(response.status).toBe(308);
    expect(response.headers.get('location')).toBe(
      'https://concursomestre.com/questoes?utm_source=email',
    );
  });
});

import { describe, expect, it } from 'vitest';
import { resolveExamPublicRouteCompatibility } from '../examRouteCompatibility';

describe('exam public route compatibility', () => {
  it.each([
    '/blog/provas',
    '/blog/provas/prova-atual',
  ])('keeps legacy blog route %s outside the platform shell', (pathname) => {
    expect(resolveExamPublicRouteCompatibility(pathname)).toEqual({
      withoutPlatformShell: true,
      skipNotificationBootstrap: true,
    });
  });

  it.each(['/provas', '/provas/prova-atual'])('uses the platform shell for %s', (pathname) => {
    expect(resolveExamPublicRouteCompatibility(pathname)).toEqual({
      withoutPlatformShell: false,
      skipNotificationBootstrap: true,
    });
  });

  it.each([
    '/blog',
    '/practice',
    '/questoes',
    '/provas-internas',
  ])('does not classify %s as an exam public route', (pathname) => {
    expect(resolveExamPublicRouteCompatibility(pathname)).toBeNull();
  });
});

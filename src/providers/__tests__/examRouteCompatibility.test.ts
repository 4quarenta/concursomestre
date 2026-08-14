import { describe, expect, it } from 'vitest';
import { resolveExamPublicRouteCompatibility } from '../examRouteCompatibility';

describe('exam public route compatibility', () => {
  it.each([
    '/blog/provas',
    '/blog/provas/prova-atual',
    '/provas',
    '/provas/prova-atual',
  ])('keeps %s outside the platform shell and notification bootstrap', (pathname) => {
    expect(resolveExamPublicRouteCompatibility(pathname)).toEqual({
      withoutPlatformShell: true,
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

import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { SEO_ROBOT_DISALLOW_PATHS } from '../sitemapData';
import { seoProductionPageMap } from '../launchControl';

describe('private SEO surfaces', () => {
  it('keeps authenticated and paid-tool routes out of robots crawling', () => {
    expect(SEO_ROBOT_DISALLOW_PATHS).toEqual(expect.arrayContaining([
      '/admin',
      '/auth',
      '/cronograma',
      '/dashboard',
      '/profile',
      '/simulation',
      '/x-ray',
    ]));
  });

  it('does not include private routes in public sitemap entries', () => {
    const publicPaths = seoProductionPageMap.families
      .filter((family) => family.launchStatus === 'ACTIVE'
        && family.targetProductionIndexability === 'INDEX'
        && family.sitemapTarget === 'INCLUDE_WHEN_READY')
      .flatMap((family) => family.routePatterns);

    expect(publicPaths).not.toContain('/cronograma');
    expect(publicPaths).not.toContain('/dashboard');
    expect(publicPaths).not.toContain('/profile');
    expect(publicPaths).not.toContain('/auth');
    expect(publicPaths).not.toContain('/admin');
    expect(publicPaths).toContain('/questoes');
    expect(publicPaths).toContain('/provas');
    expect(publicPaths).not.toContain('/practice');
    expect(publicPaths).not.toContain('/plans');
    expect(publicPaths).not.toContain('/questions');
    expect(publicPaths).not.toContain('/blog/provas');
    expect(publicPaths).not.toContain('/read');
    expect(publicPaths).not.toContain('/subscription');
    expect(publicPaths).toContain('/support');
  });

  it('keeps robots disallow list aligned with private sitemap exclusions', () => {
    const publicPaths = new Set(seoProductionPageMap.families
      .filter((family) => family.launchStatus === 'ACTIVE'
        && family.targetProductionIndexability === 'INDEX'
        && family.sitemapTarget === 'INCLUDE_WHEN_READY')
      .flatMap((family) => family.routePatterns));

    SEO_ROBOT_DISALLOW_PATHS.forEach((path) => {
      const exactPath = path.endsWith('/') ? path.slice(0, -1) : path;
      expect(publicPaths.has(path)).toBe(false);
      expect(publicPaths.has(exactPath)).toBe(false);
    });
  });

  it('marks the Elite study schedule page as noindex', () => {
    const layoutSource = readFileSync(resolve(process.cwd(), 'src/app/cronograma/layout.tsx'), 'utf8');

    expect(layoutSource).toContain('buildNoIndexMetadata');
    expect(layoutSource).not.toContain('buildPublicPageMetadata');
    expect(layoutSource).not.toContain("canonical: '/cronograma'");
  });

});

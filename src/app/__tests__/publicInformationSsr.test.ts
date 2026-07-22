import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { FAQ_DATA } from '../faq/faqContent';
import { normalizePublicChangelogVersions } from '../../services/changelog/changelogService';

const readSource = (relativePath: string) => (
  readFileSync(resolve(process.cwd(), relativePath), 'utf8')
);

describe('public information SSR snapshots', () => {
  it('keeps FAQ content in one shared source and exposes every answer to the SSR route', () => {
    const seoSource = readSource('src/app/@seo/faq/page.tsx');
    const clientSource = readSource('src/app/faq/page.tsx');
    const questionCount = FAQ_DATA.reduce((total, category) => total + category.questions.length, 0);

    expect(questionCount).toBeGreaterThan(20);
    expect(seoSource).toContain("import { FAQ_DATA }");
    expect(seoSource).toContain("'@type': 'FAQPage'");
    expect(clientSource).toContain("import { FAQ_DATA");
  });

  it.each(['support', 'privacy', 'terms', 'changelog'])('%s has a materialized parallel server route', (route) => {
    const source = readSource(`src/app/@seo/${route}/page.tsx`);

    expect(source).not.toContain("'use client'");
    expect(source).toContain('SeoSnapshot');
  });

  it('keeps support public and indexable while write actions remain session-bound', () => {
    const layoutSource = readSource('src/app/support/layout.tsx');
    const routeFrameSource = readSource('src/providers/NextRouteFrame.tsx');

    expect(layoutSource).toContain('buildPublicPageMetadata');
    expect(layoutSource).not.toContain('buildNoIndexMetadata');
    expect(routeFrameSource).toContain("|| pathname.startsWith('/support')");
  });

  it('sanitizes private changelog entries before server rendering', () => {
    const versions = normalizePublicChangelogVersions([
      {
        id: 1,
        version: '1.1.0 [dev]',
        release_date: '2026-07-22',
        title: 'Interna',
        description: 'Não publicar',
        content_json: [],
      },
    ]);

    expect(versions).toHaveLength(1);
    expect(versions[0].version).toBe('1.0.0');
  });
});

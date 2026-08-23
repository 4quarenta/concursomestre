import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { FAQ_DATA } from '../faq/faqContent';
import { normalizePublicChangelogPage } from '../../services/changelog/changelogService';

const readSource = (relativePath: string) => readFileSync(resolve(process.cwd(), relativePath), 'utf8');

describe('public information SSR snapshots', () => {
  it('keeps FAQ content in one shared source and exposes every answer to the SSR route', () => {
    const clientSource = readSource('src/app/faq/page.tsx');
    const layoutSource = readSource('src/app/faq/layout.tsx');
    const questionCount = FAQ_DATA.reduce((total, category) => total + category.questions.length, 0);

    expect(questionCount).toBeGreaterThan(20);
    expect(clientSource).toContain('import { FAQ_DATA');
    expect(layoutSource).toContain("'@type': 'FAQPage'");
    expect(layoutSource).toContain('<StructuredData');
  });

  it.each(['privacy', 'terms'])('%s exposes one structured server document without a duplicate SEO shell', (route) => {
    const layoutSource = readSource(`src/app/${route}/layout.tsx`);

    expect(layoutSource).toContain('<StructuredData');
    expect(layoutSource).toContain('buildBreadcrumbList');
    expect(() => readSource(`src/app/@seo/${route}/page.tsx`)).toThrow();
  });

  it('gives support one real server-rendered heading without a duplicate SEO snapshot', () => {
    const supportLayoutSource = readSource('src/app/support/layout.tsx');

    expect(() => readSource('src/app/@seo/support/page.tsx')).toThrow();
    expect(supportLayoutSource).toContain('Como podemos ajudar?');
    expect(supportLayoutSource).toContain('data-semantic-content');
    expect(supportLayoutSource).toContain('<StructuredData');
  });

  it('keeps support public and indexable while write actions remain session-bound', () => {
    const layoutSource = readSource('src/app/support/layout.tsx');
    const routeFrameSource = readSource('src/providers/NextRouteFrame.tsx');

    expect(layoutSource).toContain('buildPublicPageMetadata');
    expect(layoutSource).not.toContain('buildNoIndexMetadata');
    expect(routeFrameSource).toContain("|| pathname.startsWith('/support')");
  });

  it('renders the blog with its public editorial shell instead of the authenticated platform frame', () => {
    const routeFrameSource = readSource('src/providers/NextRouteFrame.tsx');
    const blogSource = readSource('src/app/blog/page.tsx');
    const robotsSource = readSource('src/app/robots.txt/route.ts');

    expect(routeFrameSource).toMatch(/ROUTES_WITHOUT_PLATFORM_SHELL[\s\S]*'\/blog'/);
    expect(blogSource).toContain('<BlogHeader />');
    expect(blogSource).not.toContain("'use client'");
    expect(robotsSource).toContain('seoIndexPolicy.sitemap.indexPath');
    expect(robotsSource).not.toContain('blog-sitemap.xml');
    expect(robotsSource).not.toContain('google-news.xml');
  });

  it('renders novidades on the server and sanitizes private entries', () => {
    const novidadesSource = readSource('src/app/novidades/page.tsx');
    const page = normalizePublicChangelogPage({
      items: [{
        id: 1,
        version: '1.1.0 [dev]',
        slug: 'interna',
        releaseDate: '2026-07-22',
        publishedAt: '2026-07-22 12:00:00',
        title: 'Interna',
        description: 'Não publicar',
        content: [],
        status: 'published',
      }],
      pageInfo: { page: 1, limit: 8, total: 1, totalPages: 1, hasMore: false },
    });

    expect(novidadesSource).not.toContain("'use client'");
    expect(novidadesSource).toContain('CollectionPage');
    expect(novidadesSource).toContain('fetchPublicSuggestionsForServer');
    expect(novidadesSource).toContain('PublicSuggestionsBoard');
    expect(page.items).toHaveLength(1);
    expect(page.items[0].version).toBe('1.0.0');
  });
});

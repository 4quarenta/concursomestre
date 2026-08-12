import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const readSource = (relativePath: string) => readFileSync(resolve(process.cwd(), relativePath), 'utf8');

describe('public launch SEO readiness', () => {
  it('uses the production apex host and only materialized sitemap endpoints', () => {
    const website = readSource('config/platform/website.json');
    const robots = readSource('src/app/robots.ts');

    expect(website).toContain('https://concursomestre.com');
    expect(website).not.toContain('https://concursomestre.com.br');
    expect(robots).toContain("'/sitemap.xml'");
    expect(robots).not.toContain("'/sitemap-index.xml'");
    expect(robots).not.toContain("'/sitemaps/google-news.xml'");
  });

  it('renders an indexable practice snapshot while preserving the interactive client', () => {
    const page = readSource('src/app/practice/page.tsx');
    const snapshot = readSource('src/app/@seo/practice/page.tsx');

    expect(page).toContain('<PracticeClient');
    expect(snapshot).toContain('PracticeSeoPage');
    expect(snapshot).toContain("'@type': 'CollectionPage'");
  });

  it('returns real 404s and canonical redirects for invalid public detail URLs', () => {
    const question = readSource('src/app/question/[id]/[[...slug]]/page.tsx');
    const landing = readSource('src/app/l/[slug]/page.tsx');

    expect(question).toContain('notFound()');
    expect(question).toContain('permanentRedirect(canonicalPath)');
    expect(landing).toContain('notFound()');
  });

  it('does not ship marketplace or math dependencies to every public route', () => {
    const appProviders = readSource('src/providers/AppProviders.tsx');
    const rootLayout = readSource('src/app/layout.tsx');

    expect(appProviders).not.toContain('MarketplaceProvider');
    expect(rootLayout).not.toContain("katex/dist/katex.min.css");
    expect(rootLayout).toContain('DeferredGoogleAnalytics');
    expect(readSource('src/components/shared/analytics/DeferredGoogleAnalytics.tsx'))
      .toContain('FALLBACK_DELAY_MS = 12000');
  });
});

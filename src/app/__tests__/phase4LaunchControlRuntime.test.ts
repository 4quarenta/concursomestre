import { afterEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { GET as getRobots } from '../robots.txt/route';
import { GET as getSitemap } from '../sitemap.xml/route';
import { buildPublicPageMetadata } from '../seoMetadata';
import { proxy } from '../../proxy';

afterEach(() => vi.unstubAllEnvs());

describe('Phase 4 launch control runtime', () => {
  it('keeps public pages crawlable but omits sitemap discovery in PRELAUNCH', async () => {
    vi.stubEnv('SEO_LAUNCH_MODE', 'PRELAUNCH');
    const result = await getRobots(new Request('https://concursomestre.com/robots.txt'));
    const body = await result.text();
    expect(body).toContain('Allow: /');
    expect(body).not.toContain('Sitemap:');
    expect(body).not.toContain('Disallow: /support');
  });

  it('does not advertise a sitemap before a validated artifact exists', async () => {
    vi.stubEnv('SEO_LAUNCH_MODE', 'PRODUCTION');
    vi.stubEnv('SEO_DEPLOYMENT_ENVIRONMENT', 'PRODUCTION');
    vi.stubEnv('SEO_PRODUCTION_INDEXING', 'CONFIRMED');
    vi.stubEnv('SEO_PRODUCTION_SITEMAP', 'CONFIRMED');
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', 'https://concursomestre.com');
    const result = await getRobots(new Request('https://concursomestre.com/robots.txt'));
    const body = await result.text();
    expect(body).not.toContain('Sitemap:');
    expect(body).not.toContain('blog-sitemap');
  });

  it('does not serve stored sitemap artifacts before PRODUCTION', async () => {
    vi.stubEnv('SEO_LAUNCH_MODE', 'GO_CANDIDATE');
    const response = await getSitemap(new Request('https://concursomestre.com/sitemap.xml'));
    expect(response.status).toBe(503);
    expect(response.headers.get('x-robots-tag')).toBe('noindex, nofollow');
  });

  it('applies noindex in metadata without replacing canonical', () => {
    vi.stubEnv('SEO_LAUNCH_MODE', 'PRELAUNCH');
    const metadata = buildPublicPageMetadata({ title: 'Provas', description: 'Provas publicas.', path: '/provas' });
    expect(metadata.alternates?.canonical).toBe('/provas');
    expect(metadata.robots).toMatchObject({ index: false, follow: true });
  });

  it('adds the PRELAUNCH X-Robots-Tag to public document responses', async () => {
    vi.stubEnv('SEO_LAUNCH_MODE', 'PRELAUNCH');
    const response = await proxy(new NextRequest('https://concursomestre.com/questoes'));
    expect(response.headers.get('x-robots-tag')).toBe('noindex, follow');
  });

  it('keeps permanent functional variations NOINDEX in PRODUCTION', async () => {
    vi.stubEnv('SEO_LAUNCH_MODE', 'PRODUCTION');
    const response = await proxy(new NextRequest('https://concursomestre.com/questoes?materia=Direito'));
    expect(response.headers.get('x-robots-tag')).toBe('noindex, follow');
  });
});

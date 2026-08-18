import { afterEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import robots from '../robots';
import { GET as getSitemap } from '../sitemap.xml/route';
import { buildPublicPageMetadata } from '../seoMetadata';
import { proxy } from '../../proxy';

afterEach(() => vi.unstubAllEnvs());

describe('Phase 4 launch control runtime', () => {
  it('keeps public pages crawlable but omits sitemap discovery in PRELAUNCH', () => {
    vi.stubEnv('SEO_LAUNCH_MODE', 'PRELAUNCH');
    const result = robots();
    expect(result.rules).toMatchObject({ allow: '/' });
    expect(result.sitemap).toBeUndefined();
    expect(JSON.stringify(result.rules)).not.toContain('/support');
  });

  it('advertises the materialized sitemap only in PRODUCTION', () => {
    vi.stubEnv('SEO_LAUNCH_MODE', 'PRODUCTION');
    const result = robots();
    expect(result.sitemap).toEqual(expect.arrayContaining([
      expect.stringContaining('/sitemap.xml'),
      expect.stringContaining('/sitemaps/blog-sitemap.xml'),
    ]));
  });

  it('does not serve stored sitemap artifacts before PRODUCTION', async () => {
    vi.stubEnv('SEO_LAUNCH_MODE', 'GO_CANDIDATE');
    const response = await getSitemap();
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

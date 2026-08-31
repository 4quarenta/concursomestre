import { afterEach, describe, expect, it, vi } from 'vitest';

const loadSiteUrlModule = async () => {
  vi.resetModules();
  return import('../siteUrl');
};

describe('site URL configuration', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('uses NEXT_PUBLIC_CANONICAL_URL for public canonical surfaces', async () => {
    vi.stubEnv('NEXT_PUBLIC_SITE_URL', '');
    vi.stubEnv('NEXT_PUBLIC_APP_URL', '');
    vi.stubEnv('NEXT_PUBLIC_CANONICAL_URL', 'https://concursomestre.com.br');
    vi.stubEnv('SITE_URL', '');
    vi.stubEnv('APP_URL', '');
    vi.stubEnv('VERCEL_PROJECT_PRODUCTION_URL', '');
    vi.stubEnv('VERCEL_URL', '');

    const { getConfiguredSiteUrl, buildSiteUrl } = await loadSiteUrlModule();

    expect(getConfiguredSiteUrl().toString()).toBe('https://concursomestre.com.br/');
    expect(buildSiteUrl('/sitemap.xml')).toBe('https://concursomestre.com.br/sitemap.xml');
  });
});

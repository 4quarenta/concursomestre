import { afterEach, describe, expect, it, vi } from 'vitest';
import { buildLawArticleMetadata } from '../lawArticleMetadata';
import { parsePublicLawArticleDetail } from '../lawArticleServerData';

const item = parsePublicLawArticleDetail({
  law: { id: 1, slug: 'constituicao-federal', title: 'Constituição Federal', shortTitle: 'CF', status: 'published' },
  article: { id: 5, lawId: 1, slug: 'artigo-5-a', number: '5º-A', officialText: 'Texto oficial do dispositivo.', officialStatus: 'active', blocks: [] },
  navigation: { previous: null, next: null }, canonicalPath: '/lei-comentada/constituicao-federal/artigo-5-a', breadcrumbs: [],
  readiness: { status: 'READY', reasonCodes: [] }, editorial: { commentaryAvailable: false, protectedContentIncluded: false },
});

describe('law article metadata', () => {
  afterEach(() => vi.unstubAllEnvs());
  it('keeps self canonical and PRELAUNCH noindex', () => {
    vi.stubEnv('SEO_LAUNCH_MODE', 'PRELAUNCH');
    const metadata = buildLawArticleMetadata(item && !('redirectPath' in item) ? item : null);
    expect(metadata.alternates?.canonical).toBe('/lei-comentada/constituicao-federal/artigo-5-a');
    expect(metadata.robots).toMatchObject({ index: false, follow: true });
  });
  it('allows a READY article only in PRODUCTION', () => {
    vi.stubEnv('SEO_LAUNCH_MODE', 'PRODUCTION');
    expect(buildLawArticleMetadata(item && !('redirectPath' in item) ? item : null).robots).toBeUndefined();
  });
  it('keeps functional query variants noindex', () => {
    vi.stubEnv('SEO_LAUNCH_MODE', 'PRODUCTION');
    expect(buildLawArticleMetadata(item && !('redirectPath' in item) ? item : null, { view: 'print' }).robots).toMatchObject({ index: false, follow: true });
  });
  it('removes canonical for missing articles', () => {
    expect(buildLawArticleMetadata(null).alternates?.canonical).toBeNull();
  });
});

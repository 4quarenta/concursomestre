import { afterEach, describe, expect, it, vi } from 'vitest';
import { buildTaxonomyDirectoryMetadata } from './directoryMetadata';

const build = (path: '/disciplinas' | '/bancas' | '/orgaos' | '/carreiras' | '/cargos', searchParams: Record<string, string | string[]>) => (
  buildTaxonomyDirectoryMetadata({ title: 'Diretório', description: 'Diretório público.', path, searchParams })
);

describe('buildTaxonomyDirectoryMetadata', () => {
  afterEach(() => vi.unstubAllEnvs());

  it('keeps the clean directory indexable and canonical', () => {
    vi.stubEnv('SEO_LAUNCH_MODE', 'PRODUCTION');
    const metadata = build('/disciplinas', {});
    expect(metadata.alternates?.canonical).toBe('/disciplinas');
    expect(metadata.robots).toBeUndefined();
  });

  it('keeps the clean canonical but blocks indexing in PRELAUNCH', () => {
    vi.stubEnv('SEO_LAUNCH_MODE', 'PRELAUNCH');
    const metadata = build('/disciplinas', {});
    expect(metadata.alternates?.canonical).toBe('/disciplinas');
    expect(metadata.robots).toMatchObject({ index: false, follow: false });
  });

  it.each([[{ busca: 'direito' }], [{ letra: 'A' }], [{ ordenacao: 'nome' }], [{ busca: ['direito', 'penal'] }]])(
    'marks functional directory variations NOINDEX,follow',
    (params) => {
      const metadata = build('/disciplinas', params);
      expect(metadata.alternates?.canonical).toBe('/disciplinas');
      expect(metadata.robots).toMatchObject({ index: false, follow: true });
    },
  );

  it('keeps clean pagination canonical and drops tracking from canonical', () => {
    expect(build('/bancas', { pagina: '2', utm_source: 'email' }).alternates?.canonical).toBe('/bancas?pagina=2');
    expect(build('/bancas', { gclid: 'abc' }).alternates?.canonical).toBe('/bancas');
  });

  it('keeps organization filters noindex with the clean hub canonical', () => {
    vi.stubEnv('SEO_LAUNCH_MODE', 'PRODUCTION');
    expect(build('/orgaos', { busca: 'policia' })).toMatchObject({
      alternates: { canonical: '/orgaos' },
      robots: { index: false, follow: true },
    });
    expect(build('/orgaos', { letra: 'P' }).alternates?.canonical).toBe('/orgaos');
  });

  it.each(['/carreiras', '/cargos'] as const)('keeps professional filters noindex for %s', (path) => {
    vi.stubEnv('SEO_LAUNCH_MODE', 'PRODUCTION');
    expect(build(path, { busca: 'auditor', letra: 'A', sort: 'nome', foo: 'bar' })).toMatchObject({
      alternates: { canonical: path },
      robots: { index: false, follow: true },
    });
  });
});

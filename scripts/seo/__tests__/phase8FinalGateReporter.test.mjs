import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  compileRoutePattern,
  createFamilyMatcher,
  evaluateFinalGate,
  inspectHtmlDocument,
  normalizeCrawlUrl,
  runHttpCrawl,
  simulateLaunchDecision,
  validateContracts,
} from '../lib/phase8-final-gate.mjs';
import { renderPhase8MarkdownReport } from '../lib/phase8-final-report.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const readJson = async (relativePath) => JSON.parse(await readFile(path.join(root, relativePath), 'utf8'));

describe('Phase 8 final SEO gate reporter', () => {
  it('normalizes tracking and fragments without multiplying crawl identities', () => {
    expect(normalizeCrawlUrl('/questoes/?utm_source=x&gclid=y#top', 'https://example.test')).toMatchObject({
      path: '/questoes',
      query: '',
    });
    expect(normalizeCrawlUrl('javascript:alert(1)', 'https://example.test')).toBeNull();
    expect(normalizeCrawlUrl('https://other.test/path', 'https://example.test')).toBeNull();
  });

  it('matches specific and wildcard route patterns without cross-family resolution', () => {
    expect(compileRoutePattern('/blog/categoria/{slug}').test('/blog/categoria/concursos')).toBe(true);
    expect(compileRoutePattern('/profile/{*path}').test('/profile')).toBe(true);
    const matcher = createFamilyMatcher([
      { familyId: 'blog_article', routePatterns: ['/blog/{slug}'] },
      { familyId: 'blog_category', routePatterns: ['/blog/categoria/{slug}'] },
      { familyId: 'questions_hub', routePatterns: ['/questoes'] },
      { familyId: 'search', routePatterns: ['/busca'] },
      { familyId: 'facet', routePatterns: ['/questoes'] },
    ]);
    expect(matcher('/blog/categoria/concursos').familyId).toBe('blog_category');
    expect(matcher('/busca?q=controle').familyId).toBe('search');
    expect(matcher('/questoes?q=controle').familyId).toBe('facet');
    expect(matcher('/questoes?materia=20').familyId).toBe('facet');
  });

  it('extracts canonical SEO signals and protected sentinels from initial HTML', () => {
    const document = inspectHtmlDocument(`<!doctype html><html><head>
      <title>Página factual</title><meta name="robots" content="noindex,follow">
      <link rel="canonical" href="https://concursomestre.com/rota">
      <script type="application/ld+json">{"@type":"WebPage","url":"https://concursomestre.com/rota"}</script>
      </head><body><main><h1>Página factual</h1><a href="/destino">Destino</a> SECRET_SENTINEL</main></body></html>`,
    'https://example.test/rota', ['SECRET_SENTINEL']);
    expect(document.title).toBe('Página factual');
    expect(document.robotsTokens).toContain('noindex');
    expect(document.schemaTypes).toContain('WebPage');
    expect(document.sentinelHits).toEqual(['SECRET_SENTINEL']);
    expect(document.links[0]).toMatchObject({ href: '/destino', inMain: true });
  });

  it('keeps PRELAUNCH, GO_CANDIDATE, explicit NOINDEX and permanent families fail-closed', () => {
    const indexable = { launchStatus: 'ACTIVE', familyEligibility: 'INDEXABLE', sitemapTarget: 'INCLUDE_WHEN_READY' };
    const permanent = { ...indexable, familyEligibility: 'PERMANENT_NOINDEX', sitemapTarget: 'EXCLUDE' };
    expect(simulateLaunchDecision(indexable, 'PRELAUNCH').indexability).toBe('NOINDEX');
    expect(simulateLaunchDecision(indexable, 'GO_CANDIDATE').indexability).toBe('NOINDEX');
    expect(simulateLaunchDecision(indexable, 'PRODUCTION')).toMatchObject({ indexability: 'INDEX', sitemapEligible: true });
    expect(simulateLaunchDecision(indexable, 'PRODUCTION', { explicitNoindex: true }).indexability).toBe('NOINDEX');
    expect(simulateLaunchDecision(permanent, 'PRODUCTION')).toMatchObject({ indexability: 'NOINDEX', sitemapEligible: false });
  });

  it('reconciles the authoritative family, graph and launch contracts', async () => {
    const [pageMap, graph, structuralPolicy, indexPolicy, indexFixtures, crawlConfig] = await Promise.all([
      readJson('config/seo/seo-production-page-map.v1.json'),
      readJson('config/seo/internal-link-graph.v1.json'),
      readJson('config/seo/structural-route-policy.v1.json'),
      readJson('config/seo/index-policy-phase-6.v1.json'),
      readJson('config/seo/index-policy-phase-6-fixtures.v1.json'),
      readJson('config/seo/phase-8-full-crawl.v1.json'),
    ]);
    const result = validateContracts({ pageMap, graph, structuralPolicy, indexPolicy, indexFixtures, crawlConfig });
    expect(result.errors).toEqual([]);
    expect(result.counts).toEqual({ families: 55, targetIndex: 40, permanentNoindex: 15 });
  });

  it('blocks a contractually implemented representative that resolves as 404', () => {
    const family = {
      familyId: 'search',
      routePatterns: ['/busca'],
      instanceReadinessRule: 'functional_route',
      familyEligibility: 'PERMANENT_NOINDEX',
      targetProductionIndexability: 'NOINDEX',
      preLaunchIndexability: 'NOINDEX',
      sitemapTarget: 'EXCLUDE',
      launchStatus: 'ACTIVE',
    };
    const result = evaluateFinalGate({
      pageMap: { families: [family] },
      graph: { families: [] },
      indexPolicy: { canonicalOrigin: 'https://concursomestre.com', quality: { requiredFamilies: [] } },
      crawlConfig: {
        baseline: 'fixture',
        seeds: ['/busca'],
        representatives: [],
        permanentNoindexRepresentatives: [{ familyId: 'search', path: '/busca', expectedStatus: 200 }],
        realDataGates: [],
      },
      contract: { errors: [], warnings: [] },
      crawl: {
        pages: [{ url: '/busca', family: 'search', status: 404, document: null }],
        links: [],
        redirects: [],
        errors: [],
        queryVariants: [],
        unsafeHrefs: [],
        structuralLinkHealth: { brokenStructuralLinks: [], redirectingStructuralLinks: [], privateStructuralLinks: [] },
        robots: { status: 200, body: 'User-agent: *\nAllow: /\n' },
        sitemap: { status: 503, body: '' },
      },
    });
    expect(result.seoGate).toBe('NO_GO');
    expect(result.blockingGates).toEqual(expect.arrayContaining([
      expect.objectContaining({ message: expect.stringContaining('representative status mismatch: search') }),
    ]));
  });

  it('renders every required report section and every matrix row', () => {
    const matrixNames = [
      'fullCrawl', 'familyCoverage', 'redirects', 'errors', 'seoSignals',
      'indexability', 'sitemap', 'internalLinks', 'performanceRegression', 'security',
    ];
    const matrices = Object.fromEntries(matrixNames.map((name) => [name, [{
      url: `/${name}`,
      familyId: `/${name}`,
      path: `/${name}`,
      route: `/${name}`,
      source: '/source',
      href: `/${name}`,
      target: `/${name}`,
      result: 'PASS',
    }]]));
    const report = renderPhase8MarkdownReport({
      result: {
        seoGate: 'GO', p0: 0, p1: 0, p2: 0, p2Items: [], baseline: 'baseline',
        evidence: ['CONTRACT'], realDataGates: ['REAL_DATA_REQUIRED'], matrices,
        crawlStats: {
          seeds: 1, urlsDiscovered: 1, discoveredFromLinks: 0, uniqueCanonicalUrls: 1,
          noindexUrls: 1, redirects: 1, notFound: 1, gone: 0, queryVariants: 1,
          brokenInternalLinks: 0, redirectingInternalLinks: 0, privateStructuralLinks: 0,
          securityViolations: 0,
        },
      },
      pageMap: { families: [{
        familyId: 'home', routePatterns: ['/'], currentState: 'INDEX', familyEligibility: 'INDEXABLE',
        targetProductionIndexability: 'INDEX', preLaunchIndexability: 'NOINDEX', sitemapTarget: 'INCLUDE_WHEN_READY',
        instanceReadinessRule: 'page.public_ready', launchStatus: 'ACTIVE',
      }] },
      graph: { families: [], approvedRelations: [], rejectedInferences: [] },
      crawlConfig: { maxUrls: 10, maxDepth: 2, seeds: ['/'] },
      browserReport: { summary: {}, failures: [] },
    });
    expect(report).toContain('## A. Resumo executivo');
    expect(report).toContain('## DF. Próximo passo');
    for (const name of matrixNames) expect(report).toContain(`/${name}`);
    expect(report).toContain('CONCURSOMESTRE_PRODUCTION_GO = NÃO');
  });
});

describe('Phase 8 link-following crawl', () => {
  let server;
  let baseUrl;

  beforeAll(async () => {
    server = createServer((request, response) => {
      const url = new URL(request.url, 'http://fixture.test');
      if (url.pathname === '/robots.txt') {
        response.writeHead(200, { 'Content-Type': 'text/plain' });
        response.end('User-agent: *\nAllow: /\n');
        return;
      }
      if (url.pathname === '/sitemap.xml') {
        response.writeHead(503, { 'Content-Type': 'text/plain', 'X-Robots-Tag': 'noindex,nofollow' });
        response.end('Unavailable');
        return;
      }
      const isMissing = url.pathname.includes('missing');
      response.writeHead(isMissing ? 404 : 200, {
        'Content-Type': 'text/html; charset=utf-8',
        'X-Robots-Tag': 'noindex,follow',
      });
      response.end(`<!doctype html><html><head><title>Fixture</title><meta name="robots" content="noindex,follow"><link rel="canonical" href="https://concursomestre.com${url.pathname}"></head><body><main><h1>Fixture</h1>${url.pathname === '/' ? '<a href="/detail">Detail</a>' : ''}</main></body></html>`);
    });
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    baseUrl = `http://127.0.0.1:${server.address().port}`;
  });

  afterAll(async () => {
    await new Promise((resolve) => server.close(resolve));
  });

  it('discovers links from seeds while bounding queries and preserving PRELAUNCH sitemap protection', async () => {
    const pageMap = { families: [
      { familyId: 'home', routePatterns: ['/'], targetProductionIndexability: 'INDEX' },
      { familyId: 'detail', routePatterns: ['/detail'], targetProductionIndexability: 'INDEX' },
    ] };
    const crawl = await runHttpCrawl({
      baseUrl,
      pageMap,
      config: {
        maxUrls: 10,
        maxDepth: 2,
        seeds: ['/'],
        representatives: [],
        permanentNoindexRepresentatives: [],
        queryVariants: [],
        aliases: [],
        errorCases: [{ id: 'missing', path: '/missing', expectedStatus: 404 }],
        securitySentinels: [],
      },
    });
    expect(crawl.pages.map((page) => page.url)).toEqual(['/', '/detail']);
    expect(crawl.pages[1]).toMatchObject({ source: '/', reason: 'discovered_link' });
    expect(crawl.structuralLinkHealth.brokenStructuralLinks).toEqual([]);
    expect(crawl.sitemap.status).toBe(503);
    expect(crawl.errors[0].actualStatus).toBe(404);
  });
});

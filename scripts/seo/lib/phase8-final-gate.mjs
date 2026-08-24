import { JSDOM } from 'jsdom';

const TRACKING_PARAMS = /^(?:utm_.+|gclid|fbclid)$/i;
const PRIVATE_FAMILIES = new Set([
  'auth', 'account', 'private_tools', 'checkout', 'admin', 'api', 'setup',
  'temporary_promo', 'legacy_alias', 'not_found',
]);
const FUNCTIONAL_FAMILIES = new Set(['search', 'facet', 'marketplace', 'blog_tag']);

export const normalizeCrawlUrl = (rawValue, baseUrl) => {
  const raw = String(rawValue || '').trim();
  if (!raw || /^(?:javascript|data|file):/i.test(raw)) return null;
  let url;
  try {
    url = new URL(raw, baseUrl);
  } catch {
    return null;
  }
  const base = new URL(baseUrl);
  if (!['http:', 'https:'].includes(url.protocol) || url.origin !== base.origin) return null;
  url.hash = '';
  for (const key of [...url.searchParams.keys()]) {
    if (TRACKING_PARAMS.test(key)) url.searchParams.delete(key);
  }
  url.searchParams.sort();
  url.pathname = url.pathname.replace(/\/{2,}/g, '/');
  if (url.pathname.length > 1) url.pathname = url.pathname.replace(/\/+$/, '');
  const query = url.searchParams.toString();
  return {
    absolute: `${url.origin}${url.pathname}${query ? `?${query}` : ''}`,
    path: `${url.pathname}${query ? `?${query}` : ''}`,
    pathname: url.pathname,
    query,
  };
};

const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export const compileRoutePattern = (pattern) => {
  const pathname = String(pattern || '').split('?', 1)[0] || '/';
  if (pathname === '/') return /^\/$/;
  const segments = pathname.split('/').filter(Boolean);
  let source = '^';
  for (const segment of segments) {
    if (/^\{\*[^}]+\}$/.test(segment)) source += '(?:/.*)?';
    else if (/^\{[^}]+\}$/.test(segment)) source += '/[^/]+';
    else source += `/${escapeRegex(segment)}`;
  }
  return new RegExp(`${source}/?$`);
};

const patternSpecificity = (pattern) => {
  const segments = String(pattern).split('?', 1)[0].split('/').filter(Boolean);
  const staticCount = segments.filter((segment) => !segment.startsWith('{')).length;
  const wildcardCount = segments.filter((segment) => segment.startsWith('{*')).length;
  return (staticCount * 1000) + (segments.length * 10) - (wildcardCount * 100);
};

export const createFamilyMatcher = (families) => {
  const patterns = families.flatMap((family) => family.routePatterns.map((pattern) => ({
    family,
    pattern,
    regex: compileRoutePattern(pattern),
    score: patternSpecificity(pattern),
  }))).sort((left, right) => right.score - left.score || right.pattern.length - left.pattern.length);

  return (pathValue) => {
    const url = new URL(pathValue, 'https://concursomestre.com');
    if (url.pathname === '/questoes' && url.search) {
      return families.find((family) => family.familyId === 'facet') || null;
    }
    return patterns.find((entry) => entry.regex.test(url.pathname))?.family || null;
  };
};

const schemaTypesFrom = (value, output = []) => {
  if (Array.isArray(value)) {
    value.forEach((item) => schemaTypesFrom(item, output));
    return output;
  }
  if (!value || typeof value !== 'object') return output;
  const type = value['@type'];
  if (Array.isArray(type)) output.push(...type.map(String));
  else if (type) output.push(String(type));
  if (Array.isArray(value['@graph'])) schemaTypesFrom(value['@graph'], output);
  return output;
};

const robotsTokens = (values) => new Set(values.flatMap((value) => (
  String(value || '').toLowerCase().split(',').map((item) => item.trim()).filter(Boolean)
)));

export const inspectHtmlDocument = (html, documentUrl, securitySentinels = []) => {
  const dom = new JSDOM(html, { url: documentUrl });
  const { document } = dom.window;
  const canonical = [...document.querySelectorAll('link[rel~="canonical"]')]
    .map((node) => node.getAttribute('href') || '').filter(Boolean);
  const robots = [...document.querySelectorAll('meta[name="robots"],meta[name="googlebot"]')]
    .map((node) => node.getAttribute('content') || '').filter(Boolean);
  const schemas = [];
  let invalidJsonLd = 0;
  for (const node of document.querySelectorAll('script[type="application/ld+json"]')) {
    try {
      const parsed = JSON.parse(node.textContent || 'null');
      schemas.push(...schemaTypesFrom(parsed));
    } catch {
      invalidJsonLd += 1;
    }
  }
  const links = [...document.querySelectorAll('a[href]')].map((node) => ({
    href: node.getAttribute('href') || '',
    text: (node.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 160),
    inMain: Boolean(node.closest('main')),
  }));
  const breadcrumbLabels = [...document.querySelectorAll('nav[aria-label*="breadcrumb" i] a, nav[aria-label*="breadcrumb" i] [aria-current]')]
    .map((node) => (node.textContent || '').trim().replace(/\s+/g, ' ')).filter(Boolean);
  const sentinelHits = securitySentinels.filter((sentinel) => html.includes(sentinel));
  return {
    title: (document.querySelector('title')?.textContent || '').trim(),
    description: document.querySelector('meta[name="description"]')?.getAttribute('content')?.trim() || '',
    canonical,
    robots,
    robotsTokens: [...robotsTokens(robots)],
    h1: [...document.querySelectorAll('h1')].map((node) => (node.textContent || '').trim().replace(/\s+/g, ' ')),
    mainCount: document.querySelectorAll('main').length,
    links,
    schemaTypes: schemas,
    schemaTypeCounts: Object.fromEntries([...new Set(schemas)].map((type) => [type, schemas.filter((item) => item === type).length])),
    invalidJsonLd,
    breadcrumbLabels,
    sentinelHits,
    textSignature: (document.querySelector('main')?.textContent || document.body?.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 240),
  };
};

export const simulateLaunchDecision = (family, launchMode, options = {}) => {
  const publicationAllowed = options.publicationAllowed !== false;
  const readiness = options.readiness || 'READY';
  const qualityStatus = options.qualityStatus || 'PASS';
  const resolutionAction = options.resolutionAction || 'render';
  const httpStatus = Number(options.httpStatus ?? 200);
  const canonicalValid = options.canonicalValid !== false;
  const canonicalEnvironment = options.canonicalEnvironment !== false;
  const productionActivationAllowed = options.productionActivationAllowed !== false;
  const qualityRequired = options.qualityRequired === true;
  const explicitNoindex = options.explicitNoindex === true;
  const reasons = [];
  if (!publicationAllowed) reasons.push('publication_denied');
  if (launchMode !== 'PRODUCTION') reasons.push(`launch_${launchMode.toLowerCase()}`);
  if (family.launchStatus !== 'ACTIVE') reasons.push('launch_not_active');
  if (family.familyEligibility === 'PERMANENT_NOINDEX') reasons.push('permanent_noindex');
  if (readiness !== 'READY') reasons.push('not_ready');
  if (qualityRequired && qualityStatus !== 'PASS') reasons.push('quality_not_pass');
  if (resolutionAction !== 'render' || httpStatus !== 200) reasons.push('resolution_not_render_200');
  if (!canonicalValid) reasons.push('canonical_invalid');
  if (!canonicalEnvironment) reasons.push('noncanonical_environment');
  if (!productionActivationAllowed) reasons.push('production_activation_missing');
  if (explicitNoindex) reasons.push('explicit_noindex');
  const indexability = reasons.length === 0 ? 'INDEX' : 'NOINDEX';
  return {
    indexability,
    sitemapEligible: indexability === 'INDEX' && family.sitemapTarget === 'INCLUDE_WHEN_READY',
    reasonCodes: reasons,
  };
};

export const validateContracts = ({ pageMap, graph, structuralPolicy, indexPolicy, indexFixtures, crawlConfig }) => {
  const errors = [];
  const warnings = [];
  const families = pageMap.families || [];
  const familyIds = new Set(families.map((family) => family.familyId));
  const targetIndex = families.filter((family) => family.targetProductionIndexability === 'INDEX');
  const permanentNoindex = families.filter((family) => family.familyEligibility === 'PERMANENT_NOINDEX');
  if (families.length !== 55) errors.push(`expected 55 families, received ${families.length}`);
  if (targetIndex.length !== 40) errors.push(`expected 40 TARGET_INDEX, received ${targetIndex.length}`);
  if (permanentNoindex.length !== 15) errors.push(`expected 15 PERMANENT_NOINDEX, received ${permanentNoindex.length}`);
  if ((graph.approvedRelations || []).length !== 67) errors.push(`expected 67 approved relations, received ${(graph.approvedRelations || []).length}`);
  if ((graph.rejectedInferences || []).length !== 9) errors.push(`expected 9 rejected inferences, received ${(graph.rejectedInferences || []).length}`);
  for (const item of graph.families || []) {
    if (!familyIds.has(item.familyId)) errors.push(`graph family not mapped: ${item.familyId}`);
  }
  for (const relation of graph.approvedRelations || []) {
    if (!familyIds.has(relation.sourceFamily)) errors.push(`relation source not mapped: ${relation.sourceFamily}`);
    if (!familyIds.has(relation.targetFamily)) errors.push(`relation target not mapped: ${relation.targetFamily}`);
  }
  const duplicatePatterns = new Map();
  for (const family of families) {
    for (const pattern of family.routePatterns) {
      const list = duplicatePatterns.get(pattern) || [];
      list.push(family.familyId);
      duplicatePatterns.set(pattern, list);
    }
  }
  for (const [pattern, ids] of duplicatePatterns) {
    if (ids.length > 1 && pattern !== '/questoes') warnings.push(`shared route pattern ${pattern}: ${ids.join(',')}`);
  }
  if (indexPolicy.familyAuthority !== pageMap.version) errors.push('index policy family authority mismatch');
  if (crawlConfig.baseline !== '8c6e88ce051c72495293912068c2b2eb4b4349d1') errors.push('crawl baseline mismatch');
  const qualityRequired = new Set(indexPolicy.quality?.requiredFamilies || []);
  const familyById = new Map(families.map((family) => [family.familyId, family]));
  for (const fixture of indexFixtures.cases || []) {
    const family = familyById.get(fixture.familyId);
    if (!family) {
      errors.push(`index fixture family missing: ${fixture.familyId}`);
      continue;
    }
    const result = simulateLaunchDecision(family, fixture.launchMode, {
      ...fixture,
      qualityRequired: qualityRequired.has(fixture.familyId),
    });
    if (result.indexability !== fixture.expectedIndexability || result.sitemapEligible !== fixture.expectedSitemap) {
      errors.push(`index fixture mismatch: ${fixture.id}`);
    }
  }
  for (const family of permanentNoindex) {
    for (const mode of ['PRELAUNCH', 'GO_CANDIDATE', 'PRODUCTION']) {
      if (simulateLaunchDecision(family, mode).indexability !== 'NOINDEX') {
        errors.push(`permanent family promoted in ${mode}: ${family.familyId}`);
      }
    }
  }
  if ((structuralPolicy.families || []).some((family) => !familyIds.has(family.id) && !['private'].includes(family.id))) {
    errors.push('structural route policy contains unknown family');
  }
  return { errors, warnings, counts: { families: families.length, targetIndex: targetIndex.length, permanentNoindex: permanentNoindex.length } };
};

const canonicalPath = (value) => {
  try {
    const url = new URL(value, 'https://concursomestre.com');
    return `${url.pathname.replace(/\/$/, '') || '/'}${url.search}`;
  } catch {
    return '';
  }
};

const fetchWithRedirectChain = async (url, maxHops = 3) => {
  const chain = [];
  let current = url;
  for (let hop = 0; hop <= maxHops; hop += 1) {
    const response = await fetch(current, { redirect: 'manual', headers: { Accept: 'text/html,application/xhtml+xml' } });
    const location = response.headers.get('location');
    chain.push({ url: current, status: response.status, location });
    if (!(response.status >= 300 && response.status < 400) || !location) return { response, chain };
    current = new URL(location, current).toString();
  }
  return { response: null, chain };
};

const shouldCrawlFamily = (family) => family && !PRIVATE_FAMILIES.has(family.familyId);

export const runHttpCrawl = async ({ baseUrl, pageMap, config }) => {
  const matcher = createFamilyMatcher(pageMap.families);
  const queue = [];
  const queued = new Set();
  const enqueue = (path, source, depth, reason) => {
    const normalized = normalizeCrawlUrl(path, baseUrl);
    if (!normalized || normalized.query || queued.has(normalized.path) || queued.size >= config.maxUrls) return;
    queued.add(normalized.path);
    queue.push({ ...normalized, source, depth, reason });
  };
  config.seeds.forEach((path) => enqueue(path, null, 0, 'seed'));
  [...config.representatives, ...config.permanentNoindexRepresentatives]
    .forEach((item) => enqueue(item.path, null, 0, 'representative'));

  const pages = [];
  const links = [];
  const unsafeHrefs = [];
  while (queue.length > 0) {
    const item = queue.shift();
    const requestedFamily = matcher(item.path);
    let response;
    let body = '';
    let fetchError = '';
    try {
      response = await fetch(item.absolute, { redirect: 'manual', headers: { Accept: 'text/html,application/xhtml+xml' } });
      body = await response.text();
    } catch (error) {
      fetchError = error instanceof Error ? error.message : String(error);
    }
    const contentType = response?.headers.get('content-type') || '';
    const page = {
      url: item.path,
      source: item.source,
      depth: item.depth,
      reason: item.reason,
      family: requestedFamily?.familyId || null,
      status: response?.status || 0,
      location: response?.headers.get('location') || null,
      contentType,
      xRobots: response?.headers.get('x-robots-tag') || '',
      cacheControl: response?.headers.get('cache-control') || '',
      error: fetchError,
      document: null,
    };
    if (response?.status === 200 && /text\/html/i.test(contentType)) {
      page.document = inspectHtmlDocument(body, item.absolute, config.securitySentinels);
      for (const anchor of page.document.links) {
        const rawHref = anchor.href;
        if (/^(?:javascript|data|file):/i.test(rawHref)) {
          unsafeHrefs.push({ source: item.path, href: rawHref });
          continue;
        }
        const normalized = normalizeCrawlUrl(rawHref, baseUrl);
        if (!normalized) continue;
        const targetFamily = matcher(normalized.path);
        const structural = anchor.inMain
          && !normalized.query
          && targetFamily?.targetProductionIndexability === 'INDEX'
          && !FUNCTIONAL_FAMILIES.has(targetFamily.familyId);
        links.push({
          source: item.path,
          href: rawHref,
          target: normalized.path,
          targetFamily: targetFamily?.familyId || null,
          structural,
          text: anchor.text,
        });
        if (item.depth < config.maxDepth && shouldCrawlFamily(targetFamily)) {
          enqueue(normalized.path, item.path, item.depth + 1, 'discovered_link');
        }
      }
    }
    pages.push(page);
  }

  const pageByPath = new Map(pages.map((page) => [page.url, page]));
  const structuralLinks = links.filter((link) => link.structural);
  const brokenStructuralLinks = [];
  const redirectingStructuralLinks = [];
  const privateStructuralLinks = [];
  for (const link of structuralLinks) {
    let target = pageByPath.get(link.target);
    if (!target) {
      try {
        const response = await fetch(new URL(link.target, baseUrl), { redirect: 'manual', headers: { Accept: 'text/html' } });
        target = { status: response.status, location: response.headers.get('location') };
      } catch {
        target = { status: 0, location: null };
      }
    }
    if (target.status >= 400 || target.status === 0) brokenStructuralLinks.push({ ...link, status: target.status });
    if (target.status >= 300 && target.status < 400) redirectingStructuralLinks.push({ ...link, status: target.status, location: target.location });
    if (PRIVATE_FAMILIES.has(link.targetFamily)) privateStructuralLinks.push(link);
  }

  const queryVariants = [];
  for (const path of config.queryVariants) {
    const normalized = normalizeCrawlUrl(path, baseUrl);
    const response = await fetch(normalized.absolute, { redirect: 'manual', headers: { Accept: 'text/html' } });
    const html = await response.text();
    const document = /text\/html/i.test(response.headers.get('content-type') || '')
      ? inspectHtmlDocument(html, normalized.absolute, config.securitySentinels)
      : null;
    queryVariants.push({
      path: normalized.path,
      family: matcher(normalized.path)?.familyId || null,
      status: response.status,
      xRobots: response.headers.get('x-robots-tag') || '',
      document,
    });
  }

  const redirects = [];
  for (const alias of config.aliases) {
    const result = await fetchWithRedirectChain(new URL(alias.path, baseUrl).toString());
    redirects.push({
      ...alias,
      actualStatus: result.chain[0]?.status || 0,
      actualTarget: result.chain[0]?.location ? canonicalPath(result.chain[0].location) : null,
      hopCount: Math.max(0, result.chain.length - 1),
      finalStatus: result.chain.at(-1)?.status || 0,
      chain: result.chain,
    });
  }

  const errors = [];
  for (const errorCase of config.errorCases) {
    const response = await fetch(new URL(errorCase.path, baseUrl), { redirect: 'manual', headers: { Accept: 'text/html' } });
    const html = await response.text();
    const document = /text\/html/i.test(response.headers.get('content-type') || '')
      ? inspectHtmlDocument(html, new URL(errorCase.path, baseUrl).toString(), config.securitySentinels)
      : null;
    errors.push({ ...errorCase, actualStatus: response.status, document, xRobots: response.headers.get('x-robots-tag') || '' });
  }

  const robotsResponse = await fetch(new URL('/robots.txt', baseUrl), { redirect: 'manual' });
  const robotsBody = await robotsResponse.text();
  const sitemapResponse = await fetch(new URL('/sitemap.xml', baseUrl), { redirect: 'manual' });
  const sitemapBody = await sitemapResponse.text();
  return {
    pages,
    links,
    queryVariants,
    redirects,
    errors,
    unsafeHrefs,
    structuralLinkHealth: { brokenStructuralLinks, redirectingStructuralLinks, privateStructuralLinks },
    robots: { status: robotsResponse.status, body: robotsBody, xRobots: robotsResponse.headers.get('x-robots-tag') || '' },
    sitemap: { status: sitemapResponse.status, body: sitemapBody, xRobots: sitemapResponse.headers.get('x-robots-tag') || '' },
  };
};

export const evaluateFinalGate = ({ pageMap, graph, indexPolicy, crawlConfig, contract, crawl, browserReport = null }) => {
  const p0 = [];
  const p1 = [...contract.errors];
  const p2 = [...contract.warnings];
  const familyById = new Map(pageMap.families.map((family) => [family.familyId, family]));
  const canonicalOrigin = indexPolicy.canonicalOrigin;
  const pageByPath = new Map(crawl.pages.map((page) => [page.url, page]));
  const familyCoverage = pageMap.families.map((family) => {
    const fixture = [...crawlConfig.representatives, ...crawlConfig.permanentNoindexRepresentatives]
      .find((item) => item.familyId === family.familyId);
    const page = fixture ? pageByPath.get(normalizeCrawlUrl(fixture.path, 'http://fixture.local')?.path) : null;
    return {
      familyId: family.familyId,
      route: family.routePatterns.join(', '),
      identityAuthority: graph.families?.find((item) => item.familyId === family.familyId)?.identityAuthority || family.instanceReadinessRule,
      familyEligibility: family.familyEligibility,
      targetProductionIndexability: family.targetProductionIndexability,
      preLaunchIndexability: family.preLaunchIndexability,
      sitemapTarget: family.sitemapTarget,
      launchStatus: family.launchStatus,
      representative: fixture?.path || null,
      representativeStatus: page?.status ?? null,
      coverage: fixture ? 'REPRESENTATIVE' : 'CONTRACT_ONLY',
    };
  });

  for (const fixture of crawlConfig.representatives) {
    const path = normalizeCrawlUrl(fixture.path, 'http://fixture.local')?.path;
    const page = path ? pageByPath.get(path) : null;
    const expectedStatus = fixture.expectedStatus ?? 200;
    if (!page) p1.push(`representative not crawled: ${fixture.familyId} ${fixture.path}`);
    else if (page.status !== expectedStatus) {
      p1.push(`representative status mismatch: ${fixture.familyId} ${fixture.path} expected ${expectedStatus}, received ${page.status}`);
    }
  }
  for (const fixture of crawlConfig.permanentNoindexRepresentatives.filter((item) => item.expectedStatus !== undefined)) {
    const path = normalizeCrawlUrl(fixture.path, 'http://fixture.local')?.path;
    const page = path ? pageByPath.get(path) : null;
    if (!page) p1.push(`representative not crawled: ${fixture.familyId} ${fixture.path}`);
    else if (page.status !== fixture.expectedStatus) {
      p1.push(`representative status mismatch: ${fixture.familyId} ${fixture.path} expected ${fixture.expectedStatus}, received ${page.status}`);
    }
  }

  for (const page of crawl.pages) {
    const family = page.family ? familyById.get(page.family) : null;
    if (page.document?.sentinelHits.length) p0.push(`security sentinel in ${page.url}`);
    if (page.status === 200 && page.document) {
      const tokens = new Set([...page.document.robotsTokens, ...robotsTokens([page.xRobots])]);
      if (!tokens.has('noindex')) p1.push(`PRELAUNCH page without noindex: ${page.url}`);
      if (family?.targetProductionIndexability === 'INDEX' && !['elite', 'ranking'].includes(family.familyId)) {
        if (!page.document.title) p1.push(`missing title: ${page.url}`);
        if (page.document.h1.length !== 1) p1.push(`invalid H1 count ${page.document.h1.length}: ${page.url}`);
        if (page.document.canonical.length !== 1) p1.push(`invalid canonical count ${page.document.canonical.length}: ${page.url}`);
        const canonical = page.document.canonical[0];
        if (canonical) {
          const canonicalUrl = new URL(canonical, canonicalOrigin);
          if (canonicalUrl.origin !== canonicalOrigin) p1.push(`canonical host mismatch: ${page.url}`);
          if (canonicalPath(canonicalUrl.toString()) !== canonicalPath(page.url)) p1.push(`canonical path mismatch: ${page.url}`);
        }
      }
      if (page.document.invalidJsonLd > 0) p1.push(`invalid JSON-LD: ${page.url}`);
      for (const [type, count] of Object.entries(page.document.schemaTypeCounts)) {
        if (['WebPage', 'CollectionPage', 'BreadcrumbList', 'ItemList'].includes(type) && count > 1) {
          p1.push(`duplicate ${type}: ${page.url}`);
        }
      }
      if (/(?:not found|não encontrad[oa]|nao encontrad[oa])/i.test(page.document.textSignature) && family?.targetProductionIndexability === 'INDEX') {
        p1.push(`possible soft 404: ${page.url}`);
      }
    }
  }
  p1.push(...crawl.structuralLinkHealth.brokenStructuralLinks.map((item) => `broken structural link ${item.source} -> ${item.target}`));
  p1.push(...crawl.structuralLinkHealth.redirectingStructuralLinks.map((item) => `structural link redirects ${item.source} -> ${item.target}`));
  p1.push(...crawl.structuralLinkHealth.privateStructuralLinks.map((item) => `structural link to private ${item.source} -> ${item.target}`));
  p1.push(...crawl.unsafeHrefs.map((item) => `unsafe href ${item.source} -> ${item.href}`));
  for (const item of crawl.queryVariants) {
    const tokens = new Set([
      ...(item.document?.robotsTokens || []),
      ...robotsTokens([item.xRobots]),
    ]);
    if (item.status === 200 && item.document && !tokens.has('noindex')) {
      p1.push(`query variant indexable: ${item.path}`);
    }
    const canonical = item.document?.canonical[0];
    if (canonical && new URL(canonical, canonicalOrigin).search) p1.push(`query canonical polluted: ${item.path}`);
  }
  for (const redirect of crawl.redirects) {
    if (redirect.actualStatus !== redirect.status) p1.push(`alias status mismatch: ${redirect.path}`);
    if (redirect.actualTarget !== redirect.target) p1.push(`alias target mismatch: ${redirect.path}`);
    if (redirect.hopCount !== 1 || redirect.finalStatus !== 200) p1.push(`alias chain mismatch: ${redirect.path}`);
  }
  for (const item of crawl.errors) {
    if (item.actualStatus !== item.expectedStatus) p1.push(`hard 404 mismatch: ${item.path}`);
    if (item.document?.canonical.length) p1.push(`404 canonical present: ${item.path}`);
  }
  if (crawl.robots.status !== 200) p1.push(`robots status ${crawl.robots.status}`);
  if (/Disallow:\s*\/$/im.test(crawl.robots.body)) p1.push('robots contains global Disallow:/');
  if (/Sitemap:/i.test(crawl.robots.body)) p1.push('PRELAUNCH robots exposes sitemap');
  if (crawl.sitemap.status !== 503) p1.push(`PRELAUNCH sitemap status ${crawl.sitemap.status}`);
  if (browserReport) {
    const browserFailures = browserReport.failures || [];
    if (browserFailures.length) p1.push(...browserFailures.map((failure) => `browser harness: ${failure}`));
    const securityDivergence = (browserReport.results || []).filter((item) => item.classification === 'SECURITY_DIVERGENCE').length;
    if (securityDivergence) p0.push(`browser security divergence: ${securityDivergence}`);
  } else {
    p2.push('browser report not attached to final gate');
  }

  const indexabilityMatrix = pageMap.families.map((family) => {
    const qualityRequired = indexPolicy.quality.requiredFamilies.includes(family.familyId);
    return {
      familyId: family.familyId,
      prelaunch: simulateLaunchDecision(family, 'PRELAUNCH', { qualityRequired }).indexability,
      goCandidate: simulateLaunchDecision(family, 'GO_CANDIDATE', { qualityRequired }).indexability,
      productionReady: simulateLaunchDecision(family, 'PRODUCTION', { qualityRequired }).indexability,
      productionNotReady: simulateLaunchDecision(family, 'PRODUCTION', { readiness: 'NOT_READY', qualityRequired }).indexability,
      sitemapProductionReady: simulateLaunchDecision(family, 'PRODUCTION', { qualityRequired }).sitemapEligible,
    };
  });
  if (indexabilityMatrix.some((item) => item.prelaunch === 'INDEX')) p1.push('PRELAUNCH INDEX detected');
  if (indexabilityMatrix.some((item) => item.goCandidate === 'INDEX')) p1.push('GO_CANDIDATE INDEX detected');

  const uniqueP0 = [...new Set(p0)];
  const uniqueP1 = [...new Set(p1)];
  const uniqueP2 = [...new Set(p2)];
  const seoGate = uniqueP0.length === 0 && uniqueP1.length === 0 ? 'GO' : 'NO_GO';
  const stats = {
    seeds: crawlConfig.seeds.length,
    urlsDiscovered: crawl.pages.length,
    discoveredFromLinks: crawl.pages.filter((page) => page.reason === 'discovered_link').length,
    uniqueCanonicalUrls: new Set(crawl.pages.flatMap((page) => page.document?.canonical || []).map(canonicalPath).filter(Boolean)).size,
    noindexUrls: crawl.pages.filter((page) => page.document?.robotsTokens.includes('noindex')).length,
    redirects: crawl.redirects.length,
    notFound: crawl.errors.filter((item) => item.actualStatus === 404).length,
    gone: crawl.errors.filter((item) => item.actualStatus === 410).length,
    queryVariants: crawl.queryVariants.length,
    brokenInternalLinks: crawl.structuralLinkHealth.brokenStructuralLinks.length,
    redirectingInternalLinks: crawl.structuralLinkHealth.redirectingStructuralLinks.length,
    privateStructuralLinks: crawl.structuralLinkHealth.privateStructuralLinks.length,
    securityViolations: uniqueP0.length,
  };
  const seoSignalMatrix = crawl.pages.map((page) => ({
    url: page.url,
    familyId: page.family,
    status: page.status,
    title: page.document?.title || null,
    canonical: page.document?.canonical || [],
    robots: page.document?.robots || [],
    xRobots: page.xRobots,
    h1Count: page.document?.h1.length ?? 0,
    schemaTypes: page.document?.schemaTypes || [],
    result: page.status === 200 && page.document
      ? 'HTML_AUDITED'
      : page.status >= 300 && page.status < 400
        ? 'REDIRECT'
        : page.status === 404
          ? 'NOT_FOUND'
          : 'NON_HTML_OR_PROTECTED',
  }));
  const performanceRegressionMatrix = (browserReport?.results || []).map((item) => ({
    route: item.route,
    key: item.key,
    viewport: item.viewport,
    classification: item.classification,
    rawHtmlBytes: item.html?.rawBytes ?? null,
    hydratedHtmlBytes: item.html?.hydratedBytes ?? null,
    rscBytes: item.rsc?.bytes ?? null,
    serverFetches: item.fetchCounts?.server?.total ?? null,
    browserDirectFetches: item.fetchCounts?.browserDirect?.total ?? null,
    consoleErrors: item.console?.errors?.length ?? 0,
    pageErrors: item.console?.pageErrors?.length ?? 0,
    hydrationWarnings: item.console?.hydrationMessages?.length ?? 0,
  }));
  return {
    phase: 8,
    baseline: crawlConfig.baseline,
    seoGate,
    architectureSeoGo: seoGate === 'GO',
    evidence: ['CONTRACT', 'FIXTURE', 'LAB'],
    families: pageMap.families.length,
    targetIndexFamilies: pageMap.families.filter((family) => family.targetProductionIndexability === 'INDEX').length,
    permanentNoindexFamilies: pageMap.families.filter((family) => family.familyEligibility === 'PERMANENT_NOINDEX').length,
    crawlStats: stats,
    p0: uniqueP0.length,
    p1: uniqueP1.length,
    p2: uniqueP2.length,
    blockingGates: [...uniqueP0.map((message) => ({ severity: 'P0', message })), ...uniqueP1.map((message) => ({ severity: 'P1', message }))],
    p2Items: uniqueP2,
    realDataGates: crawlConfig.realDataGates,
    realDataValidationPending: true,
    productionActivated: false,
    productionSitemapPublished: false,
    searchEnginesNotified: false,
    matrices: {
      fullCrawl: crawl.pages,
      familyCoverage,
      redirects: crawl.redirects,
      errors: crawl.errors,
      seoSignals: seoSignalMatrix,
      indexability: indexabilityMatrix,
      sitemap: indexabilityMatrix.map((item) => ({ familyId: item.familyId, productionReadyEligible: item.sitemapProductionReady })),
      internalLinks: crawl.links,
      performanceRegression: performanceRegressionMatrix,
      security: crawl.pages.map((page) => ({ url: page.url, sentinelHits: page.document?.sentinelHits || [], result: (page.document?.sentinelHits || []).length ? 'FAIL' : 'PASS' })),
    },
  };
};

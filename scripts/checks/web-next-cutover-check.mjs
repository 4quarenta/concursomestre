#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const DEFAULT_BASE_URL = 'http://localhost:3001';
const baseUrl = (process.env.WEB_NEXT_BASE_URL || DEFAULT_BASE_URL).replace(/\/$/, '');
const outputPath = process.env.WEB_NEXT_CHECK_OUTPUT || '';
const expectedCanonicalBaseUrl = (process.env.WEB_NEXT_EXPECTED_CANONICAL_BASE_URL || '').replace(/\/$/, '');
const requireEntityIds = process.env.WEB_NEXT_REQUIRE_ENTITY_IDS === '1';

const requiredPages = [
  '/',
  '/planos',
  '/elite',
  '/faq',
  '/changelog',
  '/privacy',
  '/terms',
  '/checkout/termos-de-adesao',
  '/robots.txt',
  '/sitemap.xml',
  '/question-sitemap.xml',
  '/question-sitemap-page.xml?page=1',
];

const requiredSitemapEntries = [
  '/',
  '/planos',
  '/elite',
  '/faq',
  '/changelog',
  '/privacy',
  '/terms',
  '/checkout/termos-de-adesao',
];

const seoPages = [
  { path: '/', canonical: '/' },
  { path: '/planos', canonical: '/planos' },
  { path: '/elite', canonical: '/elite' },
  { path: '/faq', canonical: '/faq' },
  { path: '/changelog', canonical: '/changelog' },
  { path: '/privacy', canonical: '/privacy' },
  { path: '/terms', canonical: '/terms' },
  { path: '/checkout/termos-de-adesao', canonical: '/checkout/termos-de-adesao' },
];

const optionalEntityRedirects = [
  { env: 'WEB_NEXT_CHECK_QUESTION_ID', source: (id) => `/question/${id}`, expectedPrefix: (id) => `/question/${id}/`, structuredType: 'Article' },
  { env: 'WEB_NEXT_CHECK_RANKING_ID', source: (id) => `/ranking/${id}`, expectedPrefix: (id) => `/ranking/${id}/`, structuredType: 'ItemList' },
  { env: 'WEB_NEXT_CHECK_MATERIAL_ID', source: (id) => `/material/${id}`, expectedPrefix: (id) => `/material/${id}/`, structuredType: 'Product' },
];

const results = [];

const resolveUrl = (path) => new URL(path, `${baseUrl}/`).toString();
const normalizeExpectedBaseUrl = (value) => value ? value.replace(/\/$/, '') : '';
const canonicalBaseUrl = normalizeExpectedBaseUrl(expectedCanonicalBaseUrl);

const addResult = (status, label, detail = '') => {
  results.push({ status, label, detail });
  const marker = status === 'ok' ? 'OK' : status === 'skip' ? 'SKIP' : 'FAIL';
  console.log(`[${marker}] ${label}${detail ? ` - ${detail}` : ''}`);
};

const sleep = (milliseconds) => new Promise((resolve) => {
  setTimeout(resolve, milliseconds);
});

const fetchManual = async (path) => fetch(resolveUrl(path), { redirect: 'manual' });
const fetchFollow = async (path) => fetch(resolveUrl(path));

const readHtml = async (path) => {
  const response = await expectStatus(path);
  if (!response) return '';

  return response.text();
};

const extractTagContent = (html, pattern) => {
  const match = html.match(pattern);
  return match?.[1]?.trim() || '';
};

const normalizeCanonicalPath = (href) => {
  if (!href) return '';

  try {
    return new URL(href, `${baseUrl}/`).pathname.replace(/\/$/, '') || '/';
  } catch {
    return href.replace(/\/$/, '') || '/';
  }
};

const normalizeCanonicalAbsoluteUrl = (href) => {
  if (!href) return '';

  try {
    const resolved = new URL(href, `${baseUrl}/`);
    return `${resolved.origin}${resolved.pathname.replace(/\/$/, '') || '/'}`;
  } catch {
    return href.replace(/\/$/, '') || '/';
  }
};

const extractXmlLocs = (xml) => Array.from(
  xml.matchAll(/<loc>([^<]+)<\/loc>/gi),
  (match) => match[1]?.trim() || '',
).filter(Boolean);

const expectAbsoluteUrlsToUseBase = (label, urls, expectedBase) => {
  if (!expectedBase) {
    return;
  }

  const invalidUrls = urls.filter((url) => !url.startsWith(`${expectedBase}/`) && url !== `${expectedBase}/`);
  if (invalidUrls.length === 0) {
    addResult('ok', `${label} host`, expectedBase);
    return;
  }

  addResult('fail', `${label} host`, `expected ${expectedBase}, got ${invalidUrls[0]}`);
};

const expectStatus = async (path, allowedStatuses = [200]) => {
  const maxAttempts = 2;
  let lastError = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      const response = await fetchManual(path);
      if (!allowedStatuses.includes(response.status)) {
        if (response.status >= 500 && response.status < 600 && attempt < maxAttempts) {
          await sleep(400);
          continue;
        }

        addResult('fail', `${path} status`, `expected ${allowedStatuses.join('/')}, got ${response.status}`);
        return null;
      }

      addResult('ok', `${path} status`, attempt > 1 ? `${response.status} after ${attempt} attempts` : String(response.status));
      return response;
    } catch (error) {
      lastError = error;
      if (attempt < maxAttempts) {
        await sleep(400);
        continue;
      }
    }
  }

  addResult('fail', `${path} request`, lastError instanceof Error ? lastError.message : String(lastError));
  return null;
};

const expectRedirect = async (source, expectedDestination) => {
  const response = await expectStatus(source, [301, 302, 307, 308]);
  if (!response) return;

  const location = response.headers.get('location') || '';
  if (location !== expectedDestination && location !== resolveUrl(expectedDestination)) {
    addResult('fail', `${source} redirect`, `expected ${expectedDestination}, got ${location || 'empty location'}`);
    return;
  }

  addResult('ok', `${source} redirect`, location);
};

const expectRedirectPrefix = async (source, expectedPrefix) => {
  const response = await expectStatus(source, [301, 302, 307, 308]);
  if (!response) return;

  const location = response.headers.get('location') || '';
  const normalizedLocation = location.startsWith(baseUrl)
    ? location.slice(baseUrl.length)
    : location;

  if (!normalizedLocation.startsWith(expectedPrefix)) {
    addResult('fail', `${source} redirect`, `expected prefix ${expectedPrefix}, got ${location || 'empty location'}`);
    return;
  }

  addResult('ok', `${source} redirect`, location);
};

const expectStructuredData = async (path, expectedType) => {
  try {
    const response = await fetchFollow(path);
    if (!response.ok) {
      addResult('fail', `${path} structured data`, `final response ${response.status}`);
      return;
    }

    const html = await response.text();
    const hasJsonLd = /<script[^>]+type=["']application\/ld\+json["'][^>]*>/i.test(html);
    if (!hasJsonLd) {
      addResult('fail', `${path} structured data`, 'missing application/ld+json script');
      return;
    }

    if (!html.includes(`"@type":"${expectedType}"`) && !html.includes(`"@type":["${expectedType}`)) {
      addResult('fail', `${path} structured data`, `missing @type ${expectedType}`);
      return;
    }

    addResult('ok', `${path} structured data`, expectedType);
  } catch (error) {
    addResult('fail', `${path} structured data`, error instanceof Error ? error.message : String(error));
  }
};

const expectSeoSignals = async ({ path, canonical }) => {
  const html = await readHtml(path);
  if (!html) return;

  const title = extractTagContent(html, /<title>([^<]+)<\/title>/i);
  if (title) {
    addResult('ok', `${path} title`, title.slice(0, 80));
  } else {
    addResult('fail', `${path} title`, 'missing <title>');
  }

  const description = extractTagContent(
    html,
    /<meta\s+name=["']description["']\s+content=["']([^"']+)["'][^>]*>/i,
  ) || extractTagContent(
    html,
    /<meta\s+content=["']([^"']+)["']\s+name=["']description["'][^>]*>/i,
  );

  if (description) {
    addResult('ok', `${path} meta description`, description.slice(0, 100));
  } else {
    addResult('fail', `${path} meta description`, 'missing description');
  }

  const canonicalHref = extractTagContent(
    html,
    /<link\s+rel=["']canonical["']\s+href=["']([^"']+)["'][^>]*>/i,
  ) || extractTagContent(
    html,
    /<link\s+href=["']([^"']+)["']\s+rel=["']canonical["'][^>]*>/i,
  );
  const canonicalPath = normalizeCanonicalPath(canonicalHref);
  const expectedCanonicalPath = canonical.replace(/\/$/, '') || '/';
  const canonicalAbsoluteUrl = normalizeCanonicalAbsoluteUrl(canonicalHref);

  if (canonicalPath === expectedCanonicalPath) {
    addResult('ok', `${path} canonical`, canonicalHref);
  } else {
    addResult('fail', `${path} canonical`, `expected ${expectedCanonicalPath}, got ${canonicalHref || 'missing canonical'}`);
  }

  if (canonicalBaseUrl) {
    const expectedCanonicalUrl = expectedCanonicalPath === '/'
      ? `${canonicalBaseUrl}/`
      : `${canonicalBaseUrl}${expectedCanonicalPath}`;

    if (canonicalAbsoluteUrl === expectedCanonicalUrl) {
      addResult('ok', `${path} canonical host`, canonicalAbsoluteUrl);
    } else {
      addResult('fail', `${path} canonical host`, `expected ${expectedCanonicalUrl}, got ${canonicalHref || 'missing canonical'}`);
    }
  }
};

for (const path of requiredPages) {
  await expectStatus(path);
}

for (const seoPage of seoPages) {
  await expectSeoSignals(seoPage);
}

await expectRedirect('/plans', '/planos');

const robotsResponse = await expectStatus('/robots.txt');
if (robotsResponse) {
  const robots = await robotsResponse.text();
  if (robots.includes('Sitemap:') && robots.includes('/sitemap.xml')) {
    addResult('ok', '/robots.txt sitemap reference');
  } else {
    addResult('fail', '/robots.txt sitemap reference', 'missing Sitemap entry');
  }

  if (robots.includes('/question-sitemap.xml')) {
    addResult('ok', '/robots.txt question sitemap reference');
  } else {
    addResult('fail', '/robots.txt question sitemap reference', 'missing question sitemap entry');
  }

  if (canonicalBaseUrl) {
    if (robots.includes(`Sitemap: ${canonicalBaseUrl}/sitemap.xml`)) {
      addResult('ok', '/robots.txt canonical sitemap host', `${canonicalBaseUrl}/sitemap.xml`);
    } else {
      addResult('fail', '/robots.txt canonical sitemap host', `expected ${canonicalBaseUrl}/sitemap.xml`);
    }

    if (robots.includes(`Sitemap: ${canonicalBaseUrl}/question-sitemap.xml`)) {
      addResult('ok', '/robots.txt canonical question sitemap host', `${canonicalBaseUrl}/question-sitemap.xml`);
    } else {
      addResult('fail', '/robots.txt canonical question sitemap host', `expected ${canonicalBaseUrl}/question-sitemap.xml`);
    }
  }
}

const sitemapResponse = await expectStatus('/sitemap.xml');
if (sitemapResponse) {
  const sitemap = await sitemapResponse.text();
  for (const entry of requiredSitemapEntries) {
    if (sitemap.includes(entry)) {
      addResult('ok', `/sitemap.xml contains ${entry}`);
    } else {
      addResult('fail', `/sitemap.xml contains ${entry}`);
    }
  }

  expectAbsoluteUrlsToUseBase('/sitemap.xml loc entries', extractXmlLocs(sitemap), canonicalBaseUrl);
}

const questionSitemapIndexResponse = await expectStatus('/question-sitemap.xml');
if (questionSitemapIndexResponse) {
  const questionSitemapIndex = await questionSitemapIndexResponse.text();
  if (questionSitemapIndex.includes('/question-sitemap-page.xml?page=1')) {
    addResult('ok', '/question-sitemap.xml contains page=1');
  } else {
    addResult('fail', '/question-sitemap.xml contains page=1');
  }

  if (questionSitemapIndex.includes('<sitemapindex')) {
    addResult('ok', '/question-sitemap.xml root node', 'sitemapindex');
  } else {
    addResult('fail', '/question-sitemap.xml root node', 'expected <sitemapindex>');
  }

  expectAbsoluteUrlsToUseBase('/question-sitemap.xml loc entries', extractXmlLocs(questionSitemapIndex), canonicalBaseUrl);
}

const questionSitemapPageResponse = await expectStatus('/question-sitemap-page.xml?page=1');
if (questionSitemapPageResponse) {
  const questionSitemapPage = await questionSitemapPageResponse.text();
  if (questionSitemapPage.includes('<urlset')) {
    addResult('ok', '/question-sitemap-page.xml?page=1 root node', 'urlset');
  } else {
    addResult('fail', '/question-sitemap-page.xml?page=1 root node', 'expected <urlset>');
  }

  expectAbsoluteUrlsToUseBase('/question-sitemap-page.xml?page=1 loc entries', extractXmlLocs(questionSitemapPage), canonicalBaseUrl);
}

for (const redirectCase of optionalEntityRedirects) {
  const id = process.env[redirectCase.env];
  if (!id) {
    if (requireEntityIds) {
      addResult('fail', redirectCase.env, 'required in strict mode to validate a real entity redirect');
    } else {
      addResult('skip', redirectCase.env, 'set this env var to validate a real entity redirect');
    }
    continue;
  }

  const source = redirectCase.source(id);
  await expectRedirectPrefix(source, redirectCase.expectedPrefix(id));
  await expectStructuredData(source, redirectCase.structuredType);
}

const failures = results.filter((result) => result.status === 'fail');
const summary = {
  ok: results.filter((result) => result.status === 'ok').length,
  skip: results.filter((result) => result.status === 'skip').length,
  fail: failures.length,
};

if (outputPath) {
  const report = {
    generatedAt: new Date().toISOString(),
    baseUrl,
    expectedCanonicalBaseUrl,
    requireEntityIds,
    passed: failures.length === 0,
    summary,
    results,
  };

  const resolvedOutputPath = path.resolve(outputPath);
  fs.mkdirSync(path.dirname(resolvedOutputPath), { recursive: true });
  fs.writeFileSync(
    resolvedOutputPath,
    `${JSON.stringify(report, null, 2)}\n`,
    'utf8',
  );
  console.log(`[INFO] report written - ${resolvedOutputPath}`);
}

if (failures.length > 0) {
  console.error(`\nCutover validation failed with ${failures.length} issue(s).`);
  process.exit(1);
}

console.log('\nCutover validation passed.');

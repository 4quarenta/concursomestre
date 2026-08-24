#!/usr/bin/env node

/*
* ----------------------------------------------------
* @author: 4quarenta
* @author URI: https://github.com/4quarenta
* @copyright: (c) 2026 ConcursoMestre. All rights reserved
* ----------------------------------------------------
*
* @since 1.0.0
*
*/

import { chromium } from '@playwright/test';
import { JSDOM } from 'jsdom';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  compareSemanticSnapshots,
  extractSemanticSnapshot,
} from './lib/semantic-page-snapshot.mjs';

const ROOT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const arg = (name, fallback = '') => {
  const prefix = `--${name}=`;
  const value = process.argv.slice(2).find((item) => item.startsWith(prefix));
  return value ? value.slice(prefix.length) : fallback;
};
const boolArg = (name, fallback = false) => {
  const value = arg(name);
  return value === '' ? fallback : ['1', 'true', 'yes', 'on'].includes(value.toLowerCase());
};
const baseUrl = arg('base-url', process.env.CM_SSR_HARNESS_BASE_URL || 'http://127.0.0.1:3000').replace(/\/$/, '');
const baselinePath = path.resolve(ROOT_DIR, arg('baseline', 'config/seo/ssr-hydration-baseline.v1.json'));
const reportPath = path.resolve(ROOT_DIR, arg('report-file', '.tmp/seo/ssr-hydration-report.json'));
const metricsUrl = arg('metrics-url', process.env.CM_SSR_HARNESS_METRICS_URL || '').replace(/\/$/, '');
const timeoutMs = Number(arg('timeout-ms', '20000'));
const strict = boolArg('strict', false);

const readBaseline = async (filePath, visited = new Set()) => {
  const resolvedPath = path.resolve(filePath);
  if (visited.has(resolvedPath)) throw new Error(`Baseline inheritance cycle: ${resolvedPath}`);
  visited.add(resolvedPath);
  const baseline = JSON.parse(await readFile(resolvedPath, 'utf8'));
  if (!baseline.extends) return baseline;

  const parent = await readBaseline(path.resolve(path.dirname(resolvedPath), baseline.extends), visited);
  const routes = new Map((parent.routes || []).map((route) => [route.key, route]));
  (baseline.routes || []).forEach((route) => routes.set(route.key, route));
  return {
    ...parent,
    ...baseline,
    viewports: baseline.viewports || parent.viewports,
    securitySentinels: [...new Set([
      ...(parent.securitySentinels || []),
      ...(baseline.securitySentinels || []),
    ])],
    routes: [...routes.values()],
  };
};

const normalizePath = (value) => {
  try {
    return new URL(value, baseUrl).pathname.replace(/\/$/, '') || '/';
  } catch {
    return String(value || '').replace(/\/$/, '') || '/';
  }
};

const resetMetrics = async () => {
  if (!metricsUrl) return;
  await fetch(`${metricsUrl}/__reset`, { method: 'POST' }).catch(() => undefined);
};

const readMetrics = async () => {
  if (!metricsUrl) return null;
  try {
    const response = await fetch(`${metricsUrl}/__metrics`);
    return response.ok ? await response.json() : null;
  } catch {
    return null;
  }
};

const fetchRsc = async (routePath) => {
  const url = new URL(routePath, baseUrl);
  url.searchParams.set('_rsc', 'semantic-harness');
  try {
    const response = await fetch(url, {
      headers: {
        Accept: 'text/x-component',
        RSC: '1',
        'Next-Router-Prefetch': '1',
        'Next-Router-State-Tree': '["",{}]'
      },
    });
    return { status: response.status, contentType: response.headers.get('content-type') || '', body: await response.text() };
  } catch (error) {
    return { status: 0, contentType: '', body: '', error: error instanceof Error ? error.message : String(error) };
  }
};

const inspectRoute = async ({ browser, route, viewport, sentinels }) => {
  const routePath = process.env[route.pathEnv] || route.path;
  const url = new URL(routePath, baseUrl);
  await resetMetrics();
  const rawResponse = await fetch(url, { redirect: 'manual', headers: { Accept: 'text/html' } });
  const rawHtml = await rawResponse.text();
  const rawDom = new JSDOM(rawHtml, { url: url.toString() });
  const raw = extractSemanticSnapshot(rawDom.window.document, { mode: 'raw', origin: url.origin });
  const rawDomNodes = rawDom.window.document.querySelectorAll('*').length;
  const serverFetchMetrics = await readMetrics();
  const rsc = await fetchRsc(routePath);

  await resetMetrics();
  const context = await browser.newContext({
    baseURL: baseUrl,
    viewport: { width: viewport.width, height: viewport.height },
    isMobile: viewport.name === 'mobile',
  });
  const page = await context.newPage();
  const consoleErrors = [];
  const consoleWarnings = [];
  const pageErrors = [];
  const directBrowserApiRequests = [];
  const metricsOrigin = metricsUrl ? new URL(metricsUrl).origin : '';
  page.on('request', (request) => {
    if (!metricsOrigin) return;
    const requestUrl = new URL(request.url());
    if (requestUrl.origin === metricsOrigin) {
      directBrowserApiRequests.push(`${request.method()} ${requestUrl.pathname}${requestUrl.search}`);
    }
  });
  page.on('console', (message) => {
    const text = message.text();
    if (message.type() === 'error') consoleErrors.push(text);
    if (message.type() === 'warning') consoleWarnings.push(text);
  });
  page.on('pageerror', (error) => pageErrors.push(error.message));

  let hydrated;
  let hydratedHtml = '';
  try {
    await page.goto(routePath, { waitUntil: 'domcontentloaded', timeout: timeoutMs });
    await page.waitForLoadState('load', { timeout: Math.min(timeoutMs, 6000) }).catch(() => undefined);
    await page.waitForTimeout(250);
    hydrated = await page.evaluate(extractSemanticSnapshot, { mode: 'hydrated', origin: url.origin });
    hydratedHtml = await page.content();
  } finally {
    await context.close();
  }
  const browserFetchMetrics = await readMetrics();
  const comparison = compareSemanticSnapshots({
    raw,
    hydrated,
    sentinels,
    surfaces: { rawHtml, hydratedHtml, rsc: rsc.body },
  });
  const effectiveClassification = route.maturity === 'error'
    && comparison.classification === 'SEMANTIC_DIVERGENCE'
    && comparison.sentinelHits.length === 0
      ? 'EQUIVALENT'
      : comparison.classification;
  const hydrationMessages = [...consoleErrors, ...consoleWarnings, ...pageErrors]
    .filter((message) => /hydrat|did not match|server rendered html/i.test(message));
  const canonicalPaths = hydrated.canonical.map(normalizePath);
  const expectedCanonical = route.canonical ? normalizePath(route.canonical) : null;
  const canonicalMatches = route.canonicalAbsent === true
    ? canonicalPaths.length === 0
    : expectedCanonical === null || canonicalPaths.includes(expectedCanonical);
  const robotsNoIndex = hydrated.robots.some((value) => /(?:^|,)\s*noindex\s*(?:,|$)/i.test(value));
  const expectedSchemas = Array.isArray(route.schemaTypes) ? route.schemaTypes : [];
  const missingSchemas = expectedSchemas.filter((type) => !hydrated.schemaTypes.includes(type));
  const expectedMainCount = Number(route.expectedMainCount ?? (route.maturity === 'ssr' ? 1 : NaN));
  const expectedH1Count = Number(route.expectedH1Count ?? (route.maturity === 'ssr' ? 1 : NaN));
  const mainCountMatches = Number.isNaN(expectedMainCount)
    || (raw.mainCount === expectedMainCount && hydrated.mainCount === expectedMainCount);
  const h1CountMatches = Number.isNaN(expectedH1Count)
    || (raw.h1.length === expectedH1Count && hydrated.h1.length === expectedH1Count);
  const schemaCanonicalMatches = route.schemaCanonicalRequired !== true
    || (expectedCanonical !== null && hydrated.schemaIdentifiers.map(normalizePath).includes(expectedCanonical));
  const rawLinkHrefs = Array.from(rawDom.window.document.querySelectorAll('a[href]'))
    .map((element) => element.getAttribute('href') || '')
    .filter((href, index, values) => href && values.indexOf(href) === index);
  const requiredRawTextMissing = (Array.isArray(route.requiredRawText) ? route.requiredRawText : [])
    .filter((value) => !rawHtml.includes(String(value)));
  const requiredRawLinksMissing = (Array.isArray(route.requiredRawLinks) ? route.requiredRawLinks : [])
    .filter((value) => !rawLinkHrefs.includes(String(value)));
  const requiredRawLinkPrefixesMissing = (Array.isArray(route.requiredRawLinkPrefixes) ? route.requiredRawLinkPrefixes : [])
    .filter((value) => !rawLinkHrefs.some((href) => href.startsWith(String(value))));
  const visualBreadcrumb = hydrated.breadcrumbItems[0] || [];
  const jsonLdBreadcrumb = hydrated.jsonLdBreadcrumbItems[0] || [];
  const breadcrumbEquivalent = route.breadcrumbRequired !== true
    || (visualBreadcrumb.length > 0 && JSON.stringify(visualBreadcrumb) === JSON.stringify(jsonLdBreadcrumb));
  const duplicatePrimarySchemas = ['WebPage', 'CollectionPage', 'BreadcrumbList', 'ItemList']
    .filter((type) => Number(hydrated.schemaTypeCounts[type] || 0) > 1);
  const internalTargets = { checked: 0, broken: [], redirects: [] };
  if (route.verifyInternalLinks === true) {
    const skipPrefixes = Array.isArray(route.skipLinkPrefixes) ? route.skipLinkPrefixes : ['/auth', '/api/', '/checkout'];
    const targets = [...new Set(rawLinkHrefs.map((href) => {
      try {
        const target = new URL(href, url);
        if (target.origin !== url.origin || target.hash) return '';
        if (target.search && route.verifyFunctionalLinks !== true) return '';
        return `${target.pathname}${target.search}`;
      } catch {
        return '';
      }
    }).filter((href) => href && !skipPrefixes.some((prefix) => href.startsWith(prefix))))].slice(0, 80);
    for (const target of targets) {
      const response = await fetch(new URL(target, baseUrl), { redirect: 'manual', headers: { Accept: 'text/html' } });
      internalTargets.checked += 1;
      if (response.status >= 300 && response.status < 400) internalTargets.redirects.push({ target, status: response.status, location: response.headers.get('location') });
      if (response.status >= 400) internalTargets.broken.push({ target, status: response.status });
    }
  }

  return {
    route: routePath,
    key: route.key,
    maturity: route.maturity,
    viewport: viewport.name,
    status: rawResponse.status,
    location: rawResponse.headers.get('location'),
    classification: effectiveClassification,
    allowedClassifications: route.allowedClassifications,
    classificationAllowed: route.allowedClassifications.includes(effectiveClassification),
    differences: comparison.differences,
    sentinelHits: comparison.sentinelHits,
    raw,
    hydrated,
    rsc: { status: rsc.status, contentType: rsc.contentType, bytes: Buffer.byteLength(rsc.body) },
    html: {
      rawBytes: Buffer.byteLength(rawHtml),
      hydratedBytes: Buffer.byteLength(hydratedHtml),
      rawDomNodes,
      hydratedDomNodes: hydrated.domNodeCount,
    },
    semantics: { expectedMainCount, expectedH1Count, mainCountMatches, h1CountMatches },
    content: { requiredRawTextMissing, requiredRawLinksMissing, requiredRawLinkPrefixesMissing },
    graph: { internalTargets, visualBreadcrumb, jsonLdBreadcrumb, breadcrumbEquivalent, duplicatePrimarySchemas },
    metadata: { expectedCanonical, canonicalPaths, canonicalMatches, robotsNoIndex, missingSchemas, schemaCanonicalMatches },
    console: { errors: consoleErrors, warnings: consoleWarnings, pageErrors, hydrationMessages },
    fetchCounts: {
      server: serverFetchMetrics,
      browserWindow: browserFetchMetrics,
      browserDirect: {
        total: directBrowserApiRequests.length,
        requests: directBrowserApiRequests,
      },
    },
  };
};

const main = async () => {
  const baseline = await readBaseline(baselinePath);
  const sentinels = [
    ...(Array.isArray(baseline.securitySentinels) ? baseline.securitySentinels : []),
    ...String(process.env.CM_SSR_HARNESS_SENTINELS || '').split(',').map((value) => value.trim()).filter(Boolean),
  ];
  const browser = await chromium.launch({ headless: true });
  const results = [];
  try {
    for (const route of baseline.routes) {
      for (const viewport of baseline.viewports) {
        results.push(await inspectRoute({ browser, route, viewport, sentinels }));
      }
    }
  } finally {
    await browser.close();
  }

  const failures = results.flatMap((result) => {
    const routeFailures = [];
    const route = baseline.routes.find((item) => item.key === result.key);
    const expectedStatus = Number(route?.expectedStatus || 200);
    if (result.status !== expectedStatus) routeFailures.push(`${result.key}/${result.viewport}: HTTP ${result.status}, expected ${expectedStatus}`);
    if (!result.classificationAllowed) routeFailures.push(`${result.key}/${result.viewport}: ${result.classification}`);
    if (result.sentinelHits.length > 0) routeFailures.push(`${result.key}/${result.viewport}: protected sentinel`);
    if (!result.metadata.canonicalMatches) routeFailures.push(`${result.key}/${result.viewport}: canonical mismatch`);
    if (route?.expectNoIndex === true && !result.metadata.robotsNoIndex) routeFailures.push(`${result.key}/${result.viewport}: missing noindex`);
    if (result.metadata.missingSchemas.length > 0) routeFailures.push(`${result.key}/${result.viewport}: schema missing ${result.metadata.missingSchemas.join(',')}`);
    if (!result.metadata.schemaCanonicalMatches) routeFailures.push(`${result.key}/${result.viewport}: schema canonical mismatch`);
    if (!result.semantics.mainCountMatches) routeFailures.push(`${result.key}/${result.viewport}: main count mismatch`);
    if (!result.semantics.h1CountMatches) routeFailures.push(`${result.key}/${result.viewport}: h1 count mismatch`);
    if (result.content.requiredRawTextMissing.length > 0) routeFailures.push(`${result.key}/${result.viewport}: raw text missing ${result.content.requiredRawTextMissing.join(',')}`);
    if (result.content.requiredRawLinksMissing.length > 0) routeFailures.push(`${result.key}/${result.viewport}: raw links missing ${result.content.requiredRawLinksMissing.join(',')}`);
    if (result.content.requiredRawLinkPrefixesMissing.length > 0) routeFailures.push(`${result.key}/${result.viewport}: raw link prefixes missing ${result.content.requiredRawLinkPrefixesMissing.join(',')}`);
    if (!result.graph.breadcrumbEquivalent) routeFailures.push(`${result.key}/${result.viewport}: visual/json-ld breadcrumb mismatch`);
    if (result.graph.duplicatePrimarySchemas.length > 0) routeFailures.push(`${result.key}/${result.viewport}: duplicate primary schema ${result.graph.duplicatePrimarySchemas.join(',')}`);
    if (result.graph.internalTargets.broken.length > 0) routeFailures.push(`${result.key}/${result.viewport}: broken internal links`);
    if (result.graph.internalTargets.redirects.length > 0) routeFailures.push(`${result.key}/${result.viewport}: redirecting internal links`);
    if (result.console.hydrationMessages.length > 0) routeFailures.push(`${result.key}/${result.viewport}: hydration warning`);
    return routeFailures;
  });
  const report = {
    version: 'ssr-hydration-report.v1',
    baselineVersion: baseline.version,
    generatedAt: new Date().toISOString(),
    baseUrl,
    strict,
    totals: {
      routes: baseline.routes.length,
      executions: results.length,
      equivalent: results.filter((item) => item.classification === 'EQUIVALENT').length,
      interactionOnly: results.filter((item) => item.classification === 'INTERACTION_ONLY').length,
      semanticDivergence: results.filter((item) => item.classification === 'SEMANTIC_DIVERGENCE').length,
      securityDivergence: results.filter((item) => item.classification === 'SECURITY_DIVERGENCE').length,
      failures: failures.length,
    },
    failures,
    results,
  };
  await mkdir(path.dirname(reportPath), { recursive: true });
  await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  console.log(JSON.stringify({ report: reportPath, totals: report.totals, failures }, null, 2));
  if (strict && failures.length > 0) process.exitCode = 1;
};

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

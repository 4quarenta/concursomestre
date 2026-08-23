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
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

const arg = (name, fallback = '') => {
  const prefix = `--${name}=`;
  const value = process.argv.slice(2).find((item) => item.startsWith(prefix));
  return value ? value.slice(prefix.length) : fallback;
};

const percentile = (values, ratio) => {
  if (values.length === 0) return null;
  const sorted = [...values].sort((left, right) => left - right);
  return sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * ratio) - 1)];
};

const rounded = (value) => value === null || value === undefined ? null : Math.round(value * 100) / 100;

export const summarizeSamples = (samples) => {
  const numeric = (field) => samples.map((sample) => Number(sample[field])).filter(Number.isFinite);
  const summarize = (field) => {
    const values = numeric(field);
    return {
      median: rounded(percentile(values, 0.5)),
      p95: values.length >= 5 ? rounded(percentile(values, 0.95)) : null,
      max: values.length ? rounded(Math.max(...values)) : null,
    };
  };

  return {
    status: samples[0]?.status ?? 0,
    runs: samples.length,
    ttfbMs: summarize('ttfbMs'),
    lcpMs: summarize('lcpMs'),
    cls: summarize('cls'),
    totalBlockingTimeProxyMs: summarize('totalBlockingTimeProxyMs'),
    htmlBytes: summarize('htmlBytes'),
    domNodes: summarize('domNodes'),
    requests: summarize('requests'),
    transferBytes: summarize('transferBytes'),
    scriptRequests: summarize('scriptRequests'),
    scriptTransferBytes: summarize('scriptTransferBytes'),
    imageRequests: summarize('imageRequests'),
    backendRequests: summarize('backendRequests'),
    imagesWithoutDimensions: Math.max(...samples.map((sample) => sample.imagesWithoutDimensions), 0),
    duplicateRequests: [...new Set(samples.flatMap((sample) => sample.duplicateRequests))].sort(),
    consoleErrors: [...new Set(samples.flatMap((sample) => sample.consoleErrors))],
    hydrationMessages: [...new Set(samples.flatMap((sample) => sample.hydrationMessages))],
    thirdPartyOrigins: [...new Set(samples.flatMap((sample) => sample.thirdPartyOrigins))].sort(),
    lcpCandidates: [...new Set(samples.map((sample) => sample.lcpCandidate).filter(Boolean))],
    cacheControl: [...new Set(samples.map((sample) => sample.cacheControl).filter(Boolean))],
    nextCacheStatus: [...new Set(samples.map((sample) => sample.nextCacheStatus).filter(Boolean))],
    serverTiming: [...new Set(samples.map((sample) => sample.serverTiming).filter(Boolean))],
    backendRequestPaths: Object.fromEntries([...new Set(samples.flatMap((sample) => Object.keys(sample.backendRequestByPath || {})))]
      .sort()
      .map((requestPath) => [requestPath, Math.max(...samples.map((sample) => Number(sample.backendRequestByPath?.[requestPath] || 0)))])),
    transientRetries: samples.reduce((total, sample) => total + Number(sample.transientRetries || 0), 0),
  };
};

const resetMetrics = async (metricsUrl) => {
  if (!metricsUrl) return;
  await fetch(`${metricsUrl}/__reset`, { method: 'POST' }).catch(() => undefined);
};

const readMetrics = async (metricsUrl) => {
  if (!metricsUrl) return { total: 0, byPath: {} };
  try {
    const response = await fetch(`${metricsUrl}/__metrics`);
    return response.ok ? await response.json() : { total: 0, byPath: {} };
  } catch {
    return { total: 0, byPath: {} };
  }
};

const inspect = async ({ browser, baseUrl, metricsUrl, route, viewport, timeoutMs }) => {
  await resetMetrics(metricsUrl);
  const context = await browser.newContext({
    viewport: { width: viewport.width, height: viewport.height },
    isMobile: viewport.name === 'mobile',
    serviceWorkers: 'block',
  });
  const page = await context.newPage();
  const consoleErrors = [];
  const pageErrors = [];
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });
  page.on('pageerror', (error) => pageErrors.push(error.message));
  await page.addInitScript(() => {
    window.__phase7Metrics = { cls: 0, lcp: null, lcpCandidate: '', longTasks: [] };
    try {
      new PerformanceObserver((list) => {
        for (const entry of list.getEntries()) {
          if (!entry.hadRecentInput) window.__phase7Metrics.cls += entry.value;
        }
      }).observe({ type: 'layout-shift', buffered: true });
      new PerformanceObserver((list) => {
        const entries = list.getEntries();
        const last = entries[entries.length - 1];
        if (last) {
          window.__phase7Metrics.lcp = last.startTime;
          const element = last.element;
          window.__phase7Metrics.lcpCandidate = element
            ? `${element.tagName.toLowerCase()}${element.id ? `#${element.id}` : ''}${element.className ? `.${String(element.className).trim().split(/\s+/).slice(0, 2).join('.')}` : ''}`
            : '';
        }
      }).observe({ type: 'largest-contentful-paint', buffered: true });
      new PerformanceObserver((list) => {
        window.__phase7Metrics.longTasks.push(...list.getEntries().map((entry) => entry.duration));
      }).observe({ type: 'longtask', buffered: true });
    } catch {
      // Browsers without an observer type still produce navigation/resource evidence.
    }
  });

  const target = new URL(route.path, baseUrl);
  let response;
  try {
    response = await page.goto(target.toString(), { waitUntil: 'load', timeout: timeoutMs });
    await page.waitForTimeout(500);
    const metrics = await page.evaluate(() => {
      const navigation = performance.getEntriesByType('navigation')[0];
      const resources = performance.getEntriesByType('resource');
      const names = resources.map((entry) => entry.name);
      const duplicateRequests = [...new Set(names.filter((name, index) => names.indexOf(name) !== index))];
      const scripts = resources.filter((entry) => entry.initiatorType === 'script');
      const images = resources.filter((entry) => entry.initiatorType === 'img');
      const longTasks = window.__phase7Metrics?.longTasks || [];
      const thirdPartyOrigins = [...new Set(resources
        .map((entry) => new URL(entry.name, location.href).origin)
        .filter((origin) => origin !== location.origin))];
      const transferSize = (entries) => entries.reduce((total, entry) => total + Number(entry.transferSize || entry.encodedBodySize || 0), 0);
      const imageElements = [...document.images];
      return {
        ttfbMs: navigation?.responseStart || 0,
        lcpMs: window.__phase7Metrics?.lcp,
        lcpCandidate: window.__phase7Metrics?.lcpCandidate || '',
        cls: window.__phase7Metrics?.cls || 0,
        totalBlockingTimeProxyMs: longTasks.reduce((total, duration) => total + Math.max(0, duration - 50), 0),
        htmlBytes: new Blob([document.documentElement.outerHTML]).size,
        domNodes: document.querySelectorAll('*').length,
        requests: resources.length + 1,
        transferBytes: transferSize(resources),
        scriptRequests: scripts.length,
        scriptTransferBytes: transferSize(scripts),
        imageRequests: images.length,
        imagesWithoutDimensions: imageElements.filter((image) => !image.hasAttribute('width') || !image.hasAttribute('height')).length,
        duplicateRequests,
        thirdPartyOrigins,
      };
    });
    const backendMetrics = await readMetrics(metricsUrl);
    const allErrors = [...consoleErrors, ...pageErrors].filter((message) => !(
      route.expectedStatus === 404
      && /Failed to load resource: the server responded with a status of 404/i.test(message)
    ));
    return {
      ...metrics,
      status: response?.status() || 0,
      cacheControl: response?.headers()['cache-control'] || '',
      nextCacheStatus: response?.headers()['x-nextjs-cache'] || '',
      serverTiming: response?.headers()['server-timing'] || '',
      backendRequests: Number(backendMetrics?.total || 0),
      backendRequestByPath: backendMetrics?.byPath || {},
      consoleErrors: allErrors,
      hydrationMessages: allErrors.filter((message) => /hydrat|did not match|server rendered html/i.test(message)),
    };
  } finally {
    await context.close();
  }
};

export const runReporter = async ({ baseUrl, metricsUrl = '', matrixPath, reportPath, runs, timeoutMs }) => {
  const matrix = JSON.parse(await readFile(matrixPath, 'utf8'));
  const browser = await chromium.launch({ headless: true });
  const results = [];
  try {
    for (const route of matrix.routes) {
      for (const viewport of matrix.viewports) {
        const samples = [];
        for (let run = 0; run < runs; run += 1) {
          let sample = await inspect({ browser, baseUrl, metricsUrl, route, viewport, timeoutMs });
          if (sample.consoleErrors.some((message) => /ERR_NO_BUFFER_SPACE/i.test(message))) {
            await new Promise((resolve) => setTimeout(resolve, 250));
            sample = {
              ...await inspect({ browser, baseUrl, metricsUrl, route, viewport, timeoutMs }),
              transientRetries: 1,
            };
          }
          samples.push(sample);
        }
        results.push({
          key: route.key,
          route: route.path,
          routeClass: route.class,
          viewport: viewport.name,
          expectedStatus: route.expectedStatus || 200,
          ...summarizeSamples(samples),
        });
      }
    }
  } finally {
    await browser.close();
  }

  const report = {
    version: 'phase-7-performance-readiness-report.v1',
    evidence: 'LAB',
    generatedAt: new Date().toISOString(),
    baseUrl,
    metricsUrl: metricsUrl || null,
    runsPerRouteViewport: runs,
    fieldMetrics: 'NOT_MEASURED',
    results,
    totals: {
      routeViewports: results.length,
      statusMismatches: results.filter((result) => result.status !== result.expectedStatus).length,
      consoleErrors: results.reduce((total, result) => total + result.consoleErrors.length, 0),
      hydrationMessages: results.reduce((total, result) => total + result.hydrationMessages.length, 0),
      duplicateRequestUrls: results.reduce((total, result) => total + result.duplicateRequests.length, 0),
    },
  };
  await mkdir(path.dirname(reportPath), { recursive: true });
  await writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
  return report;
};

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const baseUrl = arg('base-url', 'http://127.0.0.1:3000').replace(/\/$/, '');
  const metricsUrl = arg('metrics-url', '').replace(/\/$/, '');
  const matrixPath = path.resolve(ROOT_DIR, arg('matrix', 'config/performance/phase-7-route-matrix.v1.json'));
  const reportPath = path.resolve(ROOT_DIR, arg('report-file', '.tmp/performance/phase-7-readiness-report.json'));
  const runs = Math.max(1, Number(arg('runs', '3')) || 3);
  const timeoutMs = Math.max(1000, Number(arg('timeout-ms', '30000')) || 30000);
  const report = await runReporter({ baseUrl, metricsUrl, matrixPath, reportPath, runs, timeoutMs });
  process.stdout.write(`${JSON.stringify(report.totals)}\n${reportPath}\n`);
  process.exitCode = report.totals.statusMismatches || report.totals.consoleErrors || report.totals.hydrationMessages ? 1 : 0;
}

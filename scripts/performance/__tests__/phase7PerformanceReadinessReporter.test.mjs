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

import { describe, expect, it } from 'vitest';
import { readFile } from 'node:fs/promises';
import { summarizeSamples } from '../phase7-performance-readiness-reporter.mjs';

describe('Phase 7 performance readiness reporter', () => {
  it('reports medians without claiming p95 from fewer than five samples', () => {
    const summary = summarizeSamples([
      { ttfbMs: 30, lcpMs: 300, cls: 0, totalBlockingTimeProxyMs: 0, htmlBytes: 100, domNodes: 10, requests: 3, transferBytes: 1000, scriptRequests: 1, scriptTransferBytes: 500, imageRequests: 1, imagesWithoutDimensions: 0, duplicateRequests: [], consoleErrors: [], hydrationMessages: [], thirdPartyOrigins: [], lcpCandidate: 'h1', status: 200 },
      { ttfbMs: 10, lcpMs: 100, cls: 0.01, totalBlockingTimeProxyMs: 5, htmlBytes: 120, domNodes: 12, requests: 4, transferBytes: 1200, scriptRequests: 2, scriptTransferBytes: 600, imageRequests: 1, imagesWithoutDimensions: 1, duplicateRequests: ['a.js'], consoleErrors: [], hydrationMessages: [], thirdPartyOrigins: [], lcpCandidate: 'img', status: 200 },
      { ttfbMs: 20, lcpMs: 200, cls: 0, totalBlockingTimeProxyMs: 0, htmlBytes: 110, domNodes: 11, requests: 3, transferBytes: 1100, scriptRequests: 1, scriptTransferBytes: 550, imageRequests: 1, imagesWithoutDimensions: 0, duplicateRequests: [], consoleErrors: [], hydrationMessages: [], thirdPartyOrigins: [], lcpCandidate: 'h1', status: 200 },
    ]);
    expect(summary.ttfbMs).toEqual({ median: 20, p95: null, max: 30 });
    expect(summary.imagesWithoutDimensions).toBe(1);
    expect(summary.duplicateRequests).toEqual(['a.js']);
  });

  it('keeps the route matrix limited to public fixture routes', async () => {
    const matrix = JSON.parse(await readFile('config/performance/phase-7-route-matrix.v1.json', 'utf8'));
    expect(matrix.routes.length).toBeGreaterThanOrEqual(10);
    expect(matrix.routes.some((route) => /admin|profile|checkout/.test(route.path))).toBe(false);
    expect(new Set(matrix.routes.map((route) => route.key)).size).toBe(matrix.routes.length);
  });

  it('keeps 404 routes explicit in the matrix instead of treating them as successful pages', async () => {
    const matrix = JSON.parse(await readFile('config/performance/phase-7-route-matrix.v1.json', 'utf8'));
    const notFound = matrix.routes.find((route) => route.key === 'not_found');
    expect(notFound).toMatchObject({ expectedStatus: 404, class: 'error' });
  });

  it('keeps real-data and field gates explicit in the versioned report', async () => {
    const report = await readFile('docs/seo/phase-7-performance-core-web-vitals-2026-08-23.md', 'utf8');
    for (const gate of [
      'PERFORMANCE_REAL_DATA_QUERY_VALIDATION_REQUIRED',
      'PERFORMANCE_REAL_DATA_EXPLAIN_REQUIRED',
      'CORE_WEB_VITALS_REAL_USER_VALIDATION_REQUIRED',
      'PRODUCTION_PERFORMANCE_SMOKE_REQUIRED',
      'CDN_CACHE_PRODUCTION_VALIDATION_REQUIRED',
      'FONT_DELIVERY_PRODUCTION_VALIDATION_REQUIRED',
      'IMAGE_DELIVERY_REAL_DATA_VALIDATION_REQUIRED',
    ]) {
      expect(report).toContain(gate);
    }
    expect(report).toContain('production DB writes = 0');
    expect(report).toContain('effective launch mode = PRELAUNCH');
  });
});

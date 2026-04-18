#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const DEFAULT_WEB_NEXT_BASE_URL = 'http://localhost:3001';
const DEFAULT_LEGACY_WEB_BASE_URL = 'http://localhost:3000';

const webNextBaseUrl = (process.env.WEB_NEXT_BASE_URL || DEFAULT_WEB_NEXT_BASE_URL).replace(/\/$/, '');
const legacyWebBaseUrl = (
  process.env.WEB_LEGACY_BASE_URL
  || process.env.NEXT_PUBLIC_LEGACY_WEB_URL
  || DEFAULT_LEGACY_WEB_BASE_URL
).replace(/\/$/, '');
const outputPath = process.env.WEB_NEXT_LEGACY_BRIDGE_CHECK_OUTPUT || '';

const routeChecks = [
  { source: '/auth?register=true&ref=bridge-check', expectedStatus: 200, type: 'render' },
  { source: '/auth?mode=login', expectedStatus: 200, type: 'render' },
  { source: '/dashboard?from=bridge-check', destination: `${webNextBaseUrl}/?from=bridge-check`, type: 'redirect' },
  { source: '/confirm-email?token=bridge-token', expectedStatus: 200, type: 'render' },
  { source: '/reset-password?token=bridge-token', expectedStatus: 200, type: 'render' },
  { source: '/concursos', expectedStatus: 200, type: 'render' },
  { source: '/practice', expectedStatus: 200, type: 'render' },
  { source: '/lei-comentada', expectedStatus: 200, type: 'render' },
  { source: '/flashcards', expectedStatus: 200, type: 'render' },
  { source: '/simulation', expectedStatus: 200, type: 'render' },
  { source: '/x-ray', expectedStatus: 200, type: 'render' },
  { source: '/marketplace', expectedStatus: 200, type: 'render' },
  { source: '/ranking', expectedStatus: 200, type: 'render' },
  { source: '/profile?tab=personal', expectedStatus: 200, type: 'render' },
  { source: '/profile/billing?tab=cards', expectedStatus: 200, type: 'render' },
  { source: '/performance/subjects', expectedStatus: 200, type: 'render' },
  { source: '/notifications', expectedStatus: 200, type: 'render' },
  { source: '/partner-dashboard', expectedStatus: 200, type: 'render' },
  { source: '/support', expectedStatus: 200, type: 'render' },
  { source: '/subscription/success', expectedStatus: 200, type: 'render' },
  { source: '/subscription/failure?source=bridge-check', expectedStatus: 200, type: 'render' },
  { source: '/subscription/pending?source=bridge-check', expectedStatus: 200, type: 'render' },
  { source: '/read/42', expectedStatus: 200, type: 'render' },
  { source: '/checkout/123', expectedStatus: 200, type: 'render' },
  { source: '/admin?section=overview', expectedStatus: 200, type: 'render' },
  { source: '/admin/settings/seo', expectedStatus: 200, type: 'render' },
];

const results = [];

const resolveWebNextUrl = (pathname) => new URL(pathname, `${webNextBaseUrl}/`).toString();
const normalizeLocation = (location) => {
  if (!location) {
    return '';
  }

  try {
    return new URL(location, `${webNextBaseUrl}/`).toString();
  } catch {
    return location;
  }
};

const addResult = (status, label, detail = '') => {
  results.push({ status, label, detail });
  const marker = status === 'ok' ? 'OK' : 'FAIL';
  console.log(`[${marker}] ${label}${detail ? ` - ${detail}` : ''}`);
};

const expectRedirect = async ({ source, destination }) => {
  try {
    const response = await fetch(resolveWebNextUrl(source), { redirect: 'manual' });
    if (![301, 302, 307, 308].includes(response.status)) {
      addResult('fail', `${source} status`, `expected redirect, got ${response.status}`);
      return;
    }

    const location = response.headers.get('location') || '';
    const normalizedLocation = normalizeLocation(location);
    if (normalizedLocation !== destination) {
      addResult('fail', `${source} redirect`, `expected ${destination}, got ${location || 'empty location'}`);
      return;
    }

    addResult('ok', `${source} redirect`, normalizedLocation);
  } catch (error) {
    addResult('fail', `${source} request`, error instanceof Error ? error.message : String(error));
  }
};

const expectRenderedRoute = async ({ source, expectedStatus }) => {
  try {
    const response = await fetch(resolveWebNextUrl(source), { redirect: 'manual' });

    if (response.status !== expectedStatus) {
      addResult('fail', `${source} status`, `expected ${expectedStatus}, got ${response.status}`);
      return;
    }

    addResult('ok', `${source} render`, `status ${response.status}`);
  } catch (error) {
    addResult('fail', `${source} request`, error instanceof Error ? error.message : String(error));
  }
};

for (const route of routeChecks) {
  // eslint-disable-next-line no-await-in-loop
  await (route.type === 'redirect' ? expectRedirect(route) : expectRenderedRoute(route));
}

const failures = results.filter((result) => result.status === 'fail');

if (outputPath) {
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, JSON.stringify({
    generatedAt: new Date().toISOString(),
    webNextBaseUrl,
    legacyWebBaseUrl,
      summary: {
        total: results.length,
      failures: failures.length,
      ok: results.filter((result) => result.status === 'ok').length,
    },
    results,
  }, null, 2));
}

if (failures.length > 0) {
  process.exitCode = 1;
} else {
  console.log(`[OK] legacy bridge coverage - ${routeChecks.length} routes validated`);
}

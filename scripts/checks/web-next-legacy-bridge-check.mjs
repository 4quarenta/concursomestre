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

const bridgeRoutes = [
  { source: '/auth?register=true&ref=bridge-check', destination: `${legacyWebBaseUrl}/auth?ref=bridge-check&mode=signup` },
  { source: '/auth?mode=login', destination: `${legacyWebBaseUrl}/auth?mode=login` },
  { source: '/dashboard?from=bridge-check', destination: `${legacyWebBaseUrl}/?from=bridge-check` },
  { source: '/confirm-email?token=bridge-token', destination: `${legacyWebBaseUrl}/confirm-email?token=bridge-token` },
  { source: '/reset-password?token=bridge-token', destination: `${legacyWebBaseUrl}/reset-password?token=bridge-token` },
  { source: '/concursos', destination: `${legacyWebBaseUrl}/concursos` },
  { source: '/practice', destination: `${legacyWebBaseUrl}/practice` },
  { source: '/lei-comentada', destination: `${legacyWebBaseUrl}/lei-comentada` },
  { source: '/flashcards', destination: `${legacyWebBaseUrl}/flashcards` },
  { source: '/simulation', destination: `${legacyWebBaseUrl}/simulation` },
  { source: '/x-ray', destination: `${legacyWebBaseUrl}/x-ray` },
  { source: '/marketplace', destination: `${legacyWebBaseUrl}/marketplace` },
  { source: '/ranking', destination: `${legacyWebBaseUrl}/ranking` },
  { source: '/profile?tab=personal', destination: `${legacyWebBaseUrl}/profile?tab=personal` },
  { source: '/profile/billing?tab=cards', destination: `${legacyWebBaseUrl}/profile/billing?tab=cards` },
  { source: '/performance/subjects', destination: `${legacyWebBaseUrl}/performance/subjects` },
  { source: '/notifications', destination: `${legacyWebBaseUrl}/notifications` },
  { source: '/partner-dashboard', destination: `${legacyWebBaseUrl}/partner-dashboard` },
  { source: '/support', destination: `${legacyWebBaseUrl}/support` },
  { source: '/subscription/success', destination: `${legacyWebBaseUrl}/subscription/success` },
  { source: '/subscription/failure?source=bridge-check', destination: `${legacyWebBaseUrl}/subscription/failure?source=bridge-check` },
  { source: '/subscription/pending?source=bridge-check', destination: `${legacyWebBaseUrl}/subscription/pending?source=bridge-check` },
  { source: '/read/42', destination: `${legacyWebBaseUrl}/read/42` },
  { source: '/checkout/123', destination: `${legacyWebBaseUrl}/checkout/123` },
  { source: '/admin?section=overview', destination: `${legacyWebBaseUrl}/admin?section=overview` },
  { source: '/admin/settings/seo', destination: `${legacyWebBaseUrl}/admin/settings/seo` },
];

const results = [];

const resolveWebNextUrl = (pathname) => new URL(pathname, `${webNextBaseUrl}/`).toString();

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
    if (location !== destination) {
      addResult('fail', `${source} redirect`, `expected ${destination}, got ${location || 'empty location'}`);
      return;
    }

    addResult('ok', `${source} redirect`, location);
  } catch (error) {
    addResult('fail', `${source} request`, error instanceof Error ? error.message : String(error));
  }
};

for (const route of bridgeRoutes) {
  // eslint-disable-next-line no-await-in-loop
  await expectRedirect(route);
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
  console.log(`[OK] legacy bridge coverage - ${bridgeRoutes.length} routes validated`);
}

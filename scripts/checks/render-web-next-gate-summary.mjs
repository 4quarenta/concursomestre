#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const [, , reportPathArg = ''] = process.argv;

if (!reportPathArg) {
  console.error('Usage: node scripts/checks/render-web-next-gate-summary.mjs <report-path>');
  process.exit(1);
}

const reportPath = path.resolve(reportPathArg);

if (!fs.existsSync(reportPath)) {
  console.error(`Report not found: ${reportPath}`);
  process.exit(1);
}

const rawReport = fs.readFileSync(reportPath, 'utf8').replace(/^\uFEFF/, '');
const report = JSON.parse(rawReport);

const firstItems = (items, limit = 10) => items.slice(0, limit);
const formatLine = (label, value) => `- **${label}:** ${value}`;
const hasOwn = (object, key) => Object.prototype.hasOwnProperty.call(object, key);

const lines = [];

if (hasOwn(report, 'reports') && hasOwn(report, 'summary') && hasOwn(report.summary, 'cutover')) {
  lines.push('## Web Next Hybrid Gate Report');
  lines.push('');
  lines.push(formatLine('Status', report.summary.passed ? 'passed' : 'failed'));
  lines.push(formatLine('Generated at', report.generatedAt || 'unknown'));
  lines.push(formatLine('Web Next base URL', report.webNextBaseUrl || 'unknown'));
  lines.push(formatLine('Legacy web base URL', report.legacyWebBaseUrl || 'unknown'));
  lines.push('');
  lines.push('### Totals');
  lines.push('');
  lines.push(formatLine('Cutover ok', String(report.summary.cutover.ok)));
  lines.push(formatLine('Cutover skip', String(report.summary.cutover.skip)));
  lines.push(formatLine('Cutover fail', String(report.summary.cutover.fail)));
  lines.push(formatLine('Legacy bridge ok', String(report.summary.legacyBridge.ok)));
  lines.push(formatLine('Legacy bridge fail', String(report.summary.legacyBridge.fail)));
  lines.push('');
} else if (
  hasOwn(report, 'webNextBaseUrl')
  && hasOwn(report, 'legacyWebBaseUrl')
  && hasOwn(report, 'summary')
  && hasOwn(report.summary, 'failures')
) {
  const okCount = Number(report.summary?.ok ?? 0);
  const failCount = Number(report.summary?.failures ?? 0);
  const totalCount = Number(report.summary?.total ?? okCount + failCount);
  const passed = failCount === 0;

  lines.push('## Web Next Legacy Bridge Check');
  lines.push('');
  lines.push(formatLine('Status', passed ? 'passed' : 'failed'));
  lines.push(formatLine('Generated at', report.generatedAt || 'unknown'));
  lines.push(formatLine('Web Next base URL', report.webNextBaseUrl || 'unknown'));
  lines.push(formatLine('Legacy web base URL', report.legacyWebBaseUrl || 'unknown'));
  lines.push('');
  lines.push('### Totals');
  lines.push('');
  lines.push(formatLine('OK', String(okCount)));
  lines.push(formatLine('Fail', String(failCount)));
  lines.push(formatLine('Total', String(totalCount)));
  lines.push('');

  const results = Array.isArray(report.results) ? report.results : [];
  const failures = results.filter((result) => result.status === 'fail');

  if (failures.length > 0) {
    lines.push('### Failures');
    lines.push('');
    for (const failure of firstItems(failures)) {
      lines.push(`- \`${failure.label}\`${failure.detail ? `: ${failure.detail}` : ''}`);
    }
    lines.push('');
  }
} else {
  const okCount = Number(report.summary?.ok ?? 0);
  const skipCount = Number(report.summary?.skip ?? 0);
  const failCount = Number(report.summary?.fail ?? report.summary?.failures ?? 0);
  const totalCount = Number(report.summary?.total ?? okCount + skipCount + failCount);
  const passed = typeof report.passed === 'boolean' ? report.passed : failCount === 0;

  lines.push('## Web Next Environment Gate');
  lines.push('');
  lines.push(formatLine('Status', passed ? 'passed' : 'failed'));
  lines.push(formatLine('Generated at', report.generatedAt || 'unknown'));
  lines.push(formatLine('Base URL', report.baseUrl || report.webNextBaseUrl || 'unknown'));

  if (report.expectedCanonicalBaseUrl) {
    lines.push(formatLine('Expected canonical base URL', report.expectedCanonicalBaseUrl));
  }

  if (typeof report.requireEntityIds === 'boolean') {
    lines.push(formatLine('Strict entity IDs', report.requireEntityIds ? 'enabled' : 'disabled'));
  }

  lines.push('');
  lines.push('### Totals');
  lines.push('');
  lines.push(formatLine('OK', String(okCount)));
  lines.push(formatLine('Skip', String(skipCount)));
  lines.push(formatLine('Fail', String(failCount)));
  lines.push(formatLine('Total', String(totalCount)));
  lines.push('');

  const results = Array.isArray(report.results) ? report.results : [];
  const failures = results.filter((result) => result.status === 'fail');
  const skips = results.filter((result) => result.status === 'skip');

  if (failures.length > 0) {
    lines.push('### Failures');
    lines.push('');
    for (const failure of firstItems(failures)) {
      lines.push(`- \`${failure.label}\`${failure.detail ? `: ${failure.detail}` : ''}`);
    }
    lines.push('');
  }

  if (skips.length > 0) {
    lines.push('### Skips');
    lines.push('');
    for (const skip of firstItems(skips)) {
      lines.push(`- \`${skip.label}\`${skip.detail ? `: ${skip.detail}` : ''}`);
    }
    lines.push('');
  }
}

process.stdout.write(`${lines.join('\n')}\n`);

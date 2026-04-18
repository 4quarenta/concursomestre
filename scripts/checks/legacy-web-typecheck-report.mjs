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

import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { spawnSync } from 'node:child_process';

const repoRoot = process.cwd();
const outputPath = path.resolve(
  process.env.LEGACY_WEB_TYPECHECK_REPORT_OUTPUT || 'docs/reports/legacy-web-typecheck-report-latest.json',
);
const localTscExecutable = process.platform === 'win32'
  ? path.join(repoRoot, 'node_modules', '.bin', 'tsc.cmd')
  : path.join(repoRoot, 'node_modules', '.bin', 'tsc');

/**
 * Resolve o caminho do resumo Markdown a partir do JSON.
 *
 * @since 1.0.0
 */
function getSummaryPath(jsonPath) {
  const directory = path.dirname(jsonPath);
  const fileName = path.basename(jsonPath, path.extname(jsonPath));
  return path.join(directory, `${fileName}.summary.md`);
}

/**
 * Normaliza o agrupamento principal para leitura operacional.
 *
 * @since 1.0.0
 */
function getDomainFromFile(filePath) {
  const normalizedPath = filePath.replaceAll('\\', '/');

  if (normalizedPath.startsWith('src/app/')) {
    const segments = normalizedPath.split('/');
    return segments.length >= 3 ? `app/${segments[2]}` : 'app';
  }

  if (normalizedPath.startsWith('src/services/')) {
    const segments = normalizedPath.split('/');
    return segments.length >= 3 ? `services/${segments[2]}` : 'services';
  }

  if (normalizedPath.startsWith('src/components/shared/')) {
    const segments = normalizedPath.split('/');
    return segments.length >= 4 ? `components/shared/${segments[3]}` : 'components/shared';
  }

  if (normalizedPath.startsWith('src/providers/')) {
    return 'providers';
  }

  if (normalizedPath.startsWith('src/router/')) {
    return 'router';
  }

  if (normalizedPath.startsWith('src/')) {
    const segments = normalizedPath.split('/');
    return segments.length >= 2 ? segments.slice(0, 2).join('/') : 'src';
  }

  return 'other';
}

/**
 * Ordena entradas numericas de forma decrescente e previsivel.
 *
 * @since 1.0.0
 */
function sortCountEntries(entries) {
  return entries.sort((left, right) => {
    if (right.count !== left.count) {
      return right.count - left.count;
    }

    return left.name.localeCompare(right.name);
  });
}

/**
 * Monta o resumo Markdown consumivel na documentacao operacional.
 *
 * @since 1.0.0
 */
function buildSummary(report) {
  const topDomains = report.grouped.byDomain.slice(0, 10);
  const topFiles = report.grouped.byFile.slice(0, 10);
  const topCodes = report.grouped.byCode.slice(0, 10);
  const sampleErrors = report.errors.slice(0, 15);

  return [
    '# Legacy Web Typecheck Report',
    '',
    `- **Generated at:** ${report.generatedAt}`,
    `- **Status:** ${report.status}`,
    `- **Command exit code:** ${report.command.exitCode}`,
    `- **Total errors:** ${report.summary.totalErrors}`,
    `- **Affected files:** ${report.summary.affectedFiles}`,
    `- **Affected domains:** ${report.summary.affectedDomains}`,
    '',
    '## Top Domains',
    '',
    ...topDomains.map((entry) => `- \`${entry.name}\`: ${entry.count}`),
    '',
    '## Top Files',
    '',
    ...topFiles.map((entry) => `- \`${entry.name}\`: ${entry.count}`),
    '',
    '## Top Error Codes',
    '',
    ...topCodes.map((entry) => `- \`${entry.name}\`: ${entry.count}`),
    '',
    '## Sample Errors',
    '',
    ...sampleErrors.map(
      (entry) => `- \`${entry.file}:${entry.line}:${entry.column}\` ${entry.code}: ${entry.message}`,
    ),
    '',
  ].join('\n');
}

const command = spawnSync(
  localTscExecutable,
  ['--noEmit', '-p', 'tsconfig.legacy.json', '--pretty', 'false'],
  {
    cwd: repoRoot,
    encoding: 'utf8',
    maxBuffer: 1024 * 1024 * 16,
    shell: process.platform === 'win32',
  },
);

const rawOutput = `${command.stdout || ''}${command.stderr || ''}`;
const errorPattern = /^(?<file>.+?)\((?<line>\d+),(?<column>\d+)\): error (?<code>TS\d+): (?<message>.+)$/gm;
const errors = [];

for (const match of rawOutput.matchAll(errorPattern)) {
  const file = match.groups?.file?.trim() || 'unknown';
  const line = Number(match.groups?.line || 0);
  const column = Number(match.groups?.column || 0);
  const code = match.groups?.code?.trim() || 'unknown';
  const message = match.groups?.message?.trim() || 'unknown';
  const domain = getDomainFromFile(file);

  errors.push({
    file,
    line,
    column,
    code,
    message,
    domain,
  });
}

const byDomainMap = new Map();
const byFileMap = new Map();
const byCodeMap = new Map();

for (const error of errors) {
  byDomainMap.set(error.domain, (byDomainMap.get(error.domain) || 0) + 1);
  byFileMap.set(error.file, (byFileMap.get(error.file) || 0) + 1);
  byCodeMap.set(error.code, (byCodeMap.get(error.code) || 0) + 1);
}

const report = {
  generatedAt: new Date().toISOString(),
  status: command.status === 0 ? 'clean' : errors.length > 0 ? 'type-errors-found' : 'command-failed',
  command: {
    executable: localTscExecutable,
    args: ['--noEmit', '-p', 'tsconfig.legacy.json', '--pretty', 'false'],
    exitCode: command.status ?? -1,
    spawnError: command.error?.message || '',
  },
  summary: {
    totalErrors: errors.length,
    affectedFiles: new Set(errors.map((error) => error.file)).size,
    affectedDomains: new Set(errors.map((error) => error.domain)).size,
  },
  grouped: {
    byDomain: sortCountEntries(
      Array.from(byDomainMap.entries(), ([name, count]) => ({ name, count })),
    ),
    byFile: sortCountEntries(
      Array.from(byFileMap.entries(), ([name, count]) => ({ name, count })),
    ),
    byCode: sortCountEntries(
      Array.from(byCodeMap.entries(), ([name, count]) => ({ name, count })),
    ),
  },
  errors,
  rawOutput,
};

const summaryPath = getSummaryPath(outputPath);
fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
fs.writeFileSync(summaryPath, `${buildSummary(report)}\n`, 'utf8');

console.log(JSON.stringify({
  outputPath,
  summaryPath,
  status: report.status,
  summary: report.summary,
}, null, 2));

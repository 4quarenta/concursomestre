#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const failures = [];
const requiredFiles = [
  'package.json',
  'package-lock.json',
  'release-manifest.json',
  'contracts/legal/legal-document-versions.v1.json',
  'backend/api/system/health.php',
  'backend/api/system/readiness.php',
  'backend/scripts/migrations/run_schema_migrations.php',
  'backend/scripts/tasks/production_preflight.php',
  'backend/scripts/tasks/production_readiness_suite.php',
  'backend/scripts/workers/process_question_ingestion_jobs.php',
  'backend/scripts/tasks/process_stripe_webhook_jobs.php',
  'backend/shared/legal/LegalDocumentVersion.php',
  'backend/shared/legal/LegalAcceptance.php',
  'scripts/release/verify-release-manifest.mjs',
];

for (const relativePath of requiredFiles) {
  if (!fs.existsSync(path.join(root, relativePath))) failures.push(`Arquivo obrigatorio ausente: ${relativePath}`);
}

const forbiddenDirectories = new Set(['.git', '.next', '.tmp', '.turbo', 'coverage', 'node_modules']);
const forbiddenEnvironmentFiles = new Set(['.env', '.env.local', '.env.production', '.env.staging']);
const forbiddenExtensions = new Set(['.bak', '.dump', '.key', '.log', '.p12', '.pem', '.pfx']);
const forbiddenRuntimePaths = [
  /^(?:docs|mobile|tools)(?:\/|$)/i,
  /^backend\/tests(?:\/|$)/i,
  /^backend\/database\/rollbacks(?:\/|$)/i,
  /^scripts\/(?:deploy|data|performance|seo)(?:\/|$)/i,
  /(?:^|\/)(?:__tests__|__mocks__)(?:\/|$)/i,
  /(?:^|\/)[^/]+\.(?:test|spec)\.[^/]+$/i,
  /(?:^|\/)(?:\.env|\.env\.[^/]+|[^/]+\.example)$/i,
];
let fileCount = 0;
let totalBytes = 0;

const walk = (directory) => {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const absolutePath = path.join(directory, entry.name);
    const relativePath = path.relative(root, absolutePath).replaceAll('\\', '/');
    if (entry.isSymbolicLink()) {
      failures.push(`Link simbolico no pacote: ${relativePath}`);
      continue;
    }
    if (entry.isDirectory()) {
      if (forbiddenDirectories.has(entry.name)) {
        failures.push(`Diretorio proibido: ${relativePath}`);
        continue;
      }
      walk(absolutePath);
      continue;
    }
    if (!entry.isFile()) continue;
    fileCount += 1;
    totalBytes += fs.statSync(absolutePath).size;
    if (forbiddenRuntimePaths.some((pattern) => pattern.test(relativePath))) failures.push(`Arquivo fora do runtime: ${relativePath}`);
    if (forbiddenEnvironmentFiles.has(entry.name)) failures.push(`Ambiente real incluido: ${relativePath}`);
    if (forbiddenExtensions.has(path.extname(entry.name).toLowerCase())) failures.push(`Artefato sensivel: ${relativePath}`);
    const isPublicDownloadArchive = /^public\/downloads\/[^/]+\.zip$/i.test(relativePath);
    if (/\.(zip|tar|tar\.gz|tgz|gz|7z|rar)$/i.test(entry.name) && !isPublicDownloadArchive) failures.push(`Arquivo compactado aninhado: ${relativePath}`);
    if (/^(dump|backup|database|production-data).*\.sql$/i.test(entry.name)) failures.push(`Possivel dump incluido: ${relativePath}`);
  }
};
walk(root);

const packageJson = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const manifest = fs.existsSync(path.join(root, 'release-manifest.json'))
  ? JSON.parse(fs.readFileSync(path.join(root, 'release-manifest.json'), 'utf8'))
  : {};
if (String(packageJson.version || '') !== String(manifest.version || '')) failures.push('Versao do manifesto diverge do package.json.');

const runGate = (script) => {
  const result = spawnSync(process.execPath, [script], { cwd: root, encoding: 'utf8', shell: false });
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  if (result.status !== 0) failures.push(`Gate falhou: ${script}`);
};
runGate('scripts/release/verify-release-manifest.mjs');
runGate('scripts/checks/check-versioned-secrets.mjs');
runGate('scripts/checks/check-source-size-budget.mjs');

if (totalBytes > 150 * 1024 * 1024) failures.push(`Pacote excede 150 MiB: ${(totalBytes / 1024 / 1024).toFixed(1)} MiB.`);
if (failures.length > 0) {
  console.error('[release-package] FAIL');
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}
console.log(`[release-package] PASS: ${fileCount} arquivos; ${(totalBytes / 1024 / 1024).toFixed(2)} MiB.`);

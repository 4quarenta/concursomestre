#!/usr/bin/env node

import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const args = new Map(process.argv.slice(2).map((argument) => {
  const [name, ...parts] = argument.replace(/^--/, '').split('=');
  return [name, parts.join('=')];
}));
const packageJson = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8'));
const hashFile = (filePath) => crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
const git = (...gitArgs) => execFileSync('git', gitArgs, { cwd: root, encoding: 'utf8' }).trim();

const criticalFiles = [
  'package.json',
  'package-lock.json',
  'next.config.ts',
  'tsconfig.strict.json',
  'tsconfig.no-unchecked.json',
  'contracts/legal/legal-document-versions.v1.json',
  'backend/scripts/migrations/run_schema_migrations.php',
  'backend/scripts/tasks/production_preflight.php',
  'backend/scripts/tasks/production_readiness_suite.php',
  'backend/scripts/workers/process_question_ingestion_jobs.php',
  'backend/scripts/tasks/process_stripe_webhook_jobs.php',
  'backend/shared/observability/RequestContext.php',
  'backend/shared/health/SystemHealthService.php',
  'backend/shared/health/ReleaseMetadata.php',
  'backend/shared/http/Request.php',
  'backend/shared/http/ApiResponse.php',
  'backend/shared/http/LegacyEndpointDeprecation.php',
  'backend/shared/responses/ApiEnvelope.php',
  'backend/shared/runtime/RuntimeStoreFactory.php',
  'backend/shared/legal/LegalDocumentVersion.php',
  'backend/shared/legal/LegalAcceptance.php',
  'backend/modules/questions/services/QuestionsService.php',
  'backend/modules/questions/repositories/QuestionsRepository.php',
  'backend/modules/subscriptions/services/SubscriptionsService.php',
  'backend/modules/subscriptions/services/CanonicalPlanChangeService.php',
  'scripts/checks/production-readiness-local.mjs',
  'scripts/checks/check-versioned-secrets.mjs',
  'scripts/checks/check-release-package.mjs',
  'scripts/checks/check-source-size-budget.mjs',
  'scripts/release/generate-release-manifest.mjs',
  'scripts/release/verify-release-manifest.mjs',
];

const migrationDirectory = path.join(root, 'backend/database/migrations');
const migrationFiles = fs.readdirSync(migrationDirectory)
  .filter((name) => /\.(php|sql)$/i.test(name))
  .sort()
  .map((name) => `backend/database/migrations/${name}`);

for (const relativePath of criticalFiles) {
  if (!fs.existsSync(path.join(root, relativePath))) {
    throw new Error(`Arquivo critico ausente: ${relativePath}`);
  }
}

let commit = args.get('commit') || process.env.APP_RELEASE_COMMIT || 'unknown';
let dirty = true;
try {
  if (commit === 'unknown') commit = git('rev-parse', 'HEAD');
  dirty = git('status', '--porcelain').length > 0;
} catch {
  // O verificador reprova commit desconhecido antes de um deploy real.
}

const files = Object.fromEntries(criticalFiles.map((relativePath) => [
  relativePath,
  hashFile(path.join(root, relativePath)),
]));
const migrations = Object.fromEntries(migrationFiles.map((relativePath) => [
  relativePath,
  hashFile(path.join(root, relativePath)),
]));

const manifest = {
  schemaVersion: 1,
  product: 'ConcursoMestre',
  version: String(packageJson.version || '1.0.0'),
  revision: args.get('revision') || process.env.APP_RELEASE_REVISION || 'selective-r6.1',
  commit,
  gitDirty: dirty,
  generatedAt: new Date().toISOString(),
  runtime: {
    node: process.version,
    nodeMinimum: '20.19.0',
    phpMinimum: '8.2',
  },
  database: { migrations },
  files,
};

fs.writeFileSync(path.join(root, 'release-manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
console.log(`[release-manifest] ${manifest.version} ${manifest.commit.slice(0, 12)}; ${Object.keys(files).length} arquivos; ${migrationFiles.length} migrations; dirty=${dirty}.`);

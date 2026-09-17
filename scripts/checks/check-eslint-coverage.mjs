import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const eslintBin = path.join(root, 'node_modules/eslint/bin/eslint.js');
const outputDir = path.join(root, '.tmp/eslint-manifest');
const extensions = /\.(?:cjs|cts|js|jsx|mjs|mts|ts|tsx)$/i;
const excludedPrefixes = [
  '.codex/',
  '.codex-tmp/',
  '.next/',
  'build/',
  'coverage/',
  'mobile/',
  'out/',
  'release/',
  '.tmp/',
];

const normalize = (value) => value.replaceAll('\\', '/');

const trackedFiles = spawnSync('git', ['ls-files', '-z'], {
  cwd: root,
  encoding: 'buffer',
  stdio: ['ignore', 'pipe', 'inherit'],
});

if (trackedFiles.status !== 0) {
  throw new Error('Nao foi possivel obter o manifesto de arquivos rastreados.');
}

const files = trackedFiles.stdout
  .toString('utf8')
  .split('\0')
  .filter(Boolean)
  .map(normalize)
  .filter((file) => extensions.test(file))
  .filter((file) => file !== 'next-env.d.ts' && !file.endsWith('/next-env.d.ts'))
  .filter((file) => !excludedPrefixes.some((prefix) => file.startsWith(prefix)));

if (!fs.existsSync(eslintBin)) {
  throw new Error(`ESLint nao encontrado: ${eslintBin}`);
}

fs.mkdirSync(outputDir, { recursive: true });
for (const entry of fs.readdirSync(outputDir)) {
  fs.rmSync(path.join(outputDir, entry), { recursive: true, force: true });
}

const batchSize = 96;
const lintedFiles = [];
const batches = [];
let eslintErrors = 0;
let eslintWarnings = 0;
let processFailures = 0;

for (let offset = 0; offset < files.length; offset += batchSize) {
  const batch = files.slice(offset, offset + batchSize);
  const batchNumber = Math.floor(offset / batchSize) + 1;
  const resultPath = path.join(outputDir, `batch-${String(batchNumber).padStart(3, '0')}.json`);
  const result = spawnSync(process.execPath, [
    eslintBin,
    '--no-cache',
    '--format',
    'json',
    '--no-warn-ignored',
    '--output-file',
    resultPath,
    ...batch,
  ], {
    cwd: root,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  if (!fs.existsSync(resultPath)) {
    throw new Error(`ESLint nao gerou resultado para o lote ${batchNumber}. ${result.stderr}`);
  }

  const diagnostics = JSON.parse(fs.readFileSync(resultPath, 'utf8'));
  const errors = diagnostics.reduce((sum, item) => sum + item.errorCount, 0);
  const warnings = diagnostics.reduce((sum, item) => sum + item.warningCount, 0);
  eslintErrors += errors;
  eslintWarnings += warnings;
  lintedFiles.push(...diagnostics.map((item) => path.relative(root, item.filePath)));
  if (result.status !== 0) {
    processFailures += 1;
  }
  batches.push({
    batch: batchNumber,
    expected: batch.length,
    reported: diagnostics.length,
    errors,
    warnings,
    exitCode: result.status,
  });
}

const expected = new Set(files.map(normalize));
const uniqueLinted = new Set(lintedFiles.map(normalize));
const missing = [...expected].filter((file) => !uniqueLinted.has(file));
const report = {
  expectedLintFiles: expected.size,
  uniqueLintedFiles: uniqueLinted.size,
  missingLintFiles: missing.length,
  missing,
  eslintErrors,
  eslintWarnings,
  processFailures,
  batches,
};

fs.writeFileSync(path.join(outputDir, 'report.json'), `${JSON.stringify(report, null, 2)}\n`, 'utf8');
console.log(JSON.stringify(report));

if (missing.length > 0 || eslintErrors > 0 || processFailures > 0) {
  process.exitCode = 1;
}

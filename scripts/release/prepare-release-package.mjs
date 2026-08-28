#!/usr/bin/env node

import { spawnSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const args = new Map(process.argv.slice(2).map((argument) => {
  const [name, ...parts] = argument.replace(/^--/, '').split('=');
  return [name, parts.join('=')];
}));

const outputPath = args.get('output');
if (!outputPath) {
  throw new Error('Informe --output=<diretorio limpo do pacote>.');
}

const output = path.resolve(root, outputPath);
const archive = args.get('archive') ? path.resolve(root, args.get('archive')) : null;
const commit = args.get('commit') || process.env.APP_RELEASE_COMMIT || 'HEAD';
const revision = args.get('revision') || process.env.APP_RELEASE_REVISION || 'release';

const run = (command, commandArgs, options = {}) => {
  const result = spawnSync(command, commandArgs, {
    cwd: options.cwd || root,
    encoding: 'utf8',
    shell: false,
    stdio: options.stdio || 'pipe',
  });
  if (result.status !== 0) {
    throw new Error(`${command} ${commandArgs.join(' ')} falhou${result.stderr ? `: ${result.stderr.trim()}` : '.'}`);
  }
  return result.stdout || '';
};

const trackedFiles = run('git', ['ls-files', '-z'])
  .split('\0')
  .filter(Boolean);

const isReleaseArchive = (relativePath) => {
  const normalized = relativePath.replaceAll('\\', '/');
  if (/^public\/downloads\/[^/]+\.zip$/i.test(normalized)) return false;
  return /\.(zip|tar|tar\.gz|tgz|gz|7z|rar)$/i.test(normalized);
};

const isExcluded = (relativePath) => {
  const normalized = relativePath.replaceAll('\\', '/');
  return /^(?:\.codex-tmp|\.deploy|\.tmp|backups|quarantine)(?:\/|$)/i.test(normalized)
    || isReleaseArchive(normalized);
};

const includedFiles = trackedFiles.filter((relativePath) => !isExcluded(relativePath));
const excludedFiles = trackedFiles.filter((relativePath) => isExcluded(relativePath));

if (fs.existsSync(output)) {
  const existing = fs.readdirSync(output);
  if (existing.length > 0) {
    throw new Error(`Diretorio de saida nao esta vazio: ${path.relative(root, output)}`);
  }
} else {
  fs.mkdirSync(output, { recursive: true });
}

for (const relativePath of includedFiles) {
  const source = path.join(root, relativePath);
  const destination = path.join(output, relativePath);
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.copyFileSync(source, destination);
  fs.chmodSync(destination, fs.statSync(source).mode & 0o777);
}

run(process.execPath, [
  'scripts/release/generate-release-manifest.mjs',
  `--commit=${commit}`,
  `--revision=${revision}`,
], { cwd: output, stdio: 'inherit' });

run(process.execPath, ['scripts/checks/check-release-package.mjs'], { cwd: output, stdio: 'inherit' });

if (archive) {
  fs.mkdirSync(path.dirname(archive), { recursive: true });
  run('tar', ['-a', '-c', '-f', archive, '-C', output, '.']);
}

const totalBytes = includedFiles.reduce((total, relativePath) => total + fs.statSync(path.join(output, relativePath)).size, 0);
const fingerprint = crypto.createHash('sha256')
  .update(includedFiles.join('\n'))
  .update('\0')
  .update(excludedFiles.join('\n'))
  .digest('hex');

console.log(JSON.stringify({
  output: path.relative(root, output).replaceAll('\\', '/'),
  archive: archive ? path.relative(root, archive).replaceAll('\\', '/') : null,
  includedFiles: includedFiles.length,
  excludedFiles: excludedFiles.length,
  excludedArchives: excludedFiles.filter(isReleaseArchive),
  totalBytes,
  fingerprint,
}, null, 2));

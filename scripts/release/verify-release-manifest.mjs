#!/usr/bin/env node

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const manifestPath = path.join(root, 'release-manifest.json');
const failures = [];
const hashFile = (filePath) => crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');

if (!fs.existsSync(manifestPath)) {
  console.error('[release-manifest] release-manifest.json ausente.');
  process.exit(1);
}

const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
if (manifest.schemaVersion !== 1 || manifest.product !== 'ConcursoMestre') failures.push('Cabecalho invalido.');
if (!/^\d+\.\d+\.\d+$/.test(String(manifest.version || ''))) failures.push('Versao sem SemVer.');
if (!/^[a-f0-9]{7,64}$/i.test(String(manifest.commit || ''))) failures.push('Commit invalido.');
if (manifest.gitDirty !== false) failures.push('Manifesto nao representa uma arvore canonica limpa.');

const verifyMap = (entries, label) => {
  for (const [relativePath, expectedHash] of Object.entries(entries || {})) {
    const absolutePath = path.join(root, relativePath);
    if (!fs.existsSync(absolutePath)) {
      failures.push(`${label} ausente: ${relativePath}`);
      continue;
    }
    if (hashFile(absolutePath) !== expectedHash) failures.push(`Checksum divergente: ${relativePath}`);
  }
};

verifyMap(manifest.files, 'Arquivo critico');
verifyMap(manifest.database?.migrations, 'Migration');

const actualMigrations = fs.readdirSync(path.join(root, 'backend/database/migrations'))
  .filter((name) => /\.(php|sql)$/i.test(name))
  .sort()
  .map((name) => `backend/database/migrations/${name}`);
const expectedMigrations = Object.keys(manifest.database?.migrations || {}).sort();
if (JSON.stringify(actualMigrations) !== JSON.stringify(expectedMigrations)) {
  failures.push('Lista de migrations diverge do manifesto.');
}

if (failures.length > 0) {
  console.error('[release-manifest] FAIL');
  failures.forEach((failure) => console.error(`- ${failure}`));
  process.exit(1);
}

console.log(`[release-manifest] PASS: ${Object.keys(manifest.files || {}).length} arquivos e ${expectedMigrations.length} migrations.`);

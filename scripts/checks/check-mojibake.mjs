#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const backendRoot = process.env.BACKEND_ROOT
  ? path.resolve(process.env.BACKEND_ROOT)
  : path.resolve('C:/xampp/htdocs/questao-pro-backend');

const roots = [
  path.resolve('src'),
  path.resolve('docs'),
  backendRoot,
];

const exts = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.json', '.md', '.php', '.sql', '.txt']);
const ignoredPathFragments = ['node_modules', '.git', 'dist', 'docs\\legacy\\workspace-backups', '\\vendor\\'];

const suspectTokens = [
  'Ã¡', 'Ã¢', 'Ã£', 'Ã¤', 'Ã©', 'Ãª', 'Ã­', 'Ã³', 'Ã´', 'Ãµ', 'Ãº', 'Ã§',
  'Ã€', 'Ã', 'Ã‚', 'Ãƒ', 'Ã„', 'Ã‰', 'ÃŠ', 'Ã', 'Ã“', 'Ã”', 'Ã•', 'Ãš', 'Ã‡',
  'Ã ', 'Â ', 'Â', 'â€™', 'â€œ', 'â€\u009d', 'â€"', 'â€', 'â€“', 'â€”', 'â€¢',
];

const findings = [];

function shouldIgnore(filePath) {
  const normalized = filePath.replace(/\//g, '\\').toLowerCase();
  return ignoredPathFragments.some((fragment) => normalized.includes(fragment.toLowerCase()));
}

function scanFile(filePath) {
  const raw = fs.readFileSync(filePath, 'utf8');
  const lines = raw.split(/\r?\n/);

  lines.forEach((line, index) => {
    for (const token of suspectTokens) {
      if (line.includes(token)) {
        findings.push({
          file: filePath,
          line: index + 1,
          token,
          sample: line.trim().slice(0, 180),
        });
        break;
      }
    }
  });
}

function walk(currentPath) {
  if (!fs.existsSync(currentPath)) return;

  const stat = fs.statSync(currentPath);
  if (stat.isFile()) {
    const ext = path.extname(currentPath).toLowerCase();
    if (exts.has(ext) && !shouldIgnore(currentPath)) {
      scanFile(currentPath);
    }
    return;
  }

  const entries = fs.readdirSync(currentPath, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(currentPath, entry.name);
    if (entry.isDirectory()) {
      if (!shouldIgnore(full)) {
        walk(full);
      }
      continue;
    }
    const ext = path.extname(entry.name).toLowerCase();
    if (exts.has(ext) && !shouldIgnore(full)) {
      scanFile(full);
    }
  }
}

for (const root of roots) {
  walk(root);
}

if (findings.length > 0) {
  console.error('Mojibake detectado. Corrija os textos antes de continuar.');
  findings.slice(0, 200).forEach((item) => {
    console.error(`- ${item.file}:${item.line} [${item.token}] ${item.sample}`);
  });

  if (findings.length > 200) {
    console.error(`... e mais ${findings.length - 200} ocorrencias.`);
  }
  process.exit(1);
}

console.log('OK: nenhum mojibake detectado.');

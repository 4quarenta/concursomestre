#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';

const backendRoot = process.env.BACKEND_ROOT
  ? path.resolve(process.env.BACKEND_ROOT)
  : path.resolve('backend');

const roots = [
  path.resolve('src'),
  backendRoot,
  path.resolve('docs'),
];

const exts = new Set(['.ts', '.tsx', '.js', '.jsx', '.mjs', '.json', '.md', '.php', '.sql', '.txt']);
const ignoredPathFragments = ['node_modules', '.git', 'dist', '\\vendor\\'];

const replacements = new Map([
  ['Ã€', 'À'], ['Ã', 'Á'], ['Ã‚', 'Â'], ['Ãƒ', 'Ã'], ['Ã„', 'Ä'], ['Ã…', 'Å'],
  ['Ã‡', 'Ç'], ['Ãˆ', 'È'], ['Ã‰', 'É'], ['ÃŠ', 'Ê'], ['Ã‹', 'Ë'],
  ['ÃŒ', 'Ì'], ['Ã', 'Í'], ['ÃŽ', 'Î'], ['Ã', 'Ï'],
  ['Ã‘', 'Ñ'], ['Ã’', 'Ò'], ['Ã“', 'Ó'], ['Ã”', 'Ô'], ['Ã•', 'Õ'], ['Ã–', 'Ö'],
  ['Ã™', 'Ù'], ['Ãš', 'Ú'], ['Ã›', 'Û'], ['Ãœ', 'Ü'],
  ['Ã ', 'à'], ['Ã¡', 'á'], ['Ã¢', 'â'], ['Ã£', 'ã'], ['Ã¤', 'ä'], ['Ã¥', 'å'],
  ['Ã§', 'ç'], ['Ã¨', 'è'], ['Ã©', 'é'], ['Ãª', 'ê'], ['Ã«', 'ë'],
  ['Ã¬', 'ì'], ['Ã­', 'í'], ['Ã®', 'î'], ['Ã¯', 'ï'],
  ['Ã±', 'ñ'], ['Ã²', 'ò'], ['Ã³', 'ó'], ['Ã´', 'ô'], ['Ãµ', 'õ'], ['Ã¶', 'ö'],
  ['Ã¹', 'ù'], ['Ãº', 'ú'], ['Ã»', 'û'], ['Ã¼', 'ü'],
  ['Ã¿', 'ÿ'], ['Ã ', 'à'],
  ['â€™', '\''], ['â€˜', '\''], ['â€œ', '"'], ['â€\u009d', '"'], ['â€"', '"'],
  ['â€“', '-'], ['â€”', '-'], ['â€¢', '*'],
  ['Â ', ' '],
]);

function shouldIgnore(filePath) {
  const normalized = filePath.replace(/\//g, '\\').toLowerCase();
  return ignoredPathFragments.some((fragment) => normalized.includes(fragment.toLowerCase()));
}

function applyReplacements(content) {
  let output = content;
  for (const [from, to] of replacements.entries()) {
    if (output.includes(from)) {
      output = output.split(from).join(to);
    }
  }
  return output;
}

let changedFiles = 0;

function processFile(filePath) {
  const original = fs.readFileSync(filePath, 'utf8');
  const updated = applyReplacements(original);
  if (updated !== original) {
    fs.writeFileSync(filePath, updated, 'utf8');
    changedFiles += 1;
    console.log(`fixed: ${filePath}`);
  }
}

function walk(currentPath) {
  if (!fs.existsSync(currentPath)) return;
  const stat = fs.statSync(currentPath);
  if (stat.isFile()) {
    const ext = path.extname(currentPath).toLowerCase();
    if (exts.has(ext) && !shouldIgnore(currentPath)) {
      processFile(currentPath);
    }
    return;
  }

  for (const entry of fs.readdirSync(currentPath, { withFileTypes: true })) {
    const full = path.join(currentPath, entry.name);
    if (entry.isDirectory()) {
      if (!shouldIgnore(full)) walk(full);
      continue;
    }
    const ext = path.extname(entry.name).toLowerCase();
    if (exts.has(ext) && !shouldIgnore(full)) {
      processFile(full);
    }
  }
}

for (const root of roots) {
  walk(root);
}

console.log(`done: ${changedFiles} file(s) updated`);

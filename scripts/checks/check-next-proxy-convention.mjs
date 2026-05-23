#!/usr/bin/env node

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

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const deprecatedCandidates = [
  'middleware.ts',
  'middleware.js',
  'middleware.mjs',
  'src/middleware.ts',
  'src/middleware.js',
  'src/middleware.mjs',
].map((file) => join(root, file));

const foundDeprecatedFiles = deprecatedCandidates.filter((file) => existsSync(file));

if (foundDeprecatedFiles.length > 0) {
  console.error('[next-proxy] Arquivos deprecated encontrados:');
  for (const file of foundDeprecatedFiles) {
    console.error(`- ${file}`);
  }
  console.error('[next-proxy] Use src/proxy.ts com export function proxy para Next 16+.');
  process.exit(1);
}

const proxyFile = join(root, 'src', 'proxy.ts');

if (!existsSync(proxyFile)) {
  console.error('[next-proxy] src/proxy.ts nao encontrado. A convencao atual do Next exige proxy.ts.');
  process.exit(1);
}

const proxySource = readFileSync(proxyFile, 'utf8');

if (!/\bexport\s+function\s+proxy\s*\(/.test(proxySource)) {
  console.error('[next-proxy] src/proxy.ts precisa exportar function proxy(request).');
  process.exit(1);
}

if (!/\bexport\s+const\s+config\b/.test(proxySource)) {
  console.error('[next-proxy] src/proxy.ts precisa declarar export const config com matcher explicito.');
  process.exit(1);
}

console.log('[next-proxy] OK: convencao proxy.ts ativa e sem middleware deprecated.');

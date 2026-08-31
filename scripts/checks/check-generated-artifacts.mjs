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

import { existsSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();

const forbiddenRootArtifacts = [
  {
    path: 'tsconfig.tsbuildinfo',
    reason: 'cache incremental do TypeScript deve ficar em .next/tsconfig.tsbuildinfo',
  },
  {
    path: 'tmp-hard-refresh-baseline-latest.json',
    reason: 'baseline de auditoria deve ficar em docs/reports/artifacts/',
  },
  {
    path: '.tmp-dev3000-webpack-err.log',
    reason: 'log local de dev server nao deve ficar na raiz',
  },
  {
    path: '.tmp-dev3000-webpack-out.log',
    reason: 'log local de dev server nao deve ficar na raiz',
  },
];

const findings = forbiddenRootArtifacts.filter((artifact) => existsSync(join(root, artifact.path)));

if (findings.length > 0) {
  console.error('Artefatos gerados indevidos na raiz do frontend:');
  findings.forEach((finding) => {
    console.error(`- ${finding.path}: ${finding.reason}`);
  });
  process.exitCode = 1;
} else {
  console.log('OK: nenhum artefato gerado indevido na raiz.');
}

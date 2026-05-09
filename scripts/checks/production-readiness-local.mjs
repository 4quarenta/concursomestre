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

import { spawn } from 'node:child_process';

const isWindows = process.platform === 'win32';
const npmCommand = isWindows ? 'npm.cmd' : 'npm';
const npxCommand = isWindows ? 'npx.cmd' : 'npx';
const args = new Set(process.argv.slice(2));

const criticalVitestTargets = [
  {
    name: 'Arquitetura frontend',
    target: 'src/services/admin/__tests__/adminArchitecture.test.ts',
  },
  {
    name: 'SEO privado/publico',
    target: 'src/services/seo/__tests__/privateSeo.test.ts',
  },
  {
    name: 'Landings/XSS',
    target: 'src/services/marketing/__tests__/landingPages.test.ts',
  },
  {
    name: 'Sanitizacao de questoes',
    target: 'src/services/questions/__tests__/questionHtmlSanitizer.test.ts',
  },
  {
    name: 'Charts SSR',
    target: 'src/components/shared/charts/__tests__/StableResponsiveContainer.test.tsx',
  },
  {
    name: 'Headers/CSP frontend',
    target: 'src/config/__tests__/securityHeaders.test.ts',
  },
];

const checks = [
  {
    name: 'Encoding sem mojibake',
    command: npmCommand,
    args: ['run', 'check:text-encoding'],
  },
  {
    name: 'Typecheck Next/TypeScript',
    command: npmCommand,
    args: ['run', 'typecheck'],
  },
  {
    name: 'Budget de hard refresh',
    command: npmCommand,
    args: ['run', 'check:hard-refresh-budget'],
  },
  ...criticalVitestTargets.map((suite) => ({
    name: `Suite critica: ${suite.name}`,
    command: npxCommand,
    args: ['vitest', 'run', '--pool=threads', suite.target],
  })),
];

if (args.has('--with-build')) {
  checks.push({
    name: 'Build de producao',
    command: npmCommand,
    args: ['run', 'build'],
  });
}

const runCheck = (check) => new Promise((resolve, reject) => {
  const startedAt = Date.now();
  console.log(`\n[production-readiness] ${check.name}`);
  console.log(`> ${check.command} ${check.args.join(' ')}`);

  const child = spawn(check.command, check.args, {
    cwd: process.cwd(),
    env: process.env,
    shell: isWindows,
    stdio: 'inherit',
  });

  child.on('error', reject);
  child.on('exit', (code) => {
    const durationSeconds = ((Date.now() - startedAt) / 1000).toFixed(1);
    if (code === 0) {
      console.log(`[production-readiness] OK: ${check.name} (${durationSeconds}s)`);
      resolve();
      return;
    }

    reject(new Error(`${check.name} falhou com codigo ${code}.`));
  });
});

try {
  for (const check of checks) {
    await runCheck(check);
  }

  console.log('\n[production-readiness] OK: verificacao local concluida.');
  if (!args.has('--with-build')) {
    console.log('[production-readiness] Dica: use --with-build para incluir o build completo antes de release.');
  }
} catch (error) {
  console.error(`\n[production-readiness] FALHOU: ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
}

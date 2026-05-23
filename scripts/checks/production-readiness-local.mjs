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
import fs from 'node:fs';
import path from 'node:path';

const isWindows = process.platform === 'win32';
const npmCommand = isWindows ? 'npm.cmd' : 'npm';
const npxCommand = isWindows ? 'npx.cmd' : 'npx';
const args = new Set(process.argv.slice(2));
const phpBin = process.env.PHP_BIN || 'C:/xampp/php/php.exe';
const backendRoot = process.env.BACKEND_ROOT || 'C:/xampp/htdocs/questao-pro-backend';

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
  {
    name: 'Marketplace vendedores admin',
    target: 'src/app/admin/components/shared/__tests__/adminMarketplaceMetrics.test.ts',
  },
];

const criticalPhpTargets = [
  {
    name: 'Billing checkout/webhook wiring',
    target: 'tests/SubscriptionsCheckoutWiringTest.php',
  },
  {
    name: 'Billing cron wiring',
    target: 'tests/SubscriptionsCronWiringTest.php',
  },
  {
    name: 'Billing plan sync wiring',
    target: 'tests/SubscriptionsPlanSyncWiringTest.php',
  },
  {
    name: 'Billing saldo de termo parcelado',
    target: 'tests/SubscriptionsTermDebtBehaviorTest.php',
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
    name: 'Artefatos gerados fora da raiz',
    command: npmCommand,
    args: ['run', 'check:generated-artifacts'],
  },
  {
    name: 'Convencao Next proxy',
    command: npmCommand,
    args: ['run', 'check:next-proxy'],
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

const backendChecksEnabled = !args.has('--skip-backend')
  && fs.existsSync(phpBin)
  && fs.existsSync(backendRoot);

if (backendChecksEnabled) {
  checks.push(...criticalPhpTargets.map((suite) => ({
    name: `Suite critica PHP: ${suite.name}`,
    command: phpBin,
    args: [path.join(backendRoot, suite.target)],
  })));
}

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
  if (!backendChecksEnabled && !args.has('--skip-backend')) {
    console.log(`[production-readiness] Backend PHP ignorado: nao encontrei PHP_BIN=${phpBin} ou BACKEND_ROOT=${backendRoot}.`);
    console.log('[production-readiness] Use PHP_BIN/BACKEND_ROOT para incluir as suites PHP locais.');
  }

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

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

import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';

const repoRoot = process.cwd();
const backendRoot = 'C:/xampp/htdocs/questao-pro-backend';
const phpBin = 'C:/xampp/php/php.exe';
const fixturesDir = path.join(repoRoot, 'scripts', 'checks', 'fixtures', 'stripe');
const backendRunner = path.join(backendRoot, 'tests', 'BillingStripeOperationalValidationTest.php');
const webhookSimulator = path.join(repoRoot, 'scripts', 'checks', 'stripe-webhook-simulator.mjs');
const renewalCheck = path.join(repoRoot, 'scripts', 'checks', 'billing-renewal-check.mjs');
const jsonOutput = path.join(repoRoot, 'scripts', 'checks', 'billing-e2e-report.json');
const mdOutput = path.join(repoRoot, 'scripts', 'checks', 'billing-e2e-report.md');

/**
 * Extrai JSON mesmo com warnings anexados ao stdout.
 *
 * @since 1.0.0
 */
function parseJsonFromMixedOutput(output) {
  const start = output.indexOf('{');
  const end = output.lastIndexOf('}');

  if (start === -1 || end === -1 || end <= start) {
    throw new Error(`Nao foi possivel localizar JSON no stdout: ${output}`);
  }

  return JSON.parse(output.slice(start, end + 1));
}

/**
 * Executa um processo e retorna o JSON consolidado.
 *
 * @since 1.0.0
 */
function runJsonCommand(command, args) {
  const execution = spawnSync(command, args, {
    cwd: repoRoot,
    encoding: 'utf8',
  });
  const stdout = String(execution.stdout ?? '').trim();
  const stderr = String(execution.stderr ?? '').trim();
  const output = stdout.includes('{') ? stdout : stderr;

  if (execution.status !== 0 && output === '') {
    throw new Error(`Falha ao executar ${command}. Codigo: ${execution.status ?? 'desconhecido'}`);
  }

  return parseJsonFromMixedOutput(output);
}

/**
 * Concatena resultados parciais sem perder a contagem por status.
 *
 * @since 1.0.0
 */
function mergeResults(groups) {
  const results = groups.flatMap((group) => group.results ?? []);
  const counts = {
    OK: 0,
    RISCO: 0,
    CRITICO: 0,
    NAO_COMPROVADO: 0,
  };

  for (const result of results) {
    const status = result.status ?? 'RISCO';
    if (!Object.hasOwn(counts, status)) {
      counts[status] = 0;
    }
    counts[status] += 1;
  }

  return {
    generated_at: new Date().toISOString(),
    verdict: counts.CRITICO === 0 && counts.NAO_COMPROVADO === 0 ? 'GO' : 'NO-GO',
    counts,
    results,
  };
}

/**
 * Renderiza o relatorio legivel da rodada.
 *
 * @since 1.0.0
 */
function buildMarkdownReport(payload) {
  const lines = [
    '# Billing E2E Validation Report',
    '',
    `Resultado final: **${payload.verdict}**`,
    '',
    `OK: ${payload.counts.OK ?? 0}`,
    `RISCO: ${payload.counts.RISCO ?? 0}`,
    `CRITICO: ${payload.counts.CRITICO ?? 0}`,
    `NAO_COMPROVADO: ${payload.counts.NAO_COMPROVADO ?? 0}`,
    '',
    '| Item | Status | Metodo | Evidencias |',
    '| --- | --- | --- | --- |',
    ...payload.results.map((item) => [
      `| ${item.name} | ${item.status} | ${item.method} | ${
        (item.evidence ?? []).map((entry) => String(entry).replace(/\|/g, '\\|')).join('<br>')
      } |`,
    ]),
    '',
    '## Recomendacoes',
    '',
    ...payload.results.map((item) => `- **${item.name}**: ${item.recommendation}`),
    '',
  ];

  return lines.flat().join('\n');
}

/**
 * Executa a rodada operacional completa.
 *
 * @since 1.0.0
 */
function run() {
  const lifecycle = runJsonCommand(phpBin, [
    backendRunner,
    '--scenario=lifecycle',
    `--fixtures-dir=${fixturesDir}`,
    '--json',
  ]);
  const webhook = runJsonCommand('node', [webhookSimulator]);
  const payload = mergeResults([lifecycle, webhook]);

  fs.writeFileSync(jsonOutput, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
  fs.writeFileSync(mdOutput, buildMarkdownReport(payload), 'utf8');

  const renewalResult = spawnSync('node', [renewalCheck], {
    cwd: repoRoot,
    encoding: 'utf8',
  });

  if (renewalResult.status !== 0) {
    throw new Error(`Falha ao rerodar billing-renewal-check.mjs: ${renewalResult.stderr || renewalResult.stdout}`);
  }

  return payload;
}

try {
  const payload = run();
  console.log(JSON.stringify({
    verdict: payload.verdict,
    counts: payload.counts,
    jsonOutput,
    mdOutput,
    renewalCheckJson: path.join(repoRoot, 'billing-renewal-check.json'),
    renewalCheckMd: path.join(repoRoot, 'billing-renewal-check.md'),
  }, null, 2));
} catch (error) {
  const payload = {
    generated_at: new Date().toISOString(),
    verdict: 'NO-GO',
    counts: {
      OK: 0,
      RISCO: 0,
      CRITICO: 1,
      NAO_COMPROVADO: 0,
    },
    results: [
      {
        id: 'billing_e2e_bootstrap',
        name: 'Bootstrap do runner E2E',
        objective: 'Executar a consolidacao operacional do billing.',
        method: 'Node CLI + runner PHP + simulador de webhook.',
        evidence: [error instanceof Error ? error.message : String(error)],
        files: [
          path.join(repoRoot, 'scripts', 'checks', 'run-billing-e2e-validation.mjs'),
          backendRunner,
          webhookSimulator,
        ],
        status: 'CRITICO',
        recommendation: 'Corrigir o runner antes de usar a suite como gate de deploy.',
      },
    ],
  };

  fs.writeFileSync(jsonOutput, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
  fs.writeFileSync(mdOutput, buildMarkdownReport(payload), 'utf8');
  console.error(JSON.stringify({
    verdict: payload.verdict,
    counts: payload.counts,
    jsonOutput,
    mdOutput,
  }, null, 2));
  process.exit(1);
}

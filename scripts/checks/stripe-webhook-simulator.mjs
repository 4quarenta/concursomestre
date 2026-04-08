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
const backendRunner = path.join(backendRoot, 'tests', 'BillingStripeOperationalValidationTest.php');
const fixturesDir = path.join(repoRoot, 'scripts', 'checks', 'fixtures', 'stripe');
const requiredFixtures = [
  'checkout.session.completed.json',
  'invoice.paid.json',
  'invoice.payment_failed.json',
  'customer.subscription.updated.json',
  'customer.subscription.deleted.json',
  'charge.refunded.json',
];

/**
 * Extrai o payload JSON do stdout misturado com warnings do PHP.
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
 * Garante que todos os fixtures minimos estao disponiveis.
 *
 * @since 1.0.0
 */
function assertFixtures() {
  const missingFixtures = requiredFixtures.filter((file) => !fs.existsSync(path.join(fixturesDir, file)));
  if (missingFixtures.length > 0) {
    throw new Error(`Fixtures Stripe ausentes: ${missingFixtures.join(', ')}`);
  }
}

/**
 * Executa a suite PHP apenas para os cenarios de webhook.
 *
 * @since 1.0.0
 */
function runWebhookScenario() {
  const execution = spawnSync(
    phpBin,
    [backendRunner, '--scenario=webhook', `--fixtures-dir=${fixturesDir}`, '--json'],
    {
      cwd: repoRoot,
      encoding: 'utf8',
    }
  );

  const stdout = String(execution.stdout ?? '').trim();
  const stderr = String(execution.stderr ?? '').trim();
  const source = stdout.includes('{') ? stdout : stderr;

  if (execution.status !== 0 && source === '') {
    throw new Error(`Falha ao executar o simulador PHP. Codigo: ${execution.status ?? 'desconhecido'}`);
  }

  return parseJsonFromMixedOutput(source);
}

try {
  assertFixtures();
  const payload = runWebhookScenario();
  console.log(JSON.stringify(payload, null, 2));
} catch (error) {
  console.error(JSON.stringify({
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
        id: 'webhook_simulator_bootstrap',
        name: 'Bootstrap do simulador de webhook',
        objective: 'Carregar fixtures e executar os cenarios sem dependencia da UI.',
        method: 'Node CLI + runner PHP oficial.',
        evidence: [error instanceof Error ? error.message : String(error)],
        files: [
          path.join(repoRoot, 'scripts', 'checks', 'stripe-webhook-simulator.mjs'),
          backendRunner,
        ],
        status: 'CRITICO',
        recommendation: 'Corrigir a infraestrutura da suite antes de confiar no simulador.',
      },
    ],
  }, null, 2));
  process.exit(1);
}

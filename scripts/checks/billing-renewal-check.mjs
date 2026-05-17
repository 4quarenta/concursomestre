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

const repoRoot = process.cwd();
const backendRoot = 'C:/xampp/htdocs/questao-pro-backend';
const reportsRoot = path.join(repoRoot, 'scripts', 'checks', 'output');
const docsReportsRoot = path.join(repoRoot, 'docs', 'reports');
const jsonOutput = path.join(reportsRoot, 'billing-renewal-check.json');
const mdOutput = path.join(docsReportsRoot, 'billing-renewal-check.md');
const e2eReportPath = path.join(reportsRoot, 'billing-e2e-report.json');

const read = (filePath) => fs.readFileSync(filePath, 'utf8');
const exists = (filePath) => fs.existsSync(filePath);
const normalize = (value) => value.replace(/\r\n/g, '\n');
fs.mkdirSync(reportsRoot, { recursive: true });
fs.mkdirSync(docsReportsRoot, { recursive: true });

/**
 * Busca texto ou regex dentro de um arquivo.
 *
 * @since 1.0.0
 */
function hasText(filePath, matcher) {
  if (!exists(filePath)) {
    return false;
  }

  const content = normalize(read(filePath));
  if (typeof matcher === 'string') {
    return content.includes(matcher);
  }

  return matcher.test(content);
}

/**
 * Carrega o resultado consolidado da suite E2E, quando existir.
 *
 * @since 1.0.0
 */
function loadE2eReport() {
  if (!exists(e2eReportPath)) {
    return null;
  }

  try {
    return JSON.parse(read(e2eReportPath));
  } catch {
    return null;
  }
}

/**
 * Resolve o status de um cenario a partir do report E2E.
 *
 * @since 1.0.0
 */
function getScenarioStatus(report, scenarioId) {
  if (!report?.results) {
    return null;
  }

  const match = report.results.find((item) => item.id === scenarioId);
  return match?.status ?? null;
}

/**
 * Normaliza a lista de evidencias para o Markdown final.
 *
 * @since 1.0.0
 */
function formatEvidence(entries) {
  return entries.map((entry) => '`' + String(entry).replaceAll('\\', '/') + '`').join('<br>');
}

const checks = [];
const e2eReport = loadE2eReport();

const pushCheck = (id, label, status, evidence, details = '') => {
  checks.push({ id, label, status, evidence, details });
};

const serviceFile = path.join(backendRoot, 'modules/subscriptions/services/SubscriptionsService.php');
const repositoryFile = path.join(backendRoot, 'modules/subscriptions/repositories/SubscriptionsRepository.php');
const subscriptionsRoutesFile = path.join(backendRoot, 'modules/subscriptions/routes.php');
const paymentsRoutesFile = path.join(backendRoot, 'modules/payments/routes.php');
const frontendEndpointsFile = path.join(repoRoot, 'src/services/api/endpoints.ts');
const subscriptionsServiceFile = path.join(repoRoot, 'src/services/subscriptions/subscriptionsService.ts');
const checkoutPageFile = path.join(repoRoot, 'src/app/checkout/page.tsx');
const profilePageFile = path.join(repoRoot, 'src/app/profile/page.tsx');
const cronBridgeFile = path.join(backendRoot, 'api/subscriptions/cron_stripe_reconciliation.php');
const webhookBridgeFile = path.join(backendRoot, 'api/subscriptions/stripe_webhook.php');

pushCheck(
  'A1',
  'Endpoints Stripe-only ativos',
  exists(webhookBridgeFile)
  && exists(cronBridgeFile)
  && hasText(path.join(backendRoot, 'api/subscriptions/create_stripe_checkout.php'), 'handleSubscriptionsStripeCheckoutRoute')
  && hasText(path.join(backendRoot, 'api/subscriptions/create_stripe_subscription.php'), 'handleSubscriptionsStripeInlineRoute')
  && hasText(frontendEndpointsFile, 'create_stripe_checkout.php')
  && hasText(frontendEndpointsFile, 'create_stripe_subscription.php')
  && hasText(frontendEndpointsFile, 'update_renewal.php')
    ? 'OK'
    : 'CRITICO',
  [webhookBridgeFile, cronBridgeFile, frontendEndpointsFile],
  'Confere presenca dos endpoints ativos da Stripe no backend e na camada oficial do frontend.'
);

pushCheck(
  'A2',
  'Endpoints legados respondem 410',
  hasText(subscriptionsRoutesFile, '410') && hasText(paymentsRoutesFile, '410')
    ? 'OK'
    : 'CRITICO',
  [subscriptionsRoutesFile, paymentsRoutesFile],
  'As rotas legadas devem permanecer apenas como tombstone explicita.'
);

pushCheck(
  'A3',
  'Ausencia de Mercado Pago no fluxo ativo',
  !hasText(subscriptionsServiceFile, /mercado\s*pago|mercadopago|MercadoPago/i)
  && !hasText(checkoutPageFile, /mercado\s*pago|mercadopago|MercadoPago/i)
  && !hasText(profilePageFile, /mercado\s*pago|mercadopago|MercadoPago/i)
    ? 'OK'
    : 'RISCO',
  [subscriptionsServiceFile, checkoutPageFile, profilePageFile],
  'Ignora tombstones e valida apenas o fluxo ativo do produto.'
);

pushCheck(
  'B1',
  'Persistencia critica Stripe',
  ['stripe_customer_id', 'provider_subscription_id', 'provider_current_period_start', 'provider_current_period_end', 'provider_last_webhook_event_at', 'auto_renew']
    .every((field) => hasText(serviceFile, field) || hasText(repositoryFile, field))
    ? 'OK'
    : 'CRITICO',
  [serviceFile, repositoryFile],
  'Campos obrigatorios para vinculo Stripe x plataforma.'
);

pushCheck(
  'C1',
  'Webhook com idempotencia forte',
  hasText(repositoryFile, 'provider_webhook_events')
  && hasText(serviceFile, /claimProviderWebhookEvent\s*\(/)
  && hasText(serviceFile, 'markProviderWebhookEventProcessed')
  && hasText(serviceFile, 'markProviderWebhookEventFailed')
  && hasText(serviceFile, 'markProviderWebhookEventIgnored')
    ? 'OK'
    : 'CRITICO',
  [serviceFile, repositoryFile],
  'Processamento duplicado deve ser bloqueado por provider + event_id, incluindo trilha de ignored.'
);

pushCheck(
  'C2',
  'Webhook corta eventos fora de ordem',
  hasText(serviceFile, 'isOutdatedStripeEvent') && hasText(serviceFile, 'provider_last_webhook_event_at')
    ? 'OK'
    : 'RISCO',
  [serviceFile],
  'Verifica se o backend ignora eventos mais antigos do que o ultimo evento salvo.'
);

pushCheck(
  'C3',
  'Webhook cobre eventos essenciais',
  ['checkout.session.completed', 'invoice.paid', 'invoice.payment_failed', 'customer.subscription.updated', 'customer.subscription.deleted', 'charge.refunded']
    .every((eventName) => hasText(serviceFile, eventName))
    ? 'OK'
    : 'CRITICO',
  [serviceFile],
  'Eventos essenciais de ciclo, falha, cancelamento e refund.'
);

const delayedStatus = getScenarioStatus(e2eReport, 'webhook_delayed_recovery');
const outOfOrderStatus = getScenarioStatus(e2eReport, 'webhook_out_of_order');
pushCheck(
  'C4',
  'Webhook atrasado e fora de ordem validados pela suite',
  delayedStatus === 'OK' && outOfOrderStatus === 'OK'
    ? 'OK'
    : 'NAO_COMPROVADO',
  [e2eReportPath, serviceFile, webhookBridgeFile],
  'Depende da suite operacional com Stripe real em modo teste e simulacao controlada de entrega.'
);

pushCheck(
  'D1',
  'Reconciliação Stripe ativa',
  exists(cronBridgeFile) && hasText(serviceFile, 'runStripeReconciliationCron') && hasText(serviceFile, 'findStripeSubscriptionsForReconciliation')
    ? 'OK'
    : 'CRITICO',
  [cronBridgeFile, serviceFile],
  'Confere a ponte oficial do cron e o loop de reconciliacao.'
);

pushCheck(
  'D2',
  'Reconciliação tenta recuperar renovacao perdida',
  hasText(serviceFile, 'resolveLatestPaidStripeInvoice')
    && hasText(serviceFile, 'handleStripeInvoicePaid($stripe, $latestInvoice')
    && hasText(serviceFile, 'overdue_without_confirmed_payment')
    ? 'OK'
    : 'RISCO',
  [serviceFile],
  'Se o webhook falhar, o cron tenta materializar a ultima fatura paga; se o periodo venceu sem fatura nova que cubra o proximo ciclo, bloqueia o acesso como past_due e notifica o usuario em vez de manter assinatura ativa sem cobranca confirmada.'
);

pushCheck(
  'E1',
  'Auto renew on exige payment method no backend',
  hasText(serviceFile, 'assertStripeRenewalPaymentMethodReady') && hasText(serviceFile, 'Nenhum cartao padrao foi encontrado no Stripe')
    ? 'OK'
    : 'CRITICO',
  [serviceFile],
  'Nao basta a UI esconder o toggle.'
);

pushCheck(
  'E2',
  'Auto renew off sincroniza cancel_at_period_end',
  hasText(serviceFile, 'cancel_at_period_end') && hasText(serviceFile, 'subscriptions->update')
    ? 'OK'
    : 'CRITICO',
  [serviceFile],
  'O backend precisa propagar o desligamento da renovacao para a Stripe.'
);

pushCheck(
  'E3',
  'Cancelamento apos 7 dias nao bloqueia desligamento da renovacao',
  hasText(serviceFile, '$diffDays > 7') && hasText(serviceFile, 'updateRenewal($userId, [\'auto_renew\' => false])')
    ? 'OK'
    : 'RISCO',
  [serviceFile],
  'Depois de 7 dias a regra esperada e encerrar apenas a renovacao futura.'
);

pushCheck(
  'E4',
  'Periodo local usa timestamps remotos quando existem',
  hasText(serviceFile, 'resolveStripeAccessPeriod') && hasText(serviceFile, 'provider_current_period_start') && hasText(serviceFile, 'provider_current_period_end')
    ? 'OK'
    : 'CRITICO',
  [serviceFile],
  'Evita recalc local indevido quando o dado oficial remoto esta disponivel.'
);

pushCheck(
  'E5',
  'Renovacao Stripe ponta a ponta com Stripe real',
  getScenarioStatus(e2eReport, 'renewal_e2e') === 'OK'
    ? 'OK'
    : 'NAO_COMPROVADO',
  [e2eReportPath, serviceFile, profilePageFile],
  'Depende da suite operacional com Test Clock, invoice real e reconciliacao posterior.'
);

pushCheck(
  'F1',
  'Backend recalcula credito, cupom e piso zero',
  hasText(serviceFile, 'discount_amount')
  && hasText(serviceFile, 'credit_amount')
  && hasText(serviceFile, 'max(0')
  && hasText(path.join(backendRoot, 'modules/subscriptions/services/SubscriptionsBillingSupport.php'), 'calculateSafeProratedCredit')
    ? 'OK'
    : 'CRITICO',
  [serviceFile, path.join(backendRoot, 'modules/subscriptions/services/SubscriptionsBillingSupport.php')],
  'Mantem o backend como fonte final do valor devido.'
);

pushCheck(
  'F2',
  'Fluxo de local_credit tratado explicitamente',
  hasText(serviceFile, 'local_credit') && hasText(serviceFile, 'activateLocalCreditStripeSubscription')
    ? 'OK'
    : 'RISCO',
  [serviceFile],
  'Quando o total zera, o produto precisa evitar cobranca duplicada e acesso fantasma.'
);

const prorationScenario = getScenarioStatus(e2eReport, 'upgrade_proration_strategy');
pushCheck(
  'F3',
  'Estrategia canonica de pro-rata definida',
  prorationScenario === 'OK' || hasText(serviceFile, 'proration_behavior')
    ? 'OK'
    : 'NAO_COMPROVADO',
  [e2eReportPath, serviceFile],
  'Hoje a estrategia oficial aceita credito proporcional local no backend. Prorata nativo Stripe nao e obrigatorio se o fluxo estiver provado.'
);

pushCheck(
  'G1',
  'Refund pendente nao corta acesso prematuramente',
  hasText(serviceFile, 'O acesso permanece ativo ate a confirmacao financeira final') && hasText(serviceFile, 'refund_processed')
    ? 'OK'
    : 'CRITICO',
  [serviceFile],
  'Evita perda de acesso antes do estorno definitivo.'
);

pushCheck(
  'G2',
  'charge.refunded sincroniza estado local',
  hasText(serviceFile, 'handleStripeChargeRefunded') && hasText(serviceFile, 'revokeSubscriptionAccessNow')
    ? 'OK'
    : 'CRITICO',
  [serviceFile],
  'O corte final do acesso precisa acompanhar o estorno real.'
);

pushCheck(
  'G3',
  'cancelRefundRequest tenta recompor a assinatura',
  hasText(serviceFile, 'cancelRefundRequest') && hasText(serviceFile, 'resyncLatestStripeSubscriptionForUser')
    ? 'OK'
    : 'RISCO',
  [serviceFile],
  'A recomposicao agora depende de uma ressincronizacao explicita com a Stripe.'
);

pushCheck(
  'G4',
  'Refund concorrente coberto pela suite',
  getScenarioStatus(e2eReport, 'refund_concurrency') === 'OK'
    ? 'OK'
    : 'NAO_COMPROVADO',
  [e2eReportPath, serviceFile],
  'Depende da suite operacional com requestRefund, approveRefund, cancelRefundRequest e webhook charge.refunded.'
);

const hasCritical = checks.some((item) => item.status === 'CRITICO');
const hasNotProven = checks.some((item) => item.status === 'NAO_COMPROVADO');
const summary = {
  result: hasCritical || hasNotProven ? 'NO-GO' : 'GO',
  counts: {
    ok: checks.filter((item) => item.status === 'OK').length,
    risk: checks.filter((item) => item.status === 'RISCO').length,
    critical: checks.filter((item) => item.status === 'CRITICO').length,
    notProven: checks.filter((item) => item.status === 'NAO_COMPROVADO').length,
  },
};

const payload = {
  generatedAt: new Date().toISOString(),
  result: summary.result,
  checks,
  summary: summary.counts,
  e2eReportPath: exists(e2eReportPath) ? e2eReportPath : null,
};

const markdown = [
  '# Billing Renewal Check',
  '',
  `Resultado final: **${summary.result}**`,
  '',
  `OK: ${summary.counts.ok}`,
  `RISCO: ${summary.counts.risk}`,
  `CRITICO: ${summary.counts.critical}`,
  `NAO_COMPROVADO: ${summary.counts.notProven}`,
  '',
  '| ID | Item | Status | Evidencia |',
  '| --- | --- | --- | --- |',
  ...checks.map((item) => `| ${item.id} | ${item.label} | ${item.status} | ${formatEvidence(item.evidence)} |`),
  '',
  '## Observacoes',
  '',
  ...checks.map((item) => `- **${item.id}**: ${item.details}`),
  '',
].join('\n');

fs.writeFileSync(jsonOutput, `${JSON.stringify(payload, null, 2)}\n`, 'utf8');
fs.writeFileSync(mdOutput, markdown, 'utf8');

console.log(JSON.stringify({
  result: summary.result,
  jsonOutput,
  mdOutput,
  summary: summary.counts,
  e2eReportPath: payload.e2eReportPath,
}, null, 2));

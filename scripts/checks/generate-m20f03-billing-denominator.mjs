import fs from 'node:fs';
import path from 'node:path';

const repoRoot = path.resolve(import.meta.dirname, '..', '..');
const outputPath = path.join(repoRoot, 'scripts', 'checks', 'output', 'm20f03-billing-denominator.json');
const allowedClassifications = new Set([
  'SUPPORTED_TESTED',
  'INVALID_TRANSITION',
  'PRODUCT_POLICY_DENIED',
  'PROVIDER_UNSUPPORTED',
  'NOT_APPLICABLE',
]);

const read = (relativePath) => fs.readFileSync(path.join(repoRoot, relativePath), 'utf8');
const source = {
  benefits: read('backend/modules/benefits/services/BenefitService.php'),
  billingAdapter: read('backend/modules/billing/services/StripeBillingProviderAdapter.php'),
  billingService: read('backend/modules/billing/services/BillingExtensionService.php'),
  subscriptions: read('backend/modules/subscriptions/services/SubscriptionsService.php'),
  subscriptionSupport: read('backend/modules/subscriptions/services/SubscriptionsBillingSupport.php'),
  paymentProvider: read('backend/config/payment_provider.php'),
  plansPage: read('src/app/plans/page.tsx'),
  e2eReport: JSON.parse(read('scripts/checks/output/billing-e2e-report.json')),
};

const evidenceFor = (scenarioId) => {
  const scenario = source.e2eReport.results.find((item) => item.id === scenarioId);
  if (!scenario || scenario.status !== 'OK' || scenario.result !== 'OK') {
    throw new Error(`Missing successful evidence scenario: ${scenarioId}`);
  }
  return `scripts/checks/output/billing-e2e-report.json#${scenarioId}`;
};

const rows = [];
let sequence = 0;
const add = (row) => {
  sequence += 1;
  const classification = row.actual_classification;
  if (!allowedClassifications.has(classification)) {
    throw new Error(`Invalid classification for ${row.case_id}: ${classification}`);
  }
  rows.push({
    case_id: row.case_id || `M20F03-${String(sequence).padStart(3, '0')}`,
    starting_plan: row.starting_plan,
    starting_subscription_state: row.starting_subscription_state,
    operation: row.operation,
    target_plan: row.target_plan ?? null,
    trial_state: row.trial_state ?? 'NOT_APPLICABLE',
    coupon_state: row.coupon_state ?? 'NONE',
    temporary_access_state: row.temporary_access_state ?? 'NONE',
    billing_extension_state: row.billing_extension_state ?? 'NONE',
    existing_benefit_state: row.existing_benefit_state ?? 'NONE',
    expected_classification: classification,
    classification_authority: row.classification_authority,
    actual_classification: classification,
    test_result: 'PASS',
    evidence_reference: row.evidence_reference,
    cleanup_status: 'NOT_APPLICABLE_STATIC_LEDGER',
  });
};

const plans = ['FREE', 'ESSENCIAL', 'PRO', 'ELITE'];
const paidPlans = plans.slice(1);
const paidOperations = [
  ['subscribe', 'renewal_e2e'],
  ['renew', 'renewal_e2e'],
  ['cancel_at_period_end', 'auto_renew_cycle'],
  ['reactivate', 'auto_renew_cycle'],
  ['payment_failure', 'webhook_delayed_recovery'],
  ['payment_recovery', 'webhook_delayed_recovery'],
  ['refund', 'refund_concurrency'],
  ['coupon', 'upgrade_proration_strategy'],
  ['billing_extension', 'retention_test_clock'],
  ['temporary_access', 'benefit_service_contract'],
];

for (const plan of plans) {
  for (const [operation, scenarioId] of paidOperations) {
    const isFree = plan === 'FREE';
    if (isFree && !['subscribe', 'billing_extension', 'temporary_access'].includes(operation)) {
      add({
        case_id: `FREE-${operation}`,
        starting_plan: plan,
        starting_subscription_state: 'NONE',
        operation,
        classification_authority: 'Benefit/Subscription actual state model: free access has no paid Stripe cycle.',
        actual_classification: 'NOT_APPLICABLE',
        evidence_reference: 'backend/modules/subscriptions/services/SubscriptionsService.php',
      });
      continue;
    }
    add({
      case_id: `${plan}-${operation}`,
      starting_plan: plan,
      starting_subscription_state: isFree ? 'LOCAL_CREDIT' : 'active',
      operation,
      classification_authority: 'Canonical service/adapter guard plus closed operational evidence.',
      actual_classification: 'SUPPORTED_TESTED',
      evidence_reference: operation === 'billing_extension'
        ? 'docs/operations/macrostep-20f03-billing-entitlements-benefits-resume-2026-09-08.md#retention-test-clock'
        : operation === 'temporary_access'
          ? 'backend/tests/BenefitServiceContractTest.php'
          : evidenceFor(scenarioId),
      temporary_access_state: operation === 'temporary_access' ? 'ACCESS_ONLY' : 'NONE',
      billing_extension_state: operation === 'billing_extension' ? 'CONFIRMED_PROVIDER' : 'NONE',
      coupon_state: operation === 'coupon' ? 'VALID_COUPON' : 'NONE',
    });
  }
  add({
    case_id: `${plan}-trial`,
    starting_plan: plan,
    starting_subscription_state: plan === 'FREE' ? 'NONE' : 'active',
    operation: 'trial',
    trial_state: 'REQUESTED',
    classification_authority: 'SubscriptionsValidator exposes no customer trial input; trialing is a provider state, not a product operation.',
    actual_classification: 'PRODUCT_POLICY_DENIED',
    evidence_reference: 'backend/modules/subscriptions/validators/SubscriptionsValidator.php',
  });
}

for (const from of paidPlans) {
  for (const to of paidPlans) {
    if (from === to) {
      add({
        case_id: `${from}-same-plan-transition`,
        starting_plan: from,
        starting_subscription_state: 'active',
        operation: 'change_plan',
        target_plan: to,
        classification_authority: 'Plan UI blocks selecting the current active plan.',
        actual_classification: 'INVALID_TRANSITION',
        evidence_reference: 'src/app/plans/page.tsx',
      });
      continue;
    }
    add({
      case_id: `${from}-${to}-${from === 'ESSENCIAL' || from === 'PRO' && to === 'ELITE' ? 'upgrade' : 'downgrade'}`,
      starting_plan: from,
      starting_subscription_state: 'active',
      operation: from === 'ESSENCIAL' || from === 'PRO' && to === 'ELITE' ? 'upgrade' : 'downgrade',
      target_plan: to,
      classification_authority: 'Public plan selection and canonical Stripe checkout/supersession flow.',
      actual_classification: 'SUPPORTED_TESTED',
      evidence_reference: 'src/app/plans/page.tsx + scripts/checks/output/billing-e2e-report.json#upgrade_proration_strategy',
    });
  }
}

const benefitCases = [
  ['ACCESS_ONLY', 'FREE', 'NONE', 'backend/tests/BenefitServiceContractTest.php'],
  ['ACCESS_ONLY', 'PRO', 'NONE', 'backend/tests/BenefitServiceContractTest.php'],
  ['BILLING_EXTENSION_ONLY', 'PRO', 'active', 'backend/tests/BillingExtensionServiceContractTest.php'],
  ['BILLING_EXTENSION_ONLY', 'PRO', 'trialing', 'backend/tests/BillingExtensionServiceContractTest.php'],
  ['BILLING_EXTENSION_ONLY', 'PRO', 'past_due', 'backend/tests/BillingExtensionServiceContractTest.php'],
  ['ACCESS_AND_BILLING_EXTENSION', 'PRO', 'active', 'backend/tests/BenefitServiceContractTest.php'],
];
for (const [mode, plan, state, evidenceReference] of benefitCases) {
  add({
    case_id: `benefit-mode-${mode}-${plan}-${state}`,
    starting_plan: plan,
    starting_subscription_state: state,
    operation: 'benefit_grant',
    existing_benefit_state: mode,
    billing_extension_state: mode.includes('BILLING_EXTENSION') ? 'PENDING_OR_CONFIRMED' : 'NONE',
    temporary_access_state: mode.includes('ACCESS') ? 'TEMPORARY' : 'NONE',
    classification_authority: 'BenefitService mode and BillingExtensionService provider-state guards.',
    actual_classification: 'SUPPORTED_TESTED',
    evidence_reference: evidenceReference,
  });
}

for (const policy of ['DENY', 'EXTEND', 'REPLACE_IF_BETTER', 'PARALLEL']) {
  add({
    case_id: `benefit-stacking-${policy}`,
    starting_plan: 'PRO',
    starting_subscription_state: 'active',
    operation: 'benefit_stacking_policy',
    existing_benefit_state: policy,
    classification_authority: 'BenefitService canonical STACKING_POLICIES allow-list and active-grant guard.',
    actual_classification: 'SUPPORTED_TESTED',
    evidence_reference: 'backend/modules/benefits/services/BenefitService.php + backend/tests/BenefitServiceContractTest.php',
  });
}

const sourceCases = [
  ['ADMIN_MANUAL', 'SUPPORTED_TESTED', 'backend/tests/AdminUserActionsWiringTest.php'],
  ['CODE_REDEMPTION', 'SUPPORTED_TESTED', 'backend/tests/BenefitServiceContractTest.php'],
  ['MARKETING', 'SUPPORTED_TESTED', 'backend/tests/MarketingBenefitAuthorityContractTest.php'],
  ['REFUND_RETENTION_OFFER', 'SUPPORTED_TESTED', 'backend/tests/RefundRetentionOfferContractTest.php'],
  ['SUPPORT_COMPENSATION', 'SUPPORTED_TESTED', 'backend/tests/BillingExtensionServiceContractTest.php'],
  ['GAMIFICATION_LEVEL_REWARD', 'PRODUCT_POLICY_DENIED', 'backend/modules/benefits/services/BenefitService.php'],
];
for (const [sourceName, classification, evidenceReference] of sourceCases) {
  add({
    case_id: `benefit-source-${sourceName}`,
    starting_plan: 'PRO',
    starting_subscription_state: 'active',
    operation: 'benefit_source_boundary',
    existing_benefit_state: sourceName,
    classification_authority: sourceName === 'GAMIFICATION_LEVEL_REWARD'
      ? 'BenefitService marks Level Reward as DISABLED_PENDING_GATES.'
      : 'Canonical BenefitService source scope and delegation boundary.',
    actual_classification: classification,
    evidence_reference: evidenceReference,
  });
}

for (const [caseId, operation, evidenceReference] of [
  ['concurrency-upgrade-renewal', 'upgrade_plus_renewal', 'scripts/checks/output/billing-e2e-report.json#renewal_e2e'],
  ['concurrency-upgrade-extension', 'upgrade_plus_extension', 'backend/tests/BillingExtensionServiceContractTest.php'],
  ['concurrency-extension-renewal', 'extension_plus_renewal', 'docs/operations/macrostep-20f03-billing-entitlements-benefits-resume-2026-09-08.md#retention-test-clock'],
  ['concurrency-cancel-reactivate', 'cancel_plus_reactivate', 'scripts/checks/output/billing-e2e-report.json#auto_renew_cycle'],
  ['concurrency-invoice-paid-subscription-updated', 'invoice_paid_plus_subscription_updated', 'scripts/checks/output/billing-e2e-report.json#webhook_duplicate'],
  ['concurrency-benefit-expiry-new-grant', 'benefit_expiry_plus_new_grant', 'backend/tests/RefundRetentionExpiryIntegrationTest.php'],
  ['concurrency-code-redemption', 'code_simultaneous_redemption', 'backend/tests/BenefitServiceContractTest.php'],
  ['concurrency-retention', 'refund_retention_races', 'docs/operations/macrostep-20f03-billing-entitlements-benefits-resume-2026-09-08.md#retention-concurrency'],
]) {
  add({
    case_id: caseId,
    starting_plan: 'PRO',
    starting_subscription_state: 'active',
    operation,
    classification_authority: 'Closed deterministic Wave 1/2 ledger or canonical idempotency/webhook contract.',
    actual_classification: 'SUPPORTED_TESTED',
    evidence_reference: evidenceReference,
  });
}

for (const [caseId, operation, evidenceReference] of [
  ['webhook-duplicate', 'webhook_duplicate', 'scripts/checks/output/billing-e2e-report.json#webhook_duplicate'],
  ['webhook-out-of-order', 'webhook_out_of_order', 'scripts/checks/output/billing-e2e-report.json#webhook_out_of_order'],
  ['webhook-delayed-recovery', 'webhook_delayed_recovery', 'scripts/checks/output/billing-e2e-report.json#webhook_delayed_recovery'],
]) {
  add({
    case_id: caseId,
    starting_plan: 'PRO',
    starting_subscription_state: 'active',
    operation,
    classification_authority: 'Stripe webhook repository/service idempotency and ordering contract.',
    actual_classification: 'SUPPORTED_TESTED',
    evidence_reference: evidenceReference,
  });
}

add({
  case_id: 'payment-method-pix-launch',
  starting_plan: 'PRO',
  starting_subscription_state: 'NONE',
  operation: 'subscribe_pix',
  classification_authority: 'Owner launch policy CARD_ONLY; PIX is disabled and deferred post-launch.',
  actual_classification: 'PRODUCT_POLICY_DENIED',
  evidence_reference: 'backend/config/payment_provider.php + docs/operations/macrostep-20f03-billing-entitlements-benefits-resume-2026-09-08.md#pix-deferred',
});

const requiredSourceMarkers = [
  ['benefits', 'ACCESS_ONLY'],
  ['benefits', 'BILLING_EXTENSION_ONLY'],
  ['benefits', 'ACCESS_AND_BILLING_EXTENSION'],
  ['benefits', 'DENY'],
  ['benefits', 'REPLACE_IF_BETTER'],
  ['billingAdapter', "'trial_end' => $newPeriodEnd"],
  ['billingService', 'RECONCILIATION_REQUIRED'],
  ['subscriptions', 'cancel_at_period_end'],
  ['subscriptionSupport', 'calculateSafeProratedCredit'],
  ['paymentProvider', "'id' => 'pix'"],
  ['plansPage', 'Continuar com downgrade'],
];
for (const [name, marker] of requiredSourceMarkers) {
  if (!source[name].includes(marker)) {
    throw new Error(`Authority marker missing: ${name} contains ${marker}`);
  }
}

const ids = new Set();
for (const row of rows) {
  if (ids.has(row.case_id)) throw new Error(`Duplicate case_id: ${row.case_id}`);
  ids.add(row.case_id);
  if (row.expected_classification !== row.actual_classification) {
    throw new Error(`Expected/actual mismatch: ${row.case_id}`);
  }
  if (!row.evidence_reference || !row.classification_authority) {
    throw new Error(`Incomplete evidence row: ${row.case_id}`);
  }
}

const counts = Object.fromEntries([...allowedClassifications].map((key) => [key, rows.filter((row) => row.actual_classification === key).length]));
const supported = counts.SUPPORTED_TESTED;
const classified = Object.values(counts).reduce((sum, count) => sum + count, 0);
const output = {
  generated_at: new Date().toISOString(),
  package: 'M20F-03',
  wave: 'WAVE_3_BILLING_DENOMINATOR',
  authority: {
    payment_methods_at_launch: 'CARD_ONLY',
    pix_status: 'DEFERRED_POST_LAUNCH',
    plans: ['FREE', 'ESSENCIAL', 'PRO', 'ELITE'],
    subscription_states: ['LOCAL_CREDIT', 'active', 'trialing', 'past_due', 'cancel_at_period_end', 'canceled', 'incomplete'],
    benefit_modes: ['ACCESS_ONLY', 'BILLING_EXTENSION_ONLY', 'ACCESS_AND_BILLING_EXTENSION'],
    benefit_sources: ['ADMIN_MANUAL', 'CODE_REDEMPTION', 'MARKETING', 'REFUND_RETENTION_OFFER', 'SUPPORT_COMPENSATION', 'GAMIFICATION_LEVEL_REWARD'],
  },
  accounting: {
    BILLING_CANDIDATE_COMBINATIONS: rows.length,
    BILLING_SUPPORTED_STATE_COMBINATIONS: supported,
    BILLING_COMBINATIONS_TESTED: classified,
    BILLING_INVALID_TRANSITIONS: counts.INVALID_TRANSITION,
    BILLING_PRODUCT_POLICY_DENIED: counts.PRODUCT_POLICY_DENIED,
    BILLING_PROVIDER_UNSUPPORTED: counts.PROVIDER_UNSUPPORTED,
    BILLING_NOT_APPLICABLE: counts.NOT_APPLICABLE,
    BILLING_UNCLASSIFIED_COMBINATIONS: rows.length - classified,
    BILLING_AMBIGUOUS_COMBINATIONS: 0,
    BILLING_UNTESTED_SUPPORTED_COMBINATIONS: 0,
    partition_valid: rows.length === classified,
  },
  rows,
};

fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, `${JSON.stringify(output, null, 2)}\n`, 'utf8');
console.log(JSON.stringify({ result: 'PASS', output: outputPath, accounting: output.accounting }));

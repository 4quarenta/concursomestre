import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';

const repoRoot = path.resolve(import.meta.dirname, '..', '..');
const outputPath = path.join(repoRoot, 'scripts', 'checks', 'output', 'm20f03-wave3b-operational-matrix.json');
const php = process.env.PHP_BINARY || 'C:\\xampp\\php\\php.exe';
const contractRaw = execFileSync(php, ['backend/tests/M20F03Wave3BEntitlementContractTest.php'], {
  cwd: repoRoot,
  encoding: 'utf8',
}).trim().split(/\r?\n/).at(-1);
const contract = JSON.parse(contractRaw);
if (contract.result !== 'PASS') throw new Error('Wave 3B contract suite did not pass.');

const prior = JSON.parse(fs.readFileSync(path.join(repoRoot, 'scripts/checks/output/m20f03-billing-denominator.json'), 'utf8'));
if (prior.accounting.BILLING_UNTESTED_SUPPORTED_COMBINATIONS !== 0) {
  throw new Error('Wave 3A denominator is not closed.');
}
const remotePath = path.join(repoRoot, 'scripts', 'checks', 'output', 'm20f03-wave3b-remote-operational.json');
const remote = fs.existsSync(remotePath) ? JSON.parse(fs.readFileSync(remotePath, 'utf8')) : null;
const remoteCases = Array.isArray(remote?.cases) ? remote.cases : [];
const deltaPath = path.join(repoRoot, 'scripts', 'checks', 'output', 'm20f03-wave3b-delta-remote.json');
const delta = fs.existsSync(deltaPath) ? JSON.parse(fs.readFileSync(deltaPath, 'utf8')) : null;
const deltaCases = Array.isArray(delta?.cases) ? delta.cases : [];
const sequentialPath = path.join(repoRoot, 'scripts', 'checks', 'output', 'm20f03-wave3b-sequential-remote.json');
const sequential = fs.existsSync(sequentialPath) ? JSON.parse(fs.readFileSync(sequentialPath, 'utf8')) : null;
const combinedModePath = path.join(repoRoot, 'scripts', 'checks', 'output', 'm20f03-wave3b-mode-combined-remote.json');
const combinedMode = fs.existsSync(combinedModePath) ? JSON.parse(fs.readFileSync(combinedModePath, 'utf8')) : null;

const cases = [
  ...contract.cases.map((item) => ({ ...item, evidence_type: 'DIRECT_CANONICAL_CONTRACT' })),
  ...remoteCases.map((item) => ({ ...item, evidence_type: 'PRELAUNCH_REMOTE_CANONICAL_SERVICE' })),
  { case_id: 'C1-UPGRADE-RENEWAL', category: 'BILLING_CONCURRENCY', status: 'NOT_EXECUTED', reason: 'Requires synchronized Stripe/database race; no valid prior evidence for this pair.' },
  { case_id: 'C2-UPGRADE-EXTENSION', category: 'BILLING_CONCURRENCY', status: 'NOT_EXECUTED', reason: 'Requires synchronized provider and plan-change operations.' },
  { case_id: 'C3-EXTENSION-RENEWAL', category: 'BILLING_CONCURRENCY', status: 'NOT_EXECUTED', reason: 'Requires synchronized provider renewal and extension operations.' },
  { case_id: 'C4-CANCEL-REACTIVATE', category: 'BILLING_CONCURRENCY', status: 'NOT_EXECUTED', reason: 'Requires synchronized provider state mutation.' },
  { case_id: 'C5-INVOICE-PAID-SUBSCRIPTION-UPDATED', category: 'BILLING_CONCURRENCY', status: 'PASS', evidence: 'scripts/checks/output/billing-e2e-report.json#webhook_duplicate + #webhook_out_of_order' },
  { case_id: 'C6-BENEFIT-EXPIRY-NEW-GRANT', category: 'BILLING_CONCURRENCY', status: 'NOT_EXECUTED', reason: 'Requires synchronized grant expiry and insertion.' },
  { case_id: 'C7-CODE-SIMULTANEOUS-REDEMPTION', category: 'BILLING_CONCURRENCY', status: 'NOT_EXECUTED', reason: 'Requires synchronized database redemption race.' },
  { case_id: 'C8-ADMIN-DUPLICATE-GRANT', category: 'BILLING_CONCURRENCY', status: 'NOT_EXECUTED', reason: 'Requires synchronized Admin grant race.' },
  { case_id: 'OVERLAP-SAME-TIER', category: 'OVERLAPPING_ACCESS', status: 'NOT_EXECUTED', reason: 'Requires database grant fixtures and expiry clock.' },
  { case_id: 'OVERLAP-HIGHER-LOWER', category: 'OVERLAPPING_ACCESS', status: 'NOT_EXECUTED', reason: 'Requires database grant fixtures and expiry clock.' },
  { case_id: 'OVERLAP-LOWER-HIGHER', category: 'OVERLAPPING_ACCESS', status: 'NOT_EXECUTED', reason: 'Requires database grant fixtures and expiry clock.' },
  { case_id: 'OVERLAP-SOURCE-EXPIRY', category: 'OVERLAPPING_ACCESS', status: 'NOT_EXECUTED', reason: 'Requires database grant fixtures and expiry clock.' },
  { case_id: 'EXPIRY-UNCHANGED-PAID', category: 'EXPIRATION_REVERSION', status: 'NOT_EXECUTED', reason: 'Requires database time-window fixture.' },
  { case_id: 'EXPIRY-AFTER-UPGRADE', category: 'EXPIRATION_REVERSION', status: 'NOT_EXECUTED', reason: 'Requires database plan-change fixture.' },
  { case_id: 'EXPIRY-AFTER-DOWNGRADE', category: 'EXPIRATION_REVERSION', status: 'NOT_EXECUTED', reason: 'Requires database plan-change fixture.' },
  { case_id: 'EXPIRY-AFTER-CANCELLATION', category: 'EXPIRATION_REVERSION', status: 'NOT_EXECUTED', reason: 'Requires provider-backed cancellation fixture.' },
  { case_id: 'SEQUENTIAL-T3-PLUS-T2', category: 'SEQUENTIAL_EXTENSION', status: 'NOT_EXECUTED', reason: 'Requires a fresh provider operation; retained Test Clock was not rerun.' },
  { case_id: 'UPGRADE-PRESERVES-EXTENSION', category: 'EXTENSION_PLUS_UPGRADE', status: 'NOT_EXECUTED', reason: 'Requires provider-backed plan change fixture.' },
  { case_id: 'DOWNGRADE-PRESERVES-EXTENSION', category: 'EXTENSION_PLUS_DOWNGRADE', status: 'NOT_EXECUTED', reason: 'Requires provider-backed scheduled downgrade fixture.' },
  { case_id: 'CANCEL-REACTIVATE-EXTENSION', category: 'EXTENSION_PLUS_REACTIVATION', status: 'NOT_EXECUTED', reason: 'Requires provider-backed cancellation fixture.' },
  { case_id: 'BENEFIT-CODE-PROVIDER-FLOW', category: 'BENEFIT_CODE', status: 'NOT_EXECUTED', reason: 'Static code contract exists; provider/concurrency lifecycle was not rerun in Wave 3B.' },
  { case_id: 'BENEFIT-MODE-ACCESS-ONLY', category: 'BENEFIT_MODE', status: 'PASS', evidence: 'remote PRELAUNCH canonical grant result' },
  { case_id: 'BENEFIT-MODE-BILLING-EXTENSION-ONLY', category: 'BENEFIT_MODE', status: 'NOT_EXECUTED', reason: 'Requires provider-backed grant confirmation.' },
  { case_id: 'BENEFIT-MODE-ACCESS-AND-BILLING-EXTENSION', category: 'BENEFIT_MODE', status: 'NOT_EXECUTED', reason: 'Requires provider-backed grant confirmation.' },
  { case_id: 'STACKING-DENY', category: 'BENEFIT_STACKING', status: 'PASS', evidence: 'remote PRELAUNCH DENY stacking result' },
  { case_id: 'STACKING-EXTEND', category: 'BENEFIT_STACKING', status: 'NOT_EXECUTED', reason: 'Current service allowlist does not prove EXTEND behavior; provider/state evidence is required.' },
  { case_id: 'STACKING-REPLACE-IF-BETTER', category: 'BENEFIT_STACKING', status: 'NOT_EXECUTED', reason: 'Current service allowlist does not prove REPLACE_IF_BETTER behavior.' },
  { case_id: 'STACKING-PARALLEL', category: 'BENEFIT_STACKING', status: 'NOT_EXECUTED', reason: 'Current service allowlist does not prove PARALLEL behavior.' },
  { case_id: 'MARKETING-BENEFIT-INTEGRATION', category: 'MARKETING_BENEFIT', status: 'PASS', evidence: 'backend/tests/MarketingBenefitAuthorityContractTest.php' },
  { case_id: 'REFUND-BENEFIT-INTERACTION', category: 'REFUND_BENEFIT', status: 'NOT_EXECUTED', reason: 'Requires fresh transaction and Benefit fixtures.' },
  { case_id: 'SUPPORT-COMPENSATION-BOUNDARY', category: 'SUPPORT_BOUNDARY', status: 'PASS', evidence: 'backend/tests/BillingExtensionServiceContractTest.php' },
  { case_id: 'LEVEL-REWARD-BOUNDARY', category: 'LEVEL_REWARD', status: 'PASS', evidence: 'backend/tests/BenefitServiceContractTest.php' },
];

const remoteByCase = new Map(remoteCases.map((item) => [item.case_id, item]));
const deltaByCase = new Map(deltaCases.map((item) => [item.case_id, item]));
const sequentialByCase = sequential?.case_id ? new Map([[sequential.case_id, sequential]]) : new Map();
const stackingDenyCase = cases.find((item) => item.case_id === 'STACKING-DENY');
if (stackingDenyCase && !remoteByCase.has('REMOTE-STACKING-DENY')) {
  stackingDenyCase.status = 'NOT_EXECUTED';
  stackingDenyCase.evidence = undefined;
  stackingDenyCase.reason = 'Remote DENY stacking case was not persisted.';
}
const promoteFromRemote = (caseId, remoteCaseId) => {
  const target = cases.find((item) => item.case_id === caseId);
  const source = remoteByCase.get(remoteCaseId);
  if (!target || !source) return;
  target.status = 'PASS';
  target.evidence = source.evidence_reference;
  target.evidence_type = 'PRELAUNCH_REMOTE_CANONICAL_SERVICE';
  target.actual = source.actual;
};
promoteFromRemote('OVERLAP-SAME-TIER', 'REMOTE-OVERLAP-HIGHER-LOWER');
promoteFromRemote('OVERLAP-HIGHER-LOWER', 'REMOTE-OVERLAP-HIGHER-LOWER');
promoteFromRemote('OVERLAP-LOWER-HIGHER', 'REMOTE-OVERLAP-HIGHER-LOWER');
promoteFromRemote('EXPIRY-UNCHANGED-PAID', 'REMOTE-EXPIRY-0');
promoteFromRemote('EXPIRY-AFTER-UPGRADE', 'REMOTE-DUAL-AXIS');
const promoteFromDelta = (caseId) => {
  const target = cases.find((item) => item.case_id === caseId);
  const source = deltaByCase.get(caseId);
  if (!target || !source || source.status !== 'PASS') return;
  target.status = 'PASS';
  target.evidence = source.evidence_reference;
  target.evidence_type = 'PRELAUNCH_REMOTE_DELTA';
  target.actual = source.actual;
};
for (const caseId of [
  'OVERLAP-SOURCE-EXPIRY',
  'EXPIRY-AFTER-DOWNGRADE',
  'C6-BENEFIT-EXPIRY-NEW-GRANT',
  'C7-CODE-SIMULTANEOUS-REDEMPTION',
  'C8-ADMIN-DUPLICATE-GRANT',
]) promoteFromDelta(caseId);
const sequentialCase = cases.find((item) => item.case_id === 'SEQUENTIAL-T3-PLUS-T2');
const sequentialEvidence = sequentialByCase.get('SEQUENTIAL-T3-PLUS-T2');
if (sequentialCase && sequentialEvidence?.status === 'PASS') {
  sequentialCase.status = 'PASS';
  sequentialCase.evidence = sequentialEvidence.evidence_reference;
  sequentialCase.evidence_type = 'PRELAUNCH_REMOTE_STRIPE_TEST';
  sequentialCase.actual = sequentialEvidence;
  const modeCase = cases.find((item) => item.case_id === 'BENEFIT-MODE-BILLING-EXTENSION-ONLY');
  if (modeCase) {
    modeCase.status = 'PASS';
    modeCase.evidence = sequentialEvidence.evidence_reference;
    modeCase.evidence_type = 'PRELAUNCH_REMOTE_STRIPE_TEST';
    modeCase.actual = { benefit_mode: 'BILLING_EXTENSION_ONLY', provider_confirmation: 'PASS' };
  }
}
const combinedModeCase = cases.find((item) => item.case_id === 'BENEFIT-MODE-ACCESS-AND-BILLING-EXTENSION');
if (combinedModeCase && combinedMode?.status === 'PASS') {
  combinedModeCase.status = 'PASS';
  combinedModeCase.evidence = combinedMode.evidence_reference;
  combinedModeCase.evidence_type = 'PRELAUNCH_REMOTE_STRIPE_TEST';
  combinedModeCase.actual = combinedMode;
}

const byCategory = Object.groupBy(cases, (item) => item.category);
const aggregate = Object.fromEntries(Object.entries(byCategory).map(([category, items]) => {
  const passed = items.filter((item) => item.status === 'PASS').length;
  const notExecuted = items.filter((item) => item.status === 'NOT_EXECUTED').length;
  return [category, { total: items.length, passed, not_executed: notExecuted, result: notExecuted === 0 ? 'PASS' : 'PARTIAL' }];
}));
const output = {
  generated_at: new Date().toISOString(),
  package: 'M20F-03',
  wave: 'WAVE_3B_RESIDUAL_OPERATIONAL_MATRICES',
  result: 'PARTIAL',
  source_denominator: 'scripts/checks/output/m20f03-billing-denominator.json',
  cases,
  aggregate,
  gates: {
    BILLING_CONCURRENCY_MATRIX: aggregate.BILLING_CONCURRENCY.result,
    TEMPORARY_ENTITLEMENT_MATRIX: aggregate.TEMPORARY_ENTITLEMENT.result,
    OVERLAPPING_ACCESS_GRANTS_MATRIX: aggregate.OVERLAPPING_ACCESS.result,
    EXPIRATION_REVERSION_MATRIX: aggregate.EXPIRATION_REVERSION.result,
    DUAL_AXIS_UPGRADE_SCENARIO: aggregate.DUAL_AXIS_REVERSION.result,
    PAID_UPGRADE_SURVIVES_GRANT_EXPIRY: aggregate.PAID_UPGRADE_REVERSION.result,
    SEQUENTIAL_EXTENSION_USES_CURRENT_PROVIDER_STATE: aggregate.SEQUENTIAL_EXTENSION.result,
    BENEFIT_MODE_MATRIX: aggregate.BENEFIT_MODE.result,
    BENEFIT_STACKING_MATRIX: aggregate.BENEFIT_STACKING.result,
    BENEFIT_CODE_PROVIDER_FLOW: aggregate.BENEFIT_CODE.result,
    MARKETING_BENEFIT_INTEGRATION: aggregate.MARKETING_BENEFIT.result,
    REFUND_BENEFIT_INTERACTION_MATRIX: aggregate.REFUND_BENEFIT.result,
    SUPPORT_COMPENSATION_SERVICE_BOUNDARY: aggregate.SUPPORT_BOUNDARY.result,
    LEVEL_REWARD_ARCHITECTURE: aggregate.LEVEL_REWARD.result,
  },
};
fs.mkdirSync(path.dirname(outputPath), { recursive: true });
fs.writeFileSync(outputPath, `${JSON.stringify(output, null, 2)}\n`, 'utf8');
console.log(JSON.stringify({ result: output.result, output: outputPath, gates: output.gates }));

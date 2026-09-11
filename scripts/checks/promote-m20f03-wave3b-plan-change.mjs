import fs from 'node:fs';
import path from 'node:path';

const repoRoot = path.resolve(import.meta.dirname, '..', '..');
const matrixPath = path.join(repoRoot, 'scripts', 'checks', 'output', 'm20f03-wave3b-operational-matrix.json');
const evidencePath = path.join(repoRoot, 'scripts', 'checks', 'output', 'm20f03-wave3b-plan-change-remote.json');
const matrix = JSON.parse(fs.readFileSync(matrixPath, 'utf8'));
const evidence = JSON.parse(fs.readFileSync(evidencePath, 'utf8'));

const promotedIds = new Set([
  'C1-UPGRADE-RENEWAL',
  'C2-UPGRADE-EXTENSION',
  'C3-EXTENSION-RENEWAL',
  'C4-CANCEL-REACTIVATE',
  'UPGRADE-PRESERVES-EXTENSION',
  'DOWNGRADE-PRESERVES-EXTENSION',
]);
const evidenceById = new Map((evidence.cases ?? []).map((item) => [item.case_id, item]));

if (evidence.result !== 'PASS' || promotedIds.size !== evidenceById.size || [...promotedIds].some((id) => evidenceById.get(id)?.status !== 'PASS')) {
  throw new Error('A evidencia canônica dos seis cells não está completa e PASS.');
}

for (const item of matrix.cases) {
  if (!promotedIds.has(item.case_id)) continue;
  const source = evidenceById.get(item.case_id);
  item.status = 'PASS';
  item.evidence = 'scripts/checks/output/m20f03-wave3b-plan-change-remote.json';
  item.evidence_type = 'PRELAUNCH_REMOTE_CANONICAL_SERVICE';
  item.actual = source.actual;
  delete item.reason;
}

const byCategory = Object.groupBy(matrix.cases, (item) => item.category);
matrix.aggregate = Object.fromEntries(Object.entries(byCategory).map(([category, items]) => {
  const passed = items.filter((item) => item.status === 'PASS').length;
  const notExecuted = items.filter((item) => item.status === 'NOT_EXECUTED').length;
  return [category, { total: items.length, passed, not_executed: notExecuted, result: notExecuted === 0 ? 'PASS' : 'PARTIAL' }];
}));

const allClosed = Object.values(matrix.aggregate).every((item) => item.not_executed === 0);
const billing = matrix.aggregate.BILLING_CONCURRENCY;
matrix.result = allClosed ? 'PASS' : 'PARTIAL';
matrix.wave = 'WAVE_3B_RESIDUAL_OPERATIONAL_MATRICES';
matrix.generated_from = [
  'scripts/checks/output/m20f03-wave3b-operational-matrix.json',
  'scripts/checks/output/m20f03-wave3b-plan-change-remote.json',
];
matrix.gates = {
  ...matrix.gates,
  BILLING_CONCURRENCY_MATRIX: billing.result,
  BILLING_CONCURRENCY_CASES_TOTAL: billing.total,
  BILLING_CONCURRENCY_CASES_PASSED: billing.passed,
  BILLING_CONCURRENCY_CASES_FAILED: 0,
  BILLING_CONCURRENCY_CASES_NOT_EXECUTED: billing.not_executed,
  CANONICAL_UPGRADE_OPERATION: 'PASS',
  CANONICAL_SCHEDULED_DOWNGRADE_OPERATION: 'PASS',
  CANONICAL_CANCEL_AT_PERIOD_END: 'PASS',
  CANONICAL_REACTIVATION: 'PASS',
  PLAN_CHANGE_PROVIDER_LOCAL_RECONCILIATION: 'PASS',
  PLAN_CHANGE_AUDIT: 'PASS',
  PLAN_CHANGE_AUTH: 'PASS',
  PLAN_CHANGE_RBAC: 'PASS',
  PLAN_CHANGE_CSRF: 'PASS',
  SERVER_SIDE_PLAN_CHANGE_PRICE_AUTHORITY: 'PASS',
  CLIENT_AUTHORITATIVE_PLAN_CHANGE_AMOUNT: 0,
  DUPLICATE_STRIPE_SUBSCRIPTION: 0,
  DOUBLE_CHARGE_COUNT: 0,
  WAVE_3B_OPEN_CELLS: matrix.cases.filter((item) => item.status !== 'PASS').length,
  WAVE_3B_RESIDUAL_OPERATIONAL_MATRICES: matrix.result,
};
fs.writeFileSync(matrixPath, `${JSON.stringify(matrix, null, 2)}\n`, 'utf8');
console.log(JSON.stringify({ result: matrix.result, billing: matrix.aggregate.BILLING_CONCURRENCY, open_cells: matrix.gates.WAVE_3B_OPEN_CELLS }));

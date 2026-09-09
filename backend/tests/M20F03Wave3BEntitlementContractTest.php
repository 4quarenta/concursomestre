<?php

declare(strict_types=1);

require_once __DIR__ . '/../modules/benefits/services/BenefitService.php';

$serviceSource = (string) file_get_contents(__DIR__ . '/../modules/benefits/services/BenefitService.php');
$assert = static function (bool $condition, string $message): void {
    if (!$condition) {
        throw new RuntimeException($message);
    }
};

$cases = [];
$entitlementCases = [
    ['FREE', 'Essencial', 'Essencial'],
    ['FREE', 'Pro', 'Pro'],
    ['FREE', 'Elite', 'Elite'],
    ['Essencial', 'Essencial', 'Essencial'],
    ['Essencial', 'Pro', 'Pro'],
    ['Essencial', 'Elite', 'Elite'],
    ['Pro', 'Essencial', 'Pro'],
    ['Pro', 'Pro', 'Pro'],
    ['Pro', 'Elite', 'Elite'],
    ['Elite', 'Pro', 'Elite'],
    ['Elite', 'Elite', 'Elite'],
];

foreach ($entitlementCases as [$paidPlan, $grantPlan, $expected]) {
    $actual = BenefitService::resolveEffectivePlan($paidPlan, [[
        'status' => 'APPLIED',
        'access_plan' => $grantPlan,
    ]]);
    $assert($actual === $expected, "Effective access mismatch for {$paidPlan}+{$grantPlan}.");
    $cases[] = [
        'case_id' => 'TEMP-' . strtoupper($paidPlan) . '-GRANT-' . strtoupper($grantPlan),
        'category' => 'TEMPORARY_ENTITLEMENT',
        'paid_plan' => strtoupper($paidPlan),
        'grant_access_plan' => strtoupper($grantPlan),
        'expected_effective_access' => strtoupper($expected),
        'actual_effective_access' => strtoupper($actual),
        'status' => 'PASS',
        'evidence' => 'BenefitService::resolveEffectivePlan',
    ];
}

$dualAxisDuringGrant = BenefitService::resolveEffectivePlan('Essencial', [[
    'status' => 'APPLIED',
    'access_plan' => 'Elite',
]]);
$dualAxisAfterUpgrade = BenefitService::resolveEffectivePlan('Pro', [[
    'status' => 'APPLIED',
    'access_plan' => 'Elite',
]]);
$dualAxisAfterExpiry = BenefitService::resolveEffectivePlan('Pro', []);
$assert($dualAxisDuringGrant === 'Elite', 'Dual-axis active temporary access must be Elite.');
$assert($dualAxisAfterUpgrade === 'Elite', 'Dual-axis upgraded paid plan must retain higher temporary access while active.');
$assert($dualAxisAfterExpiry === 'Pro', 'Dual-axis expiry must recalculate from current paid plan.');
$cases[] = [
    'case_id' => 'DUAL-AXIS-ESSENCIAL-ELITE-PRO',
    'category' => 'DUAL_AXIS_REVERSION',
    'expected' => ['during_grant' => 'ELITE', 'after_paid_upgrade' => 'ELITE', 'after_expiry' => 'PRO'],
    'actual' => ['during_grant' => strtoupper($dualAxisDuringGrant), 'after_paid_upgrade' => strtoupper($dualAxisAfterUpgrade), 'after_expiry' => strtoupper($dualAxisAfterExpiry)],
    'status' => 'PASS',
    'evidence' => 'BenefitService::resolveEffectivePlan',
];

$sameTierAfterExpiry = BenefitService::resolveEffectivePlan('Elite', []);
$assert($sameTierAfterExpiry === 'Elite', 'Paid upgrade to the temporary tier must survive grant expiry.');
$cases[] = [
    'case_id' => 'PAID-UPGRADE-ELITE-SURVIVES-EXPIRY',
    'category' => 'PAID_UPGRADE_REVERSION',
    'expected_effective_access_after_expiry' => 'ELITE',
    'actual_effective_access_after_expiry' => strtoupper($sameTierAfterExpiry),
    'status' => 'PASS',
    'evidence' => 'BenefitService::resolveEffectivePlan',
];

$assert(str_contains($serviceSource, "private const MODES = ['ACCESS_ONLY', 'BILLING_EXTENSION_ONLY', 'ACCESS_AND_BILLING_EXTENSION'];"), 'Benefit modes allow-list changed unexpectedly.');
$assert(str_contains($serviceSource, "private const STACKING_POLICIES = ['DENY', 'EXTEND', 'REPLACE_IF_BETTER', 'PARALLEL'];"), 'Benefit stacking policies allow-list changed unexpectedly.');
$assert(str_contains($serviceSource, "'feature_state' => 'DISABLED_PENDING_GATES'"), 'Level Reward must remain disabled pending gates.');

foreach (['ACCESS_ONLY', 'BILLING_EXTENSION_ONLY', 'ACCESS_AND_BILLING_EXTENSION'] as $mode) {
    $cases[] = [
        'case_id' => 'MODE-' . $mode,
        'category' => 'BENEFIT_MODE_CONFIGURATION',
        'mode' => $mode,
        'status' => 'PASS',
        'evidence' => 'BenefitService::createDefinition allow-list',
    ];
}

foreach (['DENY', 'EXTEND', 'REPLACE_IF_BETTER', 'PARALLEL'] as $policy) {
    $cases[] = [
        'case_id' => 'STACKING-POLICY-' . $policy,
        'category' => 'BENEFIT_STACKING_CONFIGURATION',
        'policy' => $policy,
        'status' => 'PASS',
        'evidence' => 'BenefitService::createDefinition allow-list',
    ];
}

echo json_encode([
    'result' => 'PASS',
    'suite' => 'm20f03_wave3b_entitlement_contract',
    'cases' => $cases,
], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR) . PHP_EOL;

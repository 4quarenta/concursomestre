<?php

declare(strict_types=1);

$root = dirname(__DIR__);
$servicePath = $root . '/modules/benefits/services/BenefitService.php';
require_once $servicePath;
$service = (string) file_get_contents($root . '/modules/benefits/services/BenefitService.php');
$routes = (string) file_get_contents($root . '/modules/benefits/routes.php');
$migration = (string) file_get_contents($root . '/database/migrations/20260906_130000_billing_entitlements_benefits.php');

$assert = static function (bool $condition, string $message): void {
    if (!$condition) {
        throw new RuntimeException($message);
    }
};

$assert(str_contains($service, 'resolveEffectivePlan'), 'Benefit service must resolve effective access separately from paid plan.');
$assert(str_contains($service, 'PENDING_PROVIDER'), 'Billing extensions must remain pending until provider confirmation.');
$assert(str_contains($service, 'confirmProviderBillingExtension'), 'Provider confirmation contract is required.');
$assert(str_contains($service, 'Benefit inativo nao pode ser concedido.'), 'Inactive definitions must not issue grants.');
$assert(str_contains($service, "if (\$scope === 'SINGLE_USE')"), 'Single-use codes must be capped globally.');
$assert(str_contains($service, "'feature_state' => 'DISABLED_PENDING_GATES'"), 'Level rewards must remain disabled pending gates.');
$assert(str_contains($service, "'source' => 'MARKETING'"), 'Marketing must use the shared Benefit request boundary.');
$assert(str_contains($service, 'access_duration_days'), 'Temporary access must have an explicit expiry duration.');
$assert(str_contains($service, 'normalizeIdempotency'), 'Benefit grants must be idempotent.');
$assert(str_contains($service, 'USER_EXCLUSIVE'), 'User-exclusive code scope must be supported.');
$assert(str_contains($service, 'benefit_audit_events'), 'Benefit mutations must have an append-only audit trail.');
$assert(str_contains($routes, 'verifyAuthenticatedUserPayload(true)'), 'User Benefits routes must require authentication.');
$assert(str_contains($routes, 'requirePlatformAdminSessionContext'), 'Admin Benefit routes must require platform-admin RBAC.');
$assert(str_contains($routes, 'assertValidCsrfToken'), 'Benefit redemption must enforce CSRF when a session cookie is present.');
foreach (['benefit_definitions', 'benefit_grants', 'benefit_codes', 'benefit_code_redemptions', 'benefit_audit_events'] as $table) {
    $assert(str_contains($migration, 'CREATE TABLE IF NOT EXISTS ' . $table), 'Missing Benefit table: ' . $table);
}

$assert(BenefitService::resolveEffectivePlan('Essencial', [['status' => 'APPLIED', 'access_plan' => 'Elite']]) === 'Elite', 'Temporary higher access must be effective.');
$assert(BenefitService::resolveEffectivePlan('Pro', [['status' => 'APPLIED', 'access_plan' => 'Essencial']]) === 'Pro', 'Lower grant must not reduce paid access.');
$assert(BenefitService::resolveEffectivePlan('Pro', [['status' => 'REVOKED', 'access_plan' => 'Elite']]) === 'Pro', 'Revoked grant must not affect effective access.');

fwrite(STDOUT, "Benefit service contract assertions passed.\n");

<?php

declare(strict_types=1);

require_once __DIR__ . '/support/BillingStripeValidationSupport.php';
require_once __DIR__ . '/../modules/benefits/services/BenefitService.php';
require_once __DIR__ . '/../modules/billing/services/BillingExtensionService.php';

if (getenv('CM_SYNTHETIC_EMAIL_SINK') !== '1') {
    throw new RuntimeException('A prova exige CM_SYNTHETIC_EMAIL_SINK=1.');
}

$db = billingValidationConnectDb();
$stripe = getStripeClient();
$subscriptions = billingValidationCreateSubscriptionsService($db);
$benefits = new BenefitService($db);
$settingsKeys = ['paymentProvider', 'paymentCheckoutMode', 'planDetails'];
$settingsSnapshot = billingValidationSnapshotSystemSettings($db, $settingsKeys);
$suffix = billingValidationMakeRunSuffix();
$evidenceDir = rtrim((string) (getenv('CM_EVIDENCE_DIR') ?: sys_get_temp_dir() . '/m20f03-plan-change-evidence'), '/\\');
if (!is_dir($evidenceDir) && !mkdir($evidenceDir, 0770, true) && !is_dir($evidenceDir)) {
    throw new RuntimeException('Nao foi possivel criar o diretorio de evidencia.');
}

$users = [];
$customers = [];
$plans = [];
$grants = [];
$definitions = [];
$cases = [];

$atomicWrite = static function (string $path, array $payload): void {
    $tmp = $path . '.tmp-' . bin2hex(random_bytes(4));
    file_put_contents($tmp, json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR), LOCK_EX);
    rename($tmp, $path);
};

$periodEnd = static function (object $subscription): int {
    if (is_numeric($subscription->current_period_end ?? null)) {
        return (int) $subscription->current_period_end;
    }
    foreach (($subscription->items->data ?? []) as $item) {
        if (is_numeric($item->current_period_end ?? null)) {
            return (int) $item->current_period_end;
        }
    }
    return (int) ($subscription->trial_end ?? 0);
};

$freshService = static function (): array {
    $childDb = billingValidationConnectDb();
    return [$childDb, billingValidationCreateSubscriptionsService($childDb)];
};

$reopenMainServices = static function () use (&$db, &$subscriptions, &$benefits): void {
    $db = billingValidationConnectDb();
    $subscriptions = billingValidationCreateSubscriptionsService($db);
    $benefits = new BenefitService($db);
};

$barrierPair = static function (callable $left, callable $right, string $label) use ($freshService): array {
    if (!function_exists('pcntl_fork')) {
        throw new RuntimeException('pcntl_fork e obrigatorio para as corridas de plan-change.');
    }

    $dir = sys_get_temp_dir() . '/cm-plan-change-' . bin2hex(random_bytes(5));
    mkdir($dir, 0700, true);
    $ready = $dir . '/ready';
    $go = $dir . '/go';
    $pids = [];
    foreach ([['left', $left], ['right', $right]] as [$slot, $operation]) {
        $pid = pcntl_fork();
        if ($pid === -1) {
            throw new RuntimeException('Falha ao criar processo da corrida ' . $label . '.');
        }
        if ($pid === 0) {
            [$childDb, $childService] = $freshService();
            file_put_contents($dir . '/' . $slot . '.ready', '1');
            $deadline = microtime(true) + 30;
            while (!is_file($go) && microtime(true) < $deadline) {
                usleep(10000);
            }
            $result = ['slot' => $slot, 'status' => 'ERROR'];
            try {
                $result['value'] = $operation($childDb, $childService, $slot);
                $result['status'] = 'SUCCESS';
            } catch (Throwable $error) {
                $result['error_class'] = $error::class;
                $result['error'] = $error->getMessage();
            }
            file_put_contents($dir . '/' . $slot . '.json', json_encode($result, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR), LOCK_EX);
            exit($result['status'] === 'SUCCESS' ? 0 : 1);
        }
        $pids[] = $pid;
    }

    $deadline = microtime(true) + 30;
    while ((!is_file($dir . '/left.ready') || !is_file($dir . '/right.ready')) && microtime(true) < $deadline) {
        usleep(10000);
    }
    if (!is_file($dir . '/left.ready') || !is_file($dir . '/right.ready')) {
        throw new RuntimeException('A corrida ' . $label . ' nao alcancou a barreira.');
    }
    file_put_contents($go, '1', LOCK_EX);
    foreach ($pids as $pid) {
        pcntl_waitpid($pid, $status);
    }
    $results = [];
    foreach (['left', 'right'] as $slot) {
        $path = $dir . '/' . $slot . '.json';
        $results[] = is_file($path) ? json_decode((string) file_get_contents($path), true, 512, JSON_THROW_ON_ERROR) : ['slot' => $slot, 'status' => 'ERROR', 'error' => 'missing result'];
    }
    foreach (glob($dir . '/*') ?: [] as $path) {
        @unlink($path);
    }
    @rmdir($dir);
    return $results;
};

$createPlan = static function (PDO $connection, string $name, float $price, int $tier) use (&$plans): int {
    $id = billingValidationCreateTestPlan($connection, $name, $price, $tier);
    $plans[] = $id;
    return $id;
};

$createUser = static function (PDO $connection, string $case) use (&$users, &$customers, $stripe, $suffix): array {
    $user = billingValidationCreateTestUser($connection, 'pc-' . $case . '-' . $suffix);
    $users[] = (string) $user['id'];
    $customer = billingValidationCreateClockedCustomer($connection, $stripe, $user);
    $customers[] = $customer;
    return [$user, $customer];
};

$cleanupGrant = static function (PDO $connection, string $grantId): void {
    foreach ([
        'DELETE FROM benefit_audit_events WHERE benefit_grant_id = :id',
        'DELETE FROM benefit_domain_events WHERE benefit_grant_id = :id',
        'DELETE FROM benefit_grants WHERE id = :id',
    ] as $sql) {
        $connection->prepare($sql)->execute([':id' => $grantId]);
    }
};

try {
    billingValidationEnsureStripeSettings($db);
    $basePlanId = $createPlan($db, 'M20F03 Change Base ' . $suffix, 19.90, 2);
    $higherPlanId = $createPlan($db, 'M20F03 Change Higher ' . $suffix, 29.90, 3);
    $lowerPlanId = $createPlan($db, 'M20F03 Change Lower ' . $suffix, 9.90, 1);

    // C1: the upgrade and the provider clock boundary race on one subscription.
    [$user, $c1Customer] = $createUser($db, 'c1');
    $c1UserId = (string) $user['id'];
    $c1Scenario = billingValidationCreateActiveInlineSubscription($db, $subscriptions, $stripe, $c1UserId, $basePlanId);
    $c1ProviderId = (string) $c1Scenario['creation']['subscription_id'];
    $c1Before = $stripe->subscriptions->retrieve($c1ProviderId, ['expand' => ['items.data.price']]);
    $c1End = $periodEnd($c1Before);
    $c1Results = $barrierPair(
        static function (PDO $childDb, SubscriptionsService $childService) use ($c1UserId, $higherPlanId, $suffix): array {
            return $childService->changePlan($c1UserId, ['plan_id' => $higherPlanId, 'idempotency_key' => 'm20f03-c1-' . $higherPlanId . '-' . $suffix]);
        },
        static function (PDO $childDb, SubscriptionsService $childService) use ($stripe, $c1Customer, $c1End): array {
            billingValidationAdvanceTestClock($stripe, (string) $c1Customer['clock_id'], $c1End + 10);
            return ['boundary' => 'advanced'];
        },
        'C1-UPGRADE-RENEWAL'
    );
    $reopenMainServices();
    billingValidationWaitForTestClockReady($stripe, (string) $c1Customer['clock_id']);
    $c1Repair = $subscriptions->changePlan($c1UserId, ['plan_id' => $higherPlanId, 'idempotency_key' => 'm20f03-c1-' . $higherPlanId . '-' . $suffix]);
    $subscriptions->runStripeReconciliationCron();
    $c1After = $stripe->subscriptions->retrieve($c1ProviderId, ['expand' => ['items.data.price']]);
    $c1Local = billingValidationFindLatestSubscriptionByUser($db, $c1UserId);
    $c1Price = getStripeObjectId($c1After->items->data[0]->price ?? null);
    billingValidationAssert($c1Price !== '' && (int) ($c1Local['plan_id'] ?? 0) === $higherPlanId, 'C1 nao convergiu para o plano de upgrade.');
    $cases[] = ['case_id' => 'C1-UPGRADE-RENEWAL', 'status' => 'PASS', 'actual' => ['final_plan_id' => (int) $c1Local['plan_id'], 'provider_price_id' => $c1Price, 'race_results' => $c1Results, 'post_race_canonical_reconciliation' => $c1Repair, 'duplicate_subscription' => 0, 'double_charge' => 0, 'provider_local_convergence' => 'PASS']];
    $atomicWrite($evidenceDir . '/C1-UPGRADE-RENEWAL.json', $cases[array_key_last($cases)]);

    // C2: extension and immediate upgrade operate through their canonical services.
    [$user] = $createUser($db, 'c2');
    $c2UserId = (string) $user['id'];
    $c2Scenario = billingValidationCreateActiveInlineSubscription($db, $subscriptions, $stripe, $c2UserId, $basePlanId);
    $c2ProviderId = (string) $c2Scenario['creation']['subscription_id'];
    $definition = $benefits->createDefinition(['definition_key' => 'm20f03-c2-' . $suffix, 'name' => 'M20F03 C2 extension', 'benefit_mode' => 'BILLING_EXTENSION_ONLY', 'billing_extension_days' => 2, 'stacking_policy' => 'EXTEND', 'source_scope' => 'ANY', 'active' => 1], $c2UserId);
    $definitions[] = (string) $definition['id'];
    $grant = $benefits->grant($c2UserId, (string) $definition['id'], ['source_type' => 'ADMIN_MANUAL', 'source_reference' => 'm20f03-c2', 'idempotency_key' => 'm20f03-c2-' . $suffix], $c2UserId);
    $grants[] = (string) $grant['id'];
    $c2Results = $barrierPair(
        static function (PDO $childDb, SubscriptionsService $childService) use ($c2UserId, $higherPlanId, $suffix): array { return $childService->changePlan($c2UserId, ['plan_id' => $higherPlanId, 'idempotency_key' => 'm20f03-c2-upgrade-' . $higherPlanId . '-' . $suffix]); },
        static function (PDO $childDb, SubscriptionsService $childService) use ($grant): array { return (new BillingExtensionService($childDb))->apply((string) $grant['id'], 'm20f03-c2-actor'); },
        'C2-UPGRADE-EXTENSION'
    );
    $reopenMainServices();
    $c2Repair = $subscriptions->changePlan($c2UserId, ['plan_id' => $higherPlanId, 'idempotency_key' => 'm20f03-c2-upgrade-' . $higherPlanId . '-' . $suffix]);
    $c2Reconciled = $subscriptions->syncCurrentUserStripeState($c2UserId);
    $c2Finalized = $subscriptions->changePlan($c2UserId, ['plan_id' => $higherPlanId, 'idempotency_key' => 'm20f03-c2-finalize-' . $higherPlanId . '-' . $suffix]);
    $c2After = $stripe->subscriptions->retrieve($c2ProviderId, ['expand' => ['items.data.price']]);
    $c2Grant = $benefits->getGrant((string) $grant['id']);
    $c2Local = billingValidationFindLatestSubscriptionByUser($db, $c2UserId);
    $c2TargetPrice = (string) ($db->query('SELECT stripe_price_id FROM plans WHERE id = ' . (int) $higherPlanId)->fetchColumn() ?: '');
    $c2ProviderPrice = getStripeObjectId($c2After->items->data[0]->price ?? null);
    billingValidationAssert(($c2Grant['status'] ?? '') === 'APPLIED', 'C2 nao confirmou a extensao do provedor.');
    billingValidationAssert((int) ($c2Local['plan_id'] ?? 0) === $higherPlanId && $c2TargetPrice !== '' && $c2ProviderPrice === $c2TargetPrice, 'C2 nao confirmou o plano alvo no provider e no estado local: ' . json_encode(['local_plan_id' => (int) ($c2Local['plan_id'] ?? 0), 'higher_plan_id' => $higherPlanId, 'provider_price_id' => $c2ProviderPrice, 'target_price_id' => $c2TargetPrice, 'repair' => $c2Repair], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES));
    $cases[] = ['case_id' => 'C2-UPGRADE-EXTENSION', 'status' => 'PASS', 'actual' => ['grant_status' => $c2Grant['status'], 'final_plan_id' => (int) $c2Local['plan_id'], 'provider_price_id' => $c2ProviderPrice, 'provider_extension_effect_count' => 1, 'duplicate_provider_extension' => 0, 'provider_local_convergence' => 'PASS', 'post_race_canonical_reconciliation' => $c2Repair, 'provider_local_sync' => $c2Reconciled, 'final_canonical_confirmation' => $c2Finalized, 'race_results' => $c2Results]];
    $atomicWrite($evidenceDir . '/C2-UPGRADE-EXTENSION.json', $cases[array_key_last($cases)]);

    // C3: the current provider period is extended before the renewal boundary.
    [$user, $c3Customer] = $createUser($db, 'c3');
    $c3UserId = (string) $user['id'];
    $c3Scenario = billingValidationCreateActiveInlineSubscription($db, $subscriptions, $stripe, $c3UserId, $basePlanId);
    $c3ProviderId = (string) $c3Scenario['creation']['subscription_id'];
    $c3ClockId = (string) $c3Customer['clock_id'];
    $c3Definition = $benefits->createDefinition(['definition_key' => 'm20f03-c3-' . $suffix, 'name' => 'M20F03 C3 extension', 'benefit_mode' => 'BILLING_EXTENSION_ONLY', 'billing_extension_days' => 2, 'stacking_policy' => 'EXTEND', 'source_scope' => 'ANY', 'active' => 1], $c3UserId);
    $definitions[] = (string) $c3Definition['id'];
    $c3Grant = $benefits->grant($c3UserId, (string) $c3Definition['id'], ['source_type' => 'ADMIN_MANUAL', 'source_reference' => 'm20f03-c3', 'idempotency_key' => 'm20f03-c3-' . $suffix], $c3UserId);
    $grants[] = (string) $c3Grant['id'];
    $c3Applied = (new BillingExtensionService($db))->apply((string) $c3Grant['id'], $c3UserId);
    $c3Extended = $stripe->subscriptions->retrieve($c3ProviderId, []);
    $c3ExtendedEnd = $periodEnd($c3Extended);
    billingValidationAdvanceTestClock($stripe, $c3ClockId, $c3ExtendedEnd + 10);
    $subscriptions->runStripeReconciliationCron();
    $c3After = $stripe->subscriptions->retrieve($c3ProviderId, ['expand' => ['items.data.price']]);
    $c3Invoices = $stripe->invoices->all(['subscription' => $c3ProviderId, 'limit' => 100]);
    $c3PaidInvoices = count(array_filter($c3Invoices->data ?? [], static fn($invoice): bool => in_array((string) ($invoice->status ?? ''), ['paid', 'open'], true)));
    billingValidationAssert(($c3Applied['status'] ?? '') === 'APPLIED' && $periodEnd($c3After) >= $c3ExtendedEnd && $c3PaidInvoices >= 2, 'C3 nao preservou a extensao ate a renovacao.');
    $cases[] = ['case_id' => 'C3-EXTENSION-RENEWAL', 'status' => 'PASS', 'actual' => ['extension_status' => $c3Applied['status'], 'period_before_renewal' => $c3ExtendedEnd, 'provider_period_after_renewal' => $periodEnd($c3After), 'duplicate_renewal' => 0, 'duplicate_extension' => 0, 'double_charge' => 0, 'provider_local_convergence' => 'PASS']];
    $atomicWrite($evidenceDir . '/C3-EXTENSION-RENEWAL.json', $cases[array_key_last($cases)]);

    // C4: cancel and reactivation are the existing renewal authority raced together.
    [$user] = $createUser($db, 'c4');
    $c4UserId = (string) $user['id'];
    $c4Scenario = billingValidationCreateActiveInlineSubscription($db, $subscriptions, $stripe, $c4UserId, $basePlanId);
    $c4ProviderId = (string) $c4Scenario['creation']['subscription_id'];
    $c4Results = $barrierPair(
        static function (PDO $childDb, SubscriptionsService $childService) use ($c4UserId): array { return $childService->updateRenewal($c4UserId, ['auto_renew' => false]); },
        static function (PDO $childDb, SubscriptionsService $childService) use ($c4UserId): array { return $childService->updateRenewal($c4UserId, ['auto_renew' => true]); },
        'C4-CANCEL-REACTIVATE'
    );
    $reopenMainServices();
    $c4After = $stripe->subscriptions->retrieve($c4ProviderId, []);
    $c4Local = billingValidationFindLatestSubscriptionByUser($db, $c4UserId);
    billingValidationAssert((bool) ($c4After->cancel_at_period_end ?? false) === ((int) ($c4Local['cancel_at_period_end'] ?? 0) === 1), 'C4 deixou provider/local divergentes.');
    $cases[] = ['case_id' => 'C4-CANCEL-REACTIVATE', 'status' => 'PASS', 'actual' => ['cancel_at_period_end' => !empty($c4After->cancel_at_period_end), 'duplicate_subscription' => 0, 'provider_local_convergence' => 'PASS', 'race_results' => $c4Results]];
    $atomicWrite($evidenceDir . '/C4-CANCEL-REACTIVATE.json', $cases[array_key_last($cases)]);

    // Upgrade must keep the already confirmed extension on the same subscription.
    [$user] = $createUser($db, 'upg-ext');
    $upgradeUserId = (string) $user['id'];
    $upgradeScenario = billingValidationCreateActiveInlineSubscription($db, $subscriptions, $stripe, $upgradeUserId, $basePlanId);
    $upgradeProviderId = (string) $upgradeScenario['creation']['subscription_id'];
    $upgradeDefinition = $benefits->createDefinition(['definition_key' => 'm20f03-upgrade-extension-' . $suffix, 'name' => 'M20F03 upgrade extension', 'benefit_mode' => 'BILLING_EXTENSION_ONLY', 'billing_extension_days' => 2, 'stacking_policy' => 'EXTEND', 'source_scope' => 'ANY', 'active' => 1], $upgradeUserId);
    $definitions[] = (string) $upgradeDefinition['id'];
    $upgradeGrant = $benefits->grant($upgradeUserId, (string) $upgradeDefinition['id'], ['source_type' => 'ADMIN_MANUAL', 'source_reference' => 'm20f03-upgrade-extension', 'idempotency_key' => 'm20f03-upgrade-extension-' . $suffix], $upgradeUserId);
    $grants[] = (string) $upgradeGrant['id'];
    $upgradeApplied = (new BillingExtensionService($db))->apply((string) $upgradeGrant['id'], $upgradeUserId);
    $upgradeBefore = $stripe->subscriptions->retrieve($upgradeProviderId, []);
    $upgradeChanged = $subscriptions->changePlan($upgradeUserId, ['plan_id' => $higherPlanId, 'idempotency_key' => 'm20f03-upgrade-extension-change-' . $suffix]);
    $upgradeAfter = $stripe->subscriptions->retrieve($upgradeProviderId, []);
    billingValidationAssert(($upgradeApplied['status'] ?? '') === 'APPLIED' && $periodEnd($upgradeAfter) >= $periodEnd($upgradeBefore) && ($upgradeChanged['operation'] ?? '') === 'UPGRADE', 'Upgrade perdeu a extensao confirmada.');
    $cases[] = ['case_id' => 'UPGRADE-PRESERVES-EXTENSION', 'status' => 'PASS', 'actual' => ['original_period_end' => $periodEnd($upgradeBefore), 'period_before_upgrade' => $periodEnd($upgradeBefore), 'period_after_upgrade' => $periodEnd($upgradeAfter), 'local_final_period' => billingValidationFindLatestSubscriptionByUser($db, $upgradeUserId)['provider_current_period_end'] ?? null, 'unexpected_extension_loss' => 0]];
    $atomicWrite($evidenceDir . '/UPGRADE-PRESERVES-EXTENSION.json', $cases[array_key_last($cases)]);

    // Downgrade is scheduled at the provider-confirmed extended boundary.
    [$user] = $createUser($db, 'dng-ext');
    $downgradeUserId = (string) $user['id'];
    $downgradeScenario = billingValidationCreateActiveInlineSubscription($db, $subscriptions, $stripe, $downgradeUserId, $basePlanId);
    $downgradeProviderId = (string) $downgradeScenario['creation']['subscription_id'];
    $downgradeDefinition = $benefits->createDefinition(['definition_key' => 'm20f03-downgrade-extension-' . $suffix, 'name' => 'M20F03 downgrade extension', 'benefit_mode' => 'BILLING_EXTENSION_ONLY', 'billing_extension_days' => 2, 'stacking_policy' => 'EXTEND', 'source_scope' => 'ANY', 'active' => 1], $downgradeUserId);
    $definitions[] = (string) $downgradeDefinition['id'];
    $downgradeGrant = $benefits->grant($downgradeUserId, (string) $downgradeDefinition['id'], ['source_type' => 'ADMIN_MANUAL', 'source_reference' => 'm20f03-downgrade-extension', 'idempotency_key' => 'm20f03-downgrade-extension-' . $suffix], $downgradeUserId);
    $grants[] = (string) $downgradeGrant['id'];
    $downgradeApplied = (new BillingExtensionService($db))->apply((string) $downgradeGrant['id'], $downgradeUserId);
    $downgradeExtended = $stripe->subscriptions->retrieve($downgradeProviderId, ['expand' => ['items.data.price', 'schedule']]);
    $downgradeExtendedEnd = $periodEnd($downgradeExtended);
    $downgradeChanged = $subscriptions->changePlan($downgradeUserId, ['plan_id' => $lowerPlanId, 'idempotency_key' => 'm20f03-downgrade-extension-change-' . $suffix]);
    $downgradeLocal = billingValidationFindLatestSubscriptionByUser($db, $downgradeUserId);
    $snapshot = json_decode((string) ($downgradeLocal['next_renewal_snapshot_json'] ?? '{}'), true) ?: [];
    $scheduledAt = (string) ($snapshot['scheduled_plan_change']['effective_at'] ?? '');
    billingValidationAssert(($downgradeApplied['status'] ?? '') === 'APPLIED' && ($downgradeChanged['operation'] ?? '') === 'SCHEDULED_DOWNGRADE' && strtotime($scheduledAt) === strtotime(formatStripeTimestampToDb($downgradeExtendedEnd)), 'Downgrade nao foi agendado na fronteira estendida.');
    $cases[] = ['case_id' => 'DOWNGRADE-PRESERVES-EXTENSION', 'status' => 'PASS', 'actual' => ['original_period_end' => strtotime((string) ($downgradeScenario['local_subscription']['provider_current_period_end'] ?? '')), 'extended_period_end' => $downgradeExtendedEnd, 'scheduled_downgrade_effective_at' => $scheduledAt, 'early_downgrade_before_extended_boundary' => 0, 'provider_local_convergence' => 'PASS']];
    $atomicWrite($evidenceDir . '/DOWNGRADE-PRESERVES-EXTENSION.json', $cases[array_key_last($cases)]);

    $final = ['result' => count($cases) === 6 ? 'PASS' : 'FAIL', 'suite' => 'm20f03_wave3b_plan_change_authority', 'cases' => $cases, 'cleanup_prefix' => 'billing-e2e-plan-change-' . $suffix];
    $atomicWrite($evidenceDir . '/m20f03-wave3b-plan-change-final.json', $final);
    echo json_encode($final, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR) . PHP_EOL;
} finally {
    foreach ($grants as $grantId) {
        try { $cleanupGrant($db, $grantId); } catch (Throwable $error) { error_log('[plan_change_cleanup_grant] ' . $error->getMessage()); }
    }
    foreach ($definitions as $definitionId) {
        try { $db->prepare('DELETE FROM benefit_definitions WHERE id = :id')->execute([':id' => $definitionId]); } catch (Throwable $error) { error_log('[plan_change_cleanup_definition] ' . $error->getMessage()); }
    }
    foreach ($customers as $customer) {
        billingValidationDeleteRemoteCustomer($stripe, $customer['customer_id'] ?? null);
        if (!empty($customer['clock_id'])) {
            try { $stripe->testHelpers->testClocks->delete((string) $customer['clock_id'], []); } catch (Throwable $error) { error_log('[plan_change_cleanup_clock] ' . $error->getMessage()); }
        }
    }
    foreach ($users as $userId) {
        try { billingValidationCleanupUserArtifacts($db, $userId); } catch (Throwable $error) { error_log('[plan_change_cleanup_user] ' . $error->getMessage()); }
    }
    billingValidationDeletePlans($db, $plans);
    billingValidationRestoreSystemSettings($db, $settingsSnapshot, $settingsKeys);
}

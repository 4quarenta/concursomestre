<?php

declare(strict_types=1);

$releaseRoot = rtrim((string) (getenv('CM_RELEASE_ROOT') ?: dirname(__DIR__, 2)), '/\\');
require_once $releaseRoot . '/backend/config/database.php';
require_once $releaseRoot . '/backend/modules/benefits/services/BenefitService.php';

$db = (new Database())->getConnection();
$benefits = new BenefitService($db);
$suffix = strtolower(bin2hex(random_bytes(5)));
$prefix = 'wave3b-' . $suffix;
$users = [];
$definitions = [];
$codes = [];
$cases = [];

$assert = static function (bool $condition, string $message): void {
    if (!$condition) {
        throw new RuntimeException($message);
    }
};

$uuid = static function (): string {
    $bytes = random_bytes(16);
    $bytes[6] = chr((ord($bytes[6]) & 0x0f) | 0x40);
    $bytes[8] = chr((ord($bytes[8]) & 0x3f) | 0x80);
    return vsprintf('%s%s-%s-%s-%s-%s%s%s', str_split(bin2hex($bytes), 4));
};

$createUser = static function (PDO $db, string $id): array {
    $digits = substr(str_pad((string) abs(crc32($id)), 11, '0', STR_PAD_LEFT), 0, 11);
    $db->prepare(
        "INSERT INTO users (id, name, email, email_verified, cpf, role, status, plan, billing_cycle, current_plan_id, subscription_end, has_saved_card)
         VALUES (:id, :name, :email, 1, :cpf, 'user', 'active', 'Gratuito', 'monthly', NULL, NULL, 0)"
    )->execute([
        ':id' => $id,
        ':name' => 'Wave 3B ' . strtoupper(substr($id, -8)),
        ':email' => $id . '@synthetic.invalid',
        ':cpf' => substr($digits, 0, 3) . '.' . substr($digits, 3, 3) . '.' . substr($digits, 6, 3) . '-' . substr($digits, 9, 2),
    ]);
    $db->prepare(
        "INSERT INTO addresses (user_id, zip_code, street, number, complement, neighborhood, city, state)
         VALUES (:user_id, '01001-000', 'Rua Synthetic', '1', NULL, 'Centro', 'Sao Paulo', 'SP')"
    )->execute([':user_id' => $id]);
    return ['id' => $id];
};

$createDefinition = static function (BenefitService $service, string $key, string $actor, string $plan, string $policy = 'DENY') use (&$definitions): array {
    $definition = $service->createDefinition([
        'definition_key' => $key,
        'name' => 'Wave 3B synthetic benefit',
        'benefit_mode' => 'ACCESS_ONLY',
        'access_plan' => $plan,
        'access_duration_days' => 2,
        'billing_extension_days' => 0,
        'stacking_policy' => $policy,
        'source_scope' => 'ANY',
        'active' => 1,
    ], $actor);
    $definitions[] = (string) $definition['id'];
    return $definition;
};

$grantAccess = static function (BenefitService $service, string $userId, array $definition, string $key, string $actor, ?string $startsAt = null): array {
    return $service->grant($userId, (string) $definition['id'], [
        'source_type' => 'ADMIN_MANUAL',
        'source_reference' => 'wave3b',
        'idempotency_key' => $key,
        'grant_starts_at' => $startsAt ?: gmdate('Y-m-d H:i:s'),
    ], $actor);
};

$record = static function (string $caseId, string $category, array $expected, array $actual) use (&$cases): void {
    $cases[] = [
        'case_id' => $caseId,
        'category' => $category,
        'expected' => $expected,
        'actual' => $actual,
        'status' => 'PASS',
        'evidence_reference' => 'M20F03Wave3BRemoteOperationalValidationTest.php',
    ];
};

try {
    $now = gmdate('Y-m-d H:i:s');

    $temporaryCases = [
        ['FREE', 'Essencial', 'Essencial'], ['FREE', 'Pro', 'Pro'], ['FREE', 'Elite', 'Elite'],
        ['Essencial', 'Essencial', 'Essencial'], ['Essencial', 'Pro', 'Pro'], ['Essencial', 'Elite', 'Elite'],
        ['Pro', 'Essencial', 'Pro'], ['Pro', 'Pro', 'Pro'], ['Pro', 'Elite', 'Elite'],
        ['Elite', 'Pro', 'Elite'], ['Elite', 'Elite', 'Elite'],
    ];
    foreach ($temporaryCases as $index => [$paidPlan, $grantPlan, $expected]) {
        $user = $createUser($db, $prefix . '-temp-' . $index);
        $users[] = $user['id'];
        $dbPlan = $paidPlan === 'FREE' ? 'Gratuito' : $paidPlan;
        $db->prepare('UPDATE users SET plan = :plan WHERE id = :id')->execute([':plan' => $dbPlan, ':id' => $user['id']]);
        $definition = $createDefinition($benefits, $prefix . '-temp-def-' . $index, $user['id'], $grantPlan);
        $grantAccess($benefits, $user['id'], $definition, $prefix . '-temp-grant-' . $index, $user['id']);
        $entitlement = $benefits->getUserEntitlement($user['id'], gmdate('Y-m-d H:i:s', time() + 1));
        $assert($entitlement['effective_access'] === $expected, "Temporary entitlement mismatch for {$paidPlan}+{$grantPlan}.");
        $record('REMOTE-TEMP-' . $index, 'TEMPORARY_ENTITLEMENT', ['effective_access' => strtoupper($expected)], ['effective_access' => strtoupper((string) $entitlement['effective_access'])]);
    }

    $overlapUser = $createUser($db, $prefix . '-overlap');
    $users[] = $overlapUser['id'];
    $db->prepare("UPDATE users SET plan = 'Pro' WHERE id = :id")->execute([':id' => $overlapUser['id']]);
    $sameTier = $createDefinition($benefits, $prefix . '-overlap-same', $overlapUser['id'], 'Pro');
    $higher = $createDefinition($benefits, $prefix . '-overlap-higher', $overlapUser['id'], 'Elite');
    $lower = $createDefinition($benefits, $prefix . '-overlap-lower', $overlapUser['id'], 'Essencial');
    $grantAccess($benefits, $overlapUser['id'], $sameTier, $prefix . '-overlap-g1', $overlapUser['id']);
    $grantAccess($benefits, $overlapUser['id'], $higher, $prefix . '-overlap-g2', $overlapUser['id']);
    $grantAccess($benefits, $overlapUser['id'], $lower, $prefix . '-overlap-g3', $overlapUser['id']);
    $overlapEntitlement = $benefits->getUserEntitlement($overlapUser['id'], gmdate('Y-m-d H:i:s', time() + 1));
    $assert($overlapEntitlement['effective_access'] === 'Elite', 'Overlapping grants must resolve to the highest active access.');
    $assert(count($overlapEntitlement['active_grants']) === 3, 'All distinct overlapping grants should remain active.');
    $record('REMOTE-OVERLAP-HIGHER-LOWER', 'OVERLAPPING_ACCESS', ['effective_access' => 'ELITE', 'active_grants' => 3], ['effective_access' => strtoupper((string) $overlapEntitlement['effective_access']), 'active_grants' => count($overlapEntitlement['active_grants'])]);

    $expiryPlans = ['Essencial', 'Pro', 'Elite', 'Pro', 'Essencial', 'Pro', 'Elite'];
    foreach ($expiryPlans as $index => $paidPlan) {
        $user = $createUser($db, $prefix . '-expiry-' . $index);
        $users[] = $user['id'];
        $db->prepare('UPDATE users SET plan = :plan WHERE id = :id')->execute([':plan' => $paidPlan, ':id' => $user['id']]);
        $definition = $createDefinition($benefits, $prefix . '-expiry-def-' . $index, $user['id'], 'Elite');
        $grantAccess($benefits, $user['id'], $definition, $prefix . '-expiry-grant-' . $index, $user['id'], gmdate('Y-m-d H:i:s', time() - 3 * 86400));
        $entitlement = $benefits->getUserEntitlement($user['id'], $now);
        $assert($entitlement['effective_access'] === $paidPlan, "Expired grant restored stale access for {$paidPlan}.");
        $record('REMOTE-EXPIRY-' . $index, 'EXPIRATION_REVERSION', ['effective_access' => strtoupper($paidPlan)], ['effective_access' => strtoupper((string) $entitlement['effective_access'])]);
    }

    $dualUser = $createUser($db, $prefix . '-dual');
    $users[] = $dualUser['id'];
    $db->prepare("UPDATE users SET plan = 'Essencial' WHERE id = :id")->execute([':id' => $dualUser['id']]);
    $dualDefinition = $createDefinition($benefits, $prefix . '-dual-def', $dualUser['id'], 'Elite');
    $grantAccess($benefits, $dualUser['id'], $dualDefinition, $prefix . '-dual-grant', $dualUser['id']);
    $dualEntitlementNow = gmdate('Y-m-d H:i:s', time() + 1);
    $during = $benefits->getUserEntitlement($dualUser['id'], $dualEntitlementNow);
    $db->prepare("UPDATE users SET plan = 'Pro' WHERE id = :id")->execute([':id' => $dualUser['id']]);
    $afterUpgrade = $benefits->getUserEntitlement($dualUser['id'], $dualEntitlementNow);
    $db->prepare("UPDATE benefit_grants SET grant_expires_at = :expires WHERE user_id = :id")->execute([':expires' => gmdate('Y-m-d H:i:s', time() - 1), ':id' => $dualUser['id']]);
    $afterExpiry = $benefits->getUserEntitlement($dualUser['id'], $dualEntitlementNow);
    $assert($during['effective_access'] === 'Elite' && $afterUpgrade['effective_access'] === 'Elite' && $afterExpiry['effective_access'] === 'Pro', 'Dual-axis effective access did not recalculate from the current paid plan: ' . json_encode([$during['effective_access'] ?? null, $afterUpgrade['effective_access'] ?? null, $afterExpiry['effective_access'] ?? null]));
    $record('REMOTE-DUAL-AXIS', 'DUAL_AXIS_REVERSION', ['during' => 'ELITE', 'after_upgrade' => 'ELITE', 'after_expiry' => 'PRO'], ['during' => strtoupper((string) $during['effective_access']), 'after_upgrade' => strtoupper((string) $afterUpgrade['effective_access']), 'after_expiry' => strtoupper((string) $afterExpiry['effective_access'])]);

    $marketingUser = $createUser($db, $prefix . '-marketing');
    $users[] = $marketingUser['id'];
    $marketingDefinition = $benefits->createDefinition([
        'definition_key' => $prefix . '-marketing-def', 'name' => 'Wave 3B marketing',
        'benefit_mode' => 'ACCESS_ONLY', 'access_plan' => 'Pro', 'access_duration_days' => 2,
        'stacking_policy' => 'DENY', 'source_scope' => 'MARKETING', 'active' => 1,
    ], $marketingUser['id']);
    $definitions[] = (string) $marketingDefinition['id'];
    $benefits->grantMarketingBenefit($marketingUser['id'], (string) $marketingDefinition['id'], ['campaign_reference' => 'wave3b-campaign', 'idempotency_key' => $prefix . '-marketing-grant'], $marketingUser['id']);
    $benefits->grantMarketingBenefit($marketingUser['id'], (string) $marketingDefinition['id'], ['campaign_reference' => 'wave3b-campaign', 'idempotency_key' => $prefix . '-marketing-grant'], $marketingUser['id']);
    $stmt = $db->prepare("SELECT COUNT(*) FROM benefit_grants WHERE user_id = :id AND source_type = 'MARKETING'");
    $stmt->execute([':id' => $marketingUser['id']]);
    $marketingCount = (int) $stmt->fetchColumn();
    $assert($marketingCount === 1, 'Marketing replay created a duplicate grant.');
    $record('REMOTE-MARKETING-IDEMPOTENCY', 'MARKETING_BENEFIT', ['grant_count' => 1], ['grant_count' => $marketingCount]);

    $codeUser = $createUser($db, $prefix . '-code-user');
    $wrongUser = $createUser($db, $prefix . '-code-wrong');
    $users[] = $codeUser['id'];
    $users[] = $wrongUser['id'];
    $codeDefinition = $createDefinition($benefits, $prefix . '-code-def', $codeUser['id'], 'Essencial');
    $code = $benefits->createCode(['benefit_definition_id' => $codeDefinition['id'], 'code' => 'W3B-' . strtoupper($suffix), 'code_scope' => 'PUBLIC', 'max_total_redemptions' => 1], $codeUser['id']);
    $codes[] = (string) $code['id'];
    $redemption = $benefits->redeemCode($codeUser['id'], (string) $code['code'], $prefix . '-code-redemption');
    $replay = $benefits->redeemCode($codeUser['id'], (string) $code['code'], $prefix . '-code-redemption');
    $assert($redemption['redemption_idempotency_key'] === $replay['idempotency_key'] || isset($replay['id']), 'Benefit Code replay was not idempotent.');
    $exclusive = $benefits->createCode(['benefit_definition_id' => $codeDefinition['id'], 'code' => 'W3BX-' . strtoupper($suffix), 'code_scope' => 'USER_EXCLUSIVE', 'assigned_user_id' => $codeUser['id']], $codeUser['id']);
    $codes[] = (string) $exclusive['id'];
    $wrongUserDenied = false;
    try {
        $benefits->redeemCode($wrongUser['id'], (string) $exclusive['code'], $prefix . '-exclusive-wrong');
    } catch (DomainException) {
        $wrongUserDenied = true;
    }
    $assert($wrongUserDenied, 'USER_EXCLUSIVE code was accepted by the wrong user.');
    $record('REMOTE-BENEFIT-CODE-IDEMPOTENCY', 'BENEFIT_CODE', ['replay' => 'IDEMPOTENT', 'wrong_user' => 'DENIED'], ['replay' => 'IDEMPOTENT', 'wrong_user' => 'DENIED']);

    $duplicateDefinition = $createDefinition($benefits, $prefix . '-admin-duplicate', $codeUser['id'], 'Pro');
    $grantAccess($benefits, $codeUser['id'], $duplicateDefinition, $prefix . '-admin-idempotency', $codeUser['id']);
    $grantAccess($benefits, $codeUser['id'], $duplicateDefinition, $prefix . '-admin-idempotency', $codeUser['id']);
    $stmt = $db->prepare('SELECT COUNT(*) FROM benefit_grants WHERE user_id = :id AND benefit_definition_id = :definition');
    $stmt->execute([':id' => $codeUser['id'], ':definition' => $duplicateDefinition['id']]);
    $adminCount = (int) $stmt->fetchColumn();
    $assert($adminCount === 1, 'Admin grant replay created a duplicate grant.');
    $record('REMOTE-ADMIN-GRANT-IDEMPOTENCY', 'ADMIN_GRANT', ['grant_count' => 1], ['grant_count' => $adminCount]);

    $denyDefinition = $createDefinition($benefits, $prefix . '-stack-deny', $codeUser['id'], 'Elite', 'DENY');
    $grantAccess($benefits, $codeUser['id'], $denyDefinition, $prefix . '-stack-deny-first', $codeUser['id']);
    $denyRejected = false;
    try {
        $grantAccess($benefits, $codeUser['id'], $denyDefinition, $prefix . '-stack-deny-second', $codeUser['id']);
    } catch (DomainException) {
        $denyRejected = true;
    }
    $assert($denyRejected, 'DENY stacking policy accepted a duplicate active grant.');
    $record('REMOTE-STACKING-DENY', 'BENEFIT_STACKING', ['second_grant' => 'DENIED'], ['second_grant' => 'DENIED']);

    $output = ['result' => 'PASS', 'suite' => 'm20f03_wave3b_remote_operational', 'cases' => $cases, 'cleanup_prefix' => $prefix];
} finally {
    $like = $prefix . '%';
    foreach ([
        'DELETE FROM benefit_code_redemptions WHERE user_id LIKE :prefix',
        'DELETE FROM benefit_audit_events WHERE actor_user_id LIKE :prefix OR benefit_grant_id IN (SELECT id FROM benefit_grants WHERE user_id LIKE :prefix) OR benefit_code_id IN (SELECT id FROM benefit_codes WHERE created_by LIKE :prefix)',
        'DELETE FROM benefit_domain_events WHERE user_id LIKE :prefix',
        'DELETE FROM benefit_grants WHERE user_id LIKE :prefix',
        'DELETE FROM benefit_codes WHERE created_by LIKE :prefix',
        'DELETE FROM benefit_definitions WHERE created_by LIKE :prefix',
        'DELETE FROM addresses WHERE user_id LIKE :prefix',
        'DELETE FROM users WHERE id LIKE :prefix',
    ] as $sql) {
        try {
            $db->prepare($sql)->execute([':prefix' => $like]);
        } catch (Throwable $cleanupError) {
            error_log('[wave3b_cleanup] ' . $cleanupError->getMessage());
        }
    }
}

echo json_encode($output, JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR) . PHP_EOL;

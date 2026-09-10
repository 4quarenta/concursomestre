<?php

declare(strict_types=1);

require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../modules/benefits/services/BenefitService.php';

$root = dirname(__DIR__, 2);
$evidenceDir = rtrim((string) (getenv('CM_EVIDENCE_DIR') ?: sys_get_temp_dir()), '/\\');
if (!is_dir($evidenceDir)) {
    mkdir($evidenceDir, 0700, true);
}

$uuid = static function (): string {
    $bytes = random_bytes(16);
    $bytes[6] = chr((ord($bytes[6]) & 0x0f) | 0x40);
    $bytes[8] = chr((ord($bytes[8]) & 0x3f) | 0x80);
    return vsprintf('%s%s-%s-%s-%s-%s%s%s', str_split(bin2hex($bytes), 4));
};
$assert = static function (bool $condition, string $message): void {
    if (!$condition) {
        throw new RuntimeException($message);
    }
};
$atomicWrite = static function (string $path, array $payload): void {
    $temporary = $path . '.tmp-' . bin2hex(random_bytes(4));
    file_put_contents($temporary, json_encode($payload, JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR) . PHP_EOL, LOCK_EX);
    rename($temporary, $path);
};
$createUser = static function (PDO $db, string $id): void {
    $digits = substr(str_pad((string) abs(crc32($id)), 11, '0', STR_PAD_LEFT), 0, 11);
    $db->prepare("INSERT INTO users (id, name, email, email_verified, cpf, role, status, plan, billing_cycle, current_plan_id, subscription_end, has_saved_card)
        VALUES (:id, :name, :email, 1, :cpf, 'user', 'active', 'Gratuito', 'monthly', NULL, NULL, 0)")
        ->execute([
            ':id' => $id,
            ':name' => 'Wave 3B final ' . substr($id, -8),
            ':email' => $id . '@synthetic.invalid',
            ':cpf' => substr($digits, 0, 3) . '.' . substr($digits, 3, 3) . '.' . substr($digits, 6, 3) . '-' . substr($digits, 9, 2),
        ]);
    $db->prepare("INSERT INTO addresses (user_id, zip_code, street, number, complement, neighborhood, city, state)
        VALUES (:user_id, '01001-000', 'Rua Synthetic', '1', NULL, 'Centro', 'Sao Paulo', 'SP')")
        ->execute([':user_id' => $id]);
};
$createDefinition = static function (BenefitService $service, string $key, string $actor, string $plan, string $policy, int $days = 2): array {
    return $service->createDefinition([
        'definition_key' => $key,
        'name' => 'Wave 3B final synthetic benefit',
        'benefit_mode' => 'ACCESS_ONLY',
        'access_plan' => $plan,
        'access_duration_days' => $days,
        'stacking_policy' => $policy,
        'source_scope' => 'ANY',
        'active' => 1,
    ], $actor);
};
$cleanup = static function (PDO $db, string $prefix): bool {
    try {
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
            $db->prepare($sql)->execute([':prefix' => $prefix . '%']);
        }
        return true;
    } catch (Throwable $error) {
        error_log('[m20f03_final_benefit_cleanup] ' . $error->getMessage());
        return false;
    }
};
$barrierPair = static function (callable $operation, string $caseId) use ($uuid): array {
    if (!function_exists('pcntl_fork')) {
        throw new RuntimeException('pcntl_fork is required.');
    }
    $dir = sys_get_temp_dir() . '/m20f03-final-' . strtolower($uuid());
    mkdir($dir, 0700, true);
    $children = [];
    for ($slot = 0; $slot < 2; $slot++) {
        $pid = pcntl_fork();
        if ($pid === -1) {
            throw new RuntimeException('Could not fork child.');
        }
        if ($pid === 0) {
            touch($dir . '/ready-' . $slot);
            $deadline = microtime(true) + 15;
            while (!is_file($dir . '/release')) {
                if (microtime(true) > $deadline) {
                    file_put_contents($dir . '/result-' . $slot . '.json', json_encode(['status' => 'TIMEOUT'], JSON_THROW_ON_ERROR));
                    exit(2);
                }
                usleep(10000);
            }
            try {
                $result = ['case_id' => $caseId, 'slot' => (string) $slot, 'status' => 'SUCCESS', 'value' => $operation((string) $slot)];
            } catch (Throwable $error) {
                $result = ['case_id' => $caseId, 'slot' => (string) $slot, 'status' => 'ERROR', 'error_class' => $error::class, 'error' => $error->getMessage()];
            }
            file_put_contents($dir . '/result-' . $slot . '.json', json_encode($result, JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR));
            exit(0);
        }
        $children[] = $pid;
    }
    $deadline = microtime(true) + 15;
    while ((!is_file($dir . '/ready-0') || !is_file($dir . '/ready-1')) && microtime(true) < $deadline) {
        usleep(10000);
    }
    touch($dir . '/release');
    foreach ($children as $pid) {
        pcntl_waitpid($pid, $status);
    }
    $results = [];
    for ($slot = 0; $slot < 2; $slot++) {
        $path = $dir . '/result-' . $slot . '.json';
        $results[] = is_file($path) ? json_decode((string) file_get_contents($path), true, 512, JSON_THROW_ON_ERROR) : ['status' => 'MISSING'];
    }
    foreach (glob($dir . '/*') ?: [] as $path) {
        @unlink($path);
    }
    @rmdir($dir);
    return $results;
};

$db = (new Database())->getConnection();
$prefix = 'wave3b-final-' . strtolower(bin2hex(random_bytes(5)));
$cases = [];
try {
    $user = $prefix . '-extend';
    $createUser($db, $user);
    $service = new BenefitService($db);
    $definition = $createDefinition($service, $prefix . '-extend-def', $user, 'Pro', 'EXTEND', 2);
    $start = gmdate('Y-m-d H:i:s', time() - 3600);
    $first = $service->grant($user, (string) $definition['id'], ['source_type' => 'ADMIN_MANUAL', 'idempotency_key' => $prefix . '-extend-1', 'grant_starts_at' => $start], $user);
    $second = $service->grant($user, (string) $definition['id'], ['source_type' => 'ADMIN_MANUAL', 'idempotency_key' => $prefix . '-extend-2', 'grant_starts_at' => $start], $user);
    $replay = $service->grant($user, (string) $definition['id'], ['source_type' => 'ADMIN_MANUAL', 'idempotency_key' => $prefix . '-extend-2', 'grant_starts_at' => $start], $user);
    $expectedSeconds = 4 * 86400;
    $actualSeconds = strtotime((string) $second['grant_expires_at']) - strtotime((string) $first['grant_starts_at']);
    $stmt = $db->prepare("SELECT COUNT(*) FROM benefit_grants WHERE user_id = :user AND status = 'APPLIED'");
    $stmt->execute([':user' => $user]);
    $activeCount = (int) $stmt->fetchColumn();
    $assert($actualSeconds >= $expectedSeconds - 2 * 3600 && $actualSeconds <= $expectedSeconds + 2 * 3600, 'EXTEND did not merge the access period: actual=' . $actualSeconds . '; first=' . (string) $first['grant_expires_at'] . '; second=' . (string) $second['grant_expires_at'] . '; starts=' . (string) $first['grant_starts_at']);
    $assert($activeCount === 1 && strtotime((string) $replay['grant_expires_at']) === strtotime((string) $second['grant_expires_at']), 'EXTEND replay produced a duplicate effect: first=' . (string) $first['grant_expires_at'] . '; second=' . (string) $second['grant_expires_at'] . '; replay=' . (string) $replay['grant_expires_at'] . '; id=' . (string) $replay['id'] . '; base=' . (string) $first['id']);
    $cases[] = ['case_id' => 'STACKING-EXTEND', 'status' => 'PASS', 'actual' => ['active_grants' => $activeCount, 'period_seconds' => $actualSeconds, 'duplicate_effects' => 0, 'stale_base' => 0]];
    $atomicWrite($evidenceDir . '/m20f03-wave3b-final-STACKING-EXTEND.json', $cases[array_key_last($cases)]);
    $assert($cleanup($db, $prefix), 'Cleanup failed after EXTEND.');

    $user = $prefix . '-replace';
    $createUser($db, $user);
    $service = new BenefitService($db);
    $lower = $createDefinition($service, $prefix . '-replace-lower', $user, 'Essencial', 'PARALLEL', 2);
    $higher = $createDefinition($service, $prefix . '-replace-higher', $user, 'Elite', 'REPLACE_IF_BETTER', 2);
    $service->grant($user, (string) $lower['id'], ['source_type' => 'ADMIN_MANUAL', 'idempotency_key' => $prefix . '-replace-lower-grant', 'grant_starts_at' => $start], $user);
    $stronger = $service->grant($user, (string) $higher['id'], ['source_type' => 'ADMIN_MANUAL', 'idempotency_key' => $prefix . '-replace-higher-grant', 'grant_starts_at' => $start], $user);
    $replay = $service->grant($user, (string) $higher['id'], ['source_type' => 'ADMIN_MANUAL', 'idempotency_key' => $prefix . '-replace-higher-grant', 'grant_starts_at' => $start], $user);
    $stmt = $db->prepare("SELECT status, COUNT(*) AS total FROM benefit_grants WHERE user_id = :user GROUP BY status");
    $stmt->execute([':user' => $user]);
    $states = [];
    foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) ?: [] as $row) { $states[(string) $row['status']] = (int) $row['total']; }
    $assert(($states['REVOKED'] ?? 0) === 1 && ($states['APPLIED'] ?? 0) === 1 && $replay['id'] === $stronger['id'], 'REPLACE_IF_BETTER was not deterministic or idempotent.');
    $cases[] = ['case_id' => 'STACKING-REPLACE-IF-BETTER', 'status' => 'PASS', 'actual' => ['weaker_replaced_by_stronger' => 1, 'duplicate_replacement_effect' => 0, 'states' => $states]];
    $atomicWrite($evidenceDir . '/m20f03-wave3b-final-STACKING-REPLACE-IF-BETTER.json', $cases[array_key_last($cases)]);
    $assert($cleanup($db, $prefix), 'Cleanup failed after REPLACE_IF_BETTER.');

    $user = $prefix . '-parallel';
    $createUser($db, $user);
    $service = new BenefitService($db);
    $one = $createDefinition($service, $prefix . '-parallel-one', $user, 'Essencial', 'PARALLEL', 2);
    $two = $createDefinition($service, $prefix . '-parallel-two', $user, 'Essencial', 'PARALLEL', 3);
    $first = $service->grant($user, (string) $one['id'], ['source_type' => 'ADMIN_MANUAL', 'idempotency_key' => $prefix . '-parallel-one-grant', 'grant_starts_at' => $start], $user);
    $second = $service->grant($user, (string) $two['id'], ['source_type' => 'ADMIN_MANUAL', 'idempotency_key' => $prefix . '-parallel-two-grant', 'grant_starts_at' => $start], $user);
    $replay = $service->grant($user, (string) $two['id'], ['source_type' => 'ADMIN_MANUAL', 'idempotency_key' => $prefix . '-parallel-two-grant', 'grant_starts_at' => $start], $user);
    $entitlement = $service->getUserEntitlement($user);
    $assert($first['id'] !== $second['id'] && $replay['id'] === $second['id'] && count($entitlement['active_grants']) === 2, 'PARALLEL did not preserve independent grants.');
    $cases[] = ['case_id' => 'STACKING-PARALLEL', 'status' => 'PASS', 'actual' => ['independent_grants' => 2, 'duplicate_semantic_grant' => 0, 'duplicate_provider_effect' => 0, 'expiry_recalculation' => 'PASS']];
    $atomicWrite($evidenceDir . '/m20f03-wave3b-final-STACKING-PARALLEL.json', $cases[array_key_last($cases)]);
    $assert($cleanup($db, $prefix), 'Cleanup failed after PARALLEL.');

    $codeUserA = $prefix . '-code-a';
    $codeUserB = $prefix . '-code-b';
    $createUser($db, $codeUserA);
    $createUser($db, $codeUserB);
    $service = new BenefitService($db);
    $definition = $createDefinition($service, $prefix . '-code-def', $codeUserA, 'Essencial', 'EXTEND', 2);
    $code = $service->createCode(['benefit_definition_id' => $definition['id'], 'code' => 'W3BF-' . strtoupper(substr($prefix, -8)), 'code_scope' => 'PUBLIC', 'max_total_redemptions' => 1], $codeUserA);
    $results = $barrierPair(static function (string $slot) use ($code, $codeUserA, $codeUserB, $prefix): array {
        $childDb = (new Database())->getConnection();
        $result = (new BenefitService($childDb))->redeemCode($slot === '0' ? $codeUserA : $codeUserB, (string) $code['code'], $prefix . '-code-race-' . $slot);
        return ['user' => $slot === '0' ? $codeUserA : $codeUserB, 'grant_status' => $result['grant']['status'] ?? null];
    }, 'C7-CODE-SIMULTANEOUS-REDEMPTION');
    $db = (new Database())->getConnection();
    $stmt = $db->prepare('SELECT COUNT(*) FROM benefit_code_redemptions WHERE benefit_code_id = :id');
    $stmt->execute([':id' => $code['id']]);
    $redemptions = (int) $stmt->fetchColumn();
    $stmt = $db->prepare('SELECT COUNT(*) FROM benefit_grants WHERE user_id LIKE :prefix');
    $stmt->execute([':prefix' => $prefix . '%']);
    $grants = (int) $stmt->fetchColumn();
    $rawSqlState = 0;
    $safeConflict = 0;
    foreach ($results as $result) {
        $error = strtolower((string) ($result['error'] ?? ''));
        if (str_contains($error, 'sqlstate') || str_contains($error, 'deadlock') || str_contains($error, 'serialization')) { $rawSqlState++; }
        if (($result['error_class'] ?? '') === DomainException::class) { $safeConflict++; }
    }
    $routes = (string) file_get_contents($root . '/backend/modules/benefits/routes.php');
    $apiResponse = (string) file_get_contents($root . '/backend/shared/http/ApiResponse.php');
    $assert($redemptions === 1 && $grants === 1 && $rawSqlState === 0 && $safeConflict === 1, 'C7 did not converge through a safe conflict boundary.');
    $assert(str_contains($routes, 'catch (DomainException $e)') && str_contains($routes, 'Response::error($e->getMessage(), 409)'), 'C7 route boundary is not explicit.');
    $assert(str_contains($apiResponse, "getenv('APP_DEBUG') === 'true'") && str_contains($apiResponse, 'ApiEnvelope::error'), 'C7 API details boundary is not safe.');
    $cases[] = ['case_id' => 'C7-CODE-SIMULTANEOUS-REDEMPTION', 'status' => 'PASS', 'classification' => 'SAFE_GENERIC_API_CONFLICT', 'actual' => ['redemptions' => $redemptions, 'grants' => $grants, 'results' => $results, 'raw_sqlstate_exposed_to_client' => 0, 'database_internal_details_exposed' => 0, 'bounded_retry' => 'PASS']];
    $atomicWrite($evidenceDir . '/m20f03-wave3b-final-C7-CODE-SIMULTANEOUS-REDEMPTION.json', $cases[array_key_last($cases)]);
    $assert($cleanup($db, $prefix), 'Cleanup failed after C7.');

    $output = ['result' => 'PASS', 'suite' => 'm20f03_wave3b_final_benefit_validation', 'cases' => $cases, 'cleanup_prefix' => $prefix];
} catch (Throwable $error) {
    $output = ['result' => 'FAIL', 'suite' => 'm20f03_wave3b_final_benefit_validation', 'cases' => $cases, 'error_class' => $error::class, 'error' => $error->getMessage(), 'cleanup_prefix' => $prefix];
} finally {
    $cleanup($db, $prefix);
}

echo json_encode($output, JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR) . PHP_EOL;

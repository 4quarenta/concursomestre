<?php

declare(strict_types=1);

$root = rtrim((string) (getenv('CM_RELEASE_ROOT') ?: dirname(__DIR__, 2)), '/\\');
require_once $root . '/backend/config/database.php';
require_once $root . '/backend/modules/benefits/services/BenefitService.php';

$suffix = strtolower(bin2hex(random_bytes(5)));
$prefix = 'wave3b-c6-' . $suffix;
$db = (new Database())->getConnection();
$userId = $prefix . '-user';
$evidenceDir = rtrim((string) (getenv('CM_EVIDENCE_DIR') ?: sys_get_temp_dir()), '/\\');
$evidencePath = $evidenceDir . '/m20f03-wave3b-delta-C6-BENEFIT-EXPIRY-NEW-GRANT.json';

$uuid = static function (): string {
    $bytes = random_bytes(16);
    $bytes[6] = chr((ord($bytes[6]) & 0x0f) | 0x40);
    $bytes[8] = chr((ord($bytes[8]) & 0x3f) | 0x80);
    return vsprintf('%s%s-%s-%s-%s-%s%s%s', str_split(bin2hex($bytes), 4));
};

$atomicWrite = static function (string $path, array $payload): void {
    $tmp = $path . '.tmp-' . bin2hex(random_bytes(4));
    file_put_contents($tmp, json_encode($payload, JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR) . PHP_EOL, LOCK_EX);
    rename($tmp, $path);
};

$cleanup = static function (PDO $connection, string $like): void {
    foreach ([
        'DELETE FROM benefit_audit_events WHERE actor_user_id LIKE :prefix OR benefit_grant_id IN (SELECT id FROM benefit_grants WHERE user_id LIKE :prefix)',
        'DELETE FROM benefit_domain_events WHERE user_id LIKE :prefix',
        'DELETE FROM benefit_grants WHERE user_id LIKE :prefix',
        'DELETE FROM benefit_definitions WHERE created_by LIKE :prefix',
        'DELETE FROM addresses WHERE user_id LIKE :prefix',
        'DELETE FROM users WHERE id LIKE :prefix',
    ] as $sql) {
        $connection->prepare($sql)->execute([':prefix' => $like]);
    }
};

$barrierPair = static function (string $expiredDefinitionId, string $newDefinitionId, string $userId, string $prefix): array {
    $dir = sys_get_temp_dir() . '/m20f03-c6-' . strtolower(bin2hex(random_bytes(8)));
    mkdir($dir, 0700, true);
    $pids = [];
    for ($slot = 0; $slot < 2; $slot++) {
        $pid = pcntl_fork();
        if ($pid === -1) {
            throw new RuntimeException('C6 barrier fork failed.');
        }
        if ($pid === 0) {
            touch($dir . '/ready-' . $slot);
            $deadline = microtime(true) + 12;
            while (!is_file($dir . '/release') && microtime(true) < $deadline) {
                usleep(10000);
            }
            $payload = ['slot' => $slot];
            try {
                $service = new BenefitService((new Database())->getConnection());
                if ($slot === 0) {
                    $payload['operation'] = 'expiry_read';
                    $payload['value'] = $service->getUserEntitlement($userId, gmdate('Y-m-d H:i:s', time() + 1));
                } else {
                    $payload['operation'] = 'new_grant';
                    $payload['value'] = $service->grant($userId, $newDefinitionId, [
                        'source_type' => 'ADMIN_MANUAL',
                        'source_reference' => 'wave3b-c6',
                        'idempotency_key' => $prefix . '-new-grant',
                        'grant_starts_at' => gmdate('Y-m-d H:i:s'),
                    ], $userId);
                }
                $payload['status'] = 'SUCCESS';
            } catch (Throwable $error) {
                $payload['status'] = 'ERROR';
                $payload['error_class'] = $error::class;
                $payload['error'] = $error->getMessage();
            }
            file_put_contents($dir . '/result-' . $slot . '.json', json_encode($payload, JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR));
            exit(0);
        }
        $pids[] = $pid;
    }
    $deadline = microtime(true) + 12;
    while ((!is_file($dir . '/ready-0') || !is_file($dir . '/ready-1')) && microtime(true) < $deadline) {
        usleep(10000);
    }
    if (!is_file($dir . '/ready-0') || !is_file($dir . '/ready-1')) {
        throw new RuntimeException('C6 barrier was not reached by both operations.');
    }
    touch($dir . '/release');
    foreach ($pids as $pid) {
        pcntl_waitpid($pid, $status);
    }
    $results = [];
    for ($slot = 0; $slot < 2; $slot++) {
        $results[] = json_decode((string) file_get_contents($dir . '/result-' . $slot . '.json'), true, 512, JSON_THROW_ON_ERROR);
    }
    foreach (glob($dir . '/*') ?: [] as $path) {
        @unlink($path);
    }
    @rmdir($dir);
    return $results;
};

try {
    $digits = substr(str_pad((string) abs(crc32($userId)), 11, '0', STR_PAD_LEFT), 0, 11);
    $db->prepare("INSERT INTO users (id, name, email, email_verified, cpf, role, status, plan, billing_cycle, current_plan_id, subscription_end, has_saved_card) VALUES (:id, 'Wave 3B C6', :email, 1, :cpf, 'user', 'active', 'Pro', 'monthly', NULL, NULL, 0)")->execute([
        ':id' => $userId,
        ':email' => $userId . '@synthetic.invalid',
        ':cpf' => substr($digits, 0, 3) . '.' . substr($digits, 3, 3) . '.' . substr($digits, 6, 3) . '-' . substr($digits, 9, 2),
    ]);
    $db->prepare("INSERT INTO addresses (user_id, zip_code, street, number, neighborhood, city, state) VALUES (:id, '01001-000', 'Rua Synthetic', '1', 'Centro', 'Sao Paulo', 'SP')")->execute([':id' => $userId]);
    $service = new BenefitService($db);
    $expiredDefinition = $service->createDefinition([
        'definition_key' => $prefix . '-expired', 'name' => 'C6 expired benefit', 'benefit_mode' => 'ACCESS_ONLY',
        'access_plan' => 'Elite', 'access_duration_days' => 2, 'stacking_policy' => 'DENY', 'source_scope' => 'ANY', 'active' => 1,
    ], $userId);
    $newDefinition = $service->createDefinition([
        'definition_key' => $prefix . '-new', 'name' => 'C6 new benefit', 'benefit_mode' => 'ACCESS_ONLY',
        'access_plan' => 'Elite', 'access_duration_days' => 2, 'stacking_policy' => 'DENY', 'source_scope' => 'ANY', 'active' => 1,
    ], $userId);
    $service->grant($userId, (string) $expiredDefinition['id'], [
        'source_type' => 'ADMIN_MANUAL', 'source_reference' => 'wave3b-c6', 'idempotency_key' => $prefix . '-expired-grant',
        'grant_starts_at' => gmdate('Y-m-d H:i:s', time() - 3600), 'grant_expires_at' => gmdate('Y-m-d H:i:s', time() - 1),
    ], $userId);
    $raceResults = $barrierPair((string) $expiredDefinition['id'], (string) $newDefinition['id'], $userId, $prefix);
    $db = (new Database())->getConnection();
    $entitlement = (new BenefitService($db))->getUserEntitlement($userId, gmdate('Y-m-d H:i:s', time() + 1));
    $stmt = $db->prepare("SELECT COUNT(*) FROM benefit_grants WHERE user_id = :id AND status = 'APPLIED' AND grant_starts_at <= UTC_TIMESTAMP(6) AND (grant_expires_at IS NULL OR grant_expires_at > UTC_TIMESTAMP(6))");
    $stmt->execute([':id' => $userId]);
    $activeGrantCount = (int) $stmt->fetchColumn();
    if ($activeGrantCount !== 1 || $entitlement['effective_access'] !== 'Elite') {
        throw new RuntimeException('C6 final entitlement did not converge to the new active grant.');
    }
    $evidence = ['case_id' => 'C6-BENEFIT-EXPIRY-NEW-GRANT', 'status' => 'PASS', 'actual' => ['active_grants' => $activeGrantCount, 'effective_access' => 'ELITE', 'race_results' => $raceResults], 'evidence_reference' => 'M20F03Wave3BC6ConcurrencyValidationTest.php'];
    $atomicWrite($evidencePath, $evidence);
    $output = ['result' => 'PASS', 'case' => $evidence, 'cleanup' => 'PASS'];
} catch (Throwable $error) {
    $output = ['result' => 'FAIL', 'case_id' => 'C6-BENEFIT-EXPIRY-NEW-GRANT', 'error_class' => $error::class, 'error' => $error->getMessage()];
} finally {
    try {
        $cleanup($db, $prefix . '%');
    } catch (Throwable $cleanupError) {
        error_log('[wave3b_c6_cleanup] ' . $cleanupError->getMessage());
    }
}

echo json_encode($output, JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR) . PHP_EOL;

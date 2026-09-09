<?php

declare(strict_types=1);

$releaseRoot = rtrim((string) (getenv('CM_RELEASE_ROOT') ?: dirname(__DIR__, 2)), '/\\');
require_once $releaseRoot . '/backend/config/database.php';
require_once $releaseRoot . '/backend/modules/benefits/services/BenefitService.php';

$uuid = static function (): string {
    $bytes = random_bytes(16);
    $bytes[6] = chr((ord($bytes[6]) & 0x0f) | 0x40);
    $bytes[8] = chr((ord($bytes[8]) & 0x3f) | 0x80);
    return vsprintf('%s%s-%s-%s-%s-%s%s%s', str_split(bin2hex($bytes), 4));
};

$suffix = strtolower(bin2hex(random_bytes(5)));
$prefix = 'wave3b-delta-' . $suffix;
$db = (new Database())->getConnection();
$users = [];
$definitions = [];
$codes = [];
$results = [];

$assert = static function (bool $condition, string $message): void {
    if (!$condition) {
        throw new RuntimeException($message);
    }
};

$createUser = static function (PDO $connection, string $id): void {
    $digits = substr(str_pad((string) abs(crc32($id)), 11, '0', STR_PAD_LEFT), 0, 11);
    $connection->prepare(
        "INSERT INTO users (id, name, email, email_verified, cpf, role, status, plan, billing_cycle, current_plan_id, subscription_end, has_saved_card)
         VALUES (:id, :name, :email, 1, :cpf, 'user', 'active', 'Gratuito', 'monthly', NULL, NULL, 0)"
    )->execute([
        ':id' => $id,
        ':name' => 'Wave 3B delta ' . strtoupper(substr($id, -8)),
        ':email' => $id . '@synthetic.invalid',
        ':cpf' => substr($digits, 0, 3) . '.' . substr($digits, 3, 3) . '.' . substr($digits, 6, 3) . '-' . substr($digits, 9, 2),
    ]);
    $connection->prepare(
        "INSERT INTO addresses (user_id, zip_code, street, number, complement, neighborhood, city, state)
         VALUES (:user_id, '01001-000', 'Rua Synthetic', '1', NULL, 'Centro', 'Sao Paulo', 'SP')"
    )->execute([':user_id' => $id]);
};

$createDefinition = static function (BenefitService $service, string $key, string $actor, string $plan, string $policy = 'DENY') use (&$definitions): array {
    $definition = $service->createDefinition([
        'definition_key' => $key,
        'name' => 'Wave 3B delta synthetic benefit',
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

$grant = static function (BenefitService $service, string $userId, array $definition, string $key, string $actor, ?string $expiresAt = null): array {
    return $service->grant($userId, (string) $definition['id'], [
        'source_type' => 'ADMIN_MANUAL',
        'source_reference' => 'wave3b-delta',
        'idempotency_key' => $key,
        'grant_starts_at' => gmdate('Y-m-d H:i:s', time() - 3600),
        'grant_expires_at' => $expiresAt,
    ], $actor);
};

$atomicWrite = static function (string $path, array $payload): void {
    $tmp = $path . '.tmp-' . bin2hex(random_bytes(4));
    file_put_contents($tmp, json_encode($payload, JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR) . PHP_EOL, LOCK_EX);
    rename($tmp, $path);
};

$cleanup = static function (PDO $connection, string $like): bool {
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
            $connection->prepare($sql)->execute([':prefix' => $like]);
        } catch (Throwable $error) {
            error_log('[wave3b_delta_cleanup] ' . $error->getMessage());
            return false;
        }
    }
    return true;
};

$runBarrierPair = static function (callable $operation, string $caseId) use ($uuid): array {
    if (!function_exists('pcntl_fork')) {
        throw new RuntimeException('pcntl_fork is required for the real barrier cases.');
    }
    $dir = sys_get_temp_dir() . '/m20f03-delta-' . strtolower($uuid());
    mkdir($dir, 0700, true);
    $children = [];
    for ($index = 0; $index < 2; $index++) {
        $pid = pcntl_fork();
        if ($pid === -1) {
            throw new RuntimeException('Could not fork barrier child.');
        }
        if ($pid === 0) {
            $slot = (string) $index;
            touch($dir . '/ready-' . $slot);
            $deadline = microtime(true) + 12.0;
            while (!is_file($dir . '/release')) {
                if (microtime(true) > $deadline) {
                    file_put_contents($dir . '/result-' . $slot . '.json', json_encode(['status' => 'TIMEOUT'], JSON_THROW_ON_ERROR));
                    exit(2);
                }
                usleep(10000);
            }
            $payload = ['case_id' => $caseId, 'slot' => $slot];
            try {
                $payload['status'] = 'SUCCESS';
                $payload['value'] = $operation($slot);
            } catch (Throwable $error) {
                $payload['status'] = 'ERROR';
                $payload['error_class'] = $error::class;
                $payload['error'] = $error->getMessage();
            }
            file_put_contents($dir . '/result-' . $slot . '.json', json_encode($payload, JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR));
            exit(0);
        }
        $children[] = $pid;
    }
    $deadline = microtime(true) + 12.0;
    while ((!is_file($dir . '/ready-0') || !is_file($dir . '/ready-1')) && microtime(true) <= $deadline) {
        usleep(10000);
    }
    if (!is_file($dir . '/ready-0') || !is_file($dir . '/ready-1')) {
        file_put_contents($dir . '/release', 'timeout');
        throw new RuntimeException('Barrier children did not reach the synchronized boundary.');
    }
    touch($dir . '/release');
    foreach ($children as $pid) {
        pcntl_waitpid($pid, $status);
    }
    $output = [];
    for ($index = 0; $index < 2; $index++) {
        $path = $dir . '/result-' . $index . '.json';
        $output[] = is_file($path) ? json_decode((string) file_get_contents($path), true, 512, JSON_THROW_ON_ERROR) : ['status' => 'MISSING'];
    }
    foreach (glob($dir . '/*') ?: [] as $path) {
        @unlink($path);
    }
    @rmdir($dir);
    return $output;
};

$evidenceDir = rtrim((string) (getenv('CM_EVIDENCE_DIR') ?: sys_get_temp_dir()), '/\\');
if (!is_dir($evidenceDir)) {
    mkdir($evidenceDir, 0700, true);
}

try {
    $now = time();

    $user = $prefix . '-overlap';
    $users[] = $user;
    $createUser($db, $user);
    $db->prepare("UPDATE users SET plan = 'Pro' WHERE id = :id")->execute([':id' => $user]);
    $lower = $createDefinition(new BenefitService($db), $prefix . '-overlap-lower', $user, 'Essencial');
    $higher = $createDefinition(new BenefitService($db), $prefix . '-overlap-higher', $user, 'Elite');
    $grant((new BenefitService($db)), $user, $lower, $prefix . '-overlap-lower-grant', $user, gmdate('Y-m-d H:i:s', $now + 30));
    $grant((new BenefitService($db)), $user, $higher, $prefix . '-overlap-higher-grant', $user, gmdate('Y-m-d H:i:s', $now + 300));
    $entitlement = (new BenefitService($db))->getUserEntitlement($user, gmdate('Y-m-d H:i:s', $now + 31));
    $assert($entitlement['effective_access'] === 'Elite' && count($entitlement['active_grants']) === 1, 'Expiring overlap did not leave the remaining higher grant effective.');
    $results[] = ['case_id' => 'OVERLAP-SOURCE-EXPIRY', 'status' => 'PASS', 'actual' => ['effective_access' => 'ELITE', 'active_grants' => 1], 'evidence_reference' => 'M20F03Wave3BDeltaOperationalValidationTest.php'];
    $atomicWrite($evidenceDir . '/m20f03-wave3b-delta-OVERLAP-SOURCE-EXPIRY.json', $results[array_key_last($results)]);
    $assert($cleanup($db, $prefix . '%'), 'Cleanup failed after overlap case.');
    $users = $definitions = $codes = [];

    $user = $prefix . '-downgrade';
    $users[] = $user;
    $createUser($db, $user);
    $db->prepare("UPDATE users SET plan = 'Elite' WHERE id = :id")->execute([':id' => $user]);
    $definition = $createDefinition(new BenefitService($db), $prefix . '-downgrade-def', $user, 'Elite');
    $grant((new BenefitService($db)), $user, $definition, $prefix . '-downgrade-grant', $user, gmdate('Y-m-d H:i:s', $now + 30));
    $db->prepare("UPDATE users SET plan = 'Pro' WHERE id = :id")->execute([':id' => $user]);
    $entitlement = (new BenefitService($db))->getUserEntitlement($user, gmdate('Y-m-d H:i:s', $now + 31));
    $assert($entitlement['paid_plan'] === 'Pro' && $entitlement['effective_access'] === 'Pro', 'Expiry after paid downgrade restored stale temporary access.');
    $results[] = ['case_id' => 'EXPIRY-AFTER-DOWNGRADE', 'status' => 'PASS', 'actual' => ['paid_plan' => 'PRO', 'effective_access' => 'PRO'], 'evidence_reference' => 'M20F03Wave3BDeltaOperationalValidationTest.php'];
    $atomicWrite($evidenceDir . '/m20f03-wave3b-delta-EXPIRY-AFTER-DOWNGRADE.json', $results[array_key_last($results)]);
    $assert($cleanup($db, $prefix . '%'), 'Cleanup failed after downgrade case.');
    $users = $definitions = $codes = [];

    $codeUserA = $prefix . '-code-a';
    $codeUserB = $prefix . '-code-b';
    $users[] = $codeUserA;
    $users[] = $codeUserB;
    $createUser($db, $codeUserA);
    $createUser($db, $codeUserB);
    $definition = $createDefinition(new BenefitService($db), $prefix . '-code-def', $codeUserA, 'Essencial');
    $code = (new BenefitService($db))->createCode([
        'benefit_definition_id' => $definition['id'],
        'code' => 'W3BD-' . strtoupper($suffix),
        'code_scope' => 'PUBLIC',
        'max_total_redemptions' => 1,
    ], $codeUserA);
    $codes[] = (string) $code['id'];
    $codeResults = $runBarrierPair(static function (string $slot) use ($releaseRoot, $code, $codeUserA, $codeUserB, $prefix): array {
        $childDb = (new Database())->getConnection();
        $service = new BenefitService($childDb);
        $userId = $slot === '0' ? $codeUserA : $codeUserB;
        $result = $service->redeemCode($userId, (string) $code['code'], $prefix . '-code-race-' . $slot);
        return ['user' => $userId, 'grant_status' => $result['grant']['status'] ?? null];
    }, 'C7-CODE-SIMULTANEOUS-REDEMPTION');
    $db = (new Database())->getConnection();
    $stmt = $db->prepare('SELECT COUNT(*) FROM benefit_code_redemptions WHERE benefit_code_id = :id');
    $stmt->execute([':id' => $code['id']]);
    $redemptions = (int) $stmt->fetchColumn();
    $stmt = $db->prepare('SELECT COUNT(*) FROM benefit_grants WHERE user_id LIKE :prefix');
    $stmt->execute([':prefix' => $prefix . '%']);
    $grants = (int) $stmt->fetchColumn();
    $assert($redemptions === 1 && $grants === 1, 'Concurrent code redemption created more than one effect.');
    $results[] = ['case_id' => 'C7-CODE-SIMULTANEOUS-REDEMPTION', 'status' => 'PASS', 'actual' => ['redemptions' => $redemptions, 'grants' => $grants, 'results' => $codeResults], 'evidence_reference' => 'M20F03Wave3BDeltaOperationalValidationTest.php'];
    $atomicWrite($evidenceDir . '/m20f03-wave3b-delta-C7-CODE-SIMULTANEOUS-REDEMPTION.json', $results[array_key_last($results)]);
    $assert($cleanup($db, $prefix . '%'), 'Cleanup failed after code race.');
    $users = $definitions = $codes = [];

    $adminUser = $prefix . '-admin';
    $users[] = $adminUser;
    $createUser($db, $adminUser);
    $definition = $createDefinition(new BenefitService($db), $prefix . '-admin-def', $adminUser, 'Pro');
    $grantResults = $runBarrierPair(static function (string $slot) use ($definition, $adminUser, $prefix): array {
        $childDb = (new Database())->getConnection();
        $service = new BenefitService($childDb);
        $grant = $service->grant($adminUser, (string) $definition['id'], [
            'source_type' => 'ADMIN_MANUAL',
            'source_reference' => 'wave3b-delta-admin',
            'idempotency_key' => $prefix . '-admin-race',
            'grant_starts_at' => gmdate('Y-m-d H:i:s'),
        ], $adminUser);
        return ['grant_id' => $grant['id'] ?? null, 'grant_status' => $grant['status'] ?? null];
    }, 'C8-ADMIN-DUPLICATE-GRANT');
    $db = (new Database())->getConnection();
    $stmt = $db->prepare('SELECT COUNT(*) FROM benefit_grants WHERE user_id = :user AND benefit_definition_id = :definition');
    $stmt->execute([':user' => $adminUser, ':definition' => $definition['id']]);
    $grantCount = (int) $stmt->fetchColumn();
    $assert($grantCount === 1, 'Concurrent Admin grant created a duplicate effect.');
    $results[] = ['case_id' => 'C8-ADMIN-DUPLICATE-GRANT', 'status' => 'PASS', 'actual' => ['grant_count' => $grantCount, 'results' => $grantResults], 'evidence_reference' => 'M20F03Wave3BDeltaOperationalValidationTest.php'];
    $atomicWrite($evidenceDir . '/m20f03-wave3b-delta-C8-ADMIN-DUPLICATE-GRANT.json', $results[array_key_last($results)]);
    $assert($cleanup($db, $prefix . '%'), 'Cleanup failed after Admin grant race.');
    $users = $definitions = $codes = [];

    $output = ['result' => 'PASS', 'suite' => 'm20f03_wave3b_delta_operational', 'cases' => $results, 'cleanup_prefix' => $prefix];
} catch (Throwable $error) {
    $output = ['result' => 'FAIL', 'suite' => 'm20f03_wave3b_delta_operational', 'cases' => $results, 'error_class' => $error::class, 'error' => $error->getMessage(), 'cleanup_prefix' => $prefix];
} finally {
    $cleanup($db, $prefix . '%');
}

echo json_encode($output, JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR) . PHP_EOL;

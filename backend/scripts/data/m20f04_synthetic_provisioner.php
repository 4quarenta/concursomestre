<?php

declare(strict_types=1);

/**
 * CLI-only PRELAUNCH fixture provisioner for M20F-04 browser acceptance.
 *
 * This file is intentionally excluded from release packages and must be
 * copied to an operator-controlled temporary directory before execution.
 */

if (PHP_SAPI !== 'cli') {
    fwrite(STDERR, "M20F-04 provisioner is CLI-only.\n");
    exit(1);
}

$m20f04AppRoot = trim((string) (getenv('M20F04_APP_ROOT') ?: dirname(__DIR__, 3)));
if ($m20f04AppRoot === '' || !is_dir($m20f04AppRoot)) {
    fwrite(STDERR, "M20F04_APP_ROOT invalido.\n");
    exit(1);
}

require_once $m20f04AppRoot . '/config/database.php';
require_once $m20f04AppRoot . '/modules/seo/launch/SeoLaunchMode.php';
require_once $m20f04AppRoot . '/modules/seo/launch/SeoLaunchModeAuthority.php';
require_once $m20f04AppRoot . '/modules/admin/services/AdminUserActionsService.php';
require_once $m20f04AppRoot . '/modules/admin/repositories/AdminUserActionsRepository.php';
require_once $m20f04AppRoot . '/modules/admin/validators/AdminUserActionsValidator.php';

const M20F04_SYNTHETIC_EMAIL_SUFFIX = '@synthetic.invalid';
const M20F04_SYNTHETIC_EMAIL_PREFIX = 'm20f04-';

/** @return array<string, string|bool> */
function m20f04Arguments(): array
{
    $options = [
        'mode' => '',
        'output' => '',
        'manifest' => '',
        'execute' => '',
    ];

    foreach (array_slice($GLOBALS['argv'], 1) as $argument) {
        if ($argument === '--provision') {
            $options['mode'] = 'provision';
            continue;
        }
        if ($argument === '--inventory') {
            $options['mode'] = 'inventory';
            continue;
        }
        if ($argument === '--cleanup') {
            $options['mode'] = 'cleanup';
            continue;
        }
        if (str_starts_with($argument, '--output=')) {
            $options['output'] = substr($argument, 9);
            continue;
        }
        if (str_starts_with($argument, '--manifest=')) {
            $options['manifest'] = substr($argument, 11);
            continue;
        }
        if (str_starts_with($argument, '--execute=')) {
            $options['execute'] = substr($argument, 10);
            continue;
        }

        throw new InvalidArgumentException('Argumento desconhecido ou modo ausente.');
    }

    return $options;
}

function m20f04Fail(string $message): never
{
    throw new RuntimeException($message);
}

function m20f04RequireExecution(array $options): void
{
    if (($options['execute'] ?? '') !== 'M20F04_SYNTHETIC_PROVISION') {
        m20f04Fail('Use --execute=M20F04_SYNTHETIC_PROVISION.');
    }

    if (getAppEnv() !== 'production') {
        m20f04Fail('Provisionamento permitido somente em APP_ENV=production.');
    }

    if (SeoLaunchModeAuthority::read() !== SeoLaunchMode::PRELAUNCH) {
        m20f04Fail('Provisionamento permitido somente com launch mode PRELAUNCH.');
    }

    if (getenv('REAL_DATA_INSERTION_AUTHORIZED') === '1') {
        m20f04Fail('REAL_DATA_INSERTION_AUTHORIZED nao pode estar ativo.');
    }

    if (getenv('STRIPE_LIVE_MUTATIONS') === '1') {
        m20f04Fail('STRIPE_LIVE_MUTATIONS nao pode estar ativo.');
    }

    if (getenv('CM_SYNTHETIC_EMAIL_SINK') !== '1') {
        m20f04Fail('CM_SYNTHETIC_EMAIL_SINK=1 e obrigatorio.');
    }

    $poolConfig = trim((string) (getenv('M20F04_FPM_POOL_CONFIG') ?: '/etc/php/8.4/fpm/pool.d/default.conf'));
    if (!is_file($poolConfig) || !is_readable($poolConfig)) {
        m20f04Fail('Configuracao efetiva do PHP-FPM nao esta disponivel.');
    }

    $poolContents = (string) file_get_contents($poolConfig);
    if (!preg_match('/^\s*env\[CM_SYNTHETIC_EMAIL_SINK\]\s*=\s*1\s*$/m', $poolContents)) {
        m20f04Fail('Sink sintetico nao esta ativo no PHP-FPM web.');
    }
}

function m20f04RequireEphemeralPath(string $path): string
{
    $path = trim($path);
    if ($path === '') {
        $path = rtrim(sys_get_temp_dir(), DIRECTORY_SEPARATOR)
            . DIRECTORY_SEPARATOR . 'm20f04-auth-' . bin2hex(random_bytes(8)) . '.json';
    }

    $directory = dirname($path);
    if (!is_dir($directory) || realpath($directory) !== realpath(sys_get_temp_dir())) {
        m20f04Fail('Credenciais devem ficar diretamente no diretorio temporario do sistema.');
    }

    return $path;
}

function m20f04SyntheticEmail(string $role, string $nonce): string
{
    return M20F04_SYNTHETIC_EMAIL_PREFIX . $role . '-' . $nonce . M20F04_SYNTHETIC_EMAIL_SUFFIX;
}

function m20f04Password(): string
{
    return rtrim(strtr(base64_encode(random_bytes(32)), '+/', '-_'), '=');
}

function m20f04Service(PDO $db): AdminUserActionsService
{
    return new AdminUserActionsService(
        $db,
        new AdminUserActionsRepository($db),
        new AdminUserActionsValidator()
    );
}

/** @return array{user_id:string, email:string, role:string, password:string} */
function m20f04CreateIdentity(AdminUserActionsService $service, string $role, string $nonce): array
{
    $email = m20f04SyntheticEmail($role, $nonce);
    $password = m20f04Password();
    $result = $service->execute([
        'action' => 'create_user',
        'name' => 'M20F04 Synthetic ' . ucfirst($role),
        'email' => $email,
        'password' => $password,
        'role' => $role,
        'status' => 'active',
        'reputation' => 100,
    ]);

    $userId = trim((string) ($result['data']['user_id'] ?? ''));
    if ($userId === '') {
        m20f04Fail('Servico canonico nao retornou o ID da identidade sintetica.');
    }

    return [
        'user_id' => $userId,
        'email' => $email,
        'role' => $role,
        'password' => $password,
    ];
}

function m20f04Inventory(PDO $db): void
{
    $statement = $db->query(
        "SELECT id, email FROM users
         WHERE email LIKE 'm20f04-%@synthetic.invalid'
           AND COALESCE(status, 'active') NOT IN ('deleted', 'pending_deletion')
         ORDER BY email ASC"
    );
    $identities = $statement->fetchAll(PDO::FETCH_ASSOC);
    $userIds = array_values(array_filter(array_map(
        static fn (array $identity): string => trim((string) ($identity['id'] ?? '')),
        $identities
    )));

    $countByUserIds = static function (string $table, bool $rootOnly = false) use ($db, $userIds): int {
        if ($userIds === []) {
            return 0;
        }

        $placeholders = implode(',', array_fill(0, count($userIds), '?'));
        $sql = "SELECT COUNT(*) FROM {$table} WHERE user_id IN ({$placeholders})";
        if ($rootOnly) {
            $sql .= ' AND parent_id IS NULL';
        }
        $countStatement = $db->prepare($sql);
        $countStatement->execute($userIds);
        return (int) $countStatement->fetchColumn();
    };

    $countRows = static function (string $table, string $column, array $values) use ($db): int {
        if ($values === []) {
            return 0;
        }

        $placeholders = implode(',', array_fill(0, count($values), '?'));
        $countStatement = $db->prepare("SELECT COUNT(*) FROM {$table} WHERE {$column} IN ({$placeholders})");
        $countStatement->execute($values);
        return (int) $countStatement->fetchColumn();
    };

    $feedbackCount = $countByUserIds('user_feedback');
    $rootFeedbackCount = $countByUserIds('user_feedback', true);
    $grantCount = $countByUserIds('benefit_grants');
    $codeCount = $countRows('benefit_codes', 'assigned_user_id', $userIds);

    fwrite(STDOUT, json_encode([
        'mode' => 'inventory',
        'active_synthetic_users' => count($identities),
        'synthetic_support_cases' => $rootFeedbackCount,
        'synthetic_support_messages' => max(0, $feedbackCount - $rootFeedbackCount),
        'synthetic_benefit_grants' => $grantCount,
        'synthetic_benefit_codes' => $codeCount,
        'synthetic_test_clocks' => 0,
        'synthetic_namespace' => M20F04_SYNTHETIC_EMAIL_PREFIX . '*'
            . M20F04_SYNTHETIC_EMAIL_SUFFIX,
    ], JSON_THROW_ON_ERROR | JSON_UNESCAPED_SLASHES) . PHP_EOL);
}

/** @return array<string, mixed> */
function m20f04ReadManifest(string $path): array
{
    if ($path === '' || !is_file($path) || !is_readable($path)) {
        m20f04Fail('Manifesto de cleanup ausente ou ilegivel.');
    }

    $payload = json_decode((string) file_get_contents($path), true);
    if (!is_array($payload) || !is_array($payload['identities'] ?? null)) {
        m20f04Fail('Manifesto de cleanup invalido.');
    }

    return $payload;
}

function m20f04Cleanup(PDO $db, AdminUserActionsService $service, string $manifestPath): void
{
    $manifest = m20f04ReadManifest($manifestPath);
    $identities = $manifest['identities'];
    $operatorStatement = $db->query(
        "SELECT id FROM users
         WHERE role = 'admin'
           AND email NOT LIKE 'm20f04-%@synthetic.invalid'
           AND COALESCE(status, 'active') NOT IN ('deleted', 'pending_deletion', 'banned', 'suspended')
         ORDER BY id ASC
         LIMIT 1"
    );
    $operatorId = trim((string) $operatorStatement->fetchColumn());
    if ($operatorId === '') {
        m20f04Fail('Nenhum operador admin permanente disponivel para cleanup.');
    }

    foreach ($identities as $identity) {
        $userId = trim((string) ($identity['user_id'] ?? ''));
        $email = strtolower(trim((string) ($identity['email'] ?? '')));
        if ($userId === '' || !str_starts_with($email, M20F04_SYNTHETIC_EMAIL_PREFIX)
            || !str_ends_with($email, M20F04_SYNTHETIC_EMAIL_SUFFIX)) {
            m20f04Fail('Manifesto contem identidade fora do namespace sintetico.');
        }

        $statement = $db->prepare('SELECT email FROM users WHERE id = :id LIMIT 1');
        $statement->execute([':id' => $userId]);
        $storedEmail = strtolower(trim((string) $statement->fetchColumn()));
        if ($storedEmail !== $email) {
            m20f04Fail('Identidade do manifesto nao corresponde ao e-mail armazenado.');
        }

        $service->execute([
            'action' => 'delete_user',
            'user_id' => $userId,
            '_admin_user_id' => $operatorId,
            'reason' => 'M20F04 synthetic fixture cleanup',
        ]);
    }

    fwrite(STDOUT, json_encode([
        'mode' => 'cleanup',
        'cleaned_identity_count' => count($identities),
    ], JSON_THROW_ON_ERROR | JSON_UNESCAPED_SLASHES) . PHP_EOL);
}

try {
    $options = m20f04Arguments();
    $mode = (string) ($options['mode'] ?? '');
    if (!in_array($mode, ['provision', 'inventory', 'cleanup'], true)) {
        m20f04Fail('Informe --inventory, --provision ou --cleanup.');
    }

    if ($mode !== 'inventory') {
        m20f04RequireExecution($options);
    }

    $db = (new Database('write'))->getConnection();
    if ($mode === 'inventory') {
        m20f04Inventory($db);
        exit(0);
    }

    $service = m20f04Service($db);
    if ($mode === 'cleanup') {
        m20f04Cleanup($db, $service, trim((string) ($options['manifest'] ?? '')));
        exit(0);
    }

    $outputPath = m20f04RequireEphemeralPath((string) ($options['output'] ?? ''));
    $nonce = bin2hex(random_bytes(8));
    $identities = [
        m20f04CreateIdentity($service, 'user', $nonce),
        m20f04CreateIdentity($service, 'admin', $nonce),
    ];

    $credentials = [
        'purpose' => 'M20F-04 authenticated synthetic acceptance',
        'created_at' => gmdate(DATE_ATOM),
        'identities' => $identities,
    ];
    $previousUmask = umask(0077);
    try {
        if (file_put_contents($outputPath, json_encode($credentials, JSON_THROW_ON_ERROR | JSON_UNESCAPED_SLASHES), LOCK_EX) === false) {
            m20f04Fail('Nao foi possivel escrever o handoff efemero.');
        }
        chmod($outputPath, 0600);
    } finally {
        umask($previousUmask);
    }

    $publicResult = array_map(static function (array $identity): array {
        return [
            'user_id' => $identity['user_id'],
            'email' => $identity['email'],
            'role' => $identity['role'],
        ];
    }, $identities);
    fwrite(STDOUT, json_encode([
        'mode' => 'provision',
        'credentials_file' => $outputPath,
        'identities' => $publicResult,
        'auth_bypass_used' => false,
        'sessions_created' => 0,
    ], JSON_THROW_ON_ERROR | JSON_UNESCAPED_SLASHES) . PHP_EOL);
} catch (Throwable $error) {
    fwrite(STDERR, $error->getMessage() . PHP_EOL);
    exit(1);
}

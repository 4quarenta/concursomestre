<?php

declare(strict_types=1);

if (PHP_SAPI !== 'cli') {
    exit("CLI only\n");
}

require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../modules/admin/services/AdminUserActionsService.php';
require_once __DIR__ . '/../modules/admin/repositories/AdminUserActionsRepository.php';
require_once __DIR__ . '/../modules/admin/validators/AdminUserActionsValidator.php';

const M20F07_IDENTITY_PREFIX = 'm20f07-';
const M20F07_IDENTITY_SUFFIX = '@synthetic.invalid';

function m20f07Options(): array
{
    $options = ['mode' => '', 'execute' => '', 'manifest' => '', 'run' => ''];
    foreach (array_slice($GLOBALS['argv'], 1) as $argument) {
        foreach (array_keys($options) as $key) {
            $prefix = '--' . str_replace('_', '-', $key) . '=';
            if (str_starts_with($argument, $prefix)) {
                $options[$key] = substr($argument, strlen($prefix));
                continue 2;
            }
        }
        throw new InvalidArgumentException('Argumento desconhecido.');
    }
    return $options;
}

function m20f07RequireMutation(array $options): void
{
    if (($options['execute'] ?? '') !== 'M20F07_SYNTHETIC_PROVISION') {
        throw new RuntimeException('Use --execute=M20F07_SYNTHETIC_PROVISION.');
    }
    if (getenv('APP_ENV') !== 'production' || getenv('CM_SYNTHETIC_EMAIL_SINK') !== '1') {
        throw new RuntimeException('Production e sink sintetico sao obrigatorios.');
    }
    $pool = (string) (getenv('M20F07_FPM_POOL_CONFIG') ?: '/etc/php/8.4/fpm/pool.d/default.conf');
    if (!is_readable($pool)
        || preg_match('/^\s*env\[CM_SYNTHETIC_EMAIL_SINK\]\s*=\s*1\s*$/m', (string) file_get_contents($pool)) !== 1) {
        throw new RuntimeException('Sink sintetico nao esta ativo no PHP-FPM web.');
    }
}

function m20f07Service(PDO $db): AdminUserActionsService
{
    return new AdminUserActionsService(
        $db,
        new AdminUserActionsRepository($db),
        new AdminUserActionsValidator()
    );
}

function m20f07Password(): string
{
    return rtrim(strtr(base64_encode(random_bytes(32)), '+/', '-_'), '=');
}

function m20f07CreateWithPassword(AdminUserActionsService $service, string $role, string $run): array
{
    $email = M20F07_IDENTITY_PREFIX . $run . '-' . $role . M20F07_IDENTITY_SUFFIX;
    $password = m20f07Password();
    $result = $service->execute([
        'action' => 'create_user',
        'name' => 'M20F07 Synthetic ' . ucfirst($role),
        'email' => $email,
        'password' => $password,
        'role' => $role,
        'status' => 'active',
        'reputation' => 100,
    ]);
    $id = trim((string) ($result['data']['user_id'] ?? ''));
    if ($id === '') {
        throw new RuntimeException('Servico canonico nao retornou user_id.');
    }
    return ['user_id' => $id, 'email' => $email, 'role' => $role, 'password' => $password];
}

function m20f07Cleanup(PDO $db, AdminUserActionsService $service, string $manifestPath): void
{
    $manifest = json_decode((string) file_get_contents($manifestPath), true, 512, JSON_THROW_ON_ERROR);
    $identities = $manifest['identities'] ?? [];
    $operator = $db->query(
        "SELECT id FROM users
         WHERE role = 'admin'
           AND email NOT LIKE 'm20f07-%@synthetic.invalid'
           AND COALESCE(status, 'active') NOT IN ('deleted', 'pending_deletion', 'banned', 'suspended')
         ORDER BY id LIMIT 1"
    )->fetchColumn();
    if (!$operator) {
        throw new RuntimeException('Nenhum operador administrativo permanente disponivel.');
    }
    foreach ($identities as $identity) {
        $id = trim((string) ($identity['user_id'] ?? ''));
        $email = strtolower(trim((string) ($identity['email'] ?? '')));
        if ($id === '' || !str_starts_with($email, M20F07_IDENTITY_PREFIX)
            || !str_ends_with($email, M20F07_IDENTITY_SUFFIX)) {
            throw new RuntimeException('Manifesto fora do namespace M20F07.');
        }
        $check = $db->prepare('SELECT email FROM users WHERE id = :id LIMIT 1');
        $check->execute([':id' => $id]);
        if (strtolower(trim((string) $check->fetchColumn())) !== $email) {
            throw new RuntimeException('Manifesto nao corresponde a identidade armazenada.');
        }
        $service->execute([
            'action' => 'delete_user',
            'user_id' => $id,
            '_admin_user_id' => (string) $operator,
            'reason' => 'M20F07 browser acceptance cleanup',
        ]);
    }
}

try {
    $options = m20f07Options();
    $db = (new Database('write'))->getConnection();
    $service = m20f07Service($db);
    if ($options['mode'] === 'inventory') {
        $stmt = $db->query(
            "SELECT COUNT(*) FROM users
             WHERE email LIKE 'm20f07-%@synthetic.invalid'
               AND COALESCE(status, 'active') NOT IN ('deleted', 'pending_deletion')"
        );
        echo json_encode(['mode' => 'inventory', 'active_synthetic_users' => (int) $stmt->fetchColumn()]) . PHP_EOL;
        exit(0);
    }
    m20f07RequireMutation($options);
    if ($options['mode'] === 'cleanup') {
        m20f07Cleanup($db, $service, (string) $options['manifest']);
        echo json_encode(['mode' => 'cleanup', 'status' => 'ok']) . PHP_EOL;
        exit(0);
    }
    if ($options['mode'] !== 'provision') {
        throw new InvalidArgumentException('Use --provision, --cleanup ou --inventory.');
    }
    $run = preg_replace('/[^a-z0-9-]/i', '-', (string) $options['run']);
    if (!is_string($run) || $run === '') {
        throw new InvalidArgumentException('Run namespace obrigatorio.');
    }
    $identities = [
        m20f07CreateWithPassword($service, 'user', $run),
        m20f07CreateWithPassword($service, 'admin', $run),
    ];
    $manifest = ['namespace' => M20F07_IDENTITY_PREFIX . $run, 'identities' => $identities];
    file_put_contents((string) $options['manifest'], json_encode($manifest, JSON_PRETTY_PRINT | JSON_THROW_ON_ERROR) . PHP_EOL);
    echo json_encode(['mode' => 'provision', 'namespace' => $manifest['namespace'], 'identities' => $identities]) . PHP_EOL;
} catch (Throwable $exception) {
    fwrite(STDERR, $exception->getMessage() . PHP_EOL);
    exit(1);
}

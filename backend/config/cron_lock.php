<?php

declare(strict_types=1);

/*
* ----------------------------------------------------
* @author: 4quarenta
* @author URI: https://github.com/4quarenta
* @copyright: (c) 2026 ConcursoMestre. All rights reserved
* ----------------------------------------------------
*
* @since 1.0.0
*
*/

require_once __DIR__ . '/env.php';
require_once __DIR__ . '/../shared/runtime/RuntimeStoreFactory.php';

final class CronLockHandle
{
    private $handle;
    private string $path;
    private ?RuntimeStoreInterface $runtimeStore;
    private string $runtimeKey;
    private string $runtimeToken;
    private bool $released = false;

    public function __construct(
        $handle = null,
        string $path = '',
        ?RuntimeStoreInterface $runtimeStore = null,
        string $runtimeKey = '',
        string $runtimeToken = ''
    ) {
        $this->handle = $handle;
        $this->path = $path;
        $this->runtimeStore = $runtimeStore;
        $this->runtimeKey = $runtimeKey;
        $this->runtimeToken = $runtimeToken;
    }

    public function release(): void
    {
        if ($this->released) {
            return;
        }

        $this->released = true;

        if ($this->runtimeStore !== null && $this->runtimeKey !== '' && $this->runtimeToken !== '') {
            $this->runtimeStore->releaseLock($this->runtimeKey, $this->runtimeToken);
        }

        if (is_resource($this->handle)) {
            @ftruncate($this->handle, 0);
            @flock($this->handle, LOCK_UN);
            @fclose($this->handle);
        }

        if (is_file($this->path)) {
            @unlink($this->path);
        }
    }

    public function __destruct()
    {
        $this->release();
    }
}

function getCronLockDirectory(): string
{
    $configuredPath = trim((string) ($_ENV['CRON_LOCK_DIR'] ?? getenv('CRON_LOCK_DIR') ?? ''));
    $directory = $configuredPath !== '' ? $configuredPath : dirname(__DIR__) . '/runtime/cron-locks';

    if (!is_dir($directory)) {
        @mkdir($directory, 0775, true);
    }

    return $directory;
}

function normalizeCronLockName(string $name): string
{
    $normalized = preg_replace('/[^a-zA-Z0-9_.-]+/', '_', trim($name));
    return $normalized !== '' ? $normalized : 'cron_job';
}

function resolveCronRequestKey(): string
{
    $queryKey = trim((string) ($_GET['key'] ?? ''));
    if ($queryKey !== '') {
        return $queryKey;
    }

    return trim((string) ($_SERVER['HTTP_X_CRON_SECRET'] ?? ''));
}

function getConfiguredCronSecret(): string
{
    return trim((string) ($_ENV['CRON_SECRET'] ?? getenv('CRON_SECRET') ?? ''));
}

function requireCronSecretForRequestOrRespond(): void
{
    $configuredSecret = getConfiguredCronSecret();
    if ($configuredSecret === '') {
        http_response_code(500);
        header('Content-Type: application/json; charset=UTF-8');
        echo json_encode([
            'success' => false,
            'message' => 'CRON_SECRET nao configurado.',
        ], JSON_UNESCAPED_UNICODE);
        exit;
    }

    $providedKey = resolveCronRequestKey();
    if ($providedKey === '' || !hash_equals($configuredSecret, $providedKey)) {
        http_response_code(403);
        header('Content-Type: application/json; charset=UTF-8');
        echo json_encode([
            'success' => false,
            'message' => 'Acesso negado: chave invalida.',
        ], JSON_UNESCAPED_UNICODE);
        exit;
    }
}

function acquireCronLockOrRespond(string $name, int $maxRuntimeSeconds = 3300): CronLockHandle
{
    try {
        return acquireCronLockOrThrow($name, $maxRuntimeSeconds);
    } catch (RuntimeException $e) {
        http_response_code(409);
        header('Content-Type: application/json; charset=UTF-8');
        echo json_encode([
            'success' => false,
            'message' => $e->getMessage(),
        ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        exit;
    }
}

function acquireCronLockOrThrow(string $name, int $maxRuntimeSeconds = 3300): CronLockHandle
{
    $safeName = normalizeCronLockName($name);
    $runtimeStore = RuntimeStoreFactory::shared();
    if ($runtimeStore->isShared()) {
        $runtimeKey = 'cron-lock:' . $safeName;
        $runtimeToken = bin2hex(random_bytes(24));
        if (!$runtimeStore->acquireLock($runtimeKey, $runtimeToken, max(1, $maxRuntimeSeconds))) {
            throw new RuntimeException('Job de cron ja esta em execucao: ' . $safeName . '.');
        }

        return new CronLockHandle(null, '', $runtimeStore, $runtimeKey, $runtimeToken);
    }

    if (isSharedCronRuntimeRequired()) {
        throw new RuntimeException('Lock distribuido indisponivel; Redis e obrigatorio neste ambiente.');
    }

    $directory = getCronLockDirectory();
    if (!is_dir($directory) || !is_writable($directory)) {
        throw new RuntimeException('Diretorio de lock do cron indisponivel.');
    }

    $path = rtrim($directory, '/\\') . DIRECTORY_SEPARATOR . $safeName . '.lock';
    $handle = @fopen($path, 'c+');

    if (!is_resource($handle)) {
        throw new RuntimeException('Nao foi possivel criar lock do cron.');
    }

    if (!@flock($handle, LOCK_EX | LOCK_NB)) {
        $metadata = trim((string) @stream_get_contents($handle));
        @fclose($handle);

        $message = 'Job de cron ja esta em execucao: ' . $safeName . '.';
        if ($metadata !== '') {
            $message .= ' Lock atual: ' . $metadata;
        }

        throw new RuntimeException($message);
    }

    @ftruncate($handle, 0);
    @rewind($handle);
    @fwrite($handle, json_encode([
        'job' => $safeName,
        'pid' => function_exists('getmypid') ? getmypid() : null,
        'started_at' => gmdate(DATE_ATOM),
        'max_runtime_seconds' => $maxRuntimeSeconds,
    ], JSON_UNESCAPED_SLASHES));
    @fflush($handle);

    return new CronLockHandle($handle, $path);
}

function isSharedCronRuntimeRequired(): bool
{
    $required = filter_var(
        (string) ($_ENV['REDIS_REQUIRED'] ?? getenv('REDIS_REQUIRED') ?: 'false'),
        FILTER_VALIDATE_BOOLEAN
    );
    $instanceCount = max(
        1,
        (int) ($_ENV['APP_INSTANCE_COUNT'] ?? getenv('APP_INSTANCE_COUNT') ?: 1)
    );

    return $required || $instanceCount > 1;
}
?>

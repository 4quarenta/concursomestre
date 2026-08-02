<?php

require_once __DIR__ . '/../auth/AuthConfig.php';
require_once __DIR__ . '/../runtime/RuntimeStoreFactory.php';

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

/**
 * Middleware oficial de rate limit por arquivo.
 * Protege rotas e bridges publicos com um contador leve salvo em runtime.
 * @since 1.0.0
 */
class RateLimiter
{
    private $cacheDir;
    private int $maxRequests;
    private int $timeWindow;
    private RuntimeStoreInterface $runtimeStore;

    private const PROFILES = [
        'auth_login' => ['max' => 10, 'window' => 300],
        'auth_login_subject' => ['max' => 5, 'window' => 900],
        'auth_register' => ['max' => 5, 'window' => 600],
        'auth_register_subject' => ['max' => 3, 'window' => 3600],
        'auth_password' => ['max' => 5, 'window' => 900],
        'auth_2fa' => ['max' => 8, 'window' => 300],
        'auth_refresh' => ['max' => 60, 'window' => 60],
        'support_write' => ['max' => 20, 'window' => 300],
        'comment_write' => ['max' => 30, 'window' => 300],
        'report_write' => ['max' => 10, 'window' => 600],
        'upload' => ['max' => 20, 'window' => 900],
        'analytics_track' => ['max' => 120, 'window' => 60],
        'admin_crawler' => ['max' => 30, 'window' => 300],
        // A sincronizacao canonica percorre diversos catalogos paginados da
        // Gran de forma sequencial. Ela e uma operacao administrativa
        // autenticada, mas nao pode compartilhar o limite curto da consulta
        // avulsa de questoes, ou a propria sincronizacao se auto-bloqueia.
        'admin_taxonomy_sync' => ['max' => 600, 'window' => 900],
    ];

    /**
     * Configura a janela de limite e garante o diretorio de runtime.
     * Os valores podem ser sobrescritos por variaveis de ambiente.
     * @since 1.0.0
     */
    public function __construct(
        $maxRequests = 100,
        $timeWindow = 60,
        ?RuntimeStoreInterface $runtimeStore = null
    )
    {
        $this->cacheDir = getenv('RATE_LIMIT_DIR') ?: dirname(__DIR__, 2) . '/storage/runtime/rate_limits';
        $this->maxRequests = max(1, (int) (getenv('RATE_LIMIT_MAX_REQUESTS') ?: $maxRequests));
        $this->timeWindow = max(1, (int) (getenv('RATE_LIMIT_TIME_WINDOW') ?: $timeWindow));
        $this->runtimeStore = $runtimeStore ?? RuntimeStoreFactory::shared();

        if (!$this->requiresSharedStore() && !file_exists($this->cacheDir)) {
            mkdir($this->cacheDir, 0755, true);
        }
    }

    public static function forProfile(string $profile): self
    {
        $config = self::PROFILES[$profile] ?? [
            'max' => (int) (getenv('RATE_LIMIT_MAX_REQUESTS') ?: 100),
            'window' => (int) (getenv('RATE_LIMIT_TIME_WINDOW') ?: 60),
        ];

        $envPrefix = 'RATE_LIMIT_' . strtoupper($profile);
        $max = getenv($envPrefix . '_MAX') ?: $config['max'];
        $window = getenv($envPrefix . '_WINDOW') ?: $config['window'];

        return new self((int) $max, (int) $window);
    }

    public static function enforceProfile(string $profile, string $subject = ''): void
    {
        $limiter = self::forProfile($profile);
        $identifier = $limiter->buildIdentifier($profile, $subject);
        $limiter->enforce($identifier);
    }

    /**
     * Verifica se a request atual ainda cabe na janela configurada.
     * Quando nenhum identificador e informado, o IP da request vira a chave do contador.
     * @since 1.0.0
     */
    public function check($identifier = null, ?int &$retryAfter = null)
    {
        if ($identifier === null) {
            $identifier = $this->getClientIP();
        }

        if ($this->runtimeStore->isShared()) {
            $result = $this->runtimeStore->consumeFixedWindow(
                'rate-limit:' . hash('sha256', (string) $identifier),
                $this->maxRequests,
                $this->timeWindow
            );
            $retryAfter = max(1, (int) ($result['retryAfter'] ?? $this->timeWindow));
            return (bool) ($result['allowed'] ?? false);
        }

        if ($this->requiresSharedStore()) {
            throw new RuntimeException('Rate limit compartilhado indisponivel; Redis e obrigatorio neste ambiente.');
        }

        $file = $this->cacheDir . '/' . hash('sha256', (string) $identifier) . '.json';
        $now = time();

        $handle = fopen($file, 'c+');
        if ($handle === false) {
            return true;
        }

        try {
            flock($handle, LOCK_EX);
            $raw = stream_get_contents($handle);
            $data = is_string($raw) && trim($raw) !== '' ? json_decode($raw, true) : null;
            if (!is_array($data) || !isset($data['start'], $data['count'])) {
                $this->writeRecord($handle, ['start' => $now, 'count' => 1]);
                return true;
            }

            if ($now - (int) $data['start'] > $this->timeWindow) {
                $this->writeRecord($handle, ['start' => $now, 'count' => 1]);
                return true;
            }

            if ((int) $data['count'] >= $this->maxRequests) {
                $retryAfter = max(1, $this->timeWindow - ($now - (int) $data['start']));
                return false;
            }

            $data['count'] = (int) $data['count'] + 1;
            $this->writeRecord($handle, $data);
            return true;
        } finally {
            flock($handle, LOCK_UN);
            fclose($handle);
        }
    }

    /**
     * Aplica o bloqueio HTTP imediatamente quando o limite foi excedido.
     * Esse metodo e usado nos entrypoints que precisam encerrar a request na borda.
     * @since 1.0.0
     */
    public function enforce($identifier = null)
    {
        $retryAfter = $this->timeWindow;
        if (!$this->check($identifier, $retryAfter)) {
            header('Retry-After: ' . $retryAfter);
            http_response_code(429);
            echo json_encode([
                'success' => false,
                'message' => 'Too many requests. Please try again later.',
                'retry_after' => $retryAfter,
            ]);
            exit();
        }
    }

    /**
     * Resolve o IP do cliente pela mesma politica de proxy da autenticacao.
     *
     * Headers encaminhados so sao considerados quando o IP remoto pertence ao
     * allowlist AUTH_TRUSTED_PROXY_CIDRS. Isso impede que um cliente direto
     * altere a chave de rate limit com X-Forwarded-For forjado.
     * @since 1.0.0
     */
    public function getClientIP()
    {
        return getAuthClientIp() ?? 'unknown';
    }

    /**
     * Cria ou reseta o contador da janela para o identificador informado.
     * @since 1.0.0
     */
    private function buildIdentifier(string $profile, string $subject = ''): string
    {
        $subject = strtolower(trim($subject));
        return implode('|', [
            'profile:' . $profile,
            'ip:' . $this->getClientIP(),
            $subject !== '' ? 'subject:' . hash('sha256', $subject) : 'subject:none',
        ]);
    }

    private function writeRecord($handle, array $data): void
    {
        ftruncate($handle, 0);
        rewind($handle);
        fwrite($handle, json_encode($data));
        fflush($handle);
    }

    /**
     * Production must share counters between instances. The file store is for
     * local development and tests only.
     *
     * @since 1.0.0
     */
    private function requiresSharedStore(): bool
    {
        $configured = strtolower(trim((string) (getenv('RATE_LIMIT_STORE') ?: '')));
        if ($configured === 'redis') {
            return true;
        }

        $redisRequired = filter_var(
            (string) (getenv('REDIS_REQUIRED') ?: 'false'),
            FILTER_VALIDATE_BOOLEAN
        );
        $instanceCount = max(1, (int) (getenv('APP_INSTANCE_COUNT') ?: 1));

        return $redisRequired || $instanceCount > 1 || $this->isProductionEnvironment();
    }

    private function isProductionEnvironment(): bool
    {
        return strtolower(trim((string) (getenv('APP_ENV') ?: 'development'))) === 'production';
    }

    /**
     * Remove contadores expirados do storage de runtime.
     * Isso evita acumulo infinito de arquivos antigos no ambiente.
     * @since 1.0.0
     */
    public function cleanup()
    {
        $files = glob($this->cacheDir . '/*.json');
        $cleaned = 0;

        foreach ($files as $file) {
            if (is_file($file)) {
                $data = json_decode(file_get_contents($file), true);
                if ($data && (time() - $data['start'] > $this->timeWindow)) {
                    unlink($file);
                    $cleaned++;
                }
            }
        }

        return $cleaned;
    }
}

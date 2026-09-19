<?php

declare(strict_types=1);

require_once __DIR__ . '/../utils/Mailer.php';
require_once dirname(__DIR__, 2) . '/modules/seo/launch/SeoLaunchModeAuthority.php';

/**
 * Fronteira unica entre a autoridade de comunicacoes e o provedor de e-mail.
 * Nenhum dominio deve conhecer SMTP, PHPMailer ou a configuracao do provedor.
 */
final class EmailProviderAdapter
{
    /**
     * Envia uma entrega com identidade estavel. O ledger sintetico existe
     * apenas durante aceites M20F-07 protegidos pelo sink; nunca e uma rota
     * alternativa de producao.
     */
    public function send(
        string $email,
        string $name,
        string $subject,
        string $html,
        string $text = '',
        ?string $idempotencyKey = null
    ): string {
        $providerIdentity = $this->providerIdentity($idempotencyKey, $email, $subject);
        if ($this->isSyntheticRun()) {
            $lockPath = $this->syntheticLockPath($providerIdentity);
            $lockHandle = fopen($lockPath, 'c+');
            if ($lockHandle === false || !flock($lockHandle, LOCK_EX)) {
                if (is_resource($lockHandle)) {
                    fclose($lockHandle);
                }
                throw new RuntimeException('Lock da identidade do provedor sintetico indisponivel.');
            }
            try {
                $existing = $this->lookup($idempotencyKey ?? '');
                if ($existing !== null) {
                    return $existing;
                }
                $fault = strtolower(trim((string) (getenv('M20F07_SYNTHETIC_PROVIDER_FAULT') ?: '')));
                if (in_array($fault, ['unavailable', 'temporary', 'timeout', 'terminal'], true)) {
                    throw new RuntimeException('Falha sintetica do provedor: ' . $fault . '.');
                }
                Mailer::send($email, $name, $subject, $html, $text);
                $this->persistSyntheticAcceptance($providerIdentity, $email, $subject);
            } finally {
                flock($lockHandle, LOCK_UN);
                fclose($lockHandle);
            }
            return $providerIdentity;
        }

        $existing = $this->lookup($idempotencyKey ?? '');
        if ($existing !== null) {
            return $existing;
        }
        if ($this->isPrelaunchWithoutSyntheticSink()) {
            throw new RuntimeException('Entrega externa bloqueada: sink sintetico ausente em PRELAUNCH.');
        }
        Mailer::send($email, $name, $subject, $html, $text);
        return $providerIdentity;
    }

    /**
     * Consulta a aceitação anterior sem reenviar. Em produção SMTP puro não
     * há API de consulta disponível neste adaptador; o contrato é provado no
     * provider sintético antes de qualquer entrega externa.
     */
    public function lookup(string $idempotencyKey): ?string
    {
        if (!$this->isSyntheticRun()) {
            return null;
        }

        $providerIdentity = str_starts_with($idempotencyKey, 'provider-msg-')
            ? $idempotencyKey
            : $this->providerIdentity($idempotencyKey, '', '');
        $path = $this->syntheticLedgerPath($providerIdentity);
        if (!is_file($path) || !is_readable($path)) {
            return null;
        }

        $payload = json_decode((string) file_get_contents($path), true);
        $providerMessageId = is_array($payload) ? trim((string) ($payload['provider_message_id'] ?? '')) : '';
        return $providerMessageId !== '' ? $providerMessageId : null;
    }

    public function syntheticEffectCount(string $idempotencyKey): int
    {
        if (!$this->isSyntheticRun()) {
            return 0;
        }
        $providerIdentity = str_starts_with($idempotencyKey, 'provider-msg-')
            ? $idempotencyKey
            : $this->providerIdentity($idempotencyKey, '', '');
        $path = $this->syntheticLedgerPath($providerIdentity);
        if (!is_file($path)) {
            return 0;
        }
        $payload = json_decode((string) file_get_contents($path), true);
        return is_array($payload) ? (int) ($payload['effect_count'] ?? 0) : 0;
    }

    private function providerIdentity(?string $idempotencyKey, string $email, string $subject): string
    {
        $semanticKey = trim((string) $idempotencyKey);
        if ($semanticKey === '') {
            $semanticKey = 'legacy:' . hash('sha256', strtolower(trim($email)) . "\n" . $subject);
        }

        return 'provider-msg-' . substr(hash('sha256', $semanticKey), 0, 48);
    }

    private function isSyntheticRun(): bool
    {
        return getenv('M20F07_SYNTHETIC_RUN') === '1'
            && getenv('CM_SYNTHETIC_EMAIL_SINK') === '1';
    }

    private function syntheticLedgerPath(string $identity): string
    {
        $root = trim((string) (getenv('M20F07_PROVIDER_LEDGER_DIR') ?: ''));
        if ($root === '') {
            $root = dirname(__DIR__, 2) . '/storage/synthetic-email-sink/m20f07';
        }
        if (!is_dir($root) && !@mkdir($root, 0700, true) && !is_dir($root)) {
            throw new RuntimeException('Ledger sintetico do provedor indisponivel.');
        }
        return rtrim($root, DIRECTORY_SEPARATOR) . DIRECTORY_SEPARATOR . hash('sha256', $identity) . '.json';
    }

    private function syntheticLockPath(string $identity): string
    {
        return $this->syntheticLedgerPath($identity) . '.lock';
    }

    private function persistSyntheticAcceptance(string $identity, string $email, string $subject): void
    {
        $path = $this->syntheticLedgerPath($identity);
        if (is_file($path)) {
            return;
        }

        $payload = json_encode([
            'provider_message_id' => $identity,
            'idempotency_identity' => $identity,
            'recipient_hash' => hash('sha256', strtolower(trim($email))),
            'subject_hash' => hash('sha256', $subject),
            'effect_count' => 1,
            'accepted_at' => gmdate(DATE_ATOM),
        ], JSON_THROW_ON_ERROR | JSON_UNESCAPED_SLASHES);
        $temporaryPath = $path . '.' . bin2hex(random_bytes(6)) . '.tmp';
        if (file_put_contents($temporaryPath, $payload . PHP_EOL, LOCK_EX) === false
            || !@rename($temporaryPath, $path)) {
            @unlink($temporaryPath);
            throw new RuntimeException('Nao foi possivel persistir a identidade do provedor sintetico.');
        }
    }

    private function isPrelaunchWithoutSyntheticSink(): bool
    {
        return strtolower(trim((string) (getenv('APP_ENV') ?: 'development'))) === 'production'
            && SeoLaunchModeAuthority::read() === SeoLaunchMode::PRELAUNCH
            && getenv('CM_SYNTHETIC_EMAIL_SINK') !== '1';
    }
}

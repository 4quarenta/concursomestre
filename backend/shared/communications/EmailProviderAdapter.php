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
    public function send(
        string $email,
        string $name,
        string $subject,
        string $html,
        string $text = ''
    ): void {
        if ($this->isPrelaunchWithoutSyntheticSink()) {
            throw new RuntimeException('Entrega externa bloqueada: sink sintetico ausente em PRELAUNCH.');
        }

        Mailer::send($email, $name, $subject, $html, $text);
    }

    private function isPrelaunchWithoutSyntheticSink(): bool
    {
        return strtolower(trim((string) (getenv('APP_ENV') ?: 'development'))) === 'production'
            && SeoLaunchModeAuthority::read() === SeoLaunchMode::PRELAUNCH
            && getenv('CM_SYNTHETIC_EMAIL_SINK') !== '1';
    }
}

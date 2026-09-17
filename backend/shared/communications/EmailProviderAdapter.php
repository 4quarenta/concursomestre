<?php

declare(strict_types=1);

require_once __DIR__ . '/../utils/Mailer.php';

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
        Mailer::send($email, $name, $subject, $html, $text);
    }
}

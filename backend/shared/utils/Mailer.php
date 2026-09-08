<?php

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
 * shared/utils/Mailer.php
 * Helper de envio de e-mail usando PHPMailer + SMTP.
 *
 * Em modo desenvolvimento/local, quando nao ha SMTP configurado, o envio usa
 * mail(), permitindo captura por MailHog ou equivalente. Em producao, SMTP
 * transacional completo e obrigatorio para evitar "sucesso" sem entrega real.
 */

use PHPMailer\PHPMailer\PHPMailer;
use PHPMailer\PHPMailer\Exception as PHPMailerException;

require_once __DIR__ . '/MailConfiguration.php';

class Mailer {

    /**
     * Envia um e-mail usando as configuracoes SMTP do ambiente/painel.
     *
     * @param string $toEmail Destinatario
     * @param string $toName Nome do destinatario
     * @param string $subject Assunto
     * @param string $bodyHtml Corpo HTML
     * @param string $bodyText Corpo texto plano alternativo
     * @return bool true on success
     * @throws RuntimeException em caso de falha
     */
    public static function send(
        string $toEmail,
        string $toName,
        string $subject,
        string $bodyHtml,
        string $bodyText = ''
    ): bool {
        // Synthetic CLI acceptance runs must never reach a configured SMTP provider.
        if (PHP_SAPI === 'cli' && getenv('CM_SYNTHETIC_EMAIL_SINK') === '1') {
            self::logMailEvent('[MAILER-SYNTHETIC-SINK] transactional message captured without delivery.');
            return true;
        }

        $mailConfig = resolveMailConfiguration();
        $smtpHost = (string) $mailConfig['smtpHost'];
        $smtpUser = (string) $mailConfig['smtpUser'];
        $smtpPass = (string) $mailConfig['smtpPass'];
        $smtpPort = (int) $mailConfig['smtpPort'];
        $smtpSecure = (string) $mailConfig['smtpSecure'];
        $fromEmail = (string) $mailConfig['mailFromAddress'];
        $fromName = (string) $mailConfig['mailFromName'];
        $fromEmail = $fromEmail ?: 'no-reply@concursomestre.local';
        $hasSmtpCredentials = $smtpHost !== '' && $smtpUser !== '' && $smtpPass !== '';

        if (isProductionEnv() && !$hasSmtpCredentials) {
            self::logMailEvent("SMTP transacional nao configurado em producao; envio bloqueado para {$toEmail} - Assunto: {$subject}");
            throw new RuntimeException('SMTP transacional nao configurado para producao.');
        }

        if (isProductionEnv() && !filter_var($fromEmail, FILTER_VALIDATE_EMAIL)) {
            self::logMailEvent("Remetente invalido em producao: {$fromEmail}; envio bloqueado para {$toEmail} - Assunto: {$subject}");
            throw new RuntimeException('Remetente de e-mail invalido para producao.');
        }

        require_once dirname(__DIR__, 2) . '/vendor/autoload.php';

        $mail = new PHPMailer(true);

        try {
            $mail->CharSet = 'UTF-8';

            if ($hasSmtpCredentials) {
                $mail->isSMTP();
                $mail->Host = $smtpHost;
                $mail->SMTPAuth = true;
                $mail->Username = $smtpUser;
                $mail->Password = $smtpPass;
                $mail->SMTPSecure = $smtpSecure === 'ssl' ? PHPMailer::ENCRYPTION_SMTPS : PHPMailer::ENCRYPTION_STARTTLS;
                $mail->Port = $smtpPort;
            } else {
                $mail->isMail();
                self::logMailEvent("[MAILER-DEV] Enviando e-mail via mail() local para {$toEmail} - Assunto: {$subject}");
            }

            $mail->setFrom($fromEmail, $fromName);
            $mail->addAddress($toEmail, $toName);
            $mail->addReplyTo($fromEmail, $fromName);

            $normalizedBodyHtml = self::normalizeOutgoingHtmlBody($bodyHtml, $subject);
            $normalizedBodyText = trim($bodyText) !== '' ? $bodyText : self::htmlToText($normalizedBodyHtml);

            $mail->isHTML(true);
            $mail->Subject = $subject;
            $mail->Body = $normalizedBodyHtml;
            $mail->AltBody = $normalizedBodyText;

            $mail->send();
            self::logMailEvent("E-mail enviado para {$toEmail} - Assunto: {$subject}");
            return true;
        } catch (PHPMailerException $e) {
            self::logMailEvent("[MAILER] Falha ao enviar para {$toEmail}: " . $mail->ErrorInfo);
            throw new RuntimeException('Falha no envio de e-mail: ' . $mail->ErrorInfo);
        }
    }

    private static function logMailEvent(string $message): void
    {
        error_log($message);

        $logDir = dirname(__DIR__, 2) . '/storage/logs';
        if (!is_dir($logDir)) {
            @mkdir($logDir, 0775, true);
        }

        if (is_dir($logDir) && is_writable($logDir)) {
            @file_put_contents(
                $logDir . '/mail.log',
                '[' . date('Y-m-d H:i:s') . '] ' . $message . PHP_EOL,
                FILE_APPEND | LOCK_EX
            );
        }
    }

    /**
     * Normaliza a URL publica da logo usada nos e-mails.
     */
    public static function normalizeEmailLogoUrl(string $logoUrl): string
    {
        $normalized = trim($logoUrl);
        if ($normalized === '' || filter_var($normalized, FILTER_VALIDATE_URL) === false) {
            return '';
        }

        $scheme = strtolower((string) (parse_url($normalized, PHP_URL_SCHEME) ?: ''));
        return in_array($scheme, ['http', 'https'], true) ? $normalized : '';
    }

    /**
     * Renderiza a logo do e-mail ou o fallback CM.
     */
    public static function emailLogoBlock(string $logoUrl = ''): string
    {
        $normalizedLogoUrl = self::normalizeEmailLogoUrl($logoUrl);
        if ($normalizedLogoUrl !== '') {
            $safeLogoUrl = htmlspecialchars($normalizedLogoUrl, ENT_QUOTES, 'UTF-8');

            return "<img src='{$safeLogoUrl}' width='48' alt='ConcursoMestre' style='display:block;width:auto;max-width:132px;height:auto;max-height:46px;border:0;outline:none;text-decoration:none;object-fit:contain;'>";
        }

        return "<div style='width:42px;height:42px;border-radius:14px;background:#2563eb;color:#ffffff;text-align:center;line-height:42px;font-size:16px;font-weight:900;letter-spacing:0.02em;'>CM</div>";
    }

    /**
     * Converte HTML de e-mail para texto plano sem colar paragrafos.
     */
    public static function htmlToText(string $html): string
    {
        $normalized = preg_replace('/<(br|br\/)\s*\/?>/i', "\n", $html) ?? $html;
        $normalized = preg_replace('/<\/(p|div|h1|h2|h3|h4|li|tr|table)>/i', "\n", $normalized) ?? $normalized;
        $normalized = preg_replace('/<li\b[^>]*>/i', "- ", $normalized) ?? $normalized;
        $normalized = html_entity_decode(strip_tags($normalized), ENT_QUOTES | ENT_HTML5, 'UTF-8');
        $lines = array_map(static function (string $line): string {
            return trim(preg_replace('/[ \t]+/', ' ', $line) ?? $line);
        }, preg_split('/\R+/', $normalized) ?: []);
        $lines = array_values(array_filter($lines, static fn (string $line): bool => $line !== ''));

        return implode("\n\n", $lines);
    }

    /**
     * Garante que mesmo corpos acidentalmente salvos como texto puro recebam
     * o layout visual padrao no envio.
     */
    private static function normalizeOutgoingHtmlBody(string $bodyHtml, string $subject): string
    {
        $trimmed = trim($bodyHtml);
        if ($trimmed === '') {
            return self::htmlTemplate($subject, '<p>Mensagem do ConcursoMestre.</p>');
        }

        if (preg_match('/<[^>]+>/', $trimmed) === 1) {
            return $trimmed;
        }

        $safe = nl2br(htmlspecialchars($trimmed, ENT_QUOTES, 'UTF-8'));
        return self::htmlTemplate($subject, '<p>' . $safe . '</p>');
    }

    /**
     * Template HTML padrao para e-mails da plataforma.
     */
    public static function htmlTemplate(string $title, string $content, string $buttonUrl = '', string $buttonLabel = '', string $logoUrl = ''): string {
        $mailConfig = $logoUrl === '' ? resolveMailConfiguration() : [];
        $resolvedLogoUrl = self::normalizeEmailLogoUrl($logoUrl !== '' ? $logoUrl : (string) ($mailConfig['emailLogoUrl'] ?? ''));
        $logoHtml = self::emailLogoBlock($resolvedLogoUrl);
        $safeTitle = htmlspecialchars($title, ENT_QUOTES, 'UTF-8');
        $safeButtonUrl = htmlspecialchars($buttonUrl, ENT_QUOTES, 'UTF-8');
        $safeButtonLabel = htmlspecialchars($buttonLabel, ENT_QUOTES, 'UTF-8');
        $buttonHtml = '';

        if ($safeButtonUrl !== '' && $safeButtonLabel !== '') {
            $buttonHtml = "
              <table role='presentation' width='100%' cellpadding='0' cellspacing='0' style='border-collapse:collapse;margin:30px 0 10px;'>
                <tr>
                  <td align='left'>
                    <a href='{$safeButtonUrl}' target='_blank' rel='noopener noreferrer' style='display:inline-block;border-radius:12px;background:#2563eb;color:#ffffff;text-decoration:none;font-size:14px;font-weight:800;letter-spacing:0.04em;padding:14px 22px;box-shadow:0 12px 24px rgba(37,99,235,0.24);'>
                      {$safeButtonLabel}
                    </a>
                  </td>
                </tr>
              </table>";
        }

        return "<!DOCTYPE html>
<html lang='pt-BR'>
<head>
<meta charset='UTF-8'>
<meta name='viewport' content='width=device-width,initial-scale=1'>
</head>
<body style='margin:0;padding:0;background:#eef2f7;font-family:Arial,Helvetica,sans-serif;color:#0f172a;'>
  <div style='display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;'>{$safeTitle} - ConcursoMestre</div>
  <table role='presentation' width='100%' cellpadding='0' cellspacing='0' style='border-collapse:collapse;background:#eef2f7;'>
    <tr>
      <td align='center' style='padding:36px 14px;'>
        <table role='presentation' width='100%' cellpadding='0' cellspacing='0' style='max-width:660px;border-collapse:collapse;background:#ffffff;border:1px solid #dbe4ef;border-radius:20px;overflow:hidden;box-shadow:0 18px 50px rgba(15,23,42,0.10);'>
          <tr>
            <td style='background:#111827;padding:0;color:#ffffff;'>
              <table role='presentation' width='100%' cellpadding='0' cellspacing='0' style='border-collapse:collapse;'>
                <tr>
                  <td style='padding:26px 30px 22px;'>
                    <table role='presentation' width='100%' cellpadding='0' cellspacing='0' style='border-collapse:collapse;'>
                      <tr>
                        <td style='width:52px;vertical-align:middle;'>
                          {$logoHtml}
                        </td>
                        <td style='vertical-align:middle;'>
                          <p style='margin:0;font-size:12px;font-weight:900;letter-spacing:0.18em;text-transform:uppercase;color:#93c5fd;'>ConcursoMestre</p>
                          <p style='margin:7px 0 0;font-size:13px;font-weight:600;color:#dbeafe;'>Plataforma de estudos para concursos</p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
                <tr>
                  <td style='height:4px;background:#2563eb;font-size:0;line-height:0;'>&nbsp;</td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style='padding:34px 32px 30px;'>
              <p style='margin:0 0 10px;font-size:11px;font-weight:900;letter-spacing:0.14em;text-transform:uppercase;color:#2563eb;'>Comunicado</p>
              <h1 style='margin:0 0 18px;font-size:25px;line-height:1.24;font-weight:900;color:#0f172a;'>{$safeTitle}</h1>
              <div style='font-size:15px;line-height:1.75;color:#334155;'>
                {$content}
              </div>
              {$buttonHtml}
              <table role='presentation' width='100%' cellpadding='0' cellspacing='0' style='border-collapse:collapse;margin-top:28px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:14px;'>
                <tr>
                  <td style='padding:14px 16px;font-size:12px;line-height:1.6;color:#64748b;'>
                    Se voce nao reconhece esta mensagem, ignore este e-mail ou fale com nosso suporte.
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style='border-top:1px solid #e2e8f0;background:#f8fafc;padding:20px 32px;color:#64748b;font-size:12px;line-height:1.6;'>
              <strong style='color:#334155;'>Equipe ConcursoMestre</strong><br>
              Este e-mail foi enviado automaticamente pela plataforma. Por seguranca, nunca compartilhe sua senha.
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body></html>";
    }
}
?>

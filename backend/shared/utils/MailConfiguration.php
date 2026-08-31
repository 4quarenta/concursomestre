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

require_once dirname(__DIR__, 2) . '/config/env.php';

/**
 * Resolve a configuracao efetiva de e-mail.
 *
 * O painel admin pode persistir SMTP em system_settings, enquanto a VPS pode
 * definir segredos no .env. Para envio real, settings do painel prevalecem
 * quando preenchidos e o .env funciona como fallback operacional.
 *
 * @since 1.0.0
 * @return array{smtpHost:string,smtpUser:string,smtpPass:string,smtpPort:int,smtpSecure:string,mailFromAddress:string,mailFromName:string,emailLogoUrl:string,source:string}
 */
function resolveMailConfiguration(?PDO $db = null, bool $allowDatabase = true): array
{
    $config = [
        'smtpHost' => getEnvString('SMTP_HOST'),
        'smtpUser' => getEnvString('SMTP_USER'),
        'smtpPass' => getEnvString('SMTP_PASS'),
        'smtpPort' => (int) getEnvString('SMTP_PORT', '587'),
        'smtpSecure' => strtolower(getEnvString('SMTP_SECURE', 'tls')),
        'mailFromAddress' => getEnvString('MAIL_FROM_ADDRESS'),
        'mailFromName' => getEnvString('MAIL_FROM_NAME', 'ConcursoMestre'),
        'emailLogoUrl' => getEnvString('EMAIL_LOGO_URL'),
        'source' => 'env',
    ];

    $databaseDisabled = getEnvString('MAIL_CONFIG_DISABLE_DATABASE', '0') === '1';
    $settings = ($allowDatabase && !$databaseDisabled) ? loadMailConfigurationSettings($db) : [];
    if ($settings !== []) {
        foreach (['smtpHost', 'smtpUser', 'smtpPass', 'smtpSecure', 'mailFromAddress', 'mailFromName', 'emailLogoUrl'] as $key) {
            $value = trim((string) ($settings[$key] ?? ''));
            if ($value !== '') {
                $config[$key] = $value;
                $config['source'] = 'system_settings';
            }
        }

        $smtpPort = (int) ($settings['smtpPort'] ?? 0);
        if ($smtpPort > 0) {
            $config['smtpPort'] = $smtpPort;
            $config['source'] = 'system_settings';
        }
    }

    if ($config['mailFromAddress'] === '' && $config['smtpUser'] !== '') {
        $config['mailFromAddress'] = $config['smtpUser'];
    }

    if ($config['mailFromName'] === '') {
        $config['mailFromName'] = 'ConcursoMestre';
    }

    if (!in_array($config['smtpSecure'], ['tls', 'ssl'], true)) {
        $config['smtpSecure'] = 'tls';
    }

    return $config;
}

/**
 * Carrega somente as chaves de SMTP salvas pelo painel.
 *
 * @since 1.0.0
 * @return array<string, mixed>
 */
function loadMailConfigurationSettings(?PDO $db = null): array
{
    try {
        $connection = $db;
        if (!$connection instanceof PDO) {
            require_once dirname(__DIR__, 2) . '/config/database.php';
            $database = new Database();
            $connection = $database->getConnection();
        }

        $keys = [
            'smtpHost',
            'smtpUser',
            'smtpPass',
            'smtpPort',
            'smtpSecure',
            'mailFromAddress',
            'mailFromName',
            'emailLogoUrl',
        ];
        $placeholders = implode(',', array_fill(0, count($keys), '?'));
        $stmt = $connection->prepare("SELECT key_name, value_json FROM system_settings WHERE key_name IN ({$placeholders})");
        $stmt->execute($keys);

        $settings = [];
        while ($row = $stmt->fetch(PDO::FETCH_ASSOC)) {
            $key = (string) ($row['key_name'] ?? '');
            $rawValue = (string) ($row['value_json'] ?? '');
            $decoded = json_decode($rawValue, true);
            $settings[$key] = json_last_error() === JSON_ERROR_NONE ? $decoded : $rawValue;
        }

        return $settings;
    } catch (Throwable $error) {
        error_log('[mail_configuration] ' . $error->getMessage());
        return [];
    }
}

?>

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

const DEFAULT_RECAPTCHA_V3_MINIMUM_SCORE = 0.5;
const GOOGLE_RECAPTCHA_TEST_SITE_KEY = '6LeIxAcTAAAAAJcZVRqyHh71UMIEGNQ_MXjiZKhI';
const GOOGLE_RECAPTCHA_TEST_SECRET_KEY = '6LeIxAcTAAAAAGG-vFI1TnRWxMZNFuojJ4WifJWe';

/**
 * Verifica se o reCAPTCHA esta habilitado nas configuracoes globais.
 *
 * @since 1.0.0
 */
function isRecaptchaEnabled(PDO $db): bool
{
    $stmt = $db->prepare("SELECT value_json FROM system_settings WHERE key_name = 'recaptchaEnabled' LIMIT 1");
    $stmt->execute();
    $row = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$row || !array_key_exists('value_json', $row)) {
        return false;
    }

    $rawValue = $row['value_json'];
    $decodedValue = json_decode((string) $rawValue, true);

    if (is_bool($decodedValue)) {
        return $decodedValue && hasRecaptchaRuntimeConfiguration($db);
    }

    if (is_string($decodedValue)) {
        return in_array(strtolower(trim($decodedValue)), ['1', 'true', 'yes', 'on'], true)
            && hasRecaptchaRuntimeConfiguration($db);
    }

    $normalizedRawValue = strtolower(trim((string) $rawValue, " \t\n\r\0\x0B\""));
    $isEnabled = in_array($normalizedRawValue, ['1', 'true', 'yes', 'on'], true);

    if (!$isEnabled) {
        return false;
    }

    return hasRecaptchaRuntimeConfiguration($db);
}

/**
 * Recupera a site key do reCAPTCHA salva nas configuracoes.
 *
 * @since 1.0.0
 */
function getRecaptchaSiteKey(PDO $db): string
{
    $stmt = $db->prepare("SELECT value_json FROM system_settings WHERE key_name = 'recaptchaSiteKey' LIMIT 1");
    $stmt->execute();
    $row = $stmt->fetch(PDO::FETCH_ASSOC);

    if (!$row || !array_key_exists('value_json', $row)) {
        return '';
    }

    $rawValue = $row['value_json'];
    $decodedValue = json_decode((string) $rawValue, true);

    if (is_string($decodedValue) && trim($decodedValue) !== '') {
        return trim($decodedValue);
    }

    if (is_array($decodedValue) && !empty($decodedValue['value'])) {
        return trim((string) $decodedValue['value']);
    }

    return trim((string) $rawValue, " \t\n\r\0\x0B\"");
}

/**
 * Recupera o secret do reCAPTCHA exclusivamente do ambiente protegido.
 *
 * Segredos legados em system_settings nao sao mais uma fonte operacional:
 * isso impede que uma credencial potencialmente comprometida seja reativada
 * por uma configuracao de banco e mantem a rotacao sob controle do ambiente.
 *
 * @since 1.0.0
 */
function getRecaptchaSecretKey(PDO $db): string
{
    unset($db);

    return trim((string) ($_ENV['RECAPTCHA_SECRET_KEY'] ?? getenv('RECAPTCHA_SECRET_KEY') ?? ''));
}

/**
 * Garante que o runtime tenha as duas chaves necessarias para o reCAPTCHA v3.
 *
 * @since 1.0.0
 */
function hasRecaptchaRuntimeConfiguration(PDO $db): bool
{
    return getRecaptchaSiteKey($db) !== '' && getRecaptchaSecretKey($db) !== '';
}

/**
 * Detecta ambiente local para permitir bypass controlado com as chaves oficiais de teste.
 *
 * @since 1.0.0
 */
function isLocalRecaptchaDevelopmentContext(): bool
{
    $appEnv = strtolower(trim((string) ($_ENV['APP_ENV'] ?? $_SERVER['APP_ENV'] ?? '')));
    if (in_array($appEnv, ['local', 'development', 'dev', 'test'], true)) {
        return true;
    }

    $host = strtolower(trim((string) ($_SERVER['HTTP_HOST'] ?? '')));
    if (
        $host === 'localhost'
        || str_starts_with($host, 'localhost:')
        || $host === '127.0.0.1'
        || str_starts_with($host, '127.0.0.1:')
    ) {
        return true;
    }

    $remoteAddress = trim((string) ($_SERVER['REMOTE_ADDR'] ?? ''));
    return in_array($remoteAddress, ['127.0.0.1', '::1'], true);
}

/**
 * Identifica quando o runtime esta usando o par oficial de chaves de teste do Google.
 *
 * @since 1.0.0
 */
function isUsingGoogleRecaptchaTestCredentials(PDO $db): bool
{
    $siteKey = getRecaptchaSiteKey($db);
    $secretKey = getRecaptchaSecretKey($db);

    return $siteKey === GOOGLE_RECAPTCHA_TEST_SITE_KEY
        && $secretKey === GOOGLE_RECAPTCHA_TEST_SECRET_KEY;
}

/**
 * Normaliza a action esperada para o formato aceito pelo reCAPTCHA v3.
 *
 * @since 1.0.0
 */
function normalizeRecaptchaActionName(?string $action): string
{
    $normalizedAction = preg_replace('/[^a-zA-Z0-9_\/]/', '', trim((string) $action));
    return is_string($normalizedAction) ? $normalizedAction : '';
}

/**
 * Faz a chamada de verificacao do token reCAPTCHA.
 *
 * @since 1.0.0
 */
function postRecaptchaVerification(string $secretKey, string $token): array
{
    $payload = [
        'secret' => $secretKey,
        'response' => $token,
    ];

    if (!empty($_SERVER['REMOTE_ADDR'])) {
        $payload['remoteip'] = (string) $_SERVER['REMOTE_ADDR'];
    }

    if (function_exists('curl_init')) {
        $curl = curl_init('https://www.google.com/recaptcha/api/siteverify');
        curl_setopt_array($curl, [
            CURLOPT_POST => true,
            CURLOPT_POSTFIELDS => http_build_query($payload),
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT => 10,
        ]);

        $rawResponse = curl_exec($curl);
        $curlError = curl_error($curl);
        curl_close($curl);

        if ($rawResponse === false) {
            throw new RuntimeException('Nao foi possivel validar o reCAPTCHA.' . ($curlError ? ' ' . $curlError : ''));
        }
    } else {
        $context = stream_context_create([
            'http' => [
                'method' => 'POST',
                'header' => "Content-type: application/x-www-form-urlencoded\r\n",
                'content' => http_build_query($payload),
                'timeout' => 10,
            ],
        ]);

        $rawResponse = @file_get_contents('https://www.google.com/recaptcha/api/siteverify', false, $context);
        if ($rawResponse === false) {
            throw new RuntimeException('Nao foi possivel validar o reCAPTCHA.');
        }
    }

    $decodedResponse = json_decode((string) $rawResponse, true);
    if (!is_array($decodedResponse)) {
        throw new RuntimeException('Resposta invalida ao validar o reCAPTCHA.');
    }

    return $decodedResponse;
}

/**
 * Exige que o reCAPTCHA passe antes de seguir com operacoes sensiveis.
 *
 * @param array{action?: string, minimumScore?: float|int|string} $options
 * @since 1.0.0
 */
function ensureRecaptchaPassed(PDO $db, ?string $token, array $options = []): void
{
    if (!isRecaptchaEnabled($db)) {
        return;
    }

    if (isLocalRecaptchaDevelopmentContext() && isUsingGoogleRecaptchaTestCredentials($db)) {
        return;
    }

    $normalizedToken = trim((string) $token);
    if ($normalizedToken === '') {
        throw new RuntimeException('Confirme o reCAPTCHA antes de continuar.');
    }

    $secretKey = getRecaptchaSecretKey($db);
    $expectedAction = normalizeRecaptchaActionName((string) ($options['action'] ?? ''));
    $minimumScore = array_key_exists('minimumScore', $options)
        ? max(0.0, min(1.0, (float) $options['minimumScore']))
        : DEFAULT_RECAPTCHA_V3_MINIMUM_SCORE;

    $verificationResult = postRecaptchaVerification($secretKey, $normalizedToken);
    if (!($verificationResult['success'] ?? false)) {
        $errorCodes = $verificationResult['error-codes'] ?? [];
        $errorSuffix = is_array($errorCodes) && $errorCodes !== []
            ? ' [' . implode(', ', array_map('strval', $errorCodes)) . ']'
            : '';
        throw new RuntimeException('Falha na verificacao de seguranca (reCAPTCHA).' . $errorSuffix);
    }

    if ($expectedAction !== '') {
        $verifiedAction = normalizeRecaptchaActionName((string) ($verificationResult['action'] ?? ''));
        if ($verifiedAction === '' || $verifiedAction !== $expectedAction) {
            throw new RuntimeException('Falha na verificacao de seguranca (acao reCAPTCHA invalida).');
        }

        if (!array_key_exists('score', $verificationResult) || !is_numeric($verificationResult['score'])) {
            throw new RuntimeException('Falha na verificacao de seguranca (score reCAPTCHA ausente).');
        }

        if ((float) $verificationResult['score'] < $minimumScore) {
            throw new RuntimeException('Falha na verificacao de seguranca (score reCAPTCHA insuficiente).');
        }
    }
}

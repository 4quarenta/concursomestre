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

final class RecaptchaValidationException extends RuntimeException
{
}

final class RecaptchaUnavailableException extends RuntimeException
{
}

/** Retorna configuracao Enterprise mobile sem expor a chave de avaliacao. */
function getRecaptchaMobileConfiguration(): array
{
    $projectId = trim((string) ($_ENV['RECAPTCHA_ENTERPRISE_PROJECT_ID'] ?? getenv('RECAPTCHA_ENTERPRISE_PROJECT_ID') ?? ''));
    $apiKey = trim((string) ($_ENV['RECAPTCHA_ENTERPRISE_API_KEY'] ?? getenv('RECAPTCHA_ENTERPRISE_API_KEY') ?? ''));
    $siteKey = trim((string) ($_ENV['RECAPTCHA_ANDROID_SITE_KEY'] ?? getenv('RECAPTCHA_ANDROID_SITE_KEY') ?? ''));
    $packageName = trim((string) ($_ENV['RECAPTCHA_ANDROID_PACKAGE_NAME'] ?? getenv('RECAPTCHA_ANDROID_PACKAGE_NAME') ?? 'com.concursomestre.mobile'));
    $minimumScore = (float) ($_ENV['RECAPTCHA_MOBILE_MINIMUM_SCORE'] ?? getenv('RECAPTCHA_MOBILE_MINIMUM_SCORE') ?? DEFAULT_RECAPTCHA_V3_MINIMUM_SCORE);

    return compact('projectId', 'apiKey', 'siteKey', 'packageName', 'minimumScore');
}

/** Avalia um token de aplicativo pela API REST do reCAPTCHA Enterprise. */
function postRecaptchaMobileAssessment(array $config, string $token, string $expectedAction): array
{
    $url = 'https://recaptchaenterprise.googleapis.com/v1/projects/'
        . rawurlencode($config['projectId']) . '/assessments?key=' . rawurlencode($config['apiKey']);
    $body = json_encode([
        'event' => [
            'token' => $token,
            'siteKey' => $config['siteKey'],
            'expectedAction' => $expectedAction,
        ],
    ], JSON_UNESCAPED_SLASHES);
    if (!is_string($body)) {
        throw new RecaptchaUnavailableException('Nao foi possivel validar o reCAPTCHA.');
    }

    if (function_exists('curl_init')) {
        $curl = curl_init($url);
        curl_setopt_array($curl, [
            CURLOPT_POST => true,
            CURLOPT_POSTFIELDS => $body,
            CURLOPT_HTTPHEADER => ['Content-Type: application/json'],
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_CONNECTTIMEOUT => 3,
            CURLOPT_TIMEOUT => 8,
        ]);
        $rawResponse = curl_exec($curl);
        $status = (int) curl_getinfo($curl, CURLINFO_RESPONSE_CODE);
        curl_close($curl);
    } else {
        $context = stream_context_create(['http' => [
            'method' => 'POST',
            'header' => "Content-Type: application/json\r\n",
            'content' => $body,
            'timeout' => 8,
            'ignore_errors' => true,
        ]]);
        $rawResponse = @file_get_contents($url, false, $context);
        $status = 0;
        foreach (($http_response_header ?? []) as $header) {
            if (preg_match('/^HTTP\/\S+\s+(\d{3})/', $header, $matches)) {
                $status = (int) $matches[1];
            }
        }
    }

    if (!is_string($rawResponse) || $status < 200 || $status >= 300) {
        throw new RecaptchaUnavailableException('Nao foi possivel validar o reCAPTCHA. Tente novamente.');
    }
    $assessment = json_decode($rawResponse, true);
    if (!is_array($assessment)) {
        throw new RecaptchaUnavailableException('Resposta invalida ao validar o reCAPTCHA.');
    }
    return $assessment;
}

/** Rejeita token inválido, pacote/ação divergentes ou score abaixo do limite. */
function assertRecaptchaMobileAssessmentPassed(array $assessment, array $config, string $expectedAction): void
{
    $tokenProperties = $assessment['tokenProperties'] ?? [];
    $riskAnalysis = $assessment['riskAnalysis'] ?? [];
    $valid = is_array($tokenProperties) && ($tokenProperties['valid'] ?? false) === true;
    $action = is_array($tokenProperties) ? (string) ($tokenProperties['action'] ?? '') : '';
    $packageName = (string) ($tokenProperties['androidPackageName'] ?? '');
    $score = is_array($riskAnalysis) ? ($riskAnalysis['score'] ?? null) : null;

    if (!$valid || $action !== $expectedAction || $packageName !== $config['packageName']
        || !is_numeric($score) || (float) $score < $config['minimumScore']) {
        throw new RecaptchaValidationException('Nao foi possivel confirmar o reCAPTCHA. Tente novamente.');
    }
}

function ensureRecaptchaMobilePassed(PDO $db, ?string $token, string $expectedAction): void
{
    if (!isRecaptchaEnabled($db)) {
        return;
    }
    $config = getRecaptchaMobileConfiguration();
    if ($config['projectId'] === '' || $config['apiKey'] === '' || $config['siteKey'] === '' || $config['packageName'] === '') {
        throw new RecaptchaUnavailableException('A verificacao segura do app esta temporariamente indisponivel.');
    }
    $normalizedToken = trim((string) $token);
    if ($normalizedToken === '') {
        throw new RecaptchaValidationException('Confirme o reCAPTCHA antes de continuar.');
    }
    assertRecaptchaMobileAssessmentPassed(postRecaptchaMobileAssessment($config, $normalizedToken, $expectedAction), $config, $expectedAction);
}

/**
 * Permite que o contrato nativo atual omita captcha somente no login/cadastro.
 * A ausência de token é a única condição dispensada; um token fornecido segue
 * pela validação Enterprise e não pode ser tratado como aprovação implícita.
 */
function isNativeMobileAuthRecaptchaExemptFlow(array $options, ?string $token): bool
{
    if (($options['nativeMobileAuthExempt'] ?? false) !== true || trim((string) $token) !== '') {
        return false;
    }

    $action = normalizeRecaptchaActionName((string) ($options['action'] ?? ''));
    return in_array($action, ['auth_login', 'auth_register'], true);
}

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
 * @param array{action?: string, minimumScore?: float|int|string, nativeMobile?: bool, nativeMobileAuthExempt?: bool} $options
 * @since 1.0.0
 */
function ensureRecaptchaPassed(PDO $db, ?string $token, array $options = []): void
{
    if (isNativeMobileAuthRecaptchaExemptFlow($options, $token)) {
        return;
    }

    if (!empty($options['nativeMobile'])) {
        ensureRecaptchaMobilePassed($db, $token, (string) ($options['mobileAction'] ?? 'login'));
        return;
    }
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

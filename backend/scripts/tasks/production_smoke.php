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

declare(strict_types=1);

if (PHP_SAPI !== 'cli') {
    http_response_code(403);
    exit("Este script so pode ser executado via CLI.\n");
}

require_once __DIR__ . '/../../config/database.php';

function smokeCliOption(string $name, ?string $fallback = null): ?string
{
    global $argv;

    foreach ($argv as $argument) {
        if (strpos($argument, '--' . $name . '=') === 0) {
            return substr($argument, strlen($name) + 3);
        }
    }

    return $fallback;
}

function smokeNormalizeBaseUrl(string $baseUrl): string
{
    $baseUrl = trim($baseUrl);
    if ($baseUrl === '') {
        throw new RuntimeException('Informe --api-base-url ou SMOKE_API_BASE_URL.');
    }

    return rtrim($baseUrl, '/');
}

function smokeNormalizeOptionalBaseUrl(?string $baseUrl): ?string
{
    if ($baseUrl === null) {
        return null;
    }

    $trimmed = trim($baseUrl);
    if ($trimmed === '') {
        return null;
    }

    return rtrim($trimmed, '/');
}

function smokeFetchUrl(string $url, int $timeoutSeconds, string $method = 'GET', array $headers = [], ?string $body = null): array
{
    $startedAt = microtime(true);
    $method = strtoupper(trim($method));

    if (function_exists('curl_init')) {
        $handle = curl_init($url);
        $curlHeaders = [];
        foreach ($headers as $name => $value) {
            $curlHeaders[] = $name . ': ' . $value;
        }

        curl_setopt_array($handle, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_FOLLOWLOCATION => false,
            CURLOPT_HEADER => true,
            CURLOPT_CONNECTTIMEOUT => $timeoutSeconds,
            CURLOPT_TIMEOUT => $timeoutSeconds,
            CURLOPT_USERAGENT => 'ConcursoMestreProductionSmoke/1.0',
        ]);

        if ($method !== 'GET') {
            curl_setopt($handle, CURLOPT_CUSTOMREQUEST, $method);
        }

        if ($body !== null) {
            curl_setopt($handle, CURLOPT_POSTFIELDS, $body);
        }

        if (count($curlHeaders) > 0) {
            curl_setopt($handle, CURLOPT_HTTPHEADER, $curlHeaders);
        }

        $response = curl_exec($handle);
        $error = curl_error($handle);
        $statusCode = (int) curl_getinfo($handle, CURLINFO_RESPONSE_CODE);
        $headerSize = (int) curl_getinfo($handle, CURLINFO_HEADER_SIZE);
        curl_close($handle);

        $rawHeaders = is_string($response) ? substr($response, 0, $headerSize) : '';
        $body = is_string($response) ? substr($response, $headerSize) : '';

        return [
            'status_code' => $statusCode,
            'duration_ms' => (int) round((microtime(true) - $startedAt) * 1000),
            'headers' => smokeParseHeaderLines(preg_split('/\r\n|\n|\r/', $rawHeaders) ?: []),
            'body' => $body,
            'error' => $error !== '' ? $error : null,
        ];
    }

    $context = stream_context_create([
        'http' => [
            'method' => $method,
            'timeout' => $timeoutSeconds,
            'header' => smokeBuildHeaderString(array_merge([
                'User-Agent' => 'ConcursoMestreProductionSmoke/1.0',
            ], $headers)),
            'content' => $body,
            'ignore_errors' => true,
        ],
    ]);

    $body = @file_get_contents($url, false, $context);
    $statusCode = 0;
    foreach (($http_response_header ?? []) as $header) {
        if (preg_match('/^HTTP\/\S+\s+(\d{3})/', $header, $matches)) {
            $statusCode = (int) $matches[1];
            break;
        }
    }

    return [
        'status_code' => $statusCode,
        'duration_ms' => (int) round((microtime(true) - $startedAt) * 1000),
        'headers' => smokeParseHeaderLines($http_response_header ?? []),
        'body' => is_string($body) ? $body : '',
        'error' => $body === false ? 'Falha ao executar GET.' : null,
    ];
}

function smokeBuildHeaderString(array $headers): string
{
    $lines = [];
    foreach ($headers as $name => $value) {
        $name = trim((string) $name);
        $value = trim((string) $value);
        if ($name === '' || $value === '') {
            continue;
        }

        $lines[] = $name . ': ' . $value;
    }

    return implode("\r\n", $lines) . "\r\n";
}

function smokeParseHeaderLines(array $headerLines): array
{
    $headers = [];
    foreach ($headerLines as $line) {
        if (!is_string($line) || strpos($line, ':') === false) {
            continue;
        }

        [$name, $value] = explode(':', $line, 2);
        $key = strtolower(trim($name));
        $normalizedValue = trim($value);
        if ($key === '') {
            continue;
        }

        $headers[$key] = isset($headers[$key])
            ? $headers[$key] . ', ' . $normalizedValue
            : $normalizedValue;
    }

    return $headers;
}

function smokeFindMissingHeaders(array $headers, array $requiredHeaders): array
{
    $missing = [];
    foreach ($requiredHeaders as $headerName => $expectedNeedle) {
        $key = strtolower((string) $headerName);
        $value = (string) ($headers[$key] ?? '');
        if ($value === '') {
            $missing[] = $key;
            continue;
        }

        if (is_string($expectedNeedle) && $expectedNeedle !== '' && stripos($value, $expectedNeedle) === false) {
            $missing[] = $key . '=' . $expectedNeedle;
        }
    }

    return $missing;
}

function smokeUrlUsesHttpsForPublicHost(?string $baseUrl): array
{
    if ($baseUrl === null) {
        return ['ok' => true, 'reason' => 'URL opcional nao informada.'];
    }

    $parts = parse_url($baseUrl);
    $scheme = strtolower((string) ($parts['scheme'] ?? ''));
    $host = strtolower((string) ($parts['host'] ?? ''));
    $isLocal = in_array($host, ['localhost', '127.0.0.1', '::1'], true)
        || str_ends_with($host, '.local')
        || str_ends_with($host, '.test');

    if ($isLocal) {
        return ['ok' => true, 'reason' => 'Host local liberado para HTTP em desenvolvimento.'];
    }

    return [
        'ok' => $scheme === 'https',
        'reason' => $scheme === 'https' ? 'HTTPS confirmado em host publico.' : 'Host publico deve usar HTTPS.',
    ];
}

function smokeFindForbiddenJsonKeys(mixed $payload, array $forbiddenKeys, string $path = ''): array
{
    if (!is_array($payload)) {
        return [];
    }

    $forbiddenLookup = array_fill_keys($forbiddenKeys, true);
    $matches = [];

    foreach ($payload as $key => $value) {
        $keyPath = $path === '' ? (string) $key : $path . '.' . (string) $key;

        if (is_string($key) && isset($forbiddenLookup[$key])) {
            $matches[] = $keyPath;
        }

        if (is_array($value)) {
            array_push($matches, ...smokeFindForbiddenJsonKeys($value, $forbiddenKeys, $keyPath));
        }
    }

    return $matches;
}

function smokeLegalCommentaryListStats(mixed $payload): array
{
    $stats = [
        'law_summaries' => 0,
        'laws_by_area_entries' => 0,
        'areas_with_laws' => 0,
        'article_count_sum' => 0,
    ];

    if (!is_array($payload)) {
        return $stats;
    }

    $lawsByArea = $payload['lawsByArea'] ?? [];
    if (is_array($lawsByArea)) {
        foreach ($lawsByArea as $areaGroup) {
            if (!is_array($areaGroup)) {
                continue;
            }

            $laws = $areaGroup['laws'] ?? [];
            if (!is_array($laws)) {
                continue;
            }

            $lawCount = count($laws);
            $stats['laws_by_area_entries'] += $lawCount;
            if ($lawCount > 0) {
                $stats['areas_with_laws']++;
            }

            foreach ($laws as $law) {
                if (!is_array($law)) {
                    continue;
                }

                if (($law['id'] ?? null) !== null && (($law['slug'] ?? '') !== '' || ($law['title'] ?? '') !== '')) {
                    $stats['law_summaries']++;
                }

                $articleCount = $law['articleCount'] ?? $law['totalArtigos'] ?? 0;
                if (is_numeric($articleCount)) {
                    $stats['article_count_sum'] += max(0, (int) $articleCount);
                }
            }
        }
    }

    return $stats;
}

function smokeValidateLegalCommentaryList(mixed $payload): array
{
    if (!is_array($payload)) {
        return ['Payload da Lei Comentada nao e um objeto JSON.'];
    }

    $errors = [];
    $totals = $payload['totals'] ?? null;
    if (!is_array($totals)) {
        return ['Payload da Lei Comentada sem totais.'];
    }

    $totalLaws = (int) ($totals['laws'] ?? 0);
    $totalArticles = (int) ($totals['articles'] ?? 0);
    $stats = smokeLegalCommentaryListStats($payload);

    if ($totalLaws > 0 && $stats['law_summaries'] === 0) {
        $errors[] = 'Totais indicam leis publicadas, mas nenhuma lei navegavel apareceu em lawsByArea.';
    }

    if ($totalLaws > 0 && $stats['laws_by_area_entries'] < $totalLaws) {
        $errors[] = 'lawsByArea possui menos leis do que totals.laws.';
    }

    if ($totalArticles > 0 && $stats['article_count_sum'] <= 0) {
        $errors[] = 'Totais indicam artigos, mas os resumos das leis nao trazem articleCount/totalArtigos.';
    }

    return $errors;
}

function smokeFirstLegalCommentarySlug(mixed $payload): ?string
{
    if (!is_array($payload) || !is_array($payload['lawsByArea'] ?? null)) {
        return null;
    }

    foreach ($payload['lawsByArea'] as $areaGroup) {
        if (!is_array($areaGroup) || !is_array($areaGroup['laws'] ?? null)) {
            continue;
        }

        foreach ($areaGroup['laws'] as $law) {
            if (!is_array($law)) {
                continue;
            }

            $slug = trim((string) ($law['slug'] ?? ''));
            if ($slug !== '') {
                return $slug;
            }
        }
    }

    return null;
}

function smokeValidateLegalCommentaryOutline(mixed $payload): array
{
    if (!is_array($payload)) {
        return ['Payload do detalhe da Lei Comentada nao e um objeto JSON.'];
    }

    $sections = $payload['sections'] ?? null;
    $articles = $payload['articles'] ?? null;
    $errors = [];

    if (!is_array($sections) || count($sections) === 0) {
        $errors[] = 'Detalhe da lei nao retornou secoes.';
    }

    if (!is_array($articles) || count($articles) === 0) {
        $errors[] = 'Detalhe da lei nao retornou artigos.';
    }

    if (is_array($sections) && is_array($articles)) {
        $sectionArticleTotal = 0;
        foreach ($sections as $section) {
            if (!is_array($section)) {
                continue;
            }

            $articleCount = $section['articleCount'] ?? 0;
            if (is_numeric($articleCount)) {
                $sectionArticleTotal += max(0, (int) $articleCount);
            }
        }

        if (count($sections) > 0 && count($articles) > 0 && $sectionArticleTotal <= 0) {
            $errors[] = 'Secoes retornadas nao informam articleCount.';
        }
    }

    return $errors;
}

function smokeHttpChecks(string $apiBaseUrl, int $timeoutSeconds): array
{
    $checks = [
        ['name' => 'plans', 'path' => '/plans/list.php', 'expects_json' => true],
        ['name' => 'questions_list', 'path' => '/questionsList?page=1&limit=1', 'expects_json' => true],
        [
            'name' => 'legal_commentary_list',
            'path' => '/legal-commentary/list.php',
            'expects_json' => true,
            'validator' => 'legal_commentary_list',
        ],
        [
            'name' => 'settings',
            'path' => '/settings.php',
            'expects_json' => true,
            'required_headers' => [
                'x-content-type-options' => 'nosniff',
                'x-frame-options' => 'DENY',
                'content-security-policy' => "default-src 'none'",
            ],
            'forbidden_json_keys' => [
                'stripeKey',
                'stripeSecretKey',
                'stripeWebhookSecret',
                'geminiApiKey',
                'recaptchaSecretKey',
                'smtpPass',
                'mailPassword',
            ],
            'forbidden_top_level_json_keys' => [
                'appMode',
                'seo',
                'hasStripeSecretConfigured',
                'hasStripeWebhookConfigured',
                'hasGeminiApiKeyConfigured',
                'hasRecaptchaSecretConfigured',
                'hasSmtpPasswordConfigured',
            ],
        ],
    ];

    $results = [];
    foreach ($checks as $check) {
        $url = $apiBaseUrl . $check['path'];
        $result = smokeFetchUrl($url, $timeoutSeconds);
        $body = trim((string) $result['body']);
        $decodedJson = $check['expects_json'] ? json_decode($body, true) : null;
        $jsonOk = !$check['expects_json'] || is_array($decodedJson);
        $forbiddenJsonKeysFound = [];
        $validatorErrors = [];
        $relatedChecks = [];
        $missingHeaders = smokeFindMissingHeaders($result['headers'] ?? [], $check['required_headers'] ?? []);
        $decodedPayload = is_array($decodedJson) && array_key_exists('data', $decodedJson) ? $decodedJson['data'] : $decodedJson;

        if ($jsonOk && !empty($check['forbidden_json_keys'])) {
            $forbiddenJsonKeysFound = smokeFindForbiddenJsonKeys(
                $decodedPayload,
                $check['forbidden_json_keys']
            );
        }

        if ($jsonOk && is_array($decodedPayload) && !empty($check['forbidden_top_level_json_keys'])) {
            foreach ($check['forbidden_top_level_json_keys'] as $topLevelForbiddenKey) {
                if (array_key_exists($topLevelForbiddenKey, $decodedPayload)) {
                    $forbiddenJsonKeysFound[] = $topLevelForbiddenKey;
                }
            }
        }

        if ($jsonOk && ($check['validator'] ?? null) === 'legal_commentary_list') {
            $validatorErrors = smokeValidateLegalCommentaryList($decodedPayload);

            $sampleLawSlug = smokeFirstLegalCommentarySlug($decodedPayload);
            if ($sampleLawSlug !== null) {
                $outlineUrl = $apiBaseUrl . '/legal-commentary/detail.php?slug=' . rawurlencode($sampleLawSlug) . '&outline=1';
                $outlineResult = smokeFetchUrl($outlineUrl, $timeoutSeconds);
                $outlineJson = json_decode(trim((string) $outlineResult['body']), true);
                $outlinePayload = is_array($outlineJson) && array_key_exists('data', $outlineJson) ? $outlineJson['data'] : $outlineJson;
                $outlineJsonOk = is_array($outlineJson);
                $outlineErrors = $outlineJsonOk ? smokeValidateLegalCommentaryOutline($outlinePayload) : ['Detalhe da lei nao retornou JSON valido.'];

                if ($outlineResult['status_code'] < 200 || $outlineResult['status_code'] >= 300 || $outlineResult['error'] !== null) {
                    $outlineErrors[] = 'Detalhe da lei respondeu com erro HTTP.';
                }

                foreach ($outlineErrors as $outlineError) {
                    $validatorErrors[] = 'Outline "' . $sampleLawSlug . '": ' . $outlineError;
                }

                $relatedChecks[] = [
                    'name' => 'legal_commentary_outline',
                    'url' => $outlineUrl,
                    'ok' => count($outlineErrors) === 0,
                    'status_code' => $outlineResult['status_code'],
                    'duration_ms' => $outlineResult['duration_ms'],
                    'json_ok' => $outlineJsonOk,
                    'error' => $outlineResult['error'],
                ];
            }
        }

        $ok = $result['status_code'] >= 200
            && $result['status_code'] < 300
            && $result['error'] === null
            && $jsonOk
            && count($forbiddenJsonKeysFound) === 0
            && count($validatorErrors) === 0
            && count($missingHeaders) === 0;

        $results[] = [
            'name' => $check['name'],
            'url' => $url,
            'ok' => $ok,
            'status_code' => $result['status_code'],
            'duration_ms' => $result['duration_ms'],
            'json_ok' => $jsonOk,
            'missing_headers' => $missingHeaders,
            'sample_question_id' => $check['name'] === 'questions_list'
                ? (isset($decodedPayload['rows'][0]['id']) ? (int) $decodedPayload['rows'][0]['id'] : null)
                : null,
            'sample_legal_slug' => $check['name'] === 'legal_commentary_list'
                ? smokeFirstLegalCommentarySlug($decodedPayload)
                : null,
            'related_checks' => $relatedChecks,
            'validator_errors' => $validatorErrors,
            'forbidden_json_keys_found' => $forbiddenJsonKeysFound,
            'error' => $result['error'],
        ];
    }

    return $results;
}

function smokeBodyHasAny(string $body, array $needles): bool
{
    foreach ($needles as $needle) {
        if ($needle !== '' && strpos($body, $needle) !== false) {
            return true;
        }
    }

    return false;
}

function smokeWebChecks(?string $webBaseUrl, ?int $publicQuestionId, int $timeoutSeconds): array
{
    if ($webBaseUrl === null) {
        return [];
    }

    $checks = [
        [
            'name' => 'home',
            'path' => '/',
            'body_must_contain_any' => ['ConcursoMestre', 'Comecar gratis', 'Comecar'],
            'required_headers' => [
                'x-content-type-options' => 'nosniff',
                'x-frame-options' => 'DENY',
                'content-security-policy' => "default-src 'self'",
            ],
        ],
        [
            'name' => 'auth',
            'path' => '/auth',
            'body_must_contain_any' => ['Entrar', 'Criar conta', 'Bem-vindo'],
            'required_headers' => [
                'x-content-type-options' => 'nosniff',
                'x-frame-options' => 'DENY',
                'content-security-policy' => "default-src 'self'",
            ],
        ],
        [
            'name' => 'questions_public',
            'path' => '/questoes',
            'body_must_not_contain_any' => ['NEXT_REDIRECT'],
        ],
        [
            'name' => 'practice_alias',
            'path' => '/practice',
            'allow_redirect' => true,
            'expected_status' => 308,
            'body_must_not_contain_any' => ['NEXT_REDIRECT'],
        ],
        [
            'name' => 'questions_english_alias',
            'path' => '/questions',
            'allow_redirect' => true,
            'expected_status' => 308,
            'body_must_not_contain_any' => ['NEXT_REDIRECT'],
        ],
        [
            'name' => 'exams_public',
            'path' => '/provas',
            'body_must_not_contain_any' => ['NEXT_REDIRECT'],
        ],
        [
            'name' => 'exams_legacy_alias',
            'path' => '/blog/provas',
            'allow_redirect' => true,
            'expected_status' => 308,
            'body_must_not_contain_any' => ['NEXT_REDIRECT'],
        ],
    ];

    if ($publicQuestionId !== null && $publicQuestionId > 0) {
        $checks[] = [
            'name' => 'question_legacy_alias',
            'path' => '/question/' . $publicQuestionId,
            'allow_redirect' => true,
            'expected_status' => 308,
            'body_must_not_contain_any' => ['NEXT_REDIRECT'],
        ];
    }

    $results = [];
    foreach ($checks as $check) {
        $url = $webBaseUrl . $check['path'];
        $result = smokeFetchUrl($url, $timeoutSeconds);
        $body = trim((string) $result['body']);
        $mustContain = $check['body_must_contain_any'] ?? [];
        $mustNotContain = $check['body_must_not_contain_any'] ?? [];
        $containsExpected = empty($mustContain) || smokeBodyHasAny($body, $mustContain);
        $containsForbidden = !empty($mustNotContain) && smokeBodyHasAny($body, $mustNotContain);
        $missingHeaders = smokeFindMissingHeaders($result['headers'] ?? [], $check['required_headers'] ?? []);

        $statusCode = (int) $result['status_code'];
        $allowsRedirect = !empty($check['allow_redirect']);
        $expectedStatus = isset($check['expected_status']) ? (int) $check['expected_status'] : null;
        $statusOk = $expectedStatus !== null
            ? $statusCode === $expectedStatus
            : (($statusCode >= 200 && $statusCode < 300)
                || ($allowsRedirect && in_array($statusCode, [301, 302, 303, 307, 308], true)));

        $ok = $statusOk
            && $result['error'] === null
            && $containsExpected
            && !$containsForbidden
            && count($missingHeaders) === 0;

        $results[] = [
            'name' => $check['name'],
            'url' => $url,
            'ok' => $ok,
            'status_code' => $result['status_code'],
            'duration_ms' => $result['duration_ms'],
            'contains_expected_marker' => $containsExpected,
            'contains_forbidden_marker' => $containsForbidden,
            'missing_headers' => $missingHeaders,
            'error' => $result['error'],
        ];
    }

    return $results;
}

function smokeBooleanValue(?string $value): bool
{
    $value = strtolower(trim((string) $value));
    return in_array($value, ['1', 'true', 'yes', 'on'], true);
}

function smokeJsonAuthenticatedEndpoint(
    string $apiBaseUrl,
    int $timeoutSeconds,
    string $name,
    string $path,
    string $token
): array {
    $url = $apiBaseUrl . $path;
    $response = smokeFetchUrl(
        $url,
        $timeoutSeconds,
        'GET',
        ['Accept' => 'application/json', 'Authorization' => 'Bearer ' . $token]
    );
    $json = json_decode(trim((string) $response['body']), true);
    $jsonOk = is_array($json);
    $statusCode = (int) $response['status_code'];

    return [
        'name' => $name,
        'url' => $url,
        'ok' => $statusCode >= 200
            && $statusCode < 300
            && $response['error'] === null
            && $jsonOk,
        'status_code' => $statusCode,
        'duration_ms' => $response['duration_ms'],
        'json_ok' => $jsonOk,
        'error' => $response['error'],
    ];
}

function smokeProtectedEndpointChecks(
    string $apiBaseUrl,
    int $timeoutSeconds,
    string $token,
    string $role,
    bool $adminRequired
): array {
    $userChecks = [
        smokeJsonAuthenticatedEndpoint(
            $apiBaseUrl,
            $timeoutSeconds,
            'notifications_list',
            '/notifications/list.php?page=1&limit=1',
            $token
        ),
    ];

    $userOk = count(array_filter($userChecks, static fn (array $check): bool => !$check['ok'])) === 0;
    $isAdminLike = in_array($role, ['admin', 'staff'], true);

    if (!$isAdminLike) {
        return [
            'ok' => $userOk && !$adminRequired,
            'role' => $role,
            'user' => $userChecks,
            'admin' => [
                'skipped' => true,
                'required' => $adminRequired,
                'checks' => [],
                'message' => $adminRequired
                    ? 'SMOKE_ADMIN_REQUIRED=true exige credencial admin ou staff.'
                    : 'Checks administrativos ignorados porque a credencial autenticada nao e admin/staff.',
            ],
        ];
    }

    $adminChecks = [
        smokeJsonAuthenticatedEndpoint(
            $apiBaseUrl,
            $timeoutSeconds,
            'admin_stats_today',
            '/admin/stats.php?period=today',
            $token
        ),
        smokeJsonAuthenticatedEndpoint(
            $apiBaseUrl,
            $timeoutSeconds,
            'admin_settings',
            '/admin/settings.php',
            $token
        ),
        smokeJsonAuthenticatedEndpoint(
            $apiBaseUrl,
            $timeoutSeconds,
            'admin_comments_moderation',
            '/admin/comments_moderation.php?status=pending&origin=all&page=1&perPage=1',
            $token
        ),
    ];
    $adminOk = count(array_filter($adminChecks, static fn (array $check): bool => !$check['ok'])) === 0;

    return [
        'ok' => $userOk && $adminOk,
        'role' => $role,
        'user' => $userChecks,
        'admin' => [
            'skipped' => false,
            'required' => $adminRequired,
            'checks' => $adminChecks,
            'message' => $adminOk
                ? 'Endpoints administrativos essenciais responderam com sessao admin/staff.'
                : 'Um ou mais endpoints administrativos falharam no smoke autenticado.',
        ],
    ];
}

function smokeAuthenticatedChecks(
    string $apiBaseUrl,
    int $timeoutSeconds,
    ?string $email,
    ?string $password,
    ?string $captchaToken,
    bool $required,
    bool $adminRequired
): array {
    $email = trim((string) $email);
    $password = (string) $password;
    $captchaToken = trim((string) $captchaToken);

    if ($email === '' || $password === '') {
        $credentialsRequired = $required || $adminRequired;
        return [
            'ok' => !$credentialsRequired,
            'skipped' => !$credentialsRequired,
            'required' => $required,
            'admin_required' => $adminRequired,
            'login' => null,
            'profile' => null,
            'protected' => null,
            'message' => $required
                ? 'Configure SMOKE_AUTH_EMAIL e SMOKE_AUTH_PASSWORD para smoke autenticado obrigatorio.'
                : ($adminRequired
                    ? 'Configure SMOKE_AUTH_EMAIL e SMOKE_AUTH_PASSWORD para smoke administrativo obrigatorio.'
                    : 'Smoke autenticado ignorado porque credenciais nao foram configuradas.'),
        ];
    }

    $loginPayload = [
        'email' => $email,
        'password' => $password,
    ];
    if ($captchaToken !== '') {
        $loginPayload['captchaToken'] = $captchaToken;
    }

    $loginUrl = $apiBaseUrl . '/auth/login.php';
    $loginResponse = smokeFetchUrl(
        $loginUrl,
        $timeoutSeconds,
        'POST',
        ['Content-Type' => 'application/json', 'Accept' => 'application/json'],
        json_encode($loginPayload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES)
    );
    $loginJson = json_decode(trim((string) $loginResponse['body']), true);
    $loginPayloadData = is_array($loginJson) && array_key_exists('data', $loginJson) ? $loginJson['data'] : $loginJson;
    $token = is_array($loginPayloadData) ? trim((string) ($loginPayloadData['token'] ?? '')) : '';
    $requiresTwoFactor = is_array($loginPayloadData) && !empty($loginPayloadData['require2FA']);
    $loginOk = $loginResponse['status_code'] >= 200
        && $loginResponse['status_code'] < 300
        && $loginResponse['error'] === null
        && is_array($loginJson)
        && !$requiresTwoFactor
        && $token !== '';

    $profileResult = null;
    $profileOk = false;
    $role = '';
    $protected = null;
    if ($loginOk) {
        $profileUrl = $apiBaseUrl . '/auth/me.php';
        $profileResponse = smokeFetchUrl(
            $profileUrl,
            $timeoutSeconds,
            'GET',
            ['Accept' => 'application/json', 'Authorization' => 'Bearer ' . $token]
        );
        $profileJson = json_decode(trim((string) $profileResponse['body']), true);
        $profilePayload = is_array($profileJson) && array_key_exists('data', $profileJson) ? $profileJson['data'] : $profileJson;
        $profileUser = is_array($profilePayload) && is_array($profilePayload['user'] ?? null)
            ? $profilePayload['user']
            : $profilePayload;
        $profileEmail = is_array($profileUser) ? strtolower(trim((string) ($profileUser['email'] ?? ''))) : '';
        $profileId = is_array($profileUser) ? trim((string) ($profileUser['id'] ?? '')) : '';
        $role = is_array($profileUser) ? strtolower(trim((string) ($profileUser['role'] ?? ''))) : '';
        $profileOk = $profileResponse['status_code'] >= 200
            && $profileResponse['status_code'] < 300
            && $profileResponse['error'] === null
            && is_array($profileJson)
            && $profileId !== ''
            && $profileEmail === strtolower($email);

        $profileResult = [
            'url' => $profileUrl,
            'ok' => $profileOk,
            'status_code' => $profileResponse['status_code'],
            'duration_ms' => $profileResponse['duration_ms'],
            'json_ok' => is_array($profileJson),
            'user_id_present' => $profileId !== '',
            'email_matches' => $profileEmail === strtolower($email),
            'role' => $role,
            'error' => $profileResponse['error'],
        ];

        if ($profileOk) {
            $protected = smokeProtectedEndpointChecks(
                $apiBaseUrl,
                $timeoutSeconds,
                $token,
                $role,
                $adminRequired
            );
        }
    }

    return [
        'ok' => $loginOk && $profileOk && ($protected['ok'] ?? false),
        'skipped' => false,
        'required' => $required,
        'admin_required' => $adminRequired,
        'login' => [
            'url' => $loginUrl,
            'ok' => $loginOk,
            'status_code' => $loginResponse['status_code'],
            'duration_ms' => $loginResponse['duration_ms'],
            'json_ok' => is_array($loginJson),
            'token_present' => $token !== '',
            'requires_two_factor' => $requiresTwoFactor,
            'error' => $loginResponse['error'],
        ],
        'profile' => $profileResult,
        'protected' => $protected,
        'message' => $loginOk && $profileOk && ($protected['ok'] ?? false)
            ? 'Login, perfil e endpoints protegidos confirmados.'
            : 'Smoke autenticado falhou.',
    ];
}

function smokeDatabaseChecks(int $openConnections): array
{
    $openConnections = max(1, min(50, $openConnections));
    $connections = [];
    $startedAt = microtime(true);

    for ($i = 0; $i < $openConnections; $i++) {
        $database = new Database();
        $connection = $database->getConnection();
        $connection->query('SELECT 1')->fetchColumn();
        $connections[] = [$database, $connection];
    }

    $probeConnection = $connections[0][1];
    $threadsConnected = null;
    $maxConnections = null;

    try {
        $stmt = $probeConnection->query("SHOW STATUS LIKE 'Threads_connected'");
        $row = $stmt ? $stmt->fetch(PDO::FETCH_ASSOC) : false;
        $threadsConnected = is_array($row) ? (int) ($row['Value'] ?? 0) : null;
    } catch (Throwable $e) {
        $threadsConnected = null;
    }

    try {
        $stmt = $probeConnection->query("SHOW VARIABLES LIKE 'max_connections'");
        $row = $stmt ? $stmt->fetch(PDO::FETCH_ASSOC) : false;
        $maxConnections = is_array($row) ? (int) ($row['Value'] ?? 0) : null;
    } catch (Throwable $e) {
        $maxConnections = null;
    }

    $durationMs = (int) round((microtime(true) - $startedAt) * 1000);
    $usageRatio = $threadsConnected !== null && $maxConnections ? $threadsConnected / $maxConnections : null;
    $warnings = [];

    if ($usageRatio !== null && $usageRatio >= 0.7) {
        $warnings[] = 'Uso de conexoes MySQL acima de 70%.';
    }

    $connections = [];

    return [
        'ok' => true,
        'opened_connections' => $openConnections,
        'duration_ms' => $durationMs,
        'threads_connected' => $threadsConnected,
        'max_connections' => $maxConnections,
        'usage_ratio' => $usageRatio,
        'warnings' => $warnings,
    ];
}

try {
    $apiBaseUrl = smokeNormalizeBaseUrl(smokeCliOption(
        'api-base-url',
        getEnvString('SMOKE_API_BASE_URL', 'http://localhost/questao-pro-backend/api')
    ));
    $webBaseUrl = smokeNormalizeOptionalBaseUrl(smokeCliOption(
        'web-base-url',
        getEnvString('SMOKE_WEB_BASE_URL', 'http://localhost:3000')
    ));
    $timeoutSeconds = max(1, min(30, (int) smokeCliOption('timeout', getEnvString('SMOKE_TIMEOUT_SECONDS', '8'))));
    $dbConnections = max(1, min(50, (int) smokeCliOption('db-connections', getEnvString('SMOKE_DB_CONNECTIONS', '3'))));
    $authEmail = smokeCliOption('auth-email', getEnvString('SMOKE_AUTH_EMAIL'));
    $authPassword = smokeCliOption('auth-password', getEnvString('SMOKE_AUTH_PASSWORD'));
    $authCaptchaToken = smokeCliOption('auth-captcha-token', getEnvString('SMOKE_AUTH_CAPTCHA_TOKEN'));
    $authRequired = smokeBooleanValue(smokeCliOption('auth-required', getEnvString('SMOKE_AUTH_REQUIRED', 'false')));
    $adminRequired = smokeBooleanValue(smokeCliOption('admin-required', getEnvString('SMOKE_ADMIN_REQUIRED', 'false')));

    $http = smokeHttpChecks($apiBaseUrl, $timeoutSeconds);
    $questionsListCheck = array_values(array_filter(
        $http,
        static fn (array $result): bool => ($result['name'] ?? '') === 'questions_list'
    ));
    $sampleQuestionId = isset($questionsListCheck[0]['sample_question_id']) && is_int($questionsListCheck[0]['sample_question_id'])
        ? $questionsListCheck[0]['sample_question_id']
        : null;
    $web = smokeWebChecks($webBaseUrl, $sampleQuestionId, $timeoutSeconds);
    $auth = smokeAuthenticatedChecks(
        $apiBaseUrl,
        $timeoutSeconds,
        $authEmail,
        $authPassword,
        $authCaptchaToken,
        $authRequired,
        $adminRequired
    );
    $database = smokeDatabaseChecks($dbConnections);
    $transport = [
        'api_https' => smokeUrlUsesHttpsForPublicHost($apiBaseUrl),
        'web_https' => smokeUrlUsesHttpsForPublicHost($webBaseUrl),
    ];
    $failed = array_values(array_filter($http, static fn (array $result): bool => !$result['ok']));
    $failedWeb = array_values(array_filter($web, static fn (array $result): bool => !$result['ok']));
    $warnings = $database['warnings'];

    $success = count($failed) === 0
        && count($failedWeb) === 0
        && $auth['ok'] === true
        && $database['ok'] === true
        && $transport['api_https']['ok'] === true
        && $transport['web_https']['ok'] === true;
    $payload = [
        'success' => $success,
        'api_base_url' => $apiBaseUrl,
        'web_base_url' => $webBaseUrl,
        'http' => $http,
        'web' => $web,
        'auth' => $auth,
        'database' => $database,
        'transport' => $transport,
        'warnings' => $warnings,
        'checked_at' => gmdate(DATE_ATOM),
    ];

    $json = json_encode($payload, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    if ($success) {
        echo $json . PHP_EOL;
        exit(0);
    }

    fwrite(STDERR, $json . PHP_EOL);
    exit(2);
} catch (Throwable $e) {
    fwrite(STDERR, json_encode([
        'success' => false,
        'message' => $e->getMessage(),
    ], JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) . PHP_EOL);
    exit(2);
}

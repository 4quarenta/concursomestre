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

require_once __DIR__ . '/AuthConfig.php';

if (!function_exists('getAuthQuietEvents')) {
    /**
     * Lista eventos de alta frequencia que podem ser silenciados no log.
     *
     * @since 1.0.0
     */
    function getAuthQuietEvents(): array
    {
        $configured = trim((string) authConfig('AUTH_LOG_QUIET_EVENTS', 'refresh_rotated,auth_session_created,auth_logout'));
        if ($configured === '') {
            return [];
        }

        return array_values(array_filter(array_map(static function ($value) {
            return strtolower(trim((string) $value));
        }, explode(',', $configured))));
    }
}

if (!function_exists('shouldSkipAuthEventLog')) {
    /**
     * Decide se o evento atual deve ser suprimido para reduzir ruido operacional.
     *
     * @since 1.0.0
     */
    function shouldSkipAuthEventLog(string $event): bool
    {
        if (authBoolConfig('AUTH_LOG_VERBOSE_EVENTS', false)) {
            return false;
        }

        return in_array(strtolower($event), getAuthQuietEvents(), true);
    }
}

if (!function_exists('getAuthDedupeEvents')) {
    /**
     * Eventos que devem ser deduplicados em janela curta para reduzir ruído.
     *
     * @since 1.0.0
     */
    function getAuthDedupeEvents(): array
    {
        $configured = trim((string) authConfig(
            'AUTH_LOG_DEDUPE_EVENTS',
            'access_token_rejected,refresh_reuse_detected,refresh_reuse_recovered'
        ));

        if ($configured === '') {
            return [];
        }

        return array_values(array_filter(array_map(static function ($value) {
            return strtolower(trim((string) $value));
        }, explode(',', $configured))));
    }
}

if (!function_exists('getAuthDedupeWindowSeconds')) {
    /**
     * Janela usada para suprimir logs duplicados de auth.
     *
     * @since 1.0.0
     */
    function getAuthDedupeWindowSeconds(): int
    {
        return max(0, (int) authConfig('AUTH_LOG_DEDUPE_WINDOW_SECONDS', 30));
    }
}

if (!function_exists('buildAuthDedupeFingerprint')) {
    /**
     * Cria uma assinatura estável para eventos repetidos de auth.
     *
     * @since 1.0.0
     */
    function buildAuthDedupeFingerprint(string $event, array $context): string
    {
        $tokenPayload = is_array($context['token_payload'] ?? null)
            ? $context['token_payload']
            : [];

        $fingerprintData = [
            'event' => strtolower($event),
            'user_id' => (string) ($context['user_id'] ?? ($tokenPayload['user_id'] ?? '')),
            'session_id' => (string) ($context['session_id'] ?? ($tokenPayload['session_id'] ?? '')),
            'reason' => (string) ($context['reason'] ?? ''),
            'refresh_token_id' => (string) ($context['refresh_token_id'] ?? ''),
            'active_refresh_token_id' => (string) ($context['active_refresh_token_id'] ?? ''),
            'token_jti' => (string) ($tokenPayload['jti'] ?? ''),
            'ip' => (string) (getAuthClientIp() ?? ''),
        ];

        return hash('sha1', json_encode($fingerprintData, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES));
    }
}

if (!function_exists('shouldThrottleAuthEventLog')) {
    /**
     * Dedupe de eventos ruidosos para reduzir spam em ambientes com refresh concorrente.
     *
     * @since 1.0.0
     */
    function shouldThrottleAuthEventLog(string $event, array $context = []): bool
    {
        if (authBoolConfig('AUTH_LOG_VERBOSE_EVENTS', false)) {
            return false;
        }

        $eventName = strtolower($event);
        if (!in_array($eventName, getAuthDedupeEvents(), true)) {
            return false;
        }

        $window = getAuthDedupeWindowSeconds();
        if ($window <= 0) {
            return false;
        }

        $fingerprint = buildAuthDedupeFingerprint($eventName, $context);
        $cacheKey = 'cm_auth_log_dedupe_' . $fingerprint;

        if (function_exists('apcu_fetch') && function_exists('apcu_store')) {
            $exists = false;
            $hit = apcu_fetch($cacheKey, $exists);
            if ($exists && $hit !== false) {
                return true;
            }

            apcu_store($cacheKey, 1, $window);
            return false;
        }

        $cacheDir = rtrim((string) authConfig('AUTH_LOG_DEDUPE_DIR', sys_get_temp_dir()), DIRECTORY_SEPARATOR);
        if ($cacheDir === '') {
            return false;
        }

        if (!is_dir($cacheDir)) {
            @mkdir($cacheDir, 0775, true);
        }

        if (!is_dir($cacheDir) || !is_writable($cacheDir)) {
            return false;
        }

        $cacheFile = $cacheDir . DIRECTORY_SEPARATOR . $cacheKey . '.log';
        $now = time();
        $lastSeenAt = @filemtime($cacheFile);
        if ($lastSeenAt !== false && ($now - $lastSeenAt) < $window) {
            return true;
        }

        @touch($cacheFile, $now);
        return false;
    }
}

if (!function_exists('logAuthEvent')) {
    /**
     * Registra eventos de auth no log do servidor para auditoria e debug.
     *
     * @since 1.0.0
     */
    function logAuthEvent(string $event, array $context = []): void
    {
        if (shouldSkipAuthEventLog($event)) {
            return;
        }
        if (shouldThrottleAuthEventLog($event, $context)) {
            return;
        }

        $payload = [
            'event' => $event,
            'time' => authNow()->format(DateTimeInterface::ATOM),
            'instance' => getAuthInstanceId(),
            'ip' => getAuthClientIp(),
            'user_agent' => getAuthUserAgent(),
            'server_time_unix' => time(),
        ];

        foreach ($context as $key => $value) {
            if ($value instanceof DateTimeInterface) {
                $payload[$key] = $value->format(DateTimeInterface::ATOM);
                continue;
            }

            $payload[$key] = $value;
        }

        error_log('[AUTH] ' . json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES));
    }
}

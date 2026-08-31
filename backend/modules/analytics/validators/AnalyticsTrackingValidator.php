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
 * Validador do ledger first-party de eventos.
 *
 * @since 1.0.0
 */
class AnalyticsTrackingValidator
{
    private const SAFE_METADATA_KEYS = ['mode', 'authMode', 'step', 'stage'];

    private const ALLOWED_EVENTS = [
        'identifiable_visit',
        'signup_started',
        'signup_completed',
        'checkout_started',
        'plan_viewed',
        'payment_method_started',
        'checkout_abandoned',
        'payment_failed',
    ];

    public function validateTrackPayload(array $payload): array
    {
        $eventName = strtolower(trim((string) ($payload['eventName'] ?? $payload['event_name'] ?? '')));
        if (!in_array($eventName, self::ALLOWED_EVENTS, true)) {
            throw new InvalidArgumentException('Evento de analytics invalido.');
        }

        $source = strtolower(trim((string) ($payload['source'] ?? 'platform')));
        if ($source === '') {
            $source = 'platform';
        }

        $metadata = $this->normalizeSafeMetadata($payload['metadata'] ?? []);

        return [
            'event_name' => $eventName,
            'source' => substr($source, 0, 40),
            // Analytics is an aggregate product signal. Direct identity, raw
            // URLs and caller-provided hooks never cross this boundary.
            'email' => null,
            'session_key' => null,
            'user_id' => null,
            'plan_id' => isset($payload['planId']) || isset($payload['plan_id'])
                ? max(0, (int) ($payload['planId'] ?? $payload['plan_id']))
                : null,
            'cycle_label' => $this->normalizeNullableString($payload['cycleLabel'] ?? $payload['cycle_label'] ?? null, 30),
            'origin_url' => null,
            'referrer_url' => null,
            'utm_source' => $this->normalizeCampaignValue($payload['utmSource'] ?? $payload['utm_source'] ?? null, 80),
            'utm_medium' => $this->normalizeCampaignValue($payload['utmMedium'] ?? $payload['utm_medium'] ?? null, 80),
            'utm_campaign' => $this->normalizeCampaignValue($payload['utmCampaign'] ?? $payload['utm_campaign'] ?? null, 120),
            'metadata_json' => $metadata,
            'external_hooks_json' => null,
        ];
    }

    private function normalizeSafeMetadata(mixed $value): ?string
    {
        if (!is_array($value) || empty($value)) {
            return null;
        }

        $safe = [];
        foreach (self::SAFE_METADATA_KEYS as $key) {
            if (!array_key_exists($key, $value) || !is_scalar($value[$key])) {
                continue;
            }

            $candidate = trim((string) $value[$key]);
            if ($candidate !== '' && preg_match('/^[a-zA-Z0-9_-]{1,40}$/', $candidate) === 1) {
                $safe[$key] = $candidate;
            }
        }

        if ($safe === []) {
            return null;
        }

        $encoded = json_encode($safe, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        if (!is_string($encoded)) {
            throw new InvalidArgumentException('O campo metadata precisa ser um objeto JSON valido.');
        }

        if (strlen($encoded) > 512) {
            throw new InvalidArgumentException('O campo metadata excede o tamanho maximo permitido.');
        }

        return $encoded;
    }

    private function normalizeCampaignValue(mixed $value, int $maxLength): ?string
    {
        $normalized = trim((string) ($value ?? ''));
        if ($normalized === '' || preg_match('/^[a-zA-Z0-9._~%-]+$/', $normalized) !== 1) {
            return null;
        }

        return mb_substr($normalized, 0, $maxLength);
    }

    private function normalizeNullableString(mixed $value, int $maxLength): ?string
    {
        $normalized = trim((string) ($value ?? ''));
        if ($normalized === '') {
            return null;
        }

        return mb_substr($normalized, 0, $maxLength);
    }
}

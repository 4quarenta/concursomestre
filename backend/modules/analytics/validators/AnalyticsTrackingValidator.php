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
    private const ALLOWED_EVENTS = [
        'identifiable_visit',
        'signup_started',
        'email_captured',
        'signup_completed',
        'checkout_started',
        'plan_viewed',
        'payment_method_started',
        'checkout_abandoned',
        'purchase_completed',
        'payment_failed',
        'renewal_upcoming',
        'renewal_completed',
        'subscription_cancelled',
        'subscription_reactivated',
    ];

    public function validateTrackPayload(array $payload): array
    {
        $eventName = strtolower(trim((string) ($payload['eventName'] ?? $payload['event_name'] ?? '')));
        if (!in_array($eventName, self::ALLOWED_EVENTS, true)) {
            throw new InvalidArgumentException('Evento de analytics invalido.');
        }

        $email = strtolower(trim((string) ($payload['email'] ?? '')));
        if ($email !== '' && !filter_var($email, FILTER_VALIDATE_EMAIL)) {
            $email = '';
        }

        $source = strtolower(trim((string) ($payload['source'] ?? 'platform')));
        if ($source === '') {
            $source = 'platform';
        }

        $metadata = $this->normalizeBoundedJsonObject($payload['metadata'] ?? [], 8192, 'metadata');
        $externalHooks = $this->normalizeBoundedJsonObject($payload['externalHooks'] ?? $payload['external_hooks'] ?? [], 4096, 'externalHooks');

        return [
            'event_name' => $eventName,
            'source' => substr($source, 0, 40),
            'email' => $email !== '' ? $email : null,
            'session_key' => $this->normalizeNullableString($payload['sessionKey'] ?? $payload['session_key'] ?? null, 120),
            'user_id' => null,
            'plan_id' => isset($payload['planId']) || isset($payload['plan_id'])
                ? max(0, (int) ($payload['planId'] ?? $payload['plan_id']))
                : null,
            'cycle_label' => $this->normalizeNullableString($payload['cycleLabel'] ?? $payload['cycle_label'] ?? null, 30),
            'origin_url' => $this->normalizeNullableString($payload['originUrl'] ?? $payload['origin_url'] ?? null, 255),
            'referrer_url' => $this->normalizeNullableString($payload['referrerUrl'] ?? $payload['referrer_url'] ?? null, 255),
            'utm_source' => $this->normalizeNullableString($payload['utmSource'] ?? $payload['utm_source'] ?? null, 120),
            'utm_medium' => $this->normalizeNullableString($payload['utmMedium'] ?? $payload['utm_medium'] ?? null, 120),
            'utm_campaign' => $this->normalizeNullableString($payload['utmCampaign'] ?? $payload['utm_campaign'] ?? null, 180),
            'metadata_json' => $metadata,
            'external_hooks_json' => $externalHooks,
        ];
    }

    private function normalizeBoundedJsonObject(mixed $value, int $maxBytes, string $fieldName): ?string
    {
        if (!is_array($value) || empty($value)) {
            return null;
        }

        $encoded = json_encode($value, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        if (!is_string($encoded)) {
            throw new InvalidArgumentException("O campo {$fieldName} precisa ser um objeto JSON valido.");
        }

        if (strlen($encoded) > $maxBytes) {
            throw new InvalidArgumentException("O campo {$fieldName} excede o tamanho maximo permitido.");
        }

        return $encoded;
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

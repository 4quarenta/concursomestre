<?php

declare(strict_types=1);

require_once __DIR__ . '/../modules/analytics/services/AnalyticsTrackingAvailability.php';

function assertAnalyticsAvailability(bool $condition, string $message): void
{
    if (!$condition) {
        throw new RuntimeException($message);
    }
}

assertAnalyticsAvailability(
    AnalyticsTrackingAvailability::shouldDiscardForUnavailableRateLimit(
        new RuntimeException('Rate limit compartilhado indisponivel; Redis e obrigatorio neste ambiente.')
    ),
    'O tracker deve descartar eventos apenas quando o rate limit compartilhado estiver indisponivel.'
);

assertAnalyticsAvailability(
    !AnalyticsTrackingAvailability::shouldDiscardForUnavailableRateLimit(
        new RuntimeException('Falha ao persistir analytics.')
    ),
    'Falhas de persistencia nao podem ser mascaradas como indisponibilidade do rate limit.'
);

fwrite(STDOUT, "AnalyticsTrackingAvailabilityTest: PASS\n");

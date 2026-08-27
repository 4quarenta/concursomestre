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
    AnalyticsTrackingAvailability::shouldDiscardForPrelaunchZeroState('PRELAUNCH', true),
    'PRELAUNCH with an empty canonical dataset must discard lifecycle analytics.'
);
assertAnalyticsAvailability(
    AnalyticsTrackingAvailability::shouldDiscardForPrelaunchZeroState('unknown', true),
    'An invalid launch mode must fail safe as PRELAUNCH.'
);
assertAnalyticsAvailability(
    !AnalyticsTrackingAvailability::shouldDiscardForPrelaunchZeroState('PRELAUNCH', false),
    'PRELAUNCH with canonical content must not be treated as the post-reset zero state.'
);
assertAnalyticsAvailability(
    !AnalyticsTrackingAvailability::shouldDiscardForPrelaunchZeroState('PRODUCTION', true),
    'The zero-state maintenance guard must not redefine PRODUCTION tracking policy.'
);

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

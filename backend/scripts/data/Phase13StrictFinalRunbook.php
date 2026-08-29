<?php

declare(strict_types=1);

final class Phase13StrictFinalRunbook
{
    public const OBSERVATION_SECONDS = 93600;

    /** @return list<string> */
    public static function steps(): array
    {
        return [
            'recovery_backup',
            'freeze_authenticated_practice_ingress',
            'freeze_billing_reconciliation',
            'freeze_schedulers',
            'hold_webhooks_fail_closed',
            'control_stripe_test_external_state',
            'prove_active_writers_zero',
            'strict_cleanup',
            'observe_strict_zero',
            'controlled_writer_resume',
            'observe_strict_zero_after_resume',
        ];
    }

    /** @return array{valid:bool,blockers:list<string>} */
    public static function validate(array $steps, int $observationSeconds): array
    {
        $blockers = [];
        if ($steps !== self::steps()) {
            $blockers[] = 'STRICT_RUNBOOK_SEQUENCE_DRIFT';
        }
        if ($observationSeconds < self::OBSERVATION_SECONDS) {
            $blockers[] = 'STRICT_OBSERVATION_WINDOW_TOO_SHORT';
        }
        return ['valid' => $blockers === [], 'blockers' => $blockers];
    }
}

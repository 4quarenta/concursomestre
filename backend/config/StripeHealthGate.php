<?php

declare(strict_types=1);

require_once dirname(__DIR__) . '/scripts/data/DatasetAvailabilitySafeFreezeState.php';

final class StripeHealthGate
{
    private const EXPECTED_FREEZE_ENV = 'B13X_STRIPE_HEALTH_FREEZE_EXPECTED';
    private const STATE_FILE_ENV = 'B13X_AVAILABILITY_SAFE_FREEZE_STATE_FILE';
    private const KEY_FILE_ENV = 'B13X_AVAILABILITY_SAFE_FREEZE_KEY_FILE';
    private const RUN_ID_ENV = 'B13X_AVAILABILITY_SAFE_FREEZE_RUN_ID';

    /** @return array{expected: bool, valid: bool, blockers: list<string>, state?: array<string, mixed>} */
    public static function expectedFreezeFromEnvironment(): array
    {
        $expected = filter_var(getEnvString(self::EXPECTED_FREEZE_ENV, 'false'), FILTER_VALIDATE_BOOLEAN);
        if (!$expected) {
            return ['expected' => false, 'valid' => true, 'blockers' => []];
        }

        $statePath = getEnvString(self::STATE_FILE_ENV);
        $keyPath = getEnvString(self::KEY_FILE_ENV);
        $runId = getEnvString(self::RUN_ID_ENV);
        $blockers = [];

        if ($statePath === '' || !is_file($statePath) || !is_readable($statePath)) {
            $blockers[] = 'B13X_FREEZE_STATE_MISSING';
        }
        if ($keyPath === '' || !is_file($keyPath) || !is_readable($keyPath)) {
            $blockers[] = 'B13X_FREEZE_KEY_MISSING';
        }
        if ($runId === '') {
            $blockers[] = 'B13X_FREEZE_RUN_ID_MISSING';
        }

        if ($blockers !== []) {
            return ['expected' => true, 'valid' => false, 'blockers' => $blockers];
        }

        try {
            $state = DatasetAvailabilitySafeFreezeState::readStateFile($statePath);
            $key = trim((string) file_get_contents($keyPath));
            $validation = DatasetAvailabilitySafeFreezeState::validate($state, $runId, $key);
            if (!$validation['valid']) {
                $blockers = array_merge($blockers, $validation['blockers']);
            }

            if (($state['status'] ?? '') !== 'FROZEN' || ($state['phase'] ?? '') !== 'frozen') {
                $blockers[] = 'B13X_FREEZE_NOT_ACTIVE';
            }
            if ((int) ($state['deadlineEpoch'] ?? 0) < time()) {
                $blockers[] = 'B13X_FREEZE_EXPIRED';
            }

            $allowedMethods = $state['httpWriteBoundary']['allowedMethods'] ?? [];
            if (!is_array($allowedMethods) || array_diff($allowedMethods, ['GET', 'HEAD', 'OPTIONS']) !== []) {
                $blockers[] = 'B13X_FREEZE_HTTP_WRITE_BOUNDARY_INVALID';
            }

            $frozenUnits = $state['frozenUnits'] ?? [];
            if (!is_array($frozenUnits) || !in_array('cron.service', $frozenUnits, true)) {
                $blockers[] = 'B13X_STRIPE_SCHEDULER_NOT_ALLOWLISTED';
            }

            $blockers = array_values(array_unique($blockers));
            sort($blockers);
            return [
                'expected' => true,
                'valid' => $blockers === [],
                'blockers' => $blockers,
                'state' => $state,
            ];
        } catch (Throwable $exception) {
            return [
                'expected' => true,
                'valid' => false,
                'blockers' => ['B13X_FREEZE_STATE_UNREADABLE'],
            ];
        }
    }

    public static function isExpectedFreezeValid(?array $context): bool
    {
        return is_array($context)
            && ($context['expected'] ?? false) === true
            && ($context['valid'] ?? false) === true;
    }
}

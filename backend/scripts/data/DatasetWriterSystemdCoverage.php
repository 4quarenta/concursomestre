<?php

declare(strict_types=1);

final class DatasetWriterSystemdCoverage
{
    /** @param array<string, mixed> $resumeState */
    public static function expectedActiveState(array $resumeState, string $unit): string
    {
        $units = is_array($resumeState['units'] ?? null) ? $resumeState['units'] : [];
        $unitState = is_array($units[$unit] ?? null) ? $units[$unit] : null;
        if ($unitState === null) {
            throw new RuntimeException('Systemd resume evidence does not cover unit: ' . $unit);
        }

        $expected = strtolower(trim((string) ($unitState['ActiveState'] ?? '')));
        if ($expected === '') {
            throw new RuntimeException('Systemd resume evidence has no ActiveState for unit: ' . $unit);
        }

        return $expected;
    }

    /** @return array{ok: bool, classification: string} */
    public static function evaluate(string $expected, string $actual): array
    {
        $expected = strtolower(trim($expected));
        $actual = strtolower(trim($actual));

        if ($expected === 'active') {
            return [
                'ok' => $actual === 'active',
                'classification' => $actual === 'active' ? 'ACTIVE_AS_BEFORE_FREEZE' : 'ACTIVE_STATE_NOT_RESTORED',
            ];
        }

        $inactiveStates = ['inactive', 'failed'];
        $ok = in_array($expected, $inactiveStates, true) && in_array($actual, $inactiveStates, true);
        return [
            'ok' => $ok,
            'classification' => $ok ? 'INACTIVE_AS_BEFORE_FREEZE' : 'UNEXPECTED_ACTIVE_STATE',
        ];
    }
}

<?php

/*
* ----------------------------------------------------
* @author: 4quarenta
* @author URI: https://github.com/4quarenta
* @copyright: (c) 2026 ConcursoMestre. All rights reserved.
* ----------------------------------------------------
*
* @since 1.0.0
*
*/

declare(strict_types=1);

require_once __DIR__ . '/DatasetWriterFreezeReporter.php';
require_once __DIR__ . '/DatasetWriterFreezeEvidence.php';

final class DatasetWriterSystemdFreezePolicy
{
    public const VERSION = 'SYSTEMD_RUNTIME_DROPIN_V1';
    public const STATE_SCHEMA_VERSION = 'SYSTEMD_FREEZE_STATE_V1';
    public const DROP_IN_FILE = '90-concursomestre-dataset-reset-freeze.conf';
    public const RUNTIME_ROOT = '/run/concursomestre-dataset-reset-freeze';
    public const CLASS_STRICT_WRITER = 'STRICT_WRITER';
    public const CLASS_SERVING_LAYER = 'SERVING_LAYER';
    public const CLASS_OBSERVABILITY = 'OBSERVABILITY';
    public const CLASS_MAINTENANCE = 'MAINTENANCE';
    public const CLASS_UNKNOWN = 'UNKNOWN';

    /** @return list<string> */
    public static function publicServingLayerUnits(): array
    {
        return [
            'nginx.service',
            'clp-nginx.service',
            'concursomestre-frontend.service',
            'php8.4-fpm.service',
        ];
    }

    /** @return list<array<string, mixed>> */
    public static function units(): array
    {
        return [
            self::unit('concursomestre-sitemap.timer', 'timer', ['/etc/systemd/system/concursomestre-sitemap.timer'], ['concursomestre-sitemap.service'], []),
            self::unit('concursomestre-blog-sitemap.timer', 'timer', ['/etc/systemd/system/concursomestre-blog-sitemap.timer'], ['concursomestre-blog-sitemap.service'], []),
            self::unit('concursomestre-answer-archive.timer', 'timer', ['/etc/systemd/system/concursomestre-answer-archive.timer'], ['concursomestre-answer-archive.service'], []),
            self::unit('cron.service', 'service', ['/usr/lib/systemd/system/cron.service'], [], []),
            self::unit('concursomestre-question-ingestion@1.service', 'service', ['/etc/systemd/system/concursomestre-question-ingestion@.service'], [], []),
            self::unit('concursomestre-question-ingestion@2.service', 'service', ['/etc/systemd/system/concursomestre-question-ingestion@.service'], [], []),
            self::unit('concursomestre-platform-events@1.service', 'service', ['/etc/systemd/system/concursomestre-platform-events@.service'], [], []),
            self::unit('concursomestre-python-extractor.service', 'service', ['/etc/systemd/system/concursomestre-python-extractor.service'], [], []),
            self::unit('concursomestre-sitemap.service', 'service', ['/etc/systemd/system/concursomestre-sitemap.service'], [], ['concursomestre-sitemap.timer']),
            self::unit('concursomestre-blog-sitemap.service', 'service', ['/etc/systemd/system/concursomestre-blog-sitemap.service'], [], ['concursomestre-blog-sitemap.timer']),
            self::unit('concursomestre-answer-archive.service', 'service', ['/etc/systemd/system/concursomestre-answer-archive.service'], [], ['concursomestre-answer-archive.timer']),
        ];
    }

    /** @return list<string> */
    public static function unitNames(): array
    {
        return array_values(array_map(static fn (array $unit): string => (string) $unit['unit'], self::units()));
    }

    /** @return list<string> */
    public static function stopOrder(): array
    {
        return self::unitNames();
    }

    /** @return list<string> */
    public static function resumeOrder(): array
    {
        return [
            'concursomestre-python-extractor.service',
            'concursomestre-question-ingestion@1.service',
            'concursomestre-question-ingestion@2.service',
            'concursomestre-platform-events@1.service',
            'concursomestre-sitemap.timer',
            'concursomestre-blog-sitemap.timer',
            'concursomestre-answer-archive.timer',
            'cron.service',
        ];
    }

    public static function classifyUnit(string $unit): string
    {
        if (in_array($unit, self::publicServingLayerUnits(), true)) return self::CLASS_SERVING_LAYER;
        if (in_array($unit, self::unitNames(), true)) return self::CLASS_STRICT_WRITER;
        return self::CLASS_UNKNOWN;
    }

    public static function freezeDecision(string $unit): string
    {
        return match (self::classifyUnit($unit)) {
            self::CLASS_STRICT_WRITER => 'SUPPRESS',
            self::CLASS_SERVING_LAYER => 'LEAVE_RUNNING',
            default => 'REJECT_UNKNOWN',
        };
    }

    /** @return array{valid: bool, blockers: list<string>, classifications: array<string, string>} */
    public static function availabilitySafeFreezeGuard(): array
    {
        $classifications = [];
        $blockers = [];
        foreach (self::publicServingLayerUnits() as $unit) {
            $classifications[$unit] = self::classifyUnit($unit);
            if (in_array($unit, self::unitNames(), true)) $blockers[] = 'PUBLIC_SERVING_UNIT_IN_FREEZE:' . $unit;
        }
        foreach (self::unitNames() as $unit) {
            $classifications[$unit] = self::classifyUnit($unit);
            if (self::classifyUnit($unit) !== self::CLASS_STRICT_WRITER) $blockers[] = 'NON_WRITER_UNIT_IN_FREEZE:' . $unit;
        }
        ksort($classifications);
        sort($blockers);
        return ['valid' => $blockers === [], 'blockers' => $blockers, 'classifications' => $classifications];
    }

    /** @return array<string, list<string>> */
    public static function writerControls(): array
    {
        $ingress = ['http-writer-boundary'];
        $cron = ['cron.service'];
        return [
            'http-auth-account' => $ingress,
            'http-practice-user-activity' => $ingress,
            'http-content-interactions' => $ingress,
            'http-admin-editorial' => $ingress,
            'http-private-ingestion-producer' => $ingress,
            'http-stripe-webhook-producer' => $ingress,
            'cron-stripe-webhook-consumer' => $cron,
            'cron-stripe-reconciliation' => $cron,
            'cron-card-expiry' => $cron,
            'cron-marketing-automations' => $cron,
            'cron-referral-rewards' => $cron,
            'cron-legal-commentary-sync' => $cron,
            'cron-operational-alerts' => $cron,
            'systemd-platform-event-consumer' => ['concursomestre-platform-events@1.service'],
            'systemd-question-ingestion-consumers' => ['concursomestre-question-ingestion@1.service', 'concursomestre-question-ingestion@2.service'],
            'systemd-answer-archive' => ['concursomestre-answer-archive.timer', 'concursomestre-answer-archive.service'],
            'manual-gran-crawler-taxonomy' => array_merge($ingress, ['operator-lock', 'process-scan']),
            'manual-exam-import-extraction' => array_merge($ingress, ['concursomestre-python-extractor.service', 'operator-lock', 'process-scan']),
            'manual-planalto-import' => array_merge($ingress, $cron, ['operator-lock', 'process-scan']),
            'manual-backfills-migrations-reset' => ['operator-lock', 'sql-client-scan', 'database-session-scan'],
        ];
    }

    /** @return list<string> */
    public static function controlCoverageBlockers(): array
    {
        $blockers = self::availabilitySafeFreezeGuard()['blockers'];
        $controls = self::writerControls();
        foreach (DatasetWriterFreezeReporter::requiredFreezeWriterIds() as $writerId) {
            if (($controls[$writerId] ?? []) === []) $blockers[] = 'WRITER_CONTROL_MISSING:' . $writerId;
        }
        foreach (array_keys($controls) as $writerId) {
            if (!in_array($writerId, DatasetWriterFreezeReporter::requiredFreezeWriterIds(), true)) {
                $blockers[] = 'UNKNOWN_WRITER_CONTROL:' . $writerId;
            }
        }
        sort($blockers);
        return $blockers;
    }

    public static function runRoot(string $runId): string
    {
        self::assertRunId($runId);
        return self::RUNTIME_ROOT . '/' . $runId;
    }

    public static function dropInPath(string $unit): string
    {
        if (!in_array($unit, self::unitNames(), true)) throw new InvalidArgumentException('Unit is outside the strict-writer freeze allowlist.');
        return '/run/systemd/system/' . $unit . '.d/' . self::DROP_IN_FILE;
    }

    public static function dropInContent(string $unit, string $runId): string
    {
        $entry = self::unitByName($unit);
        $content = "[Unit]\nRefuseManualStart=yes\nConditionPathExists=" . self::runRoot($runId) . "/allow-start\n";
        if (($entry['kind'] ?? '') === 'service') $content .= "[Service]\nRestart=no\n";
        return $content;
    }

    public static function bootId(): string
    {
        $value = PHP_OS_FAMILY === 'Linux' && is_readable('/proc/sys/kernel/random/boot_id')
            ? trim((string) file_get_contents('/proc/sys/kernel/random/boot_id'))
            : php_uname('n') . '|' . php_uname('r');
        if ($value === '') throw new RuntimeException('Unable to identify the current boot.');
        return hash('sha256', $value);
    }

    public static function systemdVersion(): string
    {
        if (PHP_OS_FAMILY !== 'Linux') return 'NON_LINUX_TEST_RUNTIME';
        $output = [];
        $status = 0;
        exec('/usr/bin/systemctl --version 2>/dev/null', $output, $status);
        $version = trim((string) ($output[0] ?? ''));
        if ($status !== 0 || !preg_match('/^systemd [0-9]+ /', $version)) throw new RuntimeException('Unable to identify systemd version.');
        return $version;
    }

    /** @return array{valid: bool, blockers: list<string>, unitStates: array<string, array<string, mixed>>} */
    public static function validateRuntimeSuppression(string $runId): array
    {
        self::assertRunId($runId);
        $blockers = [];
        $unitStates = [];
        foreach (self::units() as $entry) {
            $unit = (string) $entry['unit'];
            $observed = self::systemctlShow($unit);
            $dropInPath = self::dropInPath($unit);
            $expectedHash = hash('sha256', self::dropInContent($unit, $runId));
            $actualHash = is_file($dropInPath) ? hash_file('sha256', $dropInPath) : false;
            $dropInLoaded = is_string($actualHash)
                && hash_equals($expectedHash, $actualHash)
                && str_contains((string) ($observed['DropInPaths'] ?? ''), $dropInPath);
            $runtimeMaskPath = '/run/systemd/system/' . $unit;
            $runtimeMask = is_link($runtimeMaskPath) && readlink($runtimeMaskPath) === '/dev/null';
            $activeState = (string) ($observed['ActiveState'] ?? '');

            if (($observed['LoadState'] ?? '') !== 'loaded') $blockers[] = 'LIVE_UNIT_NOT_LOADED:' . $unit;
            if (!in_array($activeState, ['inactive', 'failed'], true)) $blockers[] = 'LIVE_UNIT_ACTIVE:' . $unit;
            if (!$dropInLoaded) $blockers[] = 'LIVE_DROPIN_MISSING:' . $unit;
            if (($observed['RefuseManualStart'] ?? '') !== 'yes') $blockers[] = 'LIVE_MANUAL_START_ALLOWED:' . $unit;
            if (($entry['kind'] ?? '') === 'service' && ($observed['Restart'] ?? '') !== 'no') $blockers[] = 'LIVE_AUTORESTART_ENABLED:' . $unit;
            if ($runtimeMask) $blockers[] = 'LIVE_UNEXPECTED_RUNTIME_MASK:' . $unit;
            if (!in_array((string) ($observed['FragmentPath'] ?? ''), $entry['fragmentPaths'], true)) $blockers[] = 'LIVE_UNIT_FRAGMENT_DRIFT:' . $unit;
            if (self::normalizedList((string) ($observed['Names'] ?? '')) !== $entry['expectedNames']) $blockers[] = 'LIVE_UNIT_ALIAS_DRIFT:' . $unit;
            if (self::normalizedList((string) ($observed['Triggers'] ?? '')) !== $entry['triggers']) $blockers[] = 'LIVE_UNIT_TRIGGER_DRIFT:' . $unit;
            $reverseTriggers = self::normalizedList((string) ($observed['TriggeredBy'] ?? ''));
            if ($reverseTriggers !== [] && $reverseTriggers !== $entry['triggeredBy']) $blockers[] = 'LIVE_UNIT_REVERSE_TRIGGER_DRIFT:' . $unit;

            $unitStates[$unit] = [
                'kind' => (string) $entry['kind'],
                'activeState' => $activeState,
                'dropInLoaded' => $dropInLoaded,
                'refuseManualStart' => (string) ($observed['RefuseManualStart'] ?? ''),
                'restart' => (string) ($observed['Restart'] ?? ''),
                'runtimeMask' => $runtimeMask,
            ];
        }
        $blockers = array_values(array_unique($blockers));
        sort($blockers);
        ksort($unitStates);
        return ['valid' => $blockers === [], 'blockers' => $blockers, 'unitStates' => $unitStates];
    }

    /** @param array<string, mixed> $state */
    public static function signState(array $state, string $key): array
    {
        if (strlen($key) < 32) throw new InvalidArgumentException('Freeze state key must contain at least 32 bytes.');
        unset($state['signature']);
        $state['schemaVersion'] = self::STATE_SCHEMA_VERSION;
        $state['signature'] = hash_hmac('sha256', self::canonicalJson($state), $key);
        return $state;
    }

    /** @param array<string, mixed> $state @return array{valid: bool, blockers: list<string>} */
    public static function validateState(array $state, string $runId, string $key): array
    {
        $blockers = [];
        if (($state['schemaVersion'] ?? '') !== self::STATE_SCHEMA_VERSION) $blockers[] = 'FREEZE_STATE_SCHEMA_INVALID';
        if (($state['runId'] ?? '') !== $runId) $blockers[] = 'FREEZE_STATE_RUN_ID_MISMATCH';
        if (($state['mechanismVersion'] ?? '') !== self::VERSION) $blockers[] = 'FREEZE_STATE_MECHANISM_MISMATCH';
        if (($state['hostFingerprint'] ?? '') !== DatasetWriterFreezeEvidence::hostFingerprint()) $blockers[] = 'FREEZE_STATE_HOST_MISMATCH';
        if (($state['writerInventoryHash'] ?? '') !== DatasetWriterFreezeReporter::inventoryHash()) $blockers[] = 'FREEZE_STATE_WRITER_INVENTORY_MISMATCH';
        if (($state['bootId'] ?? '') !== self::bootId()) $blockers[] = 'FREEZE_STATE_BOOT_ID_MISMATCH';
        if (($state['systemdVersion'] ?? '') !== self::systemdVersion()) $blockers[] = 'FREEZE_STATE_SYSTEMD_VERSION_MISMATCH';
        if (strlen($key) < 32) $blockers[] = 'FREEZE_STATE_KEY_INVALID';
        $signature = (string) ($state['signature'] ?? '');
        $unsigned = $state;
        unset($unsigned['signature']);
        $expected = strlen($key) >= 32 ? hash_hmac('sha256', self::canonicalJson($unsigned), $key) : '';
        if ($signature === '' || $expected === '' || !hash_equals($expected, $signature)) $blockers[] = 'FREEZE_STATE_SIGNATURE_INVALID';
        $blockers = array_values(array_unique($blockers));
        sort($blockers);
        return ['valid' => $blockers === [], 'blockers' => $blockers];
    }

    /** @return array<string, mixed> */
    private static function unit(string $unit, string $kind, array $fragmentPaths, array $triggers, array $triggeredBy): array
    {
        return [
            'unit' => $unit,
            'kind' => $kind,
            'expectedNames' => [$unit],
            'fragmentPaths' => $fragmentPaths,
            'triggers' => $triggers,
            'triggeredBy' => $triggeredBy,
        ];
    }

    /** @return array<string, mixed> */
    private static function unitByName(string $unit): array
    {
        foreach (self::units() as $entry) {
            if (($entry['unit'] ?? '') === $unit) return $entry;
        }
        throw new InvalidArgumentException('Unit is outside the freeze allowlist.');
    }

    private static function assertRunId(string $runId): void
    {
        if (!preg_match('/^[A-Za-z0-9][A-Za-z0-9._:-]{7,127}$/', $runId)) throw new InvalidArgumentException('Invalid freeze run ID.');
    }

    /** @return array<string, string> */
    private static function systemctlShow(string $unit): array
    {
        if (PHP_OS_FAMILY !== 'Linux' || !is_executable('/usr/bin/systemctl')) throw new RuntimeException('Live systemd suppression validation requires Linux systemd.');
        $properties = ['ActiveState', 'LoadState', 'FragmentPath', 'DropInPaths', 'RefuseManualStart', 'Restart', 'Names', 'Triggers', 'TriggeredBy'];
        $arguments = ['/usr/bin/systemctl', 'show', '--no-pager', $unit];
        foreach ($properties as $property) $arguments[] = '--property=' . $property;
        $output = [];
        $status = 0;
        exec(implode(' ', array_map('escapeshellarg', $arguments)) . ' 2>&1', $output, $status);
        if ($status !== 0) throw new RuntimeException('Unable to inspect live systemd unit: ' . $unit);
        $result = [];
        foreach ($output as $line) {
            if (!str_contains($line, '=')) continue;
            [$key, $value] = explode('=', $line, 2);
            $result[$key] = $value;
        }
        return $result;
    }

    /** @return list<string> */
    private static function normalizedList(string $value): array
    {
        $items = preg_split('/\s+/', trim($value), -1, PREG_SPLIT_NO_EMPTY) ?: [];
        $items = array_values(array_unique(array_map(static fn (string $item): string => trim($item, '"'), $items)));
        sort($items);
        return $items;
    }

    private static function canonicalJson(mixed $value): string
    {
        $normalize = static function (mixed $item) use (&$normalize): mixed {
            if (!is_array($item)) return $item;
            if (array_is_list($item)) return array_map($normalize, $item);
            ksort($item);
            foreach ($item as $key => $child) $item[$key] = $normalize($child);
            return $item;
        };
        return json_encode($normalize($value), JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR);
    }
}

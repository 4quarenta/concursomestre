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

/**
 * Analisa linhas de log para destacar severidade, categoria e repeticoes.
 */
class AdminSystemLogAnalyzer
{
    /**
     * @param string[] $lines
     *
     * @return array{
     *     total_lines: int,
     *     severity_counts: array<string, int>,
     *     category_counts: array<string, int>,
     *     repeated: array<int, array<string, mixed>>,
     *     samples: array<string, array<int, string>>,
     *     critical_count: int,
     *     error_count: int
     * }
     */
    public function analyze(array $lines, int $repeatThreshold = 5): array
    {
        $repeatThreshold = max(2, $repeatThreshold);
        $severityCounts = [
            'critical' => 0,
            'error' => 0,
            'warning' => 0,
            'info' => 0,
        ];
        $categoryCounts = [];
        $fingerprints = [];
        $samples = [
            'critical' => [],
            'error' => [],
            'warning' => [],
        ];

        foreach ($lines as $line) {
            $line = trim((string) $line);
            if ($line === '') {
                continue;
            }

            $severity = $this->detectSeverity($line);
            $category = $this->detectCategory($line);
            $fingerprint = $this->fingerprint($line);

            $severityCounts[$severity] = ($severityCounts[$severity] ?? 0) + 1;
            $categoryCounts[$category] = ($categoryCounts[$category] ?? 0) + 1;

            if (isset($samples[$severity]) && count($samples[$severity]) < 5) {
                $samples[$severity][] = $line;
            }

            if (!isset($fingerprints[$fingerprint])) {
                $fingerprints[$fingerprint] = [
                    'count' => 0,
                    'severity' => $severity,
                    'category' => $category,
                    'sample' => $line,
                    'fingerprint' => $fingerprint,
                ];
            }

            $fingerprints[$fingerprint]['count']++;
            $fingerprints[$fingerprint]['severity'] = $this->highestSeverity(
                (string) $fingerprints[$fingerprint]['severity'],
                $severity
            );
        }

        $repeated = array_values(array_filter(
            $fingerprints,
            static fn (array $item): bool => (int) $item['count'] >= $repeatThreshold
        ));

        usort($repeated, static function (array $a, array $b): int {
            $severityRank = ['critical' => 4, 'error' => 3, 'warning' => 2, 'info' => 1];
            $severityDiff = ($severityRank[$b['severity']] ?? 0) <=> ($severityRank[$a['severity']] ?? 0);
            if ($severityDiff !== 0) {
                return $severityDiff;
            }

            return ((int) $b['count']) <=> ((int) $a['count']);
        });

        return [
            'total_lines' => array_sum($severityCounts),
            'severity_counts' => $severityCounts,
            'category_counts' => $categoryCounts,
            'repeated' => array_slice($repeated, 0, 20),
            'samples' => $samples,
            'critical_count' => $severityCounts['critical'],
            'error_count' => $severityCounts['error'],
        ];
    }

    public function detectSeverity(string $line): string
    {
        $lower = strtolower($line);

        if (
            str_contains($lower, 'too many connections')
            || str_contains($lower, 'database connection failed')
            || str_contains($lower, 'mysql server has gone away')
            || str_contains($lower, 'php fatal error')
            || str_contains($lower, 'uncaught exception')
            || str_contains($lower, 'allowed memory size exhausted')
            || str_contains($lower, 'sqlstate[08004]')
            || str_contains($lower, 'sqlstate[hy000]')
        ) {
            return 'critical';
        }

        if (
            str_contains($lower, '[php:error]')
            || str_contains($lower, ' error:')
            || str_contains($lower, ' failed')
            || str_contains($lower, 'exception')
            || str_contains($lower, ' 500 ')
        ) {
            return 'error';
        }

        if (
            str_contains($lower, '[php:warning]')
            || str_contains($lower, ' warning')
            || str_contains($lower, 'unauthorized')
            || str_contains($lower, ' 401 ')
            || str_contains($lower, 'rate limit')
        ) {
            return 'warning';
        }

        return 'info';
    }

    public function detectCategory(string $line): string
    {
        $lower = strtolower($line);

        if (str_contains($lower, 'sqlstate') || str_contains($lower, 'database') || str_contains($lower, 'mysql') || str_contains($lower, 'pdo')) {
            return 'database';
        }

        if (str_contains($lower, '[auth]') || str_contains($lower, 'token') || str_contains($lower, 'unauthorized') || str_contains($lower, 'login')) {
            return 'auth';
        }

        if (str_contains($lower, 'stripe') || str_contains($lower, 'payment') || str_contains($lower, 'invoice') || str_contains($lower, 'subscription') || str_contains($lower, 'refund')) {
            return 'payments';
        }

        if (str_contains($lower, 'webhook')) {
            return 'webhook';
        }

        if (str_contains($lower, 'cron') || str_contains($lower, 'reconciliation') || str_contains($lower, 'processrewards')) {
            return 'cron';
        }

        if (str_contains($lower, 'cors') || str_contains($lower, 'csrf') || str_contains($lower, 'xss') || str_contains($lower, 'forbidden') || str_contains($lower, 'permission')) {
            return 'security';
        }

        if (str_contains($lower, 'php') || str_contains($lower, 'exception') || str_contains($lower, 'fatal')) {
            return 'application';
        }

        return 'system';
    }

    public function fingerprint(string $line): string
    {
        $normalized = strtolower($line);
        $normalized = preg_replace('/\[[a-z]{3}\s+[a-z]{3}\s+\d{1,2}\s+[\d:.]+\s+\d{4}\]/i', '', $normalized) ?? $normalized;
        $normalized = preg_replace('/\d{4}-\d{2}-\d{2}[t\s]\d{2}:\d{2}:\d{2}(?:[.\-:+\dz]*)?/i', '<date>', $normalized) ?? $normalized;
        $normalized = preg_replace('/\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/i', '<uuid>', $normalized) ?? $normalized;
        $normalized = preg_replace('/\b(pid|tid)\s+\d+\b/i', '$1 <n>', $normalized) ?? $normalized;
        $normalized = preg_replace('/client\s+[^\]\s]+/i', 'client <ip>', $normalized) ?? $normalized;
        $normalized = preg_replace('/:\d{2,5}\b/', ':<port>', $normalized) ?? $normalized;
        $normalized = preg_replace('/\b\d+\b/', '<n>', $normalized) ?? $normalized;
        $normalized = preg_replace('/\s+/', ' ', trim($normalized)) ?? $normalized;

        return sha1($normalized);
    }

    private function highestSeverity(string $current, string $next): string
    {
        $rank = ['critical' => 4, 'error' => 3, 'warning' => 2, 'info' => 1];

        return ($rank[$next] ?? 0) > ($rank[$current] ?? 0) ? $next : $current;
    }
}

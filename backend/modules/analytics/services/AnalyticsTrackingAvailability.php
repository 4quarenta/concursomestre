<?php

declare(strict_types=1);

/**
 * Decide quando o tracking pode ser descartado de forma segura.
 *
 * Eventos analiticos nunca devem derrubar um fluxo de autenticacao ou checkout.
 * Se o rate limit compartilhado estiver indisponivel, o evento e descartado em
 * vez de ser gravado sem a protecao de rate limit.
 */
final class AnalyticsTrackingAvailability
{
    public static function shouldDiscardForPrelaunchZeroState(string $launchMode, bool $canonicalDatasetEmpty): bool
    {
        $normalized = strtoupper(trim($launchMode));
        if (!in_array($normalized, ['PRELAUNCH', 'GO_CANDIDATE', 'PRODUCTION'], true)) {
            $normalized = 'PRELAUNCH';
        }

        return $normalized === 'PRELAUNCH' && $canonicalDatasetEmpty;
    }

    public static function shouldDiscardForUnavailableRateLimit(Throwable $error): bool
    {
        return $error instanceof RuntimeException
            && str_contains($error->getMessage(), 'Rate limit compartilhado indisponivel');
    }
}

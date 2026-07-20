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

require_once __DIR__ . '/controllers/AnalyticsTrackingController.php';
require_once __DIR__ . '/services/AnalyticsTrackingService.php';
require_once __DIR__ . '/services/AnalyticsTrackingAvailability.php';
require_once __DIR__ . '/repositories/AnalyticsTrackingRepository.php';
require_once __DIR__ . '/validators/AnalyticsTrackingValidator.php';
require_once __DIR__ . '/../../shared/auth/request_auth.php';
require_once __DIR__ . '/../../shared/middleware/RateLimiter.php';
require_once __DIR__ . '/../../shared/responses/Response.php';

function handleAnalyticsTrackingRoute(PDO $db): void
{
    try {
        try {
            RateLimiter::enforceProfile('analytics_track');
        } catch (Throwable $rateLimitError) {
            if (!AnalyticsTrackingAvailability::shouldDiscardForUnavailableRateLimit($rateLimitError)) {
                throw $rateLimitError;
            }

            error_log('[analytics_tracking_route] Evento descartado: rate limit compartilhado indisponivel.');
            Response::success([
                'tracked' => false,
                'discarded' => true,
                'reason' => 'rate_limit_unavailable',
            ], 'Evento analitico descartado temporariamente.');
            return;
        }

        $authenticatedUserPayload = verifyAuthenticatedUserPayload(false);
        $payload = json_decode(file_get_contents('php://input'), true) ?: [];

        $controller = new AnalyticsTrackingController(
            new AnalyticsTrackingService(
                new AnalyticsTrackingRepository($db),
                new AnalyticsTrackingValidator()
            )
        );

        $result = $controller->track($payload, $authenticatedUserPayload);
        Response::success($result, 'Evento registrado com sucesso.');
    } catch (InvalidArgumentException $e) {
        Response::badRequest($e->getMessage());
    } catch (Throwable $e) {
        error_log('[analytics_tracking_route] ' . $e->getMessage());
        Response::serverError('Nao foi possivel registrar o evento.', $e);
    }
}

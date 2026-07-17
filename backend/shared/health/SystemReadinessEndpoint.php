<?php

declare(strict_types=1);

require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../http/ApiResponse.php';
require_once __DIR__ . '/../observability/RequestContext.php';
require_once __DIR__ . '/SystemHealthService.php';

final class SystemReadinessEndpoint
{
    public static function respond(): never
    {
        try {
            $result = SystemHealthService::readiness((new Database())->getConnection());
            if (!$result['ready']) {
                RequestContext::log('warning', 'readiness_check_failed', [
                    'failed_checks' => array_keys(array_filter(
                        $result['checks'],
                        static fn (array $check): bool => !($check['ok'] ?? false)
                    )),
                ]);
                ApiResponse::error('Service not ready', 503, null, 'service_not_ready');
            }
            ApiResponse::success($result);
        } catch (Throwable $error) {
            RequestContext::log('error', 'readiness_check_error', ['exception' => get_class($error)]);
            ApiResponse::error('Service not ready', 503, null, 'service_not_ready');
        }
    }
}

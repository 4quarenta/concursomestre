<?php

declare(strict_types=1);

require_once __DIR__ . '/../../config/cors.php';
require_once __DIR__ . '/../../shared/http/ApiResponse.php';
require_once __DIR__ . '/../../shared/health/SystemHealthService.php';

ApiResponse::success(SystemHealthService::liveness());

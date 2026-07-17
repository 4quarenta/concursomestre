<?php

declare(strict_types=1);

require_once __DIR__ . '/../../config/cors.php';
require_once __DIR__ . '/../../shared/health/SystemReadinessEndpoint.php';

SystemReadinessEndpoint::respond();

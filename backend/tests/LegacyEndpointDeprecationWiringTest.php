<?php

declare(strict_types=1);

require_once __DIR__ . '/../shared/http/LegacyEndpointDeprecation.php';

function deprecationAssert(bool $condition, string $message): void
{
    if (!$condition) {
        throw new RuntimeException($message);
    }
}

putenv('LEGACY_ENDPOINT_SUNSET_HTTP_DATE=Thu, 31 Dec 2026 23:59:59 GMT');
putenv('LEGACY_ENDPOINT_ENFORCE_SUNSET=true');
putenv('LEGACY_ENDPOINT_ZERO_CONSUMER_ALIASES=unusedAlias');

deprecationAssert(
    !LegacyEndpointDeprecation::shouldReturnGone('activeAlias', strtotime('2027-01-01 UTC')),
    'Alias ativo foi removido sem prova de consumo zero.'
);
deprecationAssert(
    !LegacyEndpointDeprecation::shouldReturnGone('unusedAlias', strtotime('2026-07-17 UTC')),
    'Alias foi removido antes da data aprovada.'
);
deprecationAssert(
    LegacyEndpointDeprecation::shouldReturnGone('unusedAlias', strtotime('2027-01-01 UTC')),
    'Alias aprovado e sem consumidores nao retornou Gone.'
);

$router = file_get_contents(__DIR__ . '/../router.php');
deprecationAssert(is_string($router) && str_contains($router, 'LegacyEndpointDeprecation::mark'), 'Router sem telemetria.');
deprecationAssert(str_contains($router, 'LegacyEndpointDeprecation::shouldReturnGone'), 'Router sem politica de 410 protegida.');

putenv('LEGACY_ENDPOINT_SUNSET_HTTP_DATE');
putenv('LEGACY_ENDPOINT_ENFORCE_SUNSET');
putenv('LEGACY_ENDPOINT_ZERO_CONSUMER_ALIASES');
fwrite(STDOUT, "LegacyEndpointDeprecationWiringTest: PASS\n");

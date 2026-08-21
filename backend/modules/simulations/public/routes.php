<?php

declare(strict_types=1);

require_once __DIR__ . '/../../../shared/responses/Response.php';
require_once __DIR__ . '/PublicSimulationsRepository.php';
require_once __DIR__ . '/PublicSimulationsService.php';

function publicSimulationsService(PDO $db): PublicSimulationsService
{
    return new PublicSimulationsService(new PublicSimulationsRepository($db));
}

function handlePublicSimulationsDirectoryRoute(PDO $db): void
{
    try {
        Response::success(publicSimulationsService($db)->directory($_GET));
    } catch (Throwable $exception) {
        Response::serverError('Nao foi possivel carregar os simulados publicos.', $exception);
    }
}

function handlePublicSimulationDetailRoute(PDO $db): void
{
    try {
        $payload = publicSimulationsService($db)->detail((string) ($_GET['slug'] ?? ''));
        if ($payload === null) Response::notFound('Simulado nao encontrado.');
        Response::success($payload);
    } catch (Throwable $exception) {
        Response::serverError('Nao foi possivel carregar o simulado publico.', $exception);
    }
}

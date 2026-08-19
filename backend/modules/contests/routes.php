<?php

declare(strict_types=1);

require_once __DIR__ . '/../../shared/responses/Response.php';
require_once __DIR__ . '/repositories/ContestsRepository.php';
require_once __DIR__ . '/services/ContestsService.php';

function publicContestsService(PDO $db): ContestsService
{
    return new ContestsService(new ContestsRepository($db));
}

function handlePublicContestsDirectoryRoute(PDO $db, bool $openOnly = false): void
{
    try {
        Response::success(publicContestsService($db)->directory($_GET, $openOnly));
    } catch (InvalidArgumentException $exception) {
        Response::badRequest($exception->getMessage());
    } catch (Throwable $exception) {
        Response::serverError('Nao foi possivel carregar os concursos publicos.', $exception);
    }
}

function handlePublicContestDetailRoute(PDO $db): void
{
    try {
        $payload = publicContestsService($db)->detail((string) ($_GET['slug'] ?? ''));
        if ($payload === null) Response::notFound('Concurso nao encontrado.');
        Response::success($payload);
    } catch (Throwable $exception) {
        Response::serverError('Nao foi possivel carregar o concurso.', $exception);
    }
}

<?php

declare(strict_types=1);

require_once __DIR__ . '/../../../shared/responses/Response.php';
require_once __DIR__ . '/PublicMaterialsRepository.php';
require_once __DIR__ . '/PublicMaterialsService.php';

function publicMaterialsService(PDO $db): PublicMaterialsService
{
    return new PublicMaterialsService(new PublicMaterialsRepository($db));
}

function handlePublicMaterialsDirectoryRoute(PDO $db): void
{
    try {
        Response::success(publicMaterialsService($db)->directory($_GET));
    } catch (InvalidArgumentException $exception) {
        Response::badRequest($exception->getMessage());
    } catch (Throwable $exception) {
        Response::serverError('Nao foi possivel carregar os materiais publicos.', $exception);
    }
}

function handlePublicMaterialDetailRoute(PDO $db): void
{
    try {
        $payload = publicMaterialsService($db)->detail((string) ($_GET['slug'] ?? ''));
        if ($payload === null) Response::notFound('Material nao encontrado.');
        Response::success($payload);
    } catch (Throwable $exception) {
        Response::serverError('Nao foi possivel carregar o material publico.', $exception);
    }
}

function handlePublicMaterialLegacyRoute(PDO $db): void
{
    try {
        $slug = publicMaterialsService($db)->legacyCanonicalSlug((string) ($_GET['id'] ?? ''));
        if ($slug === null) Response::notFound('Material nao encontrado.');
        Response::success(['redirectSlug' => $slug]);
    } catch (Throwable $exception) {
        Response::serverError('Nao foi possivel resolver o material legado.', $exception);
    }
}

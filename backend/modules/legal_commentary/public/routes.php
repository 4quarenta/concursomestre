<?php

declare(strict_types=1);

require_once __DIR__ . '/../../../shared/responses/Response.php';
require_once __DIR__ . '/PublicLawArticleService.php';

function handlePublicLawArticleDetailRoute(PDO $db): void
{
    try {
        $service = new PublicLawArticleService(new PublicLawArticleRepository($db));
        $result = $service->detail((string) ($_GET['lawSlug'] ?? ''), (string) ($_GET['articleSlug'] ?? ''));
        if ($result === null) Response::notFound('Artigo normativo nao encontrado.');
        Response::success($result);
    } catch (Throwable $exception) {
        Response::serverError('Nao foi possivel carregar o artigo normativo.', $exception);
    }
}

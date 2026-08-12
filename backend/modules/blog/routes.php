<?php

declare(strict_types=1);

require_once __DIR__ . '/controllers/BlogController.php';
require_once __DIR__ . '/services/BlogService.php';
require_once __DIR__ . '/repositories/BlogRepository.php';
require_once __DIR__ . '/validators/BlogValidator.php';
require_once __DIR__ . '/../../shared/auth/request_auth.php';
require_once __DIR__ . '/../../shared/security/AdminSecurity.php';
require_once __DIR__ . '/../../shared/responses/Response.php';
require_once __DIR__ . '/../../shared/middleware/RateLimiter.php';

function buildBlogController(PDO $db): BlogController
{
    return new BlogController(new BlogService(new BlogRepository($db), new BlogValidator()));
}

function readBlogJsonBody(): array
{
    $raw = file_get_contents('php://input');
    $decoded = is_string($raw) && trim($raw) !== '' ? json_decode($raw, true) : [];
    if (!is_array($decoded)) {
        throw new InvalidArgumentException('Payload JSON invalido.');
    }
    return $decoded;
}

function handleBlogListRoute(PDO $db): void
{
    try {
        Response::success(buildBlogController($db)->listPublic($_GET, verifyAuthenticatedUserPayload(false)));
    } catch (InvalidArgumentException $e) {
        Response::badRequest($e->getMessage());
    } catch (Throwable $e) {
        Response::serverError('Nao foi possivel listar as noticias.', $e);
    }
}

function handleBlogDetailRoute(PDO $db): void
{
    try {
        $slug = trim((string) ($_GET['slug'] ?? ''));
        if ($slug === '') {
            throw new InvalidArgumentException('slug e obrigatorio.');
        }
        Response::success(buildBlogController($db)->detailPublic($slug, verifyAuthenticatedUserPayload(false)));
    } catch (InvalidArgumentException $e) {
        Response::badRequest($e->getMessage());
    } catch (OutOfBoundsException $e) {
        Response::notFound($e->getMessage());
    } catch (Throwable $e) {
        Response::serverError('Nao foi possivel carregar a noticia.', $e);
    }
}

function handleBlogCategoriesRoute(PDO $db): void
{
    try {
        Response::success(['items' => buildBlogController($db)->categories()]);
    } catch (Throwable $e) {
        Response::serverError('Nao foi possivel listar as categorias.', $e);
    }
}

function handleBlogTagsRoute(PDO $db): void
{
    try {
        Response::success(['items' => buildBlogController($db)->tags()]);
    } catch (Throwable $e) {
        Response::serverError('Nao foi possivel listar as tags.', $e);
    }
}

function handleBlogLikeRoute(PDO $db): void
{
    try {
        RateLimiter::enforceProfile('comment_write');
        $payload = readBlogJsonBody();
        $articleId = (int) ($payload['articleId'] ?? $payload['article_id'] ?? 0);
        if ($articleId <= 0) {
            throw new InvalidArgumentException('articleId e obrigatorio.');
        }
        Response::success(buildBlogController($db)->toggleLike($articleId, verifyAuthenticatedUserPayload()));
    } catch (InvalidArgumentException $e) {
        Response::badRequest($e->getMessage());
    } catch (OutOfBoundsException $e) {
        Response::notFound($e->getMessage());
    } catch (RuntimeException $e) {
        Response::unauthorized($e->getMessage());
    } catch (Throwable $e) {
        Response::serverError('Nao foi possivel processar a curtida.', $e);
    }
}

function handleBlogAdminListRoute(PDO $db): void
{
    try {
        requireAdminSessionContext($db);
        Response::success(buildBlogController($db)->listAdmin($_GET));
    } catch (Throwable $e) {
        Response::serverError('Nao foi possivel listar os artigos.', $e);
    }
}

function handleBlogAdminDetailRoute(PDO $db): void
{
    try {
        requireAdminSessionContext($db);
        $id = (int) ($_GET['id'] ?? 0);
        if ($id <= 0) {
            throw new InvalidArgumentException('id e obrigatorio.');
        }
        Response::success(buildBlogController($db)->detailAdmin($id));
    } catch (InvalidArgumentException $e) {
        Response::badRequest($e->getMessage());
    } catch (OutOfBoundsException $e) {
        Response::notFound($e->getMessage());
    } catch (Throwable $e) {
        Response::serverError('Nao foi possivel carregar o artigo.', $e);
    }
}

function handleBlogAdminSaveRoute(PDO $db): void
{
    try {
        $context = requireAdminSessionContext($db);
        $article = buildBlogController($db)->save(readBlogJsonBody(), $context['payload']);
        logAdminAudit(
            $db,
            (string) $context['admin_user_id'],
            'blog.article.save',
            'blog_article',
            (string) ($article['id'] ?? ''),
            ['status' => $article['status'] ?? 'draft']
        );
        Response::success($article, 'Artigo salvo com sucesso.');
    } catch (InvalidArgumentException $e) {
        Response::validationError($e->getMessage());
    } catch (DomainException $e) {
        Response::forbidden($e->getMessage());
    } catch (PDOException $e) {
        if ((string) $e->getCode() === '23000') {
            Response::conflict('Ja existe um artigo ou categoria com este slug.');
        }
        Response::serverError('Nao foi possivel salvar o artigo.', $e);
    } catch (Throwable $e) {
        Response::serverError('Nao foi possivel salvar o artigo.', $e);
    }
}

function handleBlogAdminDeleteRoute(PDO $db): void
{
    try {
        $context = requireAdminSessionContext($db);
        $payload = readBlogJsonBody();
        $id = (int) ($payload['id'] ?? 0);
        if ($id <= 0) {
            throw new InvalidArgumentException('id e obrigatorio.');
        }
        buildBlogController($db)->archive($id, $context['payload']);
        logAdminAudit($db, (string) $context['admin_user_id'], 'blog.article.archive', 'blog_article', (string) $id);
        Response::success(['id' => $id], 'Artigo arquivado.');
    } catch (InvalidArgumentException $e) {
        Response::badRequest($e->getMessage());
    } catch (DomainException $e) {
        Response::forbidden($e->getMessage());
    } catch (OutOfBoundsException $e) {
        Response::notFound($e->getMessage());
    } catch (Throwable $e) {
        Response::serverError('Nao foi possivel arquivar o artigo.', $e);
    }
}

function handleBlogAdminCategoriesRoute(PDO $db): void
{
    try {
        $context = requireAdminSessionContext($db);
        if (strtoupper((string) ($_SERVER['REQUEST_METHOD'] ?? 'GET')) === 'GET') {
            Response::success(['items' => buildBlogController($db)->categories(false)]);
        }
        Response::success(
            buildBlogController($db)->createCategory(readBlogJsonBody(), $context['payload']),
            'Categoria salva.'
        );
    } catch (InvalidArgumentException $e) {
        Response::validationError($e->getMessage());
    } catch (Throwable $e) {
        Response::serverError('Nao foi possivel salvar a categoria.', $e);
    }
}

function handleBlogAdminTagsRoute(PDO $db): void
{
    try {
        $context = requireAdminSessionContext($db);
        if (strtoupper((string) ($_SERVER['REQUEST_METHOD'] ?? 'GET')) === 'GET') {
            Response::success(['items' => buildBlogController($db)->tags(false)]);
        }
        Response::success(
            buildBlogController($db)->createTag(readBlogJsonBody(), $context['payload']),
            'Tag salva.'
        );
    } catch (InvalidArgumentException $e) {
        Response::validationError($e->getMessage());
    } catch (Throwable $e) {
        Response::serverError('Nao foi possivel salvar a tag.', $e);
    }
}

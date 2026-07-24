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

require_once __DIR__ . '/controllers/CommentsController.php';
require_once __DIR__ . '/services/CommentsService.php';
require_once __DIR__ . '/repositories/CommentsRepository.php';
require_once __DIR__ . '/validators/CommentsValidator.php';
require_once __DIR__ . '/../../shared/auth/request_auth.php';
require_once __DIR__ . '/../../shared/responses/Response.php';
require_once __DIR__ . '/../../shared/middleware/RateLimiter.php';

/**
 * Le o payload JSON das rotas de comentarios.
 *
 * @since 1.0.0
 */
function readCommentsJsonRequestBody(): array
{
    $rawBody = file_get_contents('php://input');
    if (!is_string($rawBody) || trim($rawBody) === '') {
        return [];
    }

    $decoded = json_decode($rawBody, true);
    if (!is_array($decoded)) {
        throw new InvalidArgumentException('Payload JSON invalido.');
    }

    return $decoded;
}

/**
 * Fabrica curta do controller oficial.
 *
 * @since 1.0.0
 */
function buildCommentsController(PDO $db): CommentsController
{
    return new CommentsController(
        new CommentsService(
            new CommentsRepository($db),
            new CommentsValidator(),
            $db
        )
    );
}

/**
 * Lista comentarios publicamente, com autenticacao opcional para calcular isLiked.
 *
 * @since 1.0.0
 */
function handleCommentsListRoute(PDO $db): void
{
    try {
        $authenticatedUserPayload = verifyAuthenticatedUserPayload(false);
        $result = buildCommentsController($db)->listComments($_GET, $authenticatedUserPayload);
        Response::success($result, 'Comments retrieved');
    } catch (InvalidArgumentException $e) {
        Response::badRequest($e->getMessage());
    } catch (OutOfBoundsException $e) {
        Response::notFound($e->getMessage());
    } catch (Throwable $e) {
        Response::serverError('Failed to fetch comments', $e);
    }
}

/**
 * Mantem o contrato legado commentsHandle centralizando add/like/delete.
 *
 * @since 1.0.0
 */
function handleCommentsMutationRoute(PDO $db): void
{
    try {
        $requestBody = readCommentsJsonRequestBody();
        $action = trim((string) ($requestBody['action'] ?? ''));
        if ($action === '') {
            throw new InvalidArgumentException('Acao de comentario invalida.');
        }

        if (in_array($action, ['add', 'like'], true)) {
            RateLimiter::enforceProfile('comment_write');
        }

        $authenticatedUserPayload = verifyAuthenticatedUserPayload();
        $controller = buildCommentsController($db);

        if ($action === 'add') {
            $result = $controller->addComment($requestBody, $authenticatedUserPayload);
            Response::success($result, 'Comment created');
            return;
        }

        if ($action === 'like') {
            $result = $controller->toggleLike($requestBody, $authenticatedUserPayload);
            Response::success($result, 'Comment like processed');
            return;
        }

        if ($action === 'delete') {
            $result = $controller->deleteComment($requestBody, $authenticatedUserPayload);
            Response::success($result, $result['message'] ?? 'Comment deleted');
            return;
        }

        throw new InvalidArgumentException('Acao de comentario invalida.');
    } catch (InvalidArgumentException $e) {
        Response::badRequest($e->getMessage());
    } catch (OutOfBoundsException $e) {
        Response::notFound($e->getMessage());
    } catch (DomainException $e) {
        Response::forbidden($e->getMessage());
    } catch (RuntimeException $e) {
        $message = $e->getMessage();
        if (stripos($message, 'sess') !== false || stripos($message, 'token') !== false) {
            Response::unauthorized($message);
        }

        Response::serverError('Failed to process comment action', $e);
    } catch (Throwable $e) {
        Response::serverError('Failed to process comment action', $e);
    }
}

/**
 * Bridge funcional do endpoint list_cached legado.
 * O cache procedural antigo saiu do caminho e a rota agora delega para a
 * listagem oficial, mantendo apenas o header de compatibilidade.
 *
 * @since 1.0.0
 */
function handleCommentsCachedListRoute(PDO $db): void
{
    header('X-Cache: BYPASS');
    handleCommentsListRoute($db);
}

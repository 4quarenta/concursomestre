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

require_once __DIR__ . '/controllers/FeedbackController.php';
require_once __DIR__ . '/services/FeedbackService.php';
require_once __DIR__ . '/repositories/FeedbackRepository.php';
require_once __DIR__ . '/validators/FeedbackValidator.php';
require_once __DIR__ . '/../../shared/auth/request_auth.php';
require_once __DIR__ . '/../../shared/responses/Response.php';
require_once __DIR__ . '/../../shared/middleware/RateLimiter.php';

/**
 * Le o payload JSON das rotas do dominio feedback.
 *
 * @since 1.0.0
 */
function readFeedbackJsonRequestBody(): array
{
    $rawBody = file_get_contents('php://input');
    if (!is_string($rawBody) || trim($rawBody) === '') {
        return [];
    }

    $decoded = json_decode($rawBody, true);
    if (!is_array($decoded)) {
        throw new InvalidArgumentException('Payload JSON inválido.');
    }

    return $decoded;
}

/**
 * Fabrica curta do controller oficial do dominio feedback.
 *
 * @since 1.0.0
 */
function buildFeedbackController(PDO $db): FeedbackController
{
    return new FeedbackController(
        new FeedbackService(
            new FeedbackRepository($db),
            new FeedbackValidator()
        )
    );
}

function resolveFeedbackCreateSuccessMessage(array $payload, array $requestBody): string
{
    if (!empty($payload['duplicate'])) {
        return 'Já existe uma solicitação pendente para este item.';
    }

    $type = strtolower(trim((string) ($payload['type'] ?? $requestBody['type'] ?? 'support')));
    $reason = trim((string) ($requestBody['reason'] ?? ''));
    $details = trim((string) ($requestBody['details'] ?? ''));
    $normalizedReason = iconv('UTF-8', 'ASCII//TRANSLIT//IGNORE', $reason);
    $normalizedReason = strtolower((string) $normalizedReason);

    if (
        $type === 'platform-rating'
        || (int) ($requestBody['rating'] ?? $requestBody['public_rating'] ?? 0) > 0
        || str_starts_with($normalizedReason, 'avaliar plataforma')
    ) {
        return 'Avaliação enviada com sucesso.';
    }

    if ($type === 'bug') {
        return 'Bug enviado para análise.';
    }

    if ($type === 'suggestion') {
        return 'Sugestão enviada com sucesso.';
    }

    if ($type === 'report') {
        return 'Denúncia enviada para moderação.';
    }

    if (
        str_contains($normalizedReason, 'solicitar comentario')
        || str_contains($normalizedReason, 'solicitar analise')
        || str_contains($details, 'Codigo do pedido: teacher_request')
        || str_contains($details, 'Codigo do pedido: analysis_request')
    ) {
        return 'Solicitação enviada ao suporte.';
    }

    return 'Atendimento aberto com sucesso.';
}

/**
 * Lista as threads do usuario ou as respostas de uma thread especifica.
 *
 * @since 1.0.0
 */
function handleFeedbackListRoute(PDO $db): void
{
    try {
        $authenticatedUserPayload = verifyAuthenticatedUserPayload();
        $controller = buildFeedbackController($db);

        if (isset($_GET['public_suggestions'])) {
            $limit = isset($_GET['limit']) ? (int) $_GET['limit'] : 80;
            $suggestions = $controller->listPublicSuggestions($authenticatedUserPayload, $limit);
            Response::success(['suggestions' => $suggestions], 'Sugestões carregadas.');
            return;
        }

        if (isset($_GET['id'])) {
            $threadId = (int) $_GET['id'];
            $replies = $controller->listReplies($threadId, $authenticatedUserPayload);
            Response::success(['replies' => $replies], 'Respostas carregadas.');
            return;
        }

        $threads = $controller->listThreads($authenticatedUserPayload);
        Response::success(['feedback' => $threads], 'Conversas carregadas.');
    } catch (InvalidArgumentException $e) {
        Response::badRequest($e->getMessage());
    } catch (OutOfBoundsException $e) {
        Response::notFound($e->getMessage());
    } catch (DomainException $e) {
        Response::forbidden($e->getMessage());
    } catch (RuntimeException $e) {
        Response::unauthorized($e->getMessage());
    } catch (Throwable $e) {
        Response::serverError('Não foi possível carregar os feedbacks.', $e);
    }
}

/**
 * Registra voto em sugestao publica.
 *
 * @since 1.0.0
 */
function handleFeedbackVoteRoute(PDO $db): void
{
    try {
        RateLimiter::enforceProfile('support_write');
        $authenticatedUserPayload = verifyAuthenticatedUserPayload();
        $requestBody = readFeedbackJsonRequestBody();
        $suggestion = buildFeedbackController($db)->votePublicSuggestion($requestBody, $authenticatedUserPayload);
        Response::success(['suggestion' => $suggestion], 'Voto registrado.');
    } catch (InvalidArgumentException $e) {
        Response::validationError($e->getMessage());
    } catch (OutOfBoundsException $e) {
        Response::notFound($e->getMessage());
    } catch (DomainException $e) {
        Response::forbidden($e->getMessage());
    } catch (RuntimeException $e) {
        Response::unauthorized($e->getMessage());
    } catch (Throwable $e) {
        Response::serverError('Não foi possível registrar o voto.', $e);
    }
}

/**
 * Lista depoimentos aprovados para a home publica.
 *
 * @since 1.0.0
 */
function handleFeedbackTestimonialsRoute(PDO $db): void
{
    try {
        $limit = isset($_GET['limit']) ? (int) $_GET['limit'] : 9;
        $items = buildFeedbackController($db)->listPublishedTestimonials($limit);
        Response::success(['items' => $items], 'Depoimentos aprovados carregados.');
    } catch (Throwable $e) {
        Response::serverError('Não foi possível carregar os depoimentos.', $e);
    }
}

/**
 * Cria uma nova thread ou uma resposta dentro de uma thread existente.
 *
 * @since 1.0.0
 */
function handleFeedbackCreateRoute(PDO $db): void
{
    try {
        RateLimiter::enforceProfile('support_write');
        $authenticatedUserPayload = verifyAuthenticatedUserPayload();
        $requestBody = readFeedbackJsonRequestBody();
        $payload = buildFeedbackController($db)->createEntry($requestBody, $authenticatedUserPayload);
        Response::success($payload, resolveFeedbackCreateSuccessMessage($payload, $requestBody));
    } catch (InvalidArgumentException $e) {
        Response::validationError($e->getMessage());
    } catch (OutOfBoundsException $e) {
        Response::notFound($e->getMessage());
    } catch (DomainException $e) {
        Response::forbidden($e->getMessage());
    } catch (RuntimeException $e) {
        Response::unauthorized($e->getMessage());
    } catch (Throwable $e) {
        Response::serverError('Não foi possível registrar o feedback.', $e);
    }
}

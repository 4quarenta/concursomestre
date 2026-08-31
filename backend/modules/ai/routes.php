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

require_once __DIR__ . '/controllers/AiController.php';
require_once __DIR__ . '/services/AiService.php';
require_once __DIR__ . '/repositories/AiRepository.php';
require_once __DIR__ . '/validators/AiValidator.php';
require_once __DIR__ . '/../../shared/middleware/AuthMiddleware.php';
require_once __DIR__ . '/../../shared/responses/Response.php';

/**
 * Fabrica o controller oficial do modulo de IA.
 *
 * @since 1.0.0
 */
function buildAiController(PDO $db): AiController
{
    return new AiController(
        new AiService(
            new AiRepository($db),
            new AiValidator()
        )
    );
}

/**
 * Entrada oficial da geracao via Gemini.
 * O endpoint e restrito ao admin para evitar uso publico da chave do backend.
 *
 * @since 1.0.0
 */
function handleAiGenerateRoute(PDO $db): void
{
    try {
        AuthMiddleware::requireAdmin();

        $body = json_decode(file_get_contents('php://input'), true);
        if (!is_array($body)) {
            $body = [];
        }

        $payload = buildAiController($db)->generate($body);
        Response::success($payload, 'AI request completed.');
    } catch (InvalidArgumentException $e) {
        Response::badRequest($e->getMessage());
    } catch (RuntimeException $e) {
        $message = $e->getMessage();
        if (str_contains($message, 'AI Engine Error') || str_contains($message, 'Gemini') || str_contains($message, 'OpenAI')) {
            Response::serviceUnavailable($message, $e, 'ai_unavailable');
        }

        Response::serverError($message, $e);
    } catch (Throwable $e) {
        Response::serverError('AI Engine Error: Falha inesperada ao gerar conteudo.', $e);
    }
}

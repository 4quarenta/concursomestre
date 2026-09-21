<?php

/*
* ----------------------------------------------------
* @author: 4quarenta
* @copyright: (c) 2026 ConcursoMestre. All rights reserved
* ----------------------------------------------------
*
* @since 1.0.0
*/

require_once __DIR__ . '/../../config/cors.php';
require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../../modules/questions/routes.php';

/**
 * Sanitiza a listagem publica para clientes mobile.
 *
 * Na pratica normal, uma questao ja respondida pode preservar o gabarito para revisao.
 * Em `exam_mode`, nenhum gabarito ou resposta anterior sai no DTO, mesmo quando o
 * usuario ja resolveu a questao fora daquele simulado.
 */
function sanitizeMobileQuestionRows(array $result, bool $examMode = false): array
{
    $rows = is_array($result['rows'] ?? null) ? $result['rows'] : [];

    $result['rows'] = array_map(static function ($question) use ($examMode): array {
        if (!is_array($question)) {
            return [];
        }

        $hasUserAnswer = is_array($question['userAnswer'] ?? null);
        if ($examMode || !$hasUserAnswer) {
            unset($question['resposta'], $question['correctOptionIndex']);
        }

        if ($examMode) {
            unset($question['userAnswer'], $question['resolvida']);
        }

        return $question;
    }, $rows);

    return $result;
}

try {
    $database = new Database();
    $db = $database->getConnection();
    $authenticatedUserPayload = verifyAuthenticatedUserPayload(false);
    $authenticatedUserId = trim((string) ($authenticatedUserPayload['user_id'] ?? ''));
    $examMode = filter_var($_GET['exam_mode'] ?? false, FILTER_VALIDATE_BOOLEAN);

    $result = buildQuestionsController($db)->listQuestions(
        $authenticatedUserId !== '' ? $authenticatedUserId : null,
        userCanViewQuestionTeacherComment($db, $authenticatedUserId),
        userCanViewQuestionDetailedAnalysis($db, $authenticatedUserId),
        $_GET
    );

    Response::success(
        sanitizeMobileQuestionRows($result, $examMode),
        'Questoes carregadas com sucesso.'
    );
} catch (InvalidArgumentException $e) {
    Response::badRequest($e->getMessage());
} catch (Throwable $e) {
    Response::serverError('Nao foi possivel carregar as questoes.', $e);
}

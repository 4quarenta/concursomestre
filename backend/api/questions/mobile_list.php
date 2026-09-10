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
 * Remove o gabarito de questoes ainda nao respondidas.
 * O DTO de revisao preserva o gabarito somente quando existe userAnswer.
 */
function sanitizeMobileQuestionRows(array $result): array
{
    $rows = is_array($result['rows'] ?? null) ? $result['rows'] : [];

    $result['rows'] = array_map(static function ($question): array {
        if (!is_array($question)) {
            return [];
        }

        $hasUserAnswer = is_array($question['userAnswer'] ?? null);
        if (!$hasUserAnswer) {
            unset($question['resposta'], $question['correctOptionIndex']);
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

    $result = buildQuestionsController($db)->listQuestions(
        $authenticatedUserId !== '' ? $authenticatedUserId : null,
        userCanViewQuestionTeacherComment($db, $authenticatedUserId),
        userCanViewQuestionDetailedAnalysis($db, $authenticatedUserId),
        $_GET
    );

    Response::success(
        sanitizeMobileQuestionRows($result),
        'Questoes carregadas com sucesso.'
    );
} catch (InvalidArgumentException $e) {
    Response::badRequest($e->getMessage());
} catch (Throwable $e) {
    Response::serverError('Nao foi possivel carregar as questoes.', $e);
}

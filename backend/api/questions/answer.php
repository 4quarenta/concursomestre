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

require_once __DIR__ . '/../../config/cors.php';
require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../../modules/questions/routes.php';

/**
 * Resolve o indice correto exclusivamente a partir da questao persistida.
 * O cliente nunca e fonte autoritativa para is_correct.
 *
 * @since 1.0.0
 */
function resolveServerCorrectOptionIndex(array $question): int
{
    if (array_key_exists('resposta_correta_item_index', $question)) {
        return (int) $question['resposta_correta_item_index'];
    }

    $data = json_decode((string) ($question['data_json'] ?? ''), true);
    if (is_array($data)) {
        if (array_key_exists('correctOptionIndex', $data)) {
            return (int) $data['correctOptionIndex'];
        }

        if (array_key_exists('resposta', $data)) {
            $legacyAnswer = (int) $data['resposta'];
            return $legacyAnswer > 0 ? $legacyAnswer - 1 : $legacyAnswer;
        }
    }

    throw new RuntimeException('Gabarito da questao indisponivel.');
}

$database = new Database();
$db = $database->getConnection();

try {
    $authenticatedUserPayload = verifyAuthenticatedUserPayload();
    $authenticatedUserId = trim((string) ($authenticatedUserPayload['user_id'] ?? ''));
    $isAdmin = in_array((string) ($authenticatedUserPayload['role'] ?? ''), ['admin', 'staff'], true);
    $payload = readQuestionsJsonRequestBody();

    $questionId = $payload['question_id'] ?? $payload['questionId'] ?? null;
    $selectedOption = $payload['selected_option'] ?? $payload['selectedOption'] ?? null;

    if ($questionId === null || $questionId === '' || $selectedOption === null || $selectedOption === '') {
        throw new InvalidArgumentException('Dados incompletos para registrar a resposta.');
    }

    $repository = new QuestionsRepository($db);
    $question = $repository->findQuestionById($questionId);
    if (!is_array($question)) {
        throw new OutOfBoundsException('Questao nao encontrada.');
    }

    $correctOptionIndex = resolveServerCorrectOptionIndex($question);
    $selectedOptionIndex = (int) $selectedOption;
    $isCorrect = $selectedOptionIndex === $correctOptionIndex;

    // Sobrescreve qualquer valor eventualmente enviado por clientes legados.
    $payload['is_correct'] = $isCorrect;
    $payload['isCorrect'] = $isCorrect;

    $result = buildQuestionsController($db)->submitAnswer(
        $authenticatedUserId,
        $isAdmin,
        $payload
    );

    $result['isCorrect'] = $isCorrect;
    $result['is_correct'] = $isCorrect;
    $result['correctOptionIndex'] = $correctOptionIndex;
    $result['correct_option_index'] = $correctOptionIndex;

    Response::success($result, 'Resposta salva com sucesso.');
} catch (InvalidArgumentException $e) {
    Response::badRequest($e->getMessage());
} catch (OutOfBoundsException $e) {
    Response::notFound($e->getMessage());
} catch (DomainException $e) {
    Response::forbidden($e->getMessage());
} catch (RuntimeException $e) {
    $message = strtolower($e->getMessage());
    if (
        str_contains($message, 'token')
        || str_contains($message, 'autentic')
        || str_contains($message, 'sess')
        || str_contains($message, 'session')
    ) {
        Response::unauthorized($e->getMessage());
    }

    Response::serverError('Nao foi possivel registrar a resposta.', $e);
} catch (Throwable $e) {
    Response::serverError('Nao foi possivel registrar a resposta.', $e);
}

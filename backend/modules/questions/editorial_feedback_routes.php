<?php

declare(strict_types=1);

require_once __DIR__ . '/../../shared/auth/request_auth.php';
require_once __DIR__ . '/../../shared/responses/Response.php';

function readQuestionEditorialFeedbackBody(): array
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

function normalizeQuestionEditorialContentType($value): string
{
    $normalized = strtolower(trim((string) $value));
    if (!in_array($normalized, ['teacher', 'detailed'], true)) {
        throw new InvalidArgumentException('Tipo de conteudo editorial invalido.');
    }

    return $normalized;
}

function normalizeQuestionEditorialFeedbackValue($value): ?string
{
    $normalized = strtolower(trim((string) $value));
    if ($normalized === '' || $normalized === 'null' || $normalized === 'none') {
        return null;
    }

    if (!in_array($normalized, ['like', 'dislike'], true)) {
        throw new InvalidArgumentException('Avaliacao editorial invalida.');
    }

    return $normalized;
}

function buildQuestionEditorialFeedbackSnapshot(PDO $db, int $questionId, string $userId = ''): array
{
    $feedback = ['teacher' => null, 'detailed' => null];

    if ($userId !== '') {
        $stmt = $db->prepare(
            'SELECT content_type, feedback_value
             FROM question_editorial_feedback
             WHERE question_id = :question_id AND user_id = :user_id'
        );
        $stmt->execute([':question_id' => $questionId, ':user_id' => $userId]);

        foreach (($stmt->fetchAll(PDO::FETCH_ASSOC) ?: []) as $row) {
            $contentType = (string) ($row['content_type'] ?? '');
            if (array_key_exists($contentType, $feedback)) {
                $feedback[$contentType] = (string) ($row['feedback_value'] ?? '');
            }
        }
    }

    $counts = [
        'teacher' => ['likes' => 0, 'dislikes' => 0],
        'detailed' => ['likes' => 0, 'dislikes' => 0],
    ];
    $countStmt = $db->prepare(
        "SELECT content_type,
                SUM(CASE WHEN feedback_value = 'like' THEN 1 ELSE 0 END) AS likes,
                SUM(CASE WHEN feedback_value = 'dislike' THEN 1 ELSE 0 END) AS dislikes
         FROM question_editorial_feedback
         WHERE question_id = :question_id
         GROUP BY content_type"
    );
    $countStmt->execute([':question_id' => $questionId]);

    foreach (($countStmt->fetchAll(PDO::FETCH_ASSOC) ?: []) as $row) {
        $contentType = (string) ($row['content_type'] ?? '');
        if (isset($counts[$contentType])) {
            $counts[$contentType] = [
                'likes' => (int) ($row['likes'] ?? 0),
                'dislikes' => (int) ($row['dislikes'] ?? 0),
            ];
        }
    }

    return ['feedback' => $feedback, 'counts' => $counts];
}

function handleQuestionEditorialFeedbackRoute(PDO $db): void
{
    try {
        $method = strtoupper((string) ($_SERVER['REQUEST_METHOD'] ?? 'GET'));

        if ($method === 'GET') {
            $questionId = (int) ($_GET['question_id'] ?? $_GET['questionId'] ?? 0);
            if ($questionId <= 0) {
                throw new InvalidArgumentException('Questao invalida.');
            }

            $authPayload = verifyAuthenticatedUserPayload(false);
            $userId = trim((string) ($authPayload['user_id'] ?? ''));
            Response::success(
                buildQuestionEditorialFeedbackSnapshot($db, $questionId, $userId),
                'Avaliacoes editoriais carregadas.'
            );
        }

        if ($method !== 'POST') {
            Response::error('Metodo nao permitido.', 405);
        }

        $authPayload = verifyAuthenticatedUserPayload();
        $userId = trim((string) ($authPayload['user_id'] ?? ''));
        $payload = readQuestionEditorialFeedbackBody();
        $questionId = (int) ($payload['question_id'] ?? $payload['questionId'] ?? 0);
        if ($questionId <= 0) {
            throw new InvalidArgumentException('Questao invalida.');
        }

        $contentType = normalizeQuestionEditorialContentType($payload['content_type'] ?? $payload['contentType'] ?? '');
        $feedbackValue = normalizeQuestionEditorialFeedbackValue($payload['value'] ?? $payload['feedback'] ?? null);

        if ($feedbackValue === null) {
            $stmt = $db->prepare(
                'DELETE FROM question_editorial_feedback
                 WHERE question_id = :question_id
                   AND user_id = :user_id
                   AND content_type = :content_type'
            );
            $stmt->execute([
                ':question_id' => $questionId,
                ':user_id' => $userId,
                ':content_type' => $contentType,
            ]);
        } else {
            $stmt = $db->prepare(
                'INSERT INTO question_editorial_feedback (
                    question_id, user_id, content_type, feedback_value
                 ) VALUES (
                    :question_id, :user_id, :content_type, :feedback_value
                 ) ON DUPLICATE KEY UPDATE
                    feedback_value = VALUES(feedback_value),
                    updated_at = CURRENT_TIMESTAMP'
            );
            $stmt->execute([
                ':question_id' => $questionId,
                ':user_id' => $userId,
                ':content_type' => $contentType,
                ':feedback_value' => $feedbackValue,
            ]);
        }

        Response::success(
            buildQuestionEditorialFeedbackSnapshot($db, $questionId, $userId),
            'Avaliacao editorial registrada.'
        );
    } catch (InvalidArgumentException $e) {
        Response::badRequest($e->getMessage());
    } catch (RuntimeException $e) {
        Response::unauthorized($e->getMessage());
    } catch (Throwable $e) {
        Response::serverError('Nao foi possivel processar a avaliacao editorial.', $e);
    }
}

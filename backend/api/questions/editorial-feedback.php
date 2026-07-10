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

function ensureQuestionEditorialFeedbackTable(PDO $db): void
{
    $db->exec(
        "CREATE TABLE IF NOT EXISTS question_editorial_feedback (
            id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
            question_id BIGINT UNSIGNED NOT NULL,
            user_id VARCHAR(64) NOT NULL,
            content_type ENUM('teacher', 'detailed') NOT NULL,
            feedback_value ENUM('like', 'dislike') NOT NULL,
            created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
            updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
            PRIMARY KEY (id),
            UNIQUE KEY uniq_question_editorial_feedback_user (question_id, user_id, content_type),
            INDEX idx_question_editorial_feedback_question (question_id),
            INDEX idx_question_editorial_feedback_user (user_id)
        ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci"
    );
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
    $feedback = [
        'teacher' => null,
        'detailed' => null,
    ];

    if ($userId !== '') {
        $stmt = $db->prepare(
            "SELECT content_type, feedback_value
             FROM question_editorial_feedback
             WHERE question_id = :question_id
               AND user_id = :user_id"
        );
        $stmt->bindValue(':question_id', $questionId, PDO::PARAM_INT);
        $stmt->bindValue(':user_id', $userId);
        $stmt->execute();

        foreach (($stmt->fetchAll(PDO::FETCH_ASSOC) ?: []) as $row) {
            $contentType = (string) ($row['content_type'] ?? '');
            if (isset($feedback[$contentType])) {
                $feedback[$contentType] = (string) ($row['feedback_value'] ?? '');
            }
        }
    }

    $counts = [
        'teacher' => ['likes' => 0, 'dislikes' => 0],
        'detailed' => ['likes' => 0, 'dislikes' => 0],
    ];

    $countStmt = $db->prepare(
        "SELECT
            content_type,
            SUM(CASE WHEN feedback_value = 'like' THEN 1 ELSE 0 END) AS likes,
            SUM(CASE WHEN feedback_value = 'dislike' THEN 1 ELSE 0 END) AS dislikes
         FROM question_editorial_feedback
         WHERE question_id = :question_id
         GROUP BY content_type"
    );
    $countStmt->bindValue(':question_id', $questionId, PDO::PARAM_INT);
    $countStmt->execute();

    foreach (($countStmt->fetchAll(PDO::FETCH_ASSOC) ?: []) as $row) {
        $contentType = (string) ($row['content_type'] ?? '');
        if (isset($counts[$contentType])) {
            $counts[$contentType] = [
                'likes' => (int) ($row['likes'] ?? 0),
                'dislikes' => (int) ($row['dislikes'] ?? 0),
            ];
        }
    }

    return [
        'feedback' => $feedback,
        'counts' => $counts,
    ];
}

try {
    $database = new Database();
    $db = $database->getConnection();
    ensureQuestionEditorialFeedbackTable($db);

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
        $deleteStmt = $db->prepare(
            "DELETE FROM question_editorial_feedback
             WHERE question_id = :question_id
               AND user_id = :user_id
               AND content_type = :content_type"
        );
        $deleteStmt->bindValue(':question_id', $questionId, PDO::PARAM_INT);
        $deleteStmt->bindValue(':user_id', $userId);
        $deleteStmt->bindValue(':content_type', $contentType);
        $deleteStmt->execute();
    } else {
        $upsertStmt = $db->prepare(
            "INSERT INTO question_editorial_feedback (
                question_id,
                user_id,
                content_type,
                feedback_value
            ) VALUES (
                :question_id,
                :user_id,
                :content_type,
                :feedback_value
            )
            ON DUPLICATE KEY UPDATE
                feedback_value = VALUES(feedback_value),
                updated_at = CURRENT_TIMESTAMP"
        );
        $upsertStmt->bindValue(':question_id', $questionId, PDO::PARAM_INT);
        $upsertStmt->bindValue(':user_id', $userId);
        $upsertStmt->bindValue(':content_type', $contentType);
        $upsertStmt->bindValue(':feedback_value', $feedbackValue);
        $upsertStmt->execute();
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

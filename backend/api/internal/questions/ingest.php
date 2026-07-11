<?php

declare(strict_types=1);

require_once __DIR__ . '/../../../config/database.php';
require_once __DIR__ . '/../../../modules/questions/services/PrivateQuestionIngestionService.php';
require_once __DIR__ . '/../../../shared/responses/Response.php';

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    Response::error('Use POST para a ingestao privada.', 405, null, 'method_not_allowed');
}

try {
    $rawBody = file_get_contents('php://input');
    if (!is_string($rawBody)) {
        throw new InvalidArgumentException('Nao foi possivel ler o payload de ingestao.');
    }
    $db = (new Database())->getConnection();
    $result = (new PrivateQuestionIngestionService($db))->enqueueFromHttpRequest($rawBody, $_SERVER);
    http_response_code(202);
    Response::success($result, 'Ingestao enfileirada para processamento local.');
} catch (InvalidArgumentException $exception) {
    Response::badRequest($exception->getMessage());
} catch (DomainException $exception) {
    Response::forbidden($exception->getMessage());
} catch (Throwable $exception) {
    error_log('[private_question_ingestion] ' . $exception->getMessage());
    Response::serverError('Nao foi possivel enfileirar a ingestao.', $exception);
}

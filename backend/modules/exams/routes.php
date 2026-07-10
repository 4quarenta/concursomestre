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

require_once __DIR__ . '/controllers/ExamsController.php';
require_once __DIR__ . '/services/ExamsService.php';
require_once __DIR__ . '/repositories/ExamsRepository.php';
require_once __DIR__ . '/validators/ExamsValidator.php';
require_once __DIR__ . '/../../shared/auth/request_auth.php';
require_once __DIR__ . '/../../shared/responses/Response.php';

function readExamsJsonRequestBody(): array
{
    $raw = file_get_contents('php://input');
    if (!is_string($raw) || trim($raw) === '') {
        return [];
    }

    $decoded = json_decode($raw, true);
    if (!is_array($decoded)) {
        throw new InvalidArgumentException('Payload JSON inválido.');
    }

    return $decoded;
}

function buildExamsController(PDO $db): ExamsController
{
    return new ExamsController(new ExamsService(new ExamsRepository($db), new ExamsValidator(), $db));
}

function requireExamBankAdminUser(): array
{
    try {
        $user = verifyAuthenticatedUserPayload();
    } catch (RuntimeException $exception) {
        Response::unauthorized($exception->getMessage());
    }

    $role = strtolower((string) ($user['role'] ?? ''));
    if (!in_array($role, ['admin', 'staff'], true)) {
        Response::forbidden('Apenas administradores e equipe podem gerenciar o Banco de Provas.');
    }
    return $user;
}

function readExamRouteId(string $key = 'id'): int
{
    static $payload = null;
    if ($payload === null) {
        $payload = [];
        $contentType = strtolower((string) ($_SERVER['CONTENT_TYPE'] ?? ''));
        if (str_contains($contentType, 'application/json')) {
            try {
                $payload = readExamsJsonRequestBody();
            } catch (Throwable $exception) {
                Response::badRequest($exception->getMessage());
            }
        }
    }

    return (int) ($payload[$key] ?? $_POST[$key] ?? $_GET[$key] ?? 0);
}

function handleExamsListRoute(PDO $db): void
{
    requireExamBankAdminUser();
    buildExamsController($db)->list();
}

function handleExamsShowRoute(PDO $db): void
{
    requireExamBankAdminUser();
    $id = isset($_GET['id']) ? (int) $_GET['id'] : 0;
    if ($id <= 0) {
        Response::badRequest('Informe a prova.');
    }
    buildExamsController($db)->show($id);
}

function handleExamsSaveRoute(PDO $db): void
{
    $user = requireExamBankAdminUser();
    buildExamsController($db)->save(readExamsJsonRequestBody(), $user);
}

function handleExamsDeleteRoute(PDO $db): void
{
    requireExamBankAdminUser();
    $payload = readExamsJsonRequestBody();
    $id = (int) ($payload['id'] ?? $_GET['id'] ?? 0);
    if ($id <= 0) {
        Response::badRequest('Informe a prova.');
    }
    buildExamsController($db)->archive($id);
}

function handleExamsFileUploadRoute(PDO $db): void
{
    $user = requireExamBankAdminUser();
    buildExamsController($db)->uploadFile($user);
}

function handleExamsFilesListRoute(PDO $db): void
{
    requireExamBankAdminUser();
    $examId = isset($_GET['exam_id']) ? (int) $_GET['exam_id'] : (int) ($_GET['id'] ?? 0);
    if ($examId <= 0) {
        Response::badRequest('Informe a prova.');
    }
    buildExamsController($db)->listFiles($examId);
}

function handleExamsFileDeleteRoute(PDO $db): void
{
    requireExamBankAdminUser();
    $examId = readExamRouteId('exam_id');
    $fileId = readExamRouteId('file_id');
    if ($examId <= 0 || $fileId <= 0) {
        Response::badRequest('Informe a prova e o arquivo.');
    }
    buildExamsController($db)->archiveFile($examId, $fileId);
}

function handleExamsExtractionStartRoute(PDO $db): void
{
    $user = requireExamBankAdminUser();
    buildExamsController($db)->startExtraction(readExamsJsonRequestBody(), $user);
}

function handleExamsExtractionShowRoute(PDO $db): void
{
    requireExamBankAdminUser();
    $id = isset($_GET['id']) ? (int) $_GET['id'] : 0;
    if ($id <= 0) {
        Response::badRequest('Informe a extração.');
    }
    buildExamsController($db)->showExtraction($id);
}

function handleExamsExtractionReviewRoute(PDO $db): void
{
    $user = requireExamBankAdminUser();
    $payload = readExamsJsonRequestBody();
    $id = (int) ($payload['id'] ?? $_GET['id'] ?? 0);
    if ($id <= 0) {
        Response::badRequest('Informe a extração.');
    }
    buildExamsController($db)->reviewExtraction($id, $payload, $user);
}

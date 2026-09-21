<?php

declare(strict_types=1);

require_once __DIR__ . '/../../config/cors.php';
require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../../modules/users/repositories/UsersRepository.php';
require_once __DIR__ . '/../../shared/auth/request_auth.php';
require_once __DIR__ . '/../../shared/responses/Response.php';

/**
 * Solicita exclusao da propria conta no app mobile.
 * Usa reautenticacao pela senha atual em vez do reCAPTCHA web.
 */
try {
    $authenticated = verifyAuthenticatedUserPayload();
    $userId = trim((string) ($authenticated['user_id'] ?? ''));
    if ($userId === '') {
        throw new RuntimeException('Sessao invalida. Faca login novamente.');
    }

    $rawBody = file_get_contents('php://input');
    $body = is_string($rawBody) ? json_decode($rawBody, true) : null;
    if (!is_array($body)) {
        throw new InvalidArgumentException('Payload invalido.');
    }

    $currentPassword = (string) (($body['current_password'] ?? '') ?: ($body['currentPassword'] ?? ''));
    $reason = trim((string) ($body['reason'] ?? ''));
    if ($currentPassword === '' || $reason === '') {
        throw new InvalidArgumentException('Informe a senha atual e o motivo da exclusao.');
    }

    $database = new Database();
    $db = $database->getConnection();
    $repository = new UsersRepository($db);

    if (!$repository->userExistsById($userId)) {
        throw new OutOfBoundsException('Usuario nao encontrado.');
    }

    $passwordHash = $repository->getPasswordHashById($userId);
    if (!$passwordHash || !password_verify($currentPassword, $passwordHash)) {
        throw new InvalidArgumentException('A senha atual informada esta incorreta.');
    }

    $repository->markDeletionRequested($userId, $reason);
    Response::success([
        'pending' => true,
        'message' => 'Solicitacao de exclusao registrada com sucesso.',
    ], 'Solicitacao de exclusao registrada com sucesso.');
} catch (InvalidArgumentException $e) {
    Response::badRequest($e->getMessage());
} catch (OutOfBoundsException $e) {
    Response::notFound($e->getMessage());
} catch (RuntimeException $e) {
    Response::unauthorized($e->getMessage());
} catch (Throwable $e) {
    Response::serverError('Nao foi possivel solicitar a exclusao da conta.', $e);
}

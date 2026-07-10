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

require_once __DIR__ . '/services/SetupService.php';
require_once __DIR__ . '/../../shared/responses/Response.php';

function readSetupJsonRequestBody(): array
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

function handleSetupStatusRoute(): void
{
    try {
        $service = new SetupService();
        Response::success($service->getStatus(), 'Status da configuracao inicial carregado.');
    } catch (Throwable $e) {
        Response::serverError('Nao foi possivel verificar a configuracao inicial.', $e);
    }
}

function handleSetupInstallRoute(): void
{
    if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'POST') {
        Response::error('Metodo nao permitido.', 405, null, 'method_not_allowed');
    }

    try {
        $payload = readSetupJsonRequestBody();
        $service = new SetupService();
        Response::success($service->install($payload), 'Configuracao inicial concluida.', 201);
    } catch (DomainException $e) {
        Response::error($e->getMessage(), 409, null, 'setup_locked');
    } catch (InvalidArgumentException $e) {
        Response::validationError($e->getMessage());
    } catch (PDOException $e) {
        Response::error('Nao foi possivel conectar/criar o banco com os dados informados.', 422, null, 'database_setup_failed');
    } catch (Throwable $e) {
        Response::serverError('Nao foi possivel concluir a configuracao inicial.', $e);
    }
}

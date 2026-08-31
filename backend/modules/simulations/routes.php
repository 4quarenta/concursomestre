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

require_once __DIR__ . '/controllers/SimulationsController.php';
require_once __DIR__ . '/services/SimulationsService.php';
require_once __DIR__ . '/repositories/SimulationsRepository.php';
require_once __DIR__ . '/validators/SimulationsValidator.php';
require_once __DIR__ . '/../../shared/auth/request_auth.php';
require_once __DIR__ . '/../../shared/responses/Response.php';

/**
 * Le o payload JSON das rotas do dominio simulations.
 *
 * @since 1.0.0
 */
function readSimulationsJsonRequestBody(): array
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

/**
 * Fabrica curta do controller oficial do dominio simulations.
 *
 * @since 1.0.0
 */
function buildSimulationsController(PDO $db): SimulationsController
{
    return new SimulationsController(
        new SimulationsService(
            new SimulationsRepository($db),
            new SimulationsValidator()
        )
    );
}

/**
 * Persiste uma sessao de simulado do usuario autenticado.
 *
 * @since 1.0.0
 */
function handleSimulationsCreateRoute(PDO $db): void
{
    try {
        $authenticatedUserPayload = verifyAuthenticatedUserPayload();
        $requestBody = readSimulationsJsonRequestBody();
        $payload = buildSimulationsController($db)->saveSimulation($requestBody, $authenticatedUserPayload);
        Response::success($payload, 'Simulation saved');
    } catch (InvalidArgumentException $e) {
        Response::validationError($e->getMessage());
    } catch (DomainException $e) {
        Response::forbidden($e->getMessage());
    } catch (RuntimeException $e) {
        Response::unauthorized($e->getMessage());
    } catch (Throwable $e) {
        Response::serverError('Nao foi possivel salvar o simulado.', $e);
    }
}

/**
 * Lista os simulados persistidos do usuario autenticado.
 *
 * @since 1.0.0
 */
function handleSimulationsListRoute(PDO $db): void
{
    try {
        $authenticatedUserPayload = verifyAuthenticatedUserPayload();
        $payload = buildSimulationsController($db)->listSimulations($authenticatedUserPayload);
        Response::success($payload, 'Simulations listed');
    } catch (RuntimeException $e) {
        Response::unauthorized($e->getMessage());
    } catch (Throwable $e) {
        Response::serverError('Nao foi possivel listar os simulados.', $e);
    }
}

/**
 * Alias legado para submissao de simulados completos.
 *
 * @since 1.0.0
 */
function handleSimulationsSubmitRoute(PDO $db): void
{
    handleSimulationsCreateRoute($db);
}

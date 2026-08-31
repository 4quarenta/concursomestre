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

require_once __DIR__ . '/controllers/StudyScheduleController.php';
require_once __DIR__ . '/services/StudyScheduleService.php';
require_once __DIR__ . '/repositories/StudyScheduleRepository.php';
require_once __DIR__ . '/validators/StudyScheduleValidator.php';
require_once __DIR__ . '/../../shared/auth/request_auth.php';
require_once __DIR__ . '/../../shared/responses/Response.php';

function readStudyScheduleJsonRequestBody(): array
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

function buildStudyScheduleController(PDO $db): StudyScheduleController
{
    return new StudyScheduleController(
        new StudyScheduleService(
            new StudyScheduleRepository($db),
            new StudyScheduleValidator()
        )
    );
}

function handleStudyScheduleGetRoute(PDO $db): void
{
    try {
        $payload = verifyAuthenticatedUserPayload();
        Response::success(buildStudyScheduleController($db)->get($payload), 'Cronograma carregado.');
    } catch (DomainException $e) {
        Response::forbidden($e->getMessage());
    } catch (RuntimeException $e) {
        Response::unauthorized($e->getMessage());
    } catch (Throwable $e) {
        Response::serverError('Nao foi possivel carregar o cronograma.', $e);
    }
}

function handleStudyScheduleSaveRoute(PDO $db): void
{
    try {
        $payload = verifyAuthenticatedUserPayload();
        $requestBody = readStudyScheduleJsonRequestBody();
        Response::success(buildStudyScheduleController($db)->save($requestBody, $payload), 'Cronograma salvo.');
    } catch (InvalidArgumentException $e) {
        Response::validationError($e->getMessage());
    } catch (DomainException $e) {
        Response::forbidden($e->getMessage());
    } catch (RuntimeException $e) {
        Response::unauthorized($e->getMessage());
    } catch (Throwable $e) {
        Response::serverError('Nao foi possivel salvar o cronograma.', $e);
    }
}

function handleStudyScheduleDeleteRoute(PDO $db): void
{
    try {
        $payload = verifyAuthenticatedUserPayload();
        Response::success(buildStudyScheduleController($db)->delete($payload), 'Cronograma removido.');
    } catch (DomainException $e) {
        Response::forbidden($e->getMessage());
    } catch (RuntimeException $e) {
        Response::unauthorized($e->getMessage());
    } catch (Throwable $e) {
        Response::serverError('Nao foi possivel remover o cronograma.', $e);
    }
}

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

require_once __DIR__ . '/controllers/ReportsController.php';
require_once __DIR__ . '/services/ReportsService.php';
require_once __DIR__ . '/repositories/ReportsRepository.php';
require_once __DIR__ . '/validators/ReportsValidator.php';
require_once __DIR__ . '/../../shared/auth/request_auth.php';
require_once __DIR__ . '/../../shared/security/AdminSecurity.php';
require_once __DIR__ . '/../../shared/responses/Response.php';
require_once __DIR__ . '/../../shared/middleware/RateLimiter.php';

/**
 * Le o JSON bruto das rotas do modulo de denuncias.
  * @since 1.0.0
 */
function readReportsJsonRequestBody(): array
{
    $rawBody = file_get_contents('php://input');
    if (!is_string($rawBody) || trim($rawBody) === '') {
        return [];
    }

    $decoded = json_decode($rawBody, true);
    if (!is_array($decoded)) {
        throw new InvalidArgumentException('Payload JSON inválido.');
    }

    return $decoded;
}

/**
 * Fabrica curta do controller oficial de denuncias.
  * @since 1.0.0
 */
function buildReportsController(PDO $db): ReportsController
{
    return new ReportsController(
        new ReportsService(
            new ReportsRepository($db),
            new ReportsValidator()
        )
    );
}

/**
 * Ponto de entrada oficial para registro autenticado de denuncias.
  * @since 1.0.0
 */
function handleReportsCreateRoute(PDO $db): void
{
    try {
        RateLimiter::enforceProfile('report_write');
        $authenticatedUserPayload = verifyAuthenticatedUserPayload();
        $requestBody = readReportsJsonRequestBody();
        $result = buildReportsController($db)->createReport($requestBody, $authenticatedUserPayload);

        Response::success($result, (string) ($result['message'] ?? 'Denúncia registrada com sucesso.'));
    } catch (InvalidArgumentException $e) {
        Response::badRequest($e->getMessage());
    } catch (OutOfBoundsException $e) {
        Response::notFound($e->getMessage());
    } catch (RuntimeException $e) {
        $message = $e->getMessage();
        if (str_contains(strtolower($message), 'sess') || str_contains(strtolower($message), 'token')) {
            Response::unauthorized($message);
            return;
        }

        Response::serverError('Não foi possível registrar a denúncia.', $e);
    } catch (Throwable $e) {
        Response::serverError('Não foi possível registrar a denúncia.', $e);
    }
}

/**
 * Ponto de entrada oficial para listagem administrativa de denuncias.
  * @since 1.0.0
 */
function handleReportsListRoute(PDO $db): void
{
    try {
        $adminContext = requireAdminSessionContext($db);
        $adminUserId = (string) ($adminContext['admin_user_id'] ?? '');
        $result = buildReportsController($db)->listReports($adminUserId);

        logAdminAudit($db, $adminUserId, 'reports.list', 'report', null, [
            'count' => count($result),
        ]);

        Response::success($result, 'Denúncias carregadas.');
    } catch (DomainException $e) {
        Response::forbidden($e->getMessage());
    } catch (RuntimeException $e) {
        $message = $e->getMessage();
        if (str_contains(strtolower($message), 'sess') || str_contains(strtolower($message), 'token')) {
            Response::unauthorized($message);
            return;
        }

        Response::serverError('Não foi possível carregar as denúncias.', $e);
    } catch (Throwable $e) {
        Response::serverError('Não foi possível carregar as denúncias.', $e);
    }
}

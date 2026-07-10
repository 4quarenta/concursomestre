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

require_once __DIR__ . '/controllers/FiltersController.php';
require_once __DIR__ . '/services/FiltersService.php';
require_once __DIR__ . '/repositories/FiltersRepository.php';
require_once __DIR__ . '/validators/FiltersValidator.php';
require_once __DIR__ . '/../../shared/security/AdminSecurity.php';
require_once __DIR__ . '/../../shared/responses/Response.php';

/**
 * Ponto de entrada do modulo de filtros/taxonomias para leitura publica.
 *
 * @since 1.0.0
 */
function handleFiltersListRoute(PDO $db): void
{
    try {
        $controller = new FiltersController(
            new FiltersService(
                new FiltersRepository($db),
                new FiltersValidator()
            )
        );

        Response::success($controller->list());
    } catch (Throwable $e) {
        Response::serverError('Nao foi possivel carregar os filtros.', $e);
    }
}

/**
 * Ponto de entrada do modulo de filtros/taxonomias para mutacao administrativa.
 *
 * @since 1.0.0
 */
function handleFiltersSaveRoute(PDO $db): void
{
    try {
        $context = requireAdminSessionContext($db);
        $adminUserId = (string) $context['admin_user_id'];
        $data = json_decode(file_get_contents('php://input'), true);
        if (!$data) {
            Response::badRequest('Dados invalidos');
        }

        $controller = new FiltersController(
            new FiltersService(
                new FiltersRepository($db),
                new FiltersValidator()
            )
        );

        $payload = $controller->save($data);

        logAdminAudit(
            $db,
            $adminUserId,
            (string) $payload['audit_action'],
            'filter',
            (string) $payload['audit_entity_id'],
            $payload['audit_metadata'] ?? []
        );

        Response::success(['id' => $payload['id']], (string) $payload['message']);
    } catch (RuntimeException $e) {
        $code = $e->getCode() === 409 ? 409 : 400;
        Response::error($e->getMessage(), $code);
    } catch (InvalidArgumentException $e) {
        Response::badRequest($e->getMessage());
    } catch (Throwable $e) {
        Response::serverError('Nao foi possivel salvar o filtro.', $e);
    }
}

/**
 * Ponto de entrada do modulo de filtros/taxonomias para exclusao administrativa.
 *
 * @since 1.0.0
 */
function handleFiltersDeleteRoute(PDO $db): void
{
    try {
        $context = requireAdminSessionContext($db);
        $adminUserId = (string) $context['admin_user_id'];
        $id = isset($_GET['id']) ? (int) $_GET['id'] : 0;

        $controller = new FiltersController(
            new FiltersService(
                new FiltersRepository($db),
                new FiltersValidator()
            )
        );

        $payload = $controller->delete($id);

        logAdminAudit($db, $adminUserId, (string) $payload['audit_action'], 'filter', (string) $payload['audit_entity_id']);
        Response::success([], (string) $payload['message']);
    } catch (InvalidArgumentException $e) {
        Response::badRequest($e->getMessage());
    } catch (Throwable $e) {
        Response::serverError('Nao foi possivel excluir o filtro.', $e);
    }
}

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
 * Lista administrativa paginada. O endpoint e separado da lista publica para
 * impedir que a biblioteca de filtros hidrate milhares de registros no app.
 */
function handleAdminFiltersListRoute(PDO $db): void
{
    try {
        requireAdminSessionContext($db);
        $page = max(1, (int) ($_GET['page'] ?? 1));
        $perPage = min(100, max(10, (int) ($_GET['per_page'] ?? $_GET['perPage'] ?? 50)));
        $type = trim((string) ($_GET['type'] ?? 'all'));
        $search = mb_substr(trim((string) ($_GET['search'] ?? '')), 0, 120, 'UTF-8');

        $controller = new FiltersController(
            new FiltersService(
                new FiltersRepository($db),
                new FiltersValidator()
            )
        );

        $id = isset($_GET['id']) ? (int) $_GET['id'] : 0;
        if ($id > 0) {
            Response::success($controller->getAdminDetail($id));
        }

        Response::success($controller->listPage($page, $perPage, $type, $search));
    } catch (InvalidArgumentException $e) {
        Response::badRequest($e->getMessage());
    } catch (Throwable $e) {
        Response::serverError('Nao foi possivel carregar os filtros administrativos.', $e);
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

        $controller = new FiltersController(
            new FiltersService(
                new FiltersRepository($db),
                new FiltersValidator()
            )
        );

        if (strtoupper((string) ($_SERVER['REQUEST_METHOD'] ?? 'GET')) === 'POST') {
            $data = json_decode((string) file_get_contents('php://input'), true);
            $payload = $controller->deleteMany(is_array($data) ? ($data['ids'] ?? null) : null);
            logAdminAudit(
                $db,
                $adminUserId,
                (string) $payload['audit_action'],
                'filter',
                (string) $payload['audit_entity_id'],
                $payload['audit_metadata'] ?? []
            );
            Response::success([
                'deletedIds' => $payload['deletedIds'],
                'deletedCount' => $payload['deletedCount'],
            ], (string) $payload['message']);
        }

        $id = isset($_GET['id']) ? (int) $_GET['id'] : 0;
        $payload = $controller->delete($id);

        logAdminAudit($db, $adminUserId, (string) $payload['audit_action'], 'filter', (string) $payload['audit_entity_id']);
        Response::success([], (string) $payload['message']);
    } catch (RuntimeException $e) {
        if ($e->getCode() === 409) {
            Response::conflict($e->getMessage());
        }
        Response::badRequest($e->getMessage());
    } catch (InvalidArgumentException $e) {
        Response::badRequest($e->getMessage());
    } catch (Throwable $e) {
        Response::serverError('Nao foi possivel excluir o filtro.', $e);
    }
}

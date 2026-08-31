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

require_once __DIR__ . '/controllers/RankingsController.php';
require_once __DIR__ . '/services/RankingsService.php';
require_once __DIR__ . '/repositories/RankingsRepository.php';
require_once __DIR__ . '/validators/RankingsValidator.php';
require_once __DIR__ . '/../../shared/auth/JWTAuth.php';
require_once __DIR__ . '/../../shared/security/AdminSecurity.php';
require_once __DIR__ . '/../../shared/responses/Response.php';

/**
 * Resolve se a requisicao autenticada pertence a um administrador sem exigir login.
 *
 * @since 1.0.0
 */
function resolveOptionalRankingAdminStatus(PDO $db): bool
{
    $headers = getallheaders();
    $token = $headers['Authorization'] ?? $headers['authorization'] ?? $headers['X-Auth-Token'] ?? '';
    if (strpos((string) $token, 'Bearer ') === 0) {
        $token = substr((string) $token, 7);
    }

    if ($token === '') {
        return false;
    }

    $payload = JWTAuth::verify((string) $token);
    if (!$payload || !isset($payload['user_id'])) {
        return false;
    }

    $repository = new RankingsRepository($db);
    return in_array((string) $repository->findUserRoleById((string) $payload['user_id']), ['admin', 'staff'], true);
}

/**
 * Fabrica o controller oficial de rankings.
 *
 * @since 1.0.0
 */
function buildRankingsController(PDO $db): RankingsController
{
    return new RankingsController(
        new RankingsService(
            $db,
            new RankingsRepository($db),
            new RankingsValidator()
        )
    );
}

/**
 * Lista rankings publicos.
 *
 * @since 1.0.0
 */
function handleRankingsListRoute(PDO $db): void
{
    try {
        $payload = buildRankingsController($db)->list(resolveOptionalRankingAdminStatus($db));
        Response::success($payload);
    } catch (Throwable $e) {
        Response::serverError('Nao foi possivel carregar os rankings.', $e);
    }
}

/**
 * Cria um ranking novo.
 *
 * @since 1.0.0
 */
function handleRankingsCreateRoute(PDO $db): void
{
    try {
        $authUser = AuthMiddleware::requireAuth();
        $data = json_decode(file_get_contents('php://input'), true) ?: [];
        $isAdmin = in_array((string) ($authUser['role'] ?? ''), ['admin', 'staff'], true);
        $payload = buildRankingsController($db)->create($data, $isAdmin, (string) ($authUser['user_id'] ?? ''));
        Response::success(['id' => $payload['id']], (string) $payload['message']);
    } catch (InvalidArgumentException $e) {
        Response::badRequest($e->getMessage());
    } catch (Throwable $e) {
        Response::serverError('Unable to create ranking.', $e);
    }
}

/**
 * Registra participacao em ranking.
 *
 * @since 1.0.0
 */
function handleRankingsJoinRoute(PDO $db): void
{
    try {
        $authUser = AuthMiddleware::requireAuth();
        $data = json_decode(file_get_contents('php://input'), true) ?: [];
        $data['userId'] = (string) ($authUser['user_id'] ?? '');
        $payload = buildRankingsController($db)->join($data);
        Response::success(['id' => $payload['id']], (string) $payload['message']);
    } catch (InvalidArgumentException $e) {
        Response::badRequest($e->getMessage());
    } catch (OutOfBoundsException $e) {
        Response::notFound($e->getMessage());
    } catch (Throwable $e) {
        Response::serverError('Unable to join ranking.', $e);
    }
}

/**
 * Modera ranking via painel admin.
 *
 * @since 1.0.0
 */
function handleRankingsModerateRoute(PDO $db): void
{
    try {
        $context = requireAdminSessionContext($db);
        $adminUserId = (string) $context['admin_user_id'];
        $data = json_decode(file_get_contents('php://input'), true) ?: [];
        $rankingId = trim((string) ($data['id'] ?? ''));
        $status = trim((string) ($data['status'] ?? ''));

        buildRankingsController($db)->moderate($rankingId, $status);

        logAdminAudit($db, $adminUserId, 'ranking.moderate', 'ranking', $rankingId, ['status' => $status]);
        Response::success([], 'Status do ranking atualizado com sucesso.');
    } catch (InvalidArgumentException $e) {
        Response::validationError($e->getMessage());
    } catch (OutOfBoundsException $e) {
        Response::notFound($e->getMessage());
    } catch (Throwable $e) {
        Response::serverError('Nao foi possivel moderar o ranking.', $e);
    }
}

/**
 * Atualiza um ranking via painel admin.
 *
 * @since 1.0.0
 */
function handleRankingsUpdateRoute(PDO $db): void
{
    try {
        $context = requireAdminSessionContext($db);
        $adminUserId = (string) $context['admin_user_id'];
        $data = json_decode(file_get_contents('php://input'), true) ?: [];
        $rankingId = trim((string) ($data['id'] ?? ''));

        buildRankingsController($db)->update($data);

        logAdminAudit($db, $adminUserId, 'ranking.update', 'ranking', $rankingId, [
            'name' => trim((string) ($data['name'] ?? '')),
            'institution' => trim((string) ($data['institution'] ?? '')),
        ]);
        Response::success([], 'Ranking atualizado com sucesso.');
    } catch (InvalidArgumentException $e) {
        Response::validationError($e->getMessage());
    } catch (OutOfBoundsException $e) {
        Response::notFound($e->getMessage());
    } catch (Throwable $e) {
        Response::serverError('Nao foi possivel atualizar o ranking.', $e);
    }
}

/**
 * Exclui ranking via painel admin.
 *
 * @since 1.0.0
 */
function handleRankingsDeleteRoute(PDO $db): void
{
    try {
        $context = requireAdminSessionContext($db);
        $adminUserId = (string) $context['admin_user_id'];
        $data = json_decode(file_get_contents('php://input'), true) ?: [];
        $rankingId = trim((string) ($data['id'] ?? ($_GET['id'] ?? '')));

        $payload = buildRankingsController($db)->delete($rankingId);

        logAdminAudit($db, $adminUserId, 'ranking.delete', 'ranking', $rankingId, [
            'name' => $payload['name'] ?? '',
        ]);
        Response::success([], 'Ranking excluido com sucesso.');
    } catch (InvalidArgumentException $e) {
        Response::validationError($e->getMessage());
    } catch (OutOfBoundsException $e) {
        Response::notFound($e->getMessage());
    } catch (Throwable $e) {
        if ($db->inTransaction()) {
            $db->rollBack();
        }
        Response::serverError('Nao foi possivel excluir o ranking.', $e);
    }
}

/**
 * Instala o schema de rankings.
 *
 * @since 1.0.0
 */
function handleRankingsInstallRoute(PDO $db): void
{
    try {
        requireAdminSessionContext($db);
        $payload = buildRankingsController($db)->install();
        Response::success($payload, 'Ranking installation finished.');
    } catch (DomainException $e) {
        Response::forbidden($e->getMessage());
    } catch (RuntimeException $e) {
        Response::unauthorized($e->getMessage());
    } catch (Throwable $e) {
        Response::serverError('Nao foi possivel instalar o schema de rankings.', $e);
    }
}

/**
 * Migra o schema de rankings.
 *
 * @since 1.0.0
 */
function handleRankingsMigrateRoute(PDO $db): void
{
    try {
        requireAdminSessionContext($db);
        $payload = buildRankingsController($db)->migrate();
        Response::success($payload, 'Ranking migration finished.');
    } catch (DomainException $e) {
        Response::forbidden($e->getMessage());
    } catch (RuntimeException $e) {
        Response::unauthorized($e->getMessage());
    } catch (Throwable $e) {
        Response::serverError('Nao foi possivel migrar o schema de rankings.', $e);
    }
}

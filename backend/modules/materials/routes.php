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

require_once __DIR__ . '/controllers/MaterialsController.php';
require_once __DIR__ . '/services/MaterialsService.php';
require_once __DIR__ . '/repositories/MaterialsRepository.php';
require_once __DIR__ . '/validators/MaterialsValidator.php';
require_once __DIR__ . '/../../config/env.php';
require_once __DIR__ . '/../../shared/auth/AuthSession.php';
require_once __DIR__ . '/../../shared/security/AdminSecurity.php';
require_once __DIR__ . '/../../shared/responses/Response.php';
require_once __DIR__ . '/../../shared/middleware/RateLimiter.php';

/**
 * Headers especificos para respostas binarias do dominio de materiais.
 * Mantem CORS e credenciais funcionando para abrir/baixar PDFs protegidos.
 *
 * @since 1.0.0
 */
function sendMaterialsBinaryCorsHeaders(): void
{
    $allowedOrigin = resolveAllowedCorsOrigin($_SERVER['HTTP_ORIGIN'] ?? null);
    if ($allowedOrigin !== null) {
        header("Access-Control-Allow-Origin: {$allowedOrigin}");
        header('Vary: Origin');
        header('Access-Control-Allow-Credentials: true');
    }

    header('Access-Control-Allow-Methods: GET, OPTIONS');
    header('Access-Control-Allow-Headers: Authorization, X-Auth-Token, Content-Type');

    if (($_SERVER['REQUEST_METHOD'] ?? '') === 'OPTIONS') {
        http_response_code(204);
        exit();
    }
}

/**
 * Fallback padronizado para erros durante abertura/download de materiais binarios.
 *
 * @since 1.0.0
 */
function sendMaterialsBinaryJsonError(int $statusCode, string $message): void
{
    while (ob_get_level() > 0) {
        ob_end_clean();
    }

    http_response_code($statusCode);
    header('Content-Type: application/json; charset=UTF-8');
    echo json_encode([
        'success' => false,
        'message' => $message,
    ], JSON_UNESCAPED_UNICODE);
    exit();
}

/**
 * Emite o payload binario final de um PDF protegido com o content-disposition apropriado.
 *
 * @since 1.0.0
 */
function sendMaterialsPdfPayload(array $payload): void
{
    while (ob_get_level() > 0) {
        ob_end_clean();
    }

    $disposition = ($payload['disposition'] ?? 'inline') === 'attachment' ? 'attachment' : 'inline';
    $filename = (string) ($payload['filename'] ?? 'material.pdf');

    header('Content-Type: ' . ($payload['contentType'] ?? 'application/pdf'));
    header('Content-Disposition: ' . $disposition . '; filename="' . $filename . '"');
    header('Cache-Control: private, max-age=0, must-revalidate');
    header('Pragma: public');

    echo (string) ($payload['content'] ?? '');
    exit();
}

/**
 * Monta o controller do dominio de materiais.
 *
 * @since 1.0.0
 */
function buildMaterialsController(PDO $db): MaterialsController
{
    return new MaterialsController(
        new MaterialsService(
            $db,
            new MaterialsRepository($db),
            new MaterialsValidator()
        )
    );
}

/**
 * Resolve o usuario autenticado de forma opcional para a listagem publica.
 * Admin ve tudo; usuario comum ve materiais aprovados e os seus proprios.
 *
 * @since 1.0.0
 */
function resolveOptionalMaterialsViewer(PDO $db): array
{
    ensureAuthTables($db);
    $token = getBearerTokenFromRequest();
    if ($token === '') {
        return [
            'user_id' => null,
            'is_admin' => false,
        ];
    }

    $payload = verifyAuthenticatedSession($db, $token);
    if (!$payload || empty($payload['user_id'])) {
        return [
            'user_id' => null,
            'is_admin' => false,
        ];
    }

    return [
        'user_id' => (string) $payload['user_id'],
        'is_admin' => (($payload['role'] ?? '') === 'admin'),
    ];
}

/**
 * Resolve o usuario autenticado obrigatorio para mutacoes do dominio.
 *
 * @since 1.0.0
 */
function requireMaterialsAuthPayload(PDO $db): array
{
    ensureAuthTables($db);
    $token = getBearerTokenFromRequest();
    if ($token === '') {
        Response::unauthorized('No token provided');
    }

    $payload = verifyAuthenticatedSession($db, $token);
    if (!$payload || empty($payload['user_id'])) {
        Response::unauthorized('Invalid or expired token');
    }

    return $payload;
}

/**
 * Lista os materiais visiveis no marketplace.
 *
 * @since 1.0.0
 */
function handleMaterialsListRoute(PDO $db): void
{
    try {
        $viewer = resolveOptionalMaterialsViewer($db);
        $payload = buildMaterialsController($db)->list(
            $viewer['user_id'],
            $viewer['is_admin'],
            (int) ($_GET['limit'] ?? 24),
            isset($_GET['cursor']) ? (string) $_GET['cursor'] : null
        );

        Response::success($payload);
    } catch (InvalidArgumentException $e) {
        Response::badRequest($e->getMessage());
    } catch (Throwable $e) {
        Response::serverError('Nao foi possivel carregar os materiais.', $e);
    }
}

/**
 * Exponibiliza a biblioteca de materiais comprados do usuario autenticado.
 * O endpoint ainda pode chegar por `api/users/materials.php`, mas a regra fica no modulo.
 *
 * @since 1.0.0
 */
function handleMaterialsPurchasedLibraryRoute(PDO $db): void
{
    try {
        $payload = requireMaterialsAuthPayload($db);
        $authenticatedUserId = (string) ($payload['user_id'] ?? '');
        $requestedUserId = trim((string) ($_GET['userId'] ?? ''));
        $isAdmin = (($payload['role'] ?? '') === 'admin');

        $result = buildMaterialsController($db)->listPurchasedMaterials(
            $authenticatedUserId,
            $requestedUserId,
            $isAdmin
        );

        Response::success($result, 'Biblioteca de materiais carregada com sucesso.');
    } catch (InvalidArgumentException $e) {
        Response::badRequest($e->getMessage());
    } catch (RuntimeException $e) {
        Response::error($e->getMessage(), 403);
    } catch (Throwable $e) {
        Response::serverError('Nao foi possivel carregar a biblioteca de materiais.', $e);
    }
}

/**
 * Lista os marcadores do leitor para o material atual.
 *
 * @since 1.0.0
 */
function handleMaterialsBookmarksListRoute(PDO $db): void
{
    try {
        $payload = requireMaterialsAuthPayload($db);
        $requestedUserId = trim((string) ($_GET['user_id'] ?? ''));
        $materialId = trim((string) ($_GET['material_id'] ?? ''));
        $isAdmin = (($payload['role'] ?? '') === 'admin');

        $result = buildMaterialsController($db)->listBookmarks(
            (string) $payload['user_id'],
            $requestedUserId,
            $materialId,
            $isAdmin
        );

        Response::success($result, 'Marcadores carregados com sucesso.');
    } catch (InvalidArgumentException $e) {
        Response::badRequest($e->getMessage());
    } catch (OutOfBoundsException $e) {
        Response::notFound($e->getMessage());
    } catch (RuntimeException $e) {
        Response::error($e->getMessage(), 403);
    } catch (Throwable $e) {
        Response::serverError('Nao foi possivel carregar os marcadores.', $e);
    }
}

/**
 * Salva um novo marcador do leitor.
 *
 * @since 1.0.0
 */
function handleMaterialsBookmarkCreateRoute(PDO $db): void
{
    try {
        $payload = requireMaterialsAuthPayload($db);
        $data = json_decode(file_get_contents('php://input'), true) ?: [];
        $result = buildMaterialsController($db)->createBookmark((string) $payload['user_id'], $data);

        Response::success($result, 'Marcador salvo com sucesso.', 201);
    } catch (InvalidArgumentException $e) {
        Response::badRequest($e->getMessage());
    } catch (OutOfBoundsException $e) {
        Response::notFound($e->getMessage());
    } catch (RuntimeException $e) {
        Response::error($e->getMessage(), 403);
    } catch (Throwable $e) {
        Response::serverError('Nao foi possivel salvar o marcador.', $e);
    }
}

/**
 * Remove um marcador do usuario autenticado.
 *
 * @since 1.0.0
 */
function handleMaterialsBookmarkDeleteRoute(PDO $db): void
{
    try {
        $payload = requireMaterialsAuthPayload($db);
        $bookmarkId = $_GET['id'] ?? 0;
        $result = buildMaterialsController($db)->deleteBookmark((string) $payload['user_id'], (int) $bookmarkId);

        Response::success($result, 'Marcador removido com sucesso.');
    } catch (InvalidArgumentException $e) {
        Response::badRequest($e->getMessage());
    } catch (OutOfBoundsException $e) {
        Response::notFound($e->getMessage());
    } catch (RuntimeException $e) {
        Response::error($e->getMessage(), 403);
    } catch (Throwable $e) {
        Response::serverError('Nao foi possivel remover o marcador.', $e);
    }
}

/**
 * Lista destaques do leitor para o material informado.
 *
 * @since 1.0.0
 */
function handleMaterialsHighlightsListRoute(PDO $db): void
{
    try {
        $payload = requireMaterialsAuthPayload($db);
        $requestedUserId = trim((string) ($_GET['user_id'] ?? ''));
        $materialId = trim((string) ($_GET['material_id'] ?? ''));
        $isAdmin = (($payload['role'] ?? '') === 'admin');

        $result = buildMaterialsController($db)->listHighlights(
            (string) $payload['user_id'],
            $requestedUserId,
            $materialId,
            $isAdmin
        );

        Response::success($result, 'Destaques carregados com sucesso.');
    } catch (InvalidArgumentException $e) {
        Response::badRequest($e->getMessage());
    } catch (OutOfBoundsException $e) {
        Response::notFound($e->getMessage());
    } catch (RuntimeException $e) {
        Response::error($e->getMessage(), 403);
    } catch (Throwable $e) {
        Response::serverError('Nao foi possivel carregar os destaques.', $e);
    }
}

/**
 * Salva um destaque do leitor.
 *
 * @since 1.0.0
 */
function handleMaterialsHighlightCreateRoute(PDO $db): void
{
    try {
        $payload = requireMaterialsAuthPayload($db);
        $data = json_decode(file_get_contents('php://input'), true) ?: [];
        $result = buildMaterialsController($db)->createHighlight((string) $payload['user_id'], $data);

        Response::success($result, 'Destaque salvo com sucesso.', 201);
    } catch (InvalidArgumentException $e) {
        Response::badRequest($e->getMessage());
    } catch (OutOfBoundsException $e) {
        Response::notFound($e->getMessage());
    } catch (RuntimeException $e) {
        Response::error($e->getMessage(), 403);
    } catch (Throwable $e) {
        Response::serverError('Nao foi possivel salvar o destaque.', $e);
    }
}

/**
 * Remove um destaque do usuario autenticado.
 *
 * @since 1.0.0
 */
function handleMaterialsHighlightDeleteRoute(PDO $db): void
{
    try {
        $payload = requireMaterialsAuthPayload($db);
        $highlightId = $_GET['id'] ?? 0;
        $result = buildMaterialsController($db)->deleteHighlight((string) $payload['user_id'], (int) $highlightId);

        Response::success($result, 'Destaque removido com sucesso.');
    } catch (InvalidArgumentException $e) {
        Response::badRequest($e->getMessage());
    } catch (OutOfBoundsException $e) {
        Response::notFound($e->getMessage());
    } catch (RuntimeException $e) {
        Response::error($e->getMessage(), 403);
    } catch (Throwable $e) {
        Response::serverError('Nao foi possivel remover o destaque.', $e);
    }
}

/**
 * Le a anotacao do material para o usuario autenticado.
 *
 * @since 1.0.0
 */
function handleMaterialsNoteGetRoute(PDO $db): void
{
    try {
        $payload = requireMaterialsAuthPayload($db);
        $requestedUserId = trim((string) ($_GET['user_id'] ?? ''));
        $materialId = trim((string) ($_GET['material_id'] ?? ''));
        $isAdmin = (($payload['role'] ?? '') === 'admin');

        $result = buildMaterialsController($db)->getMaterialNote(
            (string) $payload['user_id'],
            $requestedUserId,
            $materialId,
            $isAdmin
        );

        Response::success($result, 'Anotacao carregada com sucesso.');
    } catch (InvalidArgumentException $e) {
        Response::badRequest($e->getMessage());
    } catch (OutOfBoundsException $e) {
        Response::notFound($e->getMessage());
    } catch (RuntimeException $e) {
        Response::error($e->getMessage(), 403);
    } catch (Throwable $e) {
        Response::serverError('Nao foi possivel carregar a anotacao.', $e);
    }
}

/**
 * Salva a anotacao do material para o usuario autenticado.
 *
 * @since 1.0.0
 */
function handleMaterialsNoteSaveRoute(PDO $db): void
{
    try {
        $payload = requireMaterialsAuthPayload($db);
        $data = json_decode(file_get_contents('php://input'), true) ?: [];
        $result = buildMaterialsController($db)->saveMaterialNote((string) $payload['user_id'], $data);

        Response::success($result, 'Anotacao salva com sucesso.');
    } catch (InvalidArgumentException $e) {
        Response::badRequest($e->getMessage());
    } catch (OutOfBoundsException $e) {
        Response::notFound($e->getMessage());
    } catch (RuntimeException $e) {
        Response::error($e->getMessage(), 403);
    } catch (Throwable $e) {
        Response::serverError('Nao foi possivel salvar a anotacao.', $e);
    }
}

/**
 * Abre o PDF protegido para visualizacao inline com marca d'agua de propriedade.
 *
 * @since 1.0.0
 */
function handleMaterialsAccessRoute(PDO $db): void
{
    sendMaterialsBinaryCorsHeaders();

    try {
        $payload = requireMaterialsAuthPayload($db);
        $materialId = trim((string) ($_GET['id'] ?? ''));
        $result = buildMaterialsController($db)->buildProtectedAccessPdf((string) $payload['user_id'], $materialId);

        sendMaterialsPdfPayload($result);
    } catch (InvalidArgumentException $e) {
        sendMaterialsBinaryJsonError(400, $e->getMessage());
    } catch (OutOfBoundsException $e) {
        sendMaterialsBinaryJsonError(404, $e->getMessage());
    } catch (RuntimeException $e) {
        sendMaterialsBinaryJsonError(403, $e->getMessage());
    } catch (Throwable $e) {
        sendMaterialsBinaryJsonError(500, 'Erro interno ao abrir o material.');
    }
}

/**
 * Baixa o PDF protegido com marca d'agua reforcada para rastreio.
 *
 * @since 1.0.0
 */
function handleMaterialsDownloadRoute(PDO $db): void
{
    sendMaterialsBinaryCorsHeaders();

    try {
        $payload = requireMaterialsAuthPayload($db);
        $materialId = trim((string) ($_GET['material_id'] ?? ''));
        $result = buildMaterialsController($db)->buildProtectedDownloadPdf((string) $payload['user_id'], $materialId);

        sendMaterialsPdfPayload($result);
    } catch (InvalidArgumentException $e) {
        sendMaterialsBinaryJsonError(400, $e->getMessage());
    } catch (OutOfBoundsException $e) {
        sendMaterialsBinaryJsonError(404, $e->getMessage());
    } catch (RuntimeException $e) {
        sendMaterialsBinaryJsonError(403, $e->getMessage());
    } catch (Throwable $e) {
        sendMaterialsBinaryJsonError(500, 'Erro interno ao baixar o material.');
    }
}

/**
 * Recebe uploads autenticados de arquivos do marketplace.
 * O bridge legado `api/upload.php` continua vivo, mas a regra sai da raiz.
 *
 * @since 1.0.0
 */
function handleMaterialsUploadRoute(PDO $db): void
{
    try {
        RateLimiter::enforceProfile('upload');
        $payload = requireMaterialsAuthPayload($db);
        $file = $_FILES['file'] ?? null;
        if (!is_array($file)) {
            Response::badRequest('Nenhum arquivo foi enviado.');
        }

        $result = buildMaterialsController($db)->uploadFile((string) $payload['user_id'], $file);

        Response::success($result, 'Arquivo enviado com sucesso.');
    } catch (InvalidArgumentException $e) {
        Response::badRequest($e->getMessage());
    } catch (RuntimeException $e) {
        Response::error($e->getMessage(), 400);
    } catch (Throwable $e) {
        Response::serverError('Nao foi possivel processar o upload do arquivo.', $e);
    }
}

/**
 * Cria um novo material dentro do marketplace.
 *
 * @since 1.0.0
 */
function handleMaterialsCreateRoute(PDO $db): void
{
    try {
        $payload = requireMaterialsAuthPayload($db);
        $data = json_decode(file_get_contents('php://input'), true) ?: [];
        $material = buildMaterialsController($db)->create((string) $payload['user_id'], $data);

        Response::success(['material' => $material], 'Material criado com sucesso.', 201);
    } catch (InvalidArgumentException $e) {
        Response::badRequest($e->getMessage());
    } catch (RuntimeException $e) {
        Response::error($e->getMessage(), 400);
    } catch (Throwable $e) {
        Response::serverError('Nao foi possivel criar o material.', $e);
    }
}

/**
 * Atualiza um material existente do marketplace.
 *
 * @since 1.0.0
 */
function handleMaterialsUpdateRoute(PDO $db): void
{
    try {
        $payload = requireMaterialsAuthPayload($db);
        $data = json_decode(file_get_contents('php://input'), true) ?: [];
        $material = buildMaterialsController($db)->update((string) $payload['user_id'], $data);

        Response::success(['material' => $material], 'Material atualizado com sucesso.');
    } catch (InvalidArgumentException $e) {
        Response::badRequest($e->getMessage());
    } catch (OutOfBoundsException $e) {
        Response::notFound($e->getMessage());
    } catch (RuntimeException $e) {
        Response::error($e->getMessage(), 403);
    } catch (Throwable $e) {
        Response::serverError('Nao foi possivel atualizar o material.', $e);
    }
}

/**
 * Modera um material do marketplace com base em decisao administrativa.
 *
 * @since 1.0.0
 */
function handleMaterialsModerateRoute(PDO $db): void
{
    try {
        $context = requirePlatformAdminSessionContext($db);
        $adminUserId = (string) $context['admin_user_id'];
        $data = json_decode(file_get_contents('php://input'), true) ?: [];
        $materialId = trim((string) ($data['id'] ?? ''));
        $status = trim((string) ($data['status'] ?? ''));
        $reason = trim((string) ($data['reason'] ?? ''));
        $evidenceUrl = trim((string) ($data['evidence_url'] ?? ''));

        $payload = buildMaterialsController($db)->moderate($materialId, $status, $reason, $adminUserId);

        logAdminAudit($db, $adminUserId, 'material.moderate', 'material', $materialId, [
            'previous_status' => $payload['previousStatus'] ?? null,
            'status' => $status,
            'reason' => $reason,
            'evidence_url' => $evidenceUrl !== '' ? $evidenceUrl : null,
        ]);

        Response::success([
            'material' => [
                'id' => $payload['id'],
                'status' => $payload['status'],
                'rejectionReason' => $payload['rejectionReason'],
            ],
        ], 'Moderacao aplicada com sucesso.');
    } catch (InvalidArgumentException $e) {
        Response::validationError($e->getMessage());
    } catch (OutOfBoundsException $e) {
        Response::notFound($e->getMessage());
    } catch (Throwable $e) {
        Response::serverError('Nao foi possivel moderar o material.', $e);
    }
}

/**
 * Remove um material do marketplace.
 *
 * @since 1.0.0
 */
function handleMaterialsDeleteRoute(PDO $db): void
{
    try {
        $context = requirePlatformAdminSessionContext($db);
        $adminUserId = (string) $context['admin_user_id'];
        $data = json_decode(file_get_contents('php://input'), true) ?: [];
        $materialId = trim((string) ($data['id'] ?? ($_GET['id'] ?? '')));

        $payload = buildMaterialsController($db)->delete($materialId, $adminUserId);

        logAdminAudit($db, $adminUserId, 'material.delete', 'material', $materialId, [
            'previous_status' => $payload['previousStatus'] ?? null,
            'title' => $payload['title'] ?? '',
        ]);

        Response::success([], 'Material removido da plataforma com sucesso.');
    } catch (InvalidArgumentException $e) {
        Response::validationError($e->getMessage());
    } catch (OutOfBoundsException $e) {
        Response::notFound($e->getMessage());
    } catch (Throwable $e) {
        Response::serverError('Nao foi possivel remover o material.', $e);
    }
}

/**
 * Exibe ou registra a avaliacao do usuario para um material.
 *
 * @since 1.0.0
 */
function handleMaterialsRateRoute(PDO $db): void
{
    try {
        $payload = requireMaterialsAuthPayload($db);
        $controller = buildMaterialsController($db);
        $method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

        if ($method === 'GET') {
            $materialId = trim((string) ($_GET['material_id'] ?? ''));
            $userRating = $controller->getUserRating((string) $payload['user_id'], $materialId);
            Response::success(['userRating' => $userRating]);
        }

        if ($method === 'POST') {
            $data = json_decode(file_get_contents('php://input'), true) ?: [];
            $result = $controller->rate((string) $payload['user_id'], $data);
            Response::success($result, 'Avaliacao registrada com sucesso.');
        }

        Response::error('Metodo nao permitido.', 405);
    } catch (InvalidArgumentException $e) {
        Response::badRequest($e->getMessage());
    } catch (OutOfBoundsException $e) {
        Response::notFound($e->getMessage());
    } catch (RuntimeException $e) {
        Response::error($e->getMessage(), 403);
    } catch (Throwable $e) {
        Response::serverError('Nao foi possivel processar a avaliacao do material.', $e);
    }
}

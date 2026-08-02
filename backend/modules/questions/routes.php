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

require_once __DIR__ . '/controllers/QuestionsController.php';
require_once __DIR__ . '/services/QuestionsService.php';
require_once __DIR__ . '/services/QuestionsRewardService.php';
require_once __DIR__ . '/repositories/QuestionsRepository.php';
require_once __DIR__ . '/validators/QuestionsValidator.php';
require_once __DIR__ . '/../../config/payment_provider.php';
require_once __DIR__ . '/../../shared/responses/ApiEnvelope.php';
require_once __DIR__ . '/../../shared/utils/SimpleCache.php';
require_once __DIR__ . '/../../shared/auth/request_auth.php';
require_once __DIR__ . '/../../shared/responses/Response.php';
require_once __DIR__ . '/../../shared/middleware/RateLimiter.php';

/**
 * Le o body JSON das rotas do modulo questions.
  * @since 1.0.0
 */
function readQuestionsJsonRequestBody(): array
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
 * Fabrica curta do controller oficial.
  * @since 1.0.0
 */
function buildQuestionsController(PDO $db): QuestionsController
{
    $repository = new QuestionsRepository($db);
    $validator = new QuestionsValidator();

    return new QuestionsController(
        new QuestionsService(
            $repository,
            $validator,
            new QuestionsRewardService($repository),
            $db
        )
    );
}

/**
 * Busca a configurao de cache usada pela listagem principal de questes.
  * @since 1.0.0
 */
function getQuestionsCacheSettings(PDO $db): array
{
    try {
        $stmt = $db->prepare("SELECT enabled, default_ttl FROM cache_settings LIMIT 1");
        $stmt->execute();
        $result = $stmt->fetch(PDO::FETCH_ASSOC);

        if (is_array($result)) {
            return [
                'enabled' => (int) ($result['enabled'] ?? 0),
                'default_ttl' => (int) ($result['default_ttl'] ?? 300),
            ];
        }
    } catch (Throwable) {
        // Mantem fallback seguro quando a infraestrutura de cache ainda no existe.
    }

    return [
        'enabled' => 0,
        'default_ttl' => 300,
    ];
}

/**
 * Emite um envelope de sucesso manualmente para permitir cache de resposta.
  * @since 1.0.0
 */
function sendQuestionsSuccessEnvelope(array $response, int $code = 200): void
{
    http_response_code($code);

    while (ob_get_level() > 0) {
        ob_end_clean();
    }

    header('Content-Type: application/json; charset=UTF-8');
    echo json_encode($response, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit();
}

/**
 * Resolve os aliases novos e legados do Controle de Acesso por Plano.
 * @since 1.0.0
 */
function userCanViewQuestionTeacherComment(PDO $db, string $userId, ?string $role = null): bool
{
    if ($userId === '') {
        return false;
    }

    if (in_array(strtolower(trim((string) $role)), ['admin', 'staff'], true)) {
        return true;
    }

    return userHasPlanBenefit($db, $userId, 'teacher_comments');
}

/**
 * Resolve os aliases novos e legados da analise detalhada da questao.
 * @since 1.0.0
 */
function userCanViewQuestionDetailedAnalysis(PDO $db, string $userId, ?string $role = null): bool
{
    if ($userId === '') {
        return false;
    }

    if (in_array(strtolower(trim((string) $role)), ['admin', 'staff'], true)) {
        return true;
    }

    return userHasPlanBenefit($db, $userId, 'question.detailed_analysis')
        || userHasPlanBenefit($db, $userId, 'detailed_analysis');
}

/**
 * Rota oficial da listagem principal de questes com cache e auth opcional.
  * @since 1.0.0
 */
function handleQuestionsListRoute(PDO $db): void
{
    try {
        $authenticatedUserPayload = verifyAuthenticatedUserPayload(false);
        $authenticatedUserId = trim((string) ($authenticatedUserPayload['user_id'] ?? ''));
        $role = (string) ($authenticatedUserPayload['role'] ?? '');
        $canViewTeacherComments = userCanViewQuestionTeacherComment($db, $authenticatedUserId, $role);
        $canViewDetailedAnalysis = userCanViewQuestionDetailedAnalysis($db, $authenticatedUserId, $role);

        $cacheSettings = getQuestionsCacheSettings($db);
        $cache = new SimpleCache(
            __DIR__ . '/../../storage/cache',
            (bool) $cacheSettings['enabled'],
            (int) $cacheSettings['default_ttl']
        );

        $cacheParams = $_GET;
        unset($cacheParams['user_id']);
        $cacheParams['viewer_id'] = $authenticatedUserId !== '' ? $authenticatedUserId : 'guest';
        $cacheParams['teacher_comments'] = $canViewTeacherComments ? '1' : '0';
        $cacheParams['detailed_analysis'] = $canViewDetailedAnalysis ? '1' : '0';

        $cachedResponse = $cache->get('questions_list', $cacheParams);
        if ($cachedResponse !== null) {
            header('X-Cache: HIT');
            sendQuestionsSuccessEnvelope($cachedResponse);
        }

        header('X-Cache: MISS');
        $result = buildQuestionsController($db)->listQuestions(
            $authenticatedUserId !== '' ? $authenticatedUserId : null,
            $canViewTeacherComments,
            $canViewDetailedAnalysis,
            $_GET
        );

        $response = ApiEnvelope::success($result, 'Questes carregadas com sucesso.');
        $cache->set('questions_list', $response, $cacheParams);

        sendQuestionsSuccessEnvelope($response);
    } catch (InvalidArgumentException $e) {
        Response::badRequest($e->getMessage());
    } catch (Throwable $e) {
        Response::serverError('No foi possvel carregar as questes.', $e);
    }
}

/**
 * Rota publica v2 da listagem leve de questoes.
 *
 * @since 1.0.0
 */
function handleQuestionsV2ListRoute(PDO $db): void
{
    try {
        $authenticatedUserPayload = verifyAuthenticatedUserPayload(false);
        $authenticatedUserId = trim((string) ($authenticatedUserPayload['user_id'] ?? ''));
        $role = (string) ($authenticatedUserPayload['role'] ?? '');
        $canViewTeacherComments = userCanViewQuestionTeacherComment($db, $authenticatedUserId, $role);
        $canViewDetailedAnalysis = userCanViewQuestionDetailedAnalysis($db, $authenticatedUserId, $role);
        $result = buildQuestionsController($db)->listQuestionsV2(
            $authenticatedUserId !== '' ? $authenticatedUserId : null,
            $canViewTeacherComments,
            $canViewDetailedAnalysis,
            $_GET
        );

        Response::success($result, 'Questoes carregadas com sucesso.');
    } catch (InvalidArgumentException $e) {
        Response::badRequest($e->getMessage());
    } catch (Throwable $e) {
        Response::serverError('Nao foi possivel carregar as questoes.', $e);
    }
}
/**
 * Rota publica do detalhe de uma questao isolada.
  * @since 1.0.0
 */
function handleQuestionDetailsRoute(PDO $db): void
{
    try {
        $authenticatedUserPayload = verifyAuthenticatedUserPayload(false);
        $authenticatedUserId = trim((string) ($authenticatedUserPayload['user_id'] ?? ''));
        $role = (string) ($authenticatedUserPayload['role'] ?? '');
        $canViewTeacherComments = userCanViewQuestionTeacherComment($db, $authenticatedUserId, $role);
        $canViewDetailedAnalysis = userCanViewQuestionDetailedAnalysis($db, $authenticatedUserId, $role);

        $result = buildQuestionsController($db)->getQuestionDetails(
            $authenticatedUserId !== '' ? $authenticatedUserId : null,
            $canViewTeacherComments,
            $canViewDetailedAnalysis,
            $_GET
        );

        Response::success($result, 'Questao carregada com sucesso.');
    } catch (InvalidArgumentException $e) {
        Response::badRequest($e->getMessage());
    } catch (OutOfBoundsException $e) {
        Response::notFound($e->getMessage());
    } catch (Throwable $e) {
        Response::serverError('Nao foi possivel carregar a questao.', $e);
    }
}

/**
 * Rota publica v2 do detalhe de pratica sem gabarito.
 *
 * @since 1.0.0
 */
function handleQuestionsV2ShowRoute(PDO $db): void
{
    try {
        $authenticatedUserPayload = verifyAuthenticatedUserPayload(false);
        $authenticatedUserId = trim((string) ($authenticatedUserPayload['user_id'] ?? ''));
        $role = (string) ($authenticatedUserPayload['role'] ?? '');
        $canViewTeacherComments = userCanViewQuestionTeacherComment($db, $authenticatedUserId, $role);
        $canViewDetailedAnalysis = userCanViewQuestionDetailedAnalysis($db, $authenticatedUserId, $role);
        $result = buildQuestionsController($db)->getQuestionPracticeV2(
            $authenticatedUserId !== '' ? $authenticatedUserId : null,
            $canViewTeacherComments,
            $canViewDetailedAnalysis,
            $_GET
        );

        Response::success($result, 'Questao carregada com sucesso.');
    } catch (InvalidArgumentException $e) {
        Response::badRequest($e->getMessage());
    } catch (OutOfBoundsException $e) {
        Response::notFound($e->getMessage());
    } catch (Throwable $e) {
        Response::serverError('Nao foi possivel carregar a questao.', $e);
    }
}

/**
 * Rota administrativa v2 com gabarito, revisao e editoriais.
 *
 * @since 1.0.0
 */
function handleQuestionsV2AdminShowRoute(PDO $db): void
{
    try {
        $authenticatedUserPayload = verifyAuthenticatedUserPayload();
        $authenticatedUserId = trim((string) ($authenticatedUserPayload['user_id'] ?? ''));
        $isAdmin = in_array((string) ($authenticatedUserPayload['role'] ?? ''), ['admin', 'staff'], true);
        $result = buildQuestionsController($db)->getQuestionAdminV2($authenticatedUserId, $isAdmin, $_GET);

        Response::success($result, 'Questao administrativa carregada com sucesso.');
    } catch (InvalidArgumentException $e) {
        Response::badRequest($e->getMessage());
    } catch (RuntimeException $e) {
        Response::unauthorized($e->getMessage());
    } catch (OutOfBoundsException $e) {
        Response::notFound($e->getMessage());
    } catch (Throwable $e) {
        Response::serverError('Nao foi possivel carregar a questao administrativa.', $e);
    }
}

/**
 * Rota oficial do filtro administrativo de questes.
  * @since 1.0.0
 */
function handleQuestionsFilterRoute(PDO $db): void
{
    try {
        $authenticatedUserPayload = verifyAuthenticatedUserPayload();
        $authenticatedUserId = trim((string) ($authenticatedUserPayload['user_id'] ?? ''));
        $isAdmin = in_array((string) ($authenticatedUserPayload['role'] ?? ''), ['admin', 'staff'], true);

        if (!$isAdmin) {
            Response::forbidden('Acesso restrito ao admin.');
        }

        $result = buildQuestionsController($db)->filterQuestions(
            userCanViewQuestionTeacherComment($db, $authenticatedUserId, (string) ($authenticatedUserPayload['role'] ?? '')),
            userCanViewQuestionDetailedAnalysis($db, $authenticatedUserId, (string) ($authenticatedUserPayload['role'] ?? '')),
            $_GET
        );

        Response::success($result, 'Questes filtradas com sucesso.');
    } catch (InvalidArgumentException $e) {
        Response::badRequest($e->getMessage());
    } catch (RuntimeException $e) {
        Response::unauthorized($e->getMessage());
    } catch (Throwable $e) {
        Response::serverError('No foi possvel filtrar as questes.', $e);
    }
}

/**
 * Rota oficial das estatisticas agregadas da questo.
  * @since 1.0.0
 */
function handleQuestionsStatsRoute(PDO $db): void
{
    try {
        $result = buildQuestionsController($db)->getQuestionStats($_GET);
        Response::success($result, 'Estatisticas da questo carregadas com sucesso.');
    } catch (InvalidArgumentException $e) {
        Response::badRequest($e->getMessage());
    } catch (Throwable $e) {
        Response::serverError('No foi possvel carregar as estatisticas da questo.', $e);
    }
}

/**
 * Rota oficial de criacao/edicao de questes.
  * @since 1.0.0
 */
function handleQuestionsSaveRoute(PDO $db): void
{
    try {
        $authenticatedUserPayload = verifyAuthenticatedUserPayload();
        $authenticatedUserId = trim((string) ($authenticatedUserPayload['user_id'] ?? ''));
        $isAdmin = in_array((string) ($authenticatedUserPayload['role'] ?? ''), ['admin', 'staff'], true);

        $result = buildQuestionsController($db)->saveQuestion(
            $authenticatedUserId,
            $isAdmin,
            readQuestionsJsonRequestBody()
        );

        try {
            (new SimpleCache(__DIR__ . '/../../storage/cache', true))->clearAll();
        } catch (Throwable $cacheError) {
            error_log('Questions bulk import cache clear failed: ' . $cacheError->getMessage());
        }

        Response::success($result, 'Questo salva.');
    } catch (InvalidArgumentException $e) {
        Response::badRequest($e->getMessage());
    } catch (OutOfBoundsException $e) {
        Response::notFound($e->getMessage());
    } catch (DomainException $e) {
        Response::forbidden($e->getMessage());
    } catch (RuntimeException $e) {
        Response::unauthorized($e->getMessage());
    } catch (Throwable $e) {
        Response::serverError('No foi possvel salvar a questo.', $e);
    }
}

/**
 * Alias oficial de criacao de questo.
  * @since 1.0.0
 */
function handleQuestionsCreateRoute(PDO $db): void
{
    handleQuestionsSaveRoute($db);
}

/**
 * Alias oficial de atualizacao de questo.
  * @since 1.0.0
 */
function handleQuestionsUpdateRoute(PDO $db): void
{
    handleQuestionsSaveRoute($db);
}
/**
 * Rota administrativa para importacao em massa de prova, contextos e questoes.
 *
 * @since 1.0.0
 */
function handleQuestionsBulkImportRoute(PDO $db): void
{
    try {
        @set_time_limit(300);
        @ini_set('memory_limit', '512M');

        $contentLength = (int) ($_SERVER['CONTENT_LENGTH'] ?? 0);
        $postMaxBytes = parseQuestionsIniSize((string) ini_get('post_max_size'));
        if ($contentLength > 0 && $postMaxBytes > 0 && $contentLength > $postMaxBytes) {
            throw new InvalidArgumentException(
                'O arquivo ou lote enviado ultrapassa o limite de upload do servidor. Reduza imagens/PDF ou aumente post_max_size no PHP.'
            );
        }

        $authenticatedUserPayload = verifyAuthenticatedUserPayload();
        $authenticatedUserId = trim((string) ($authenticatedUserPayload['user_id'] ?? ''));
        $isAdmin = in_array((string) ($authenticatedUserPayload['role'] ?? ''), ['admin', 'staff'], true);

        $rawPayload = trim((string) ($_POST['payload'] ?? ''));
        if ($rawPayload === '') {
            $payload = readQuestionsJsonRequestBody();
        } else {
            $payload = json_decode($rawPayload, true);
            if (!is_array($payload)) {
                throw new InvalidArgumentException('Payload JSON invalido.');
            }
        }

        $result = buildQuestionsController($db)->bulkImportQuestions(
            $authenticatedUserId,
            $isAdmin,
            $payload,
            $_FILES['proof_pdf'] ?? null
        );

        try {
            (new SimpleCache(__DIR__ . '/../../storage/cache', true))->clearAll();
        } catch (Throwable $cacheError) {
            error_log('Questions exam import cache clear failed: ' . $cacheError->getMessage());
        }

        Response::success($result, 'Importacao em massa concluida.');
    } catch (InvalidArgumentException $e) {
        Response::badRequest($e->getMessage());
    } catch (OutOfBoundsException $e) {
        Response::notFound($e->getMessage());
    } catch (DomainException $e) {
        Response::forbidden($e->getMessage());
    } catch (RuntimeException $e) {
        $runtimeMessage = strtolower($e->getMessage());
        if (
            str_contains($runtimeMessage, 'token')
            || str_contains($runtimeMessage, 'autentic')
            || str_contains($runtimeMessage, 'sess')
            || str_contains($runtimeMessage, 'sessao')
            || str_contains($runtimeMessage, 'session')
        ) {
            Response::unauthorized($e->getMessage());
        }
        Response::serverError('Nao foi possivel importar a prova.', $e);
    } catch (Throwable $e) {
        Response::serverError('Nao foi possivel importar a prova.', $e);
    }
}

/** Importa varios lotes de provas sem multiplicar requests ou respostas no cliente. */
function handleQuestionsMultiBatchImportRoute(PDO $db): void
{
    try {
        @set_time_limit(300);
        $authenticatedUserPayload = verifyAuthenticatedUserPayload();
        $authenticatedUserId = trim((string) ($authenticatedUserPayload['user_id'] ?? ''));
        $isAdmin = in_array((string) ($authenticatedUserPayload['role'] ?? ''), ['admin', 'staff'], true);
        $result = buildQuestionsController($db)->bulkImportQuestionBatches(
            $authenticatedUserId,
            $isAdmin,
            readQuestionsJsonRequestBody()
        );
        try { (new SimpleCache(__DIR__ . '/../../storage/cache', true))->clearAll(); } catch (Throwable $cacheError) { error_log('Questions multi batch cache clear failed: ' . $cacheError->getMessage()); }
        Response::success($result, 'Publicacao em lote concluida.');
    } catch (InvalidArgumentException $e) {
        Response::badRequest($e->getMessage());
    } catch (DomainException $e) {
        Response::forbidden($e->getMessage());
    } catch (RuntimeException $e) {
        Response::serverError('Nao foi possivel publicar o lote de questoes.', $e);
    } catch (Throwable $e) {
        Response::serverError('Nao foi possivel publicar o lote de questoes.', $e);
    }
}

/**
 * Rota administrativa leve para criar apenas o registro da prova importada.
 *
 * @since 1.0.0
 */
function handleQuestionsExamImportRoute(PDO $db): void
{
    try {
        $authenticatedUserPayload = verifyAuthenticatedUserPayload();
        $authenticatedUserId = trim((string) ($authenticatedUserPayload['user_id'] ?? ''));
        $isAdmin = in_array((string) ($authenticatedUserPayload['role'] ?? ''), ['admin', 'staff'], true);

        $result = buildQuestionsController($db)->createImportedExam(
            $authenticatedUserId,
            $isAdmin,
            readQuestionsJsonRequestBody()
        );

        try {
            (new SimpleCache(__DIR__ . '/../../storage/cache', true))->clearAll();
        } catch (Throwable $cacheError) {
            error_log('Questions exam publish cache clear failed: ' . $cacheError->getMessage());
        }

        Response::success($result, 'Prova publicada.');
    } catch (InvalidArgumentException $e) {
        Response::badRequest($e->getMessage());
    } catch (OutOfBoundsException $e) {
        Response::notFound($e->getMessage());
    } catch (DomainException $e) {
        Response::forbidden($e->getMessage());
    } catch (RuntimeException $e) {
        $runtimeMessage = strtolower($e->getMessage());
        if (
            str_contains($runtimeMessage, 'token')
            || str_contains($runtimeMessage, 'autentic')
            || str_contains($runtimeMessage, 'sess')
            || str_contains($runtimeMessage, 'sessao')
            || str_contains($runtimeMessage, 'session')
        ) {
            Response::unauthorized($e->getMessage());
        }
        error_log('Questions exam import publish failed: ' . get_class($e) . ': ' . $e->getMessage());
        Response::serverError('Nao foi possivel salvar a prova.', $e);
    } catch (Throwable $e) {
        error_log('Questions exam import publish failed: ' . get_class($e) . ': ' . $e->getMessage());
        Response::serverError('Nao foi possivel salvar a prova.', $e);
    }
}

/**
 * Rota administrativa para upload de anexos do cadastro de prova.
 *
 * @since 1.0.0
 */
function handleQuestionsExamFilesRoute(PDO $db): void
{
    try {
        RateLimiter::enforceProfile('upload');
        $authenticatedUserPayload = verifyAuthenticatedUserPayload();
        $authenticatedUserId = trim((string) ($authenticatedUserPayload['user_id'] ?? ''));
        $isAdmin = in_array((string) ($authenticatedUserPayload['role'] ?? ''), ['admin', 'staff'], true);

        $result = buildQuestionsController($db)->uploadExamAttachment(
            $authenticatedUserId,
            $isAdmin,
            $_FILES['file'] ?? null,
            (string) ($_POST['kind'] ?? $_GET['kind'] ?? '')
        );

        Response::success($result, 'Arquivo da prova enviado.');
    } catch (InvalidArgumentException $e) {
        Response::badRequest($e->getMessage());
    } catch (DomainException $e) {
        Response::forbidden($e->getMessage());
    } catch (RuntimeException $e) {
        Response::unauthorized($e->getMessage());
    } catch (Throwable $e) {
        Response::serverError('Nao foi possivel enviar o arquivo da prova.', $e);
    }
}

/**
 * Converte valores de php.ini como 8M/1G para bytes.
 *
 * @since 1.0.0
 */
function parseQuestionsIniSize(string $value): int
{
    $value = trim($value);
    if ($value === '') {
        return 0;
    }

    $unit = strtolower(substr($value, -1));
    $number = (float) $value;

    return match ($unit) {
        'g' => (int) ($number * 1024 * 1024 * 1024),
        'm' => (int) ($number * 1024 * 1024),
        'k' => (int) ($number * 1024),
        default => (int) $number,
    };
}

/**
 * Rota oficial para buscar os dados de uma questo em edicao.
  * @since 1.0.0
 */
function handleQuestionsEditRoute(PDO $db): void
{
    try {
        $authenticatedUserPayload = verifyAuthenticatedUserPayload();
        $authenticatedUserId = trim((string) ($authenticatedUserPayload['user_id'] ?? ''));
        $isAdmin = in_array((string) ($authenticatedUserPayload['role'] ?? ''), ['admin', 'staff'], true);

        $result = buildQuestionsController($db)->getQuestionForEdit(
            $authenticatedUserId,
            $isAdmin,
            $_GET
        );

        Response::success($result, 'Questo carregada com sucesso.');
    } catch (InvalidArgumentException $e) {
        Response::badRequest($e->getMessage());
    } catch (OutOfBoundsException $e) {
        Response::notFound($e->getMessage());
    } catch (DomainException $e) {
        Response::forbidden($e->getMessage());
    } catch (RuntimeException $e) {
        Response::unauthorized($e->getMessage());
    } catch (Throwable $e) {
        Response::serverError('No foi possvel carregar a questo.', $e);
    }
}

/**
 * Rota oficial para exclusao administrativa de questo.
  * @since 1.0.0
 */
function handleQuestionsDeleteRoute(PDO $db): void
{
    try {
        $authenticatedUserPayload = verifyAuthenticatedUserPayload();
        $authenticatedUserId = trim((string) ($authenticatedUserPayload['user_id'] ?? ''));
        $isAdmin = in_array((string) ($authenticatedUserPayload['role'] ?? ''), ['admin', 'staff'], true);

        buildQuestionsController($db)->deleteQuestion(
            $authenticatedUserId,
            $isAdmin,
            $_GET
        );

        (new SimpleCache(__DIR__ . '/../../storage/cache', true))->clearAll();

        Response::success([], 'Questo excluida.');
    } catch (InvalidArgumentException $e) {
        Response::badRequest($e->getMessage());
    } catch (OutOfBoundsException $e) {
        Response::notFound($e->getMessage());
    } catch (DomainException $e) {
        Response::forbidden($e->getMessage());
    } catch (RuntimeException $e) {
        Response::unauthorized($e->getMessage());
    } catch (Throwable $e) {
        Response::serverError('No foi possvel excluir a questo.', $e);
    }
}

/**
 * Rota administrativa dos contextos de questoes.
  * @since 1.0.0
 */
function handleQuestionsGroupsRoute(PDO $db): void
{
    try {
        $authenticatedUserPayload = verifyAuthenticatedUserPayload();
        $authenticatedUserId = trim((string) ($authenticatedUserPayload['user_id'] ?? ''));
        $isAdmin = in_array((string) ($authenticatedUserPayload['role'] ?? ''), ['admin', 'staff'], true);
        $controller = buildQuestionsController($db);
        $method = strtoupper((string) ($_SERVER['REQUEST_METHOD'] ?? 'GET'));

        if ($method === 'GET') {
            $result = $controller->listQuestionGroups($authenticatedUserId, $isAdmin, $_GET);
            Response::success($result, 'Contextos de questoes carregados com sucesso.');
            return;
        }

        $formAction = strtolower(trim((string) ($_POST['action'] ?? $_GET['action'] ?? '')));
        if ($method === 'POST' && $formAction === 'upload_image') {
            RateLimiter::enforceProfile('upload');
            $result = $controller->uploadQuestionGroupImage($authenticatedUserId, $isAdmin, $_FILES['image'] ?? null);
            Response::success($result, 'Imagem do contexto enviada.');
            return;
        }
        $payload = readQuestionsJsonRequestBody();
        $action = strtolower(trim((string) ($payload['action'] ?? $_GET['action'] ?? 'save')));

        if ($action === 'delete') {
            $result = $controller->deleteQuestionGroup($authenticatedUserId, $isAdmin, $payload + $_GET);
            (new SimpleCache(__DIR__ . '/../../storage/cache', true))->clearAll();
            Response::success($result, 'Contexto de questoes removido.');
            return;
        }

        $result = $controller->saveQuestionGroup($authenticatedUserId, $isAdmin, $payload);
        (new SimpleCache(__DIR__ . '/../../storage/cache', true))->clearAll();
        Response::success($result, 'Contexto de questoes salvo.');
    } catch (InvalidArgumentException $e) {
        Response::badRequest($e->getMessage());
    } catch (OutOfBoundsException $e) {
        Response::notFound($e->getMessage());
    } catch (DomainException $e) {
        Response::forbidden($e->getMessage());
    } catch (RuntimeException $e) {
        Response::unauthorized($e->getMessage());
    } catch (Throwable $e) {
        Response::serverError('Nao foi possivel processar os contextos de questoes.', $e);
    }
}
/**
 * Rota oficial para submissao de resposta do usurio.
  * @since 1.0.0
 */
function handleQuestionsAnswerRoute(PDO $db): void
{
    try {
        $authenticatedUserPayload = verifyAuthenticatedUserPayload();
        $authenticatedUserId = trim((string) ($authenticatedUserPayload['user_id'] ?? ''));
        $isAdmin = in_array((string) ($authenticatedUserPayload['role'] ?? ''), ['admin', 'staff'], true);

        $result = buildQuestionsController($db)->submitAnswer(
            $authenticatedUserId,
            $isAdmin,
            readQuestionsJsonRequestBody()
        );

        Response::success($result, 'Resposta salva com sucesso.', 201);
    } catch (InvalidArgumentException $e) {
        Response::badRequest($e->getMessage());
    } catch (OutOfBoundsException $e) {
        Response::notFound($e->getMessage());
    } catch (DomainException $e) {
        Response::forbidden($e->getMessage());
    } catch (RuntimeException $e) {
        Response::unauthorized($e->getMessage());
    } catch (Throwable $e) {
        Response::serverError('Erro ao salvar resposta.', $e);
    }
}

/**
 * Rota v2 para submissao de resposta por identificador de alternativa.
 *
 * @since 1.0.0
 */
function handleQuestionsV2AnswerRoute(PDO $db): void
{
    try {
        $authenticatedUserPayload = verifyAuthenticatedUserPayload();
        $authenticatedUserId = trim((string) ($authenticatedUserPayload['user_id'] ?? ''));
        $isAdmin = in_array((string) ($authenticatedUserPayload['role'] ?? ''), ['admin', 'staff'], true);
        $payload = readQuestionsJsonRequestBody();
        if (!isset($payload['questionId']) && isset($_GET['id'])) {
            $payload['questionId'] = $_GET['id'];
        }

        $result = buildQuestionsController($db)->submitAnswerV2($authenticatedUserId, $isAdmin, $payload);

        Response::success($result, 'Resposta salva com sucesso.', 201);
    } catch (InvalidArgumentException $e) {
        Response::badRequest($e->getMessage());
    } catch (OutOfBoundsException $e) {
        Response::notFound($e->getMessage());
    } catch (DomainException $e) {
        Response::forbidden($e->getMessage());
    } catch (RuntimeException $e) {
        Response::unauthorized($e->getMessage());
    } catch (Throwable $e) {
        Response::serverError('Erro ao salvar resposta.', $e);
    }
}

/**
 * Rota oficial para histrico de respostas de uma questo.
 * Quando no ha sesso, preserva o comportamento de convidado retornando lista vazia.
  * @since 1.0.0
 */
function handleQuestionsHistoryRoute(PDO $db): void
{
    try {
        $authenticatedUserPayload = verifyAuthenticatedUserPayload(false);
        $result = buildQuestionsController($db)->getQuestionHistory($authenticatedUserPayload, $_GET);
        Response::success($result, 'Question history retrieved');
    } catch (InvalidArgumentException $e) {
        Response::badRequest($e->getMessage());
    } catch (DomainException $e) {
        Response::forbidden($e->getMessage());
    } catch (Throwable $e) {
        Response::serverError('Failed to fetch question history', $e);
    }
}

/**
 * Rota oficial para limpar as respostas ativas do usurio.
  * @since 1.0.0
 */
function handleQuestionsResetAnswersRoute(PDO $db): void
{
    try {
        $authenticatedUserPayload = verifyAuthenticatedUserPayload();
        $authenticatedUserId = trim((string) ($authenticatedUserPayload['user_id'] ?? ''));
        $isAdmin = (string) ($authenticatedUserPayload['role'] ?? '') === 'admin';

        $result = buildQuestionsController($db)->resetAnswers(
            $authenticatedUserId,
            $isAdmin,
            readQuestionsJsonRequestBody()
        );

        Response::success($result, 'Respostas limpas com sucesso.');
    } catch (InvalidArgumentException $e) {
        Response::badRequest($e->getMessage());
    } catch (DomainException $e) {
        Response::forbidden($e->getMessage());
    } catch (RuntimeException $e) {
        Response::unauthorized($e->getMessage());
    } catch (Throwable $e) {
        Response::serverError('No foi possvel limpar as respostas.', $e);
    }
}

/**
 * Rota oficial para alternar o estado salvo de uma questo.
  * @since 1.0.0
 */
function handleQuestionsToggleSaveRoute(PDO $db): void
{
    try {
        $authenticatedUserPayload = verifyAuthenticatedUserPayload();
        $authenticatedUserId = trim((string) ($authenticatedUserPayload['user_id'] ?? ''));
        $isAdmin = (string) ($authenticatedUserPayload['role'] ?? '') === 'admin';

        $result = buildQuestionsController($db)->toggleSavedQuestion(
            $authenticatedUserId,
            $isAdmin,
            readQuestionsJsonRequestBody()
        );

        Response::success(['isSaved' => $result['isSaved']], $result['message']);
    } catch (InvalidArgumentException $e) {
        Response::badRequest($e->getMessage());
    } catch (DomainException $e) {
        Response::forbidden($e->getMessage());
    } catch (RuntimeException $e) {
        Response::unauthorized($e->getMessage());
    } catch (Throwable $e) {
        Response::serverError('No foi possvel atualizar os salvos.', $e);
    }
}

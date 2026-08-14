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

require_once __DIR__ . '/controllers/LegalCommentaryController.php';
require_once __DIR__ . '/services/LegalCommentaryService.php';
require_once __DIR__ . '/services/LegalCommentaryAiGenerationService.php';
require_once __DIR__ . '/services/PlanaltoImportService.php';
require_once __DIR__ . '/repositories/LegalCommentaryRepository.php';
require_once __DIR__ . '/validators/LegalCommentaryAiEditorialValidator.php';
require_once __DIR__ . '/../ai/services/AiService.php';
require_once __DIR__ . '/../ai/repositories/AiRepository.php';
require_once __DIR__ . '/../ai/validators/AiValidator.php';
require_once __DIR__ . '/../seo/services/PublicSeoEnvelopeService.php';
require_once __DIR__ . '/../../shared/middleware/AuthMiddleware.php';
require_once __DIR__ . '/../../shared/security/AdminSecurity.php';
require_once __DIR__ . '/../../shared/responses/Response.php';

function createLegalCommentaryController(PDO $db): LegalCommentaryController
{
    $repository = new LegalCommentaryRepository($db);
    $aiService = new LegalCommentaryAiGenerationService(
        $repository,
        new AiService(
            new AiRepository($db),
            new AiValidator()
        ),
        new LegalCommentaryAiEditorialValidator()
    );

    return new LegalCommentaryController(
        new LegalCommentaryService(
            $repository,
            $aiService
        )
    );
}

function createPlanaltoImportService(PDO $db): PlanaltoImportService
{
    return new PlanaltoImportService($db, new LegalCommentaryRepository($db));
}

function readLegalCommentaryJsonBody(): array
{
    $raw = file_get_contents('php://input');
    if (!is_string($raw) || trim($raw) === '') {
        return [];
    }

    $payload = json_decode($raw, true);
    return is_array($payload) ? $payload : [];
}

function logLegalCommentaryAdminSaveFailure(Throwable $exception, array $payload = []): void
{
    try {
        $logDir = dirname(__DIR__, 2) . '/storage/logs';
        if (!is_dir($logDir)) {
            @mkdir($logDir, 0775, true);
        }

        $summary = [
            'time' => date('c'),
            'exception' => get_class($exception),
            'message' => $exception->getMessage(),
            'file' => $exception->getFile(),
            'line' => $exception->getLine(),
            'law_id' => $payload['id'] ?? null,
            'slug' => $payload['slug'] ?? null,
            'status' => $payload['status'] ?? null,
            'articles' => is_array($payload['articles'] ?? null) ? count($payload['articles']) : null,
            'sections' => is_array($payload['sections'] ?? null) ? count($payload['sections']) : null,
            'teacher_comments' => is_array($payload['teacherComments'] ?? null) ? count($payload['teacherComments']) : null,
            'jurisprudence' => is_array($payload['jurisprudence'] ?? null) ? count($payload['jurisprudence']) : null,
            'exam_tips' => is_array($payload['examTips'] ?? null) ? count($payload['examTips']) : null,
            'sumulas' => is_array($payload['sumulas'] ?? null) ? count($payload['sumulas']) : null,
            'section_editorials' => is_array($payload['sectionEditorials'] ?? null) ? count($payload['sectionEditorials']) : null,
        ];

        @file_put_contents(
            $logDir . '/legal_commentary_admin_save.log',
            json_encode($summary, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) . PHP_EOL,
            FILE_APPEND | LOCK_EX
        );
    } catch (Throwable $ignored) {
        error_log('[legal_commentary_admin_save] ' . $exception->getMessage());
    }
}

function logLegalCommentaryAdminGenerateFailure(Throwable $exception, array $payload = []): void
{
    try {
        $logDir = dirname(__DIR__, 2) . '/storage/logs';
        if (!is_dir($logDir)) {
            @mkdir($logDir, 0775, true);
        }

        $section = is_array($payload['section'] ?? null) ? $payload['section'] : [];
        $law = is_array($payload['law'] ?? null) ? $payload['law'] : [];
        $article = is_array($payload['article'] ?? null) ? $payload['article'] : [];

        $summary = [
            'time' => date('c'),
            'exception' => get_class($exception),
            'message' => $exception->getMessage(),
            'file' => $exception->getFile(),
            'line' => $exception->getLine(),
            'scope' => $payload['scope'] ?? null,
            'law_id' => $payload['lawId'] ?? ($payload['law_id'] ?? ($law['id'] ?? null)),
            'article_id' => $payload['articleId'] ?? ($payload['article_id'] ?? ($article['id'] ?? null)),
            'article_number' => $article['number'] ?? ($article['numero'] ?? null),
            'section_id' => $section['sectionId'] ?? ($section['section_id'] ?? ($section['id'] ?? null)),
            'section_title' => $section['sectionTitle'] ?? ($section['title'] ?? null),
            'section_articles' => is_array($section['articleIds'] ?? null) ? count($section['articleIds']) : null,
            'preview_only' => array_key_exists('previewOnly', $payload) ? (bool) $payload['previewOnly'] : null,
            'persist' => array_key_exists('persist', $payload) ? (bool) $payload['persist'] : null,
        ];

        @file_put_contents(
            $logDir . '/legal_commentary_admin_generate.log',
            json_encode($summary, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) . PHP_EOL,
            FILE_APPEND | LOCK_EX
        );
    } catch (Throwable $ignored) {
        error_log('[legal_commentary_admin_generate] ' . $exception->getMessage());
    }
}

function resolveLegalCommentaryOptionalUserId(): ?string
{
    try {
        $payload = AuthMiddleware::optionalAuth();
        $userId = trim((string) ($payload['user_id'] ?? ''));
        return $userId !== '' ? $userId : null;
    } catch (Throwable $e) {
        return null;
    }
}

function requireLegalCommentaryUser(): array
{
    $payload = AuthMiddleware::requireAuth();
    $userId = trim((string) ($payload['user_id'] ?? ''));

    if ($userId === '') {
        Response::unauthorized('Sessao invalida. Faca login novamente.');
    }

    return [
        'id' => $userId,
        'name' => trim((string) ($payload['name'] ?? $payload['email'] ?? 'Aluno')),
        'role' => trim((string) ($payload['role'] ?? '')),
    ];
}

function handleLegalCommentaryListRoute(PDO $db): void
{
    try {
        $controller = createLegalCommentaryController($db);
        $query = trim((string) ($_GET['q'] ?? ''));
        $userId = resolveLegalCommentaryOptionalUserId();

        Response::success($query !== ''
            ? ['results' => $controller->search($query, $userId)]
            : $controller->home($userId)
        );
    } catch (Throwable $e) {
        Response::serverError('Nao foi possivel carregar a Lei Comentada.', $e);
    }
}

function handleLegalCommentaryDetailRoute(PDO $db): void
{
    try {
        $identifier = trim((string) ($_GET['slug'] ?? $_GET['id'] ?? ''));
        $outlineOnly = filter_var($_GET['outline'] ?? false, FILTER_VALIDATE_BOOLEAN);
        if ($identifier === '') {
            Response::badRequest('Informe a lei desejada.');
        }

        $controller = createLegalCommentaryController($db);
        $optionalUserId = resolveLegalCommentaryOptionalUserId();
        $law = $outlineOnly
            ? $controller->detailOutline($identifier, $optionalUserId)
            : $controller->detail($identifier, $optionalUserId, true);
        Response::success((new PublicSeoEnvelopeService())->attachLaw($law));
    } catch (RuntimeException $e) {
        if ((int) $e->getCode() === 404) {
            Response::notFound($e->getMessage());
        }
        Response::badRequest($e->getMessage());
    } catch (Throwable $e) {
        Response::serverError('Nao foi possivel carregar a lei.', $e);
    }
}

function handleLegalCommentaryFavoriteRoute(PDO $db): void
{
    try {
        $user = requireLegalCommentaryUser();
        $controller = createLegalCommentaryController($db);
        Response::success($controller->toggleFavorite($user['id'], readLegalCommentaryJsonBody(), $user['role']));
    } catch (InvalidArgumentException $e) {
        Response::badRequest($e->getMessage());
    } catch (DomainException $e) {
        Response::forbidden($e->getMessage());
    } catch (Throwable $e) {
        Response::serverError('Nao foi possivel atualizar o favorito.', $e);
    }
}

function handleLegalCommentaryProgressRoute(PDO $db): void
{
    try {
        $user = requireLegalCommentaryUser();
        $controller = createLegalCommentaryController($db);
        Response::success($controller->recordProgress($user['id'], readLegalCommentaryJsonBody()));
    } catch (InvalidArgumentException $e) {
        Response::badRequest($e->getMessage());
    } catch (Throwable $e) {
        Response::serverError('Nao foi possivel registrar o progresso.', $e);
    }
}

function handleLegalCommentaryNotesRoute(PDO $db): void
{
    try {
        $user = requireLegalCommentaryUser();
        $controller = createLegalCommentaryController($db);
        $payload = strtoupper((string) ($_SERVER['REQUEST_METHOD'] ?? 'GET')) === 'GET'
            ? []
            : readLegalCommentaryJsonBody();

        Response::success($controller->handleNote(
            $user['id'],
            (string) ($_SERVER['REQUEST_METHOD'] ?? 'GET'),
            $payload
        ));
    } catch (InvalidArgumentException $e) {
        Response::badRequest($e->getMessage());
    } catch (Throwable $e) {
        Response::serverError('Nao foi possivel atualizar a anotacao.', $e);
    }
}

function handleLegalCommentaryReaderAnnotationsRoute(PDO $db): void
{
    try {
        $user = requireLegalCommentaryUser();
        $method = strtoupper((string) ($_SERVER['REQUEST_METHOD'] ?? 'GET'));
        $payload = $method === 'GET'
            ? [
                'lawId' => $_GET['lawId'] ?? $_GET['law_id'] ?? null,
                'sectionId' => $_GET['sectionId'] ?? $_GET['section_id'] ?? null,
            ]
            : readLegalCommentaryJsonBody();
        $controller = createLegalCommentaryController($db);

        Response::success($controller->handleReaderAnnotation($user['id'], $method, $payload));
    } catch (InvalidArgumentException $e) {
        Response::badRequest($e->getMessage());
    } catch (Throwable $e) {
        Response::serverError('Nao foi possivel atualizar as marcacoes.', $e);
    }
}

function handleLegalCommentaryCommentRoute(PDO $db): void
{
    try {
        $user = requireLegalCommentaryUser();
        $controller = createLegalCommentaryController($db);
        Response::success($controller->handleComment($user['id'], $user['name'], readLegalCommentaryJsonBody(), $user['role']));
    } catch (InvalidArgumentException $e) {
        Response::badRequest($e->getMessage());
    } catch (DomainException $e) {
        Response::forbidden($e->getMessage());
    } catch (RuntimeException $e) {
        Response::badRequest($e->getMessage());
    } catch (Throwable $e) {
        Response::serverError('Nao foi possivel salvar o comentario.', $e);
    }
}

function handleLegalCommentaryAdminListRoute(PDO $db): void
{
    try {
        requireAdminSessionContext($db);
        $controller = createLegalCommentaryController($db);
        Response::success($controller->adminList($_GET));
    } catch (InvalidArgumentException $e) {
        Response::badRequest($e->getMessage());
    } catch (Throwable $e) {
        Response::serverError('Nao foi possivel carregar as leis no admin.', $e);
    }
}

function handleLegalCommentaryAdminDetailRoute(PDO $db): void
{
    try {
        requireAdminSessionContext($db);
        $controller = createLegalCommentaryController($db);
        Response::success($controller->adminDetail(trim((string) ($_GET['id'] ?? $_GET['slug'] ?? 'new'))));
    } catch (RuntimeException $e) {
        if ((int) $e->getCode() === 404) {
            Response::notFound($e->getMessage());
        }
        Response::badRequest($e->getMessage());
    } catch (Throwable $e) {
        Response::serverError('Nao foi possivel carregar a lei no admin.', $e);
    }
}

function handleLegalCommentaryAdminSaveRoute(PDO $db): void
{
    $payload = [];

    try {
        $context = requireAdminSessionContext($db);
        $controller = createLegalCommentaryController($db);
        $payload = readLegalCommentaryJsonBody();
        $payload['_admin_user_id'] = (string) $context['admin_user_id'];
        $payload['_admin_user_role'] = (string) (($context['payload']['role'] ?? '') ?: '');
        $law = $controller->adminSave($payload);
        $articleCount = is_array($payload['articles'] ?? null) ? count($payload['articles']) : 0;

        logAdminAudit(
            $db,
            (string) $context['admin_user_id'],
            empty($payload['id']) ? 'legal_commentary.create' : 'legal_commentary.update',
            'law',
            (string) ($law['id'] ?? $payload['id'] ?? ''),
            [
                'title' => $law['shortTitle'] ?? $law['title'] ?? $payload['shortTitle'] ?? null,
                'articles' => $articleCount,
            ]
        );

        Response::success($law, 'Lei salva com sucesso.');
    } catch (InvalidArgumentException $e) {
        Response::badRequest($e->getMessage());
    } catch (DomainException $e) {
        Response::forbidden($e->getMessage());
    } catch (RuntimeException $e) {
        logLegalCommentaryAdminSaveFailure($e, $payload);
        Response::badRequest($e->getMessage());
    } catch (Throwable $e) {
        logLegalCommentaryAdminSaveFailure($e, $payload);
        Response::serverError('Nao foi possivel salvar a lei.', $e);
    }
}

function handleLegalCommentaryAdminDeleteRoute(PDO $db): void
{
    try {
        $context = requireAdminSessionContext($db);
        $id = (int) ($_GET['id'] ?? 0);
        $controller = createLegalCommentaryController($db);
        $result = $controller->adminDelete(
            $id,
            (string) $context['admin_user_id'],
            (string) (($context['payload']['role'] ?? '') ?: '')
        );

        logAdminAudit($db, (string) $context['admin_user_id'], 'legal_commentary.delete', 'law', (string) $id);
        Response::success($result, 'Lei removida com sucesso.');
    } catch (InvalidArgumentException $e) {
        Response::badRequest($e->getMessage());
    } catch (DomainException $e) {
        Response::forbidden($e->getMessage());
    } catch (Throwable $e) {
        Response::serverError('Nao foi possivel remover a lei.', $e);
    }
}

function handleLegalCommentaryAdminGenerateRoute(PDO $db): void
{
    $payload = [];

    try {
        $context = requireAdminSessionContext($db);
        $controller = createLegalCommentaryController($db);
        $payload = readLegalCommentaryJsonBody();
        $result = $controller->adminGenerateEditorial($payload);

        logAdminAudit(
            $db,
            (string) $context['admin_user_id'],
            'legal_commentary.ai.generate',
            (string) (($result['scope'] ?? '') === 'section-analysis' ? 'law_section' : 'law_article'),
            (string) (($result['scope'] ?? '') === 'section-analysis'
                ? ($result['sectionEditorial']['sectionId'] ?? '')
                : ($result['articleId'] ?? '')),
            [
                'lawId' => $result['lawId'] ?? null,
                'scope' => $result['scope'] ?? null,
                'status' => $result['summary']['status'] ?? null,
                'approvedBlocks' => $result['summary']['approvedBlocks'] ?? 0,
            ]
        );

        Response::success($result, 'Geracao editorial concluida.');
    } catch (InvalidArgumentException $e) {
        Response::badRequest($e->getMessage());
    } catch (RuntimeException $e) {
        logLegalCommentaryAdminGenerateFailure($e, $payload);
        $message = $e->getMessage();
        if (str_contains($message, 'AI Engine Error') || str_contains($message, 'Gemini') || str_contains($message, 'OpenAI')) {
            Response::serviceUnavailable($message, $e, 'ai_unavailable');
            return;
        }

        Response::serverError('Nao foi possivel gerar o conteudo editorial com IA.', $e);
    } catch (Throwable $e) {
        logLegalCommentaryAdminGenerateFailure($e, $payload);
        Response::serverError('Nao foi possivel gerar o conteudo editorial com IA.', $e);
    }
}

function handleLegalCommentaryAdminBatchStartRoute(PDO $db): void
{
    try {
        $context = requireAdminSessionContext($db);
        $payload = readLegalCommentaryJsonBody();
        $lawId = (int) ($payload['lawId'] ?? 0);
        $articleIds = is_array($payload['articleIds'] ?? null) ? $payload['articleIds'] : [];
        $controller = createLegalCommentaryController($db);
        $run = $controller->adminStartBatch($lawId, $articleIds, (string) $context['admin_user_id']);

        logAdminAudit(
            $db,
            (string) $context['admin_user_id'],
            'legal_commentary.ai.batch_start',
            'law',
            (string) $lawId,
            [
                'runId' => $run['id'] ?? null,
                'articles' => $run['totalArticles'] ?? 0,
            ]
        );

        Response::success(['run' => $run], 'Lote editorial iniciado.');
    } catch (InvalidArgumentException $e) {
        Response::badRequest($e->getMessage());
    } catch (Throwable $e) {
        Response::serverError('Nao foi possivel iniciar o lote editorial.', $e);
    }
}

function handleLegalCommentaryAdminBatchStatusRoute(PDO $db): void
{
    try {
        requireAdminSessionContext($db);
        $controller = createLegalCommentaryController($db);
        $runId = (int) ($_GET['runId'] ?? $_GET['id'] ?? 0);
        $lawId = (int) ($_GET['lawId'] ?? 0);
        Response::success($controller->adminBatchStatus($runId, $lawId > 0 ? $lawId : null));
    } catch (InvalidArgumentException $e) {
        Response::badRequest($e->getMessage());
    } catch (Throwable $e) {
        Response::serverError('Nao foi possivel carregar o status do lote editorial.', $e);
    }
}

function handleLegalCommentaryAdminBatchRetryRoute(PDO $db): void
{
    try {
        $context = requireAdminSessionContext($db);
        $payload = readLegalCommentaryJsonBody();
        $runId = (int) ($payload['runId'] ?? 0);
        $controller = createLegalCommentaryController($db);
        $run = $controller->adminRetryBatch($runId, (string) $context['admin_user_id']);

        logAdminAudit(
            $db,
            (string) $context['admin_user_id'],
            'legal_commentary.ai.batch_retry',
            'batch_run',
            (string) ($run['id'] ?? ''),
            [
                'sourceRunId' => $runId,
                'articles' => $run['totalArticles'] ?? 0,
            ]
        );

        Response::success(['run' => $run], 'Lote de falhas reiniciado.');
    } catch (InvalidArgumentException $e) {
        Response::badRequest($e->getMessage());
    } catch (Throwable $e) {
        Response::serverError('Nao foi possivel reprocessar os artigos falhados.', $e);
    }
}

function handleLegalCommentaryAdminBatchStopRoute(PDO $db): void
{
    try {
        $context = requireAdminSessionContext($db);
        $payload = readLegalCommentaryJsonBody();
        $runId = (int) ($payload['runId'] ?? $_GET['runId'] ?? 0);
        $controller = createLegalCommentaryController($db);
        $run = $controller->adminStopBatch($runId);

        logAdminAudit(
            $db,
            (string) $context['admin_user_id'],
            'legal_commentary.ai.batch_stop',
            'batch_run',
            (string) ($run['id'] ?? $runId),
            [
                'status' => $run['status'] ?? 'stopped',
            ]
        );

        Response::success(['run' => $run], 'Lote interrompido.');
    } catch (InvalidArgumentException $e) {
        Response::badRequest($e->getMessage());
    } catch (Throwable $e) {
        Response::serverError('Nao foi possivel interromper o lote editorial.', $e);
    }
}

function handleLegalCommentaryAdminCatalogRoute(PDO $db): void
{
    try {
        requireAdminSessionContext($db);
        $service = createPlanaltoImportService($db);
        $repository = new LegalCommentaryRepository($db);
        $snapshot = $repository->fetchCatalogSnapshotByOfficialUrl();
        $selectedSources = array_values(array_filter(array_map(
            static fn ($value): string => trim((string) $value),
            explode(',', (string) ($_GET['sources'] ?? ''))
        )));
        $items = array_map(function (array $item) use ($snapshot) {
            $existing = $snapshot[$item['url']] ?? null;
            return [
                'url' => $item['url'],
                'label' => $item['label'],
                'sourceId' => $item['sourceId'] ?? null,
                'sourceLabel' => $item['sourceLabel'] ?? null,
                'exists' => $existing !== null,
                'lawId' => $existing['lawId'] ?? null,
                'platformTitle' => $existing['platformTitle'] ?? null,
                'lastSyncedAt' => $existing['lastSyncedAt'] ?? null,
                'lastUpdatedAt' => $existing['lastUpdatedAt'] ?? null,
            ];
        }, empty($selectedSources) ? [] : $service->buildCatalog($selectedSources));

        Response::success([
            'sources' => $service->getCatalogSources(),
            'items' => array_values($items),
        ]);
    } catch (Throwable $e) {
        Response::serverError('Nao foi possivel montar o catalogo do Planalto.', $e);
    }
}

function handleLegalCommentaryAdminImportRoute(PDO $db): void
{
    try {
        $context = requireAdminSessionContext($db);
        $payload = readLegalCommentaryJsonBody();
        $url = trim((string) ($payload['url'] ?? ''));
        $persist = !empty($payload['persist']);

        if ($url === '') {
            Response::badRequest('Informe a URL oficial do Planalto.');
        }

        $service = createPlanaltoImportService($db);
        $result = $service->importFromUrl($url, $persist);

        logAdminAudit(
            $db,
            (string) $context['admin_user_id'],
            $persist ? 'legal_commentary.sync.planalto' : 'legal_commentary.import.preview',
            'law',
            (string) (($result['law']['id'] ?? '') ?: ''),
            [
                'url' => $url,
                'persisted' => $persist,
                'title' => $result['law']['shortTitle'] ?? $result['law']['title'] ?? null,
            ]
        );

        Response::success($result, $persist
            ? 'Lei sincronizada com sucesso.'
            : 'Lei importada para o editor.'
        );
    } catch (InvalidArgumentException $e) {
        Response::badRequest($e->getMessage());
    } catch (Throwable $e) {
        Response::serverError('Nao foi possivel importar a lei do Planalto.', $e);
    }
}

function handleLegalCommentaryAdminSyncRoute(PDO $db): void
{
    try {
        $context = requireAdminSessionContext($db);
        $payload = readLegalCommentaryJsonBody();
        $identifier = trim((string) ($_GET['id'] ?? $payload['id'] ?? ''));

        if ($identifier === '') {
            Response::badRequest('Informe a lei que sera sincronizada.');
        }

        $service = createPlanaltoImportService($db);
        $result = $service->syncLawById($identifier);

        logAdminAudit(
            $db,
            (string) $context['admin_user_id'],
            'legal_commentary.sync.law',
            'law',
            (string) (($result['law']['id'] ?? '') ?: $identifier),
            [
                'url' => $result['sourceUrl'] ?? null,
                'sync' => $result['sync'] ?? null,
            ]
        );

        Response::success($result, 'Sincronizacao concluida.');
    } catch (InvalidArgumentException $e) {
        Response::badRequest($e->getMessage());
    } catch (RuntimeException $e) {
        if ((int) $e->getCode() === 404) {
            Response::notFound($e->getMessage());
        }
        Response::badRequest($e->getMessage());
    } catch (Throwable $e) {
        Response::serverError('Nao foi possivel sincronizar a lei.', $e);
    }
}

function handleLegalCommentaryAdminSyncAllRoute(PDO $db): void
{
    try {
        $context = requireAdminSessionContext($db);
        $payload = readLegalCommentaryJsonBody();
        $limit = (int) ($_GET['limit'] ?? $payload['limit'] ?? 10);
        $service = createPlanaltoImportService($db);
        $result = $service->syncImportedLaws($limit);

        logAdminAudit(
            $db,
            (string) $context['admin_user_id'],
            'legal_commentary.sync.all',
            'law',
            'bulk',
            $result['summary'] ?? []
        );

        Response::success($result, 'Verificacao de atualizacoes concluida.');
    } catch (Throwable $e) {
        Response::serverError('Nao foi possivel verificar atualizacoes das leis.', $e);
    }
}

function handleLegalCommentaryCronSyncUpdatesRoute(PDO $db): void
{
    try {
        $limit = (int) ($_GET['limit'] ?? 10);
        $service = createPlanaltoImportService($db);
        Response::success($service->syncImportedLaws($limit), 'Cron de atualizacoes de leis concluido.');
    } catch (Throwable $e) {
        Response::serverError('Nao foi possivel executar o cron de atualizacoes de leis.', $e);
    }
}

function handleLegalCommentaryAdminUpdatesRoute(PDO $db): void
{
    try {
        requireAdminSessionContext($db);
        $identifier = trim((string) ($_GET['id'] ?? $_GET['lawId'] ?? ''));

        if ($identifier === '') {
            Response::badRequest('Informe a lei para consultar atualizacoes.');
        }

        $repository = new LegalCommentaryRepository($db);
        Response::success($repository->fetchAdminUpdateSnapshot($identifier));
    } catch (RuntimeException $e) {
        if ((int) $e->getCode() === 404) {
            Response::notFound($e->getMessage());
        }
        Response::badRequest($e->getMessage());
    } catch (Throwable $e) {
        Response::serverError('Nao foi possivel carregar as atualizacoes da lei.', $e);
    }
}

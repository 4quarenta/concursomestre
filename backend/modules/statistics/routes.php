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

require_once __DIR__ . '/controllers/StatisticsController.php';
require_once __DIR__ . '/services/StatisticsService.php';
require_once __DIR__ . '/repositories/StatisticsRepository.php';
require_once __DIR__ . '/validators/StatisticsValidator.php';
require_once __DIR__ . '/security/RemoteFetchDestinationPolicy.php';
require_once __DIR__ . '/../../config/payment_provider.php';
require_once __DIR__ . '/../../shared/responses/ApiEnvelope.php';
require_once __DIR__ . '/../../shared/utils/SimpleCache.php';
require_once __DIR__ . '/../../shared/auth/request_auth.php';
require_once __DIR__ . '/../../shared/responses/Response.php';

/**
 * Fabrica curta das dependencias oficiais do modulo statistics.
 *
 * @since 1.0.0
 */
function buildStatisticsContext(PDO $db): array
{
    $repository = new StatisticsRepository($db);
    $remoteFetchDestinationPolicy = new RemoteFetchDestinationPolicy();
    $validator = new StatisticsValidator($remoteFetchDestinationPolicy);
    $controller = new StatisticsController(
        new StatisticsService($repository, $validator, $db, $remoteFetchDestinationPolicy)
    );

    return [
        'repository' => $repository,
        'validator' => $validator,
        'controller' => $controller,
    ];
}

/**
 * Extrai o ltimo segmento util da URL para manter compatibilidade com rotas antigas.
 *
 * @since 1.0.0
 */
function extractStatisticsTrailingPathId(): ?string
{
    $requestUri = trim((string) ($_SERVER['REQUEST_URI'] ?? ''), '/');
    if ($requestUri === '') {
        return null;
    }

    $parts = array_values(array_filter(explode('/', $requestUri), static fn(string $part): bool => $part !== ''));
    if ($parts === []) {
        return null;
    }

    $candidate = trim((string) end($parts));
    if ($candidate === '' || str_ends_with($candidate, '.php')) {
        return null;
    }

    return urldecode($candidate);
}

/**
 * Emite um payload JSON manual quando precisamos cachear o envelope inteiro.
 *
 * @since 1.0.0
 */
function sendStatisticsJson(array $response, int $code = 200): void
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
 * Cria o cache do raio-x respeitando a configurao central do sistema.
 *
 * @since 1.0.0
 */
function buildStatisticsAnalysisCache(StatisticsRepository $repository): SimpleCache
{
    $settings = $repository->getCacheSettings();

    return new SimpleCache(
        __DIR__ . '/../../storage/cache',
        (bool) ($settings['enabled'] ?? 0),
        (int) ($settings['default_ttl'] ?? 300)
    );
}

/**
 * Cria o cache do scraping da banca com TTL fixo de uma hora.
 *
 * @since 1.0.0
 */
function buildStatisticsBancaCache(StatisticsRepository $repository): SimpleCache
{
    $settings = $repository->getCacheSettings();

    return new SimpleCache(
        __DIR__ . '/../../storage/cache',
        (bool) ($settings['enabled'] ?? 0),
        3600
    );
}

/**
 * Rota oficial do raio-x da banca.
 *
 * @since 1.0.0
 */
function handleStatisticsXrayRoute(PDO $db): void
{
    try {
        $authenticatedUserPayload = verifyAuthenticatedUserPayload();
        $authenticatedUserId = trim((string) ($authenticatedUserPayload['user_id'] ?? ''));
        $context = buildStatisticsContext($db);
        $normalizedFilters = $context['validator']->validateXrayQuery($_GET);
        $cache = buildStatisticsAnalysisCache($context['repository']);

        $cacheParams = [
            'banca' => $normalizedFilters['banca'],
            'cargo' => $normalizedFilters['cargo'] ?? '',
            'ano' => $normalizedFilters['ano'] ?? '',
            'viewer_id' => $authenticatedUserId,
        ];

        $cachedResponse = $cache->get('statistics_xray', $cacheParams);
        if ($cachedResponse !== null) {
            header('X-Cache: HIT');
            sendStatisticsJson($cachedResponse);
        }

        header('X-Cache: MISS');
        $result = $context['controller']->getXrayStats($authenticatedUserId, $normalizedFilters);
        $response = ApiEnvelope::success($result, 'Raio-X da banca carregado com sucesso.');
        $cache->set('statistics_xray', $response, $cacheParams);

        sendStatisticsJson($response);
    } catch (InvalidArgumentException $e) {
        Response::badRequest($e->getMessage());
    } catch (DomainException $e) {
        Response::forbidden($e->getMessage());
    } catch (PDOException $e) {
        Response::serverError('No foi possvel carregar o Raio-X da banca.', $e);
    } catch (RuntimeException $e) {
        Response::unauthorized($e->getMessage());
    } catch (Throwable $e) {
        Response::serverError('No foi possvel carregar o Raio-X da banca.', $e);
    }
}

/**
 * Rota oficial da inteligencia pblica do site da banca.
 *
 * @since 1.0.0
 */
function handleStatisticsBancaInfoRoute(PDO $db): void
{
    try {
        $authenticatedUserPayload = verifyAuthenticatedUserPayload();
        $authenticatedUserId = trim((string) ($authenticatedUserPayload['user_id'] ?? ''));
        $context = buildStatisticsContext($db);
        $normalizedQuery = $context['validator']->validateBancaInfoQuery($_GET);
        $cache = buildStatisticsBancaCache($context['repository']);

        $cacheParams = [
            'url' => $normalizedQuery['url'],
            'viewer_id' => $authenticatedUserId,
        ];

        $cachedResponse = $cache->get('statistics_banca_info', $cacheParams);
        if ($cachedResponse !== null) {
            header('X-Cache: HIT');
            sendStatisticsJson($cachedResponse);
        }

        header('X-Cache: MISS');
        $response = $context['controller']->getBancaInfo($authenticatedUserId, $normalizedQuery);
        $cache->set('statistics_banca_info', $response, $cacheParams);

        sendStatisticsJson($response);
    } catch (InvalidArgumentException $e) {
        Response::badRequest($e->getMessage());
    } catch (DomainException $e) {
        Response::forbidden($e->getMessage());
    } catch (PDOException $e) {
        Response::serverError('No foi possvel consultar a inteligencia da banca.', $e);
    } catch (RuntimeException $e) {
        Response::unauthorized($e->getMessage());
    } catch (Throwable $e) {
        Response::serverError('No foi possvel consultar a inteligencia da banca.', $e);
    }
}

/**
 * Rota oficial do agregado do usurio.
 *
 * @since 1.0.0
 */
function handleStatisticsUserRoute(PDO $db): void
{
    try {
        $authenticatedUserPayload = verifyAuthenticatedUserPayload();
        $pathUserId = extractStatisticsTrailingPathId();
        $query = $_GET;
        if ($pathUserId !== null && !isset($query['user_id']) && !isset($query['userId'])) {
            $query['user_id'] = $pathUserId;
        }

        $context = buildStatisticsContext($db);
        $result = $context['controller']->getUserStatistics($authenticatedUserPayload, $query);
        Response::success($result, 'User statistics retrieved');
    } catch (InvalidArgumentException $e) {
        Response::badRequest($e->getMessage());
    } catch (DomainException $e) {
        Response::forbidden($e->getMessage());
    } catch (PDOException $e) {
        Response::serverError('Failed to fetch user statistics', $e);
    } catch (RuntimeException $e) {
        Response::unauthorized($e->getMessage());
    } catch (Throwable $e) {
        Response::serverError('Failed to fetch user statistics', $e);
    }
}

/**
 * Rota oficial para registrar uma sessao de estudo do usuario autenticado.
 *
 * @since 1.0.0
 */
function handleStatisticsStudySessionRoute(PDO $db): void
{
    try {
        if (($_SERVER['REQUEST_METHOD'] ?? 'GET') !== 'POST') {
            Response::error('Metodo nao permitido.', 405);
        }

        $authenticatedUserPayload = verifyAuthenticatedUserPayload();
        $payload = json_decode(file_get_contents('php://input'), true) ?: [];

        $context = buildStatisticsContext($db);
        $result = $context['controller']->recordStudySession($authenticatedUserPayload, $payload);

        Response::success($result, 'Sessao de estudo registrada com sucesso.');
    } catch (InvalidArgumentException $e) {
        Response::validationError($e->getMessage());
    } catch (RuntimeException $e) {
        Response::unauthorized($e->getMessage());
    } catch (Throwable $e) {
        Response::serverError('Failed to record study session', $e);
    }
}

/**
 * Rota oficial do agregado pblico da questo.
 *
 * @since 1.0.0
 */
function handleStatisticsQuestionRoute(PDO $db): void
{
    try {
        $pathQuestionId = extractStatisticsTrailingPathId();
        $query = $_GET;
        if ($pathQuestionId !== null && !isset($query['question_id']) && !isset($query['questionId'])) {
            $query['question_id'] = $pathQuestionId;
        }

        $context = buildStatisticsContext($db);
        $result = $context['controller']->getQuestionStatistics($query);
        Response::success($result, 'Question statistics retrieved');
    } catch (InvalidArgumentException $e) {
        Response::badRequest($e->getMessage());
    } catch (Throwable $e) {
        Response::serverError('Failed to fetch question statistics', $e);
    }
}

/**
 * Rota oficial dos indicadores globais da plataforma.
 *
 * @since 1.0.0
 */
function handleStatisticsPlatformRoute(PDO $db): void
{
    try {
        $authenticatedUserPayload = verifyAuthenticatedUserPayload();
        $context = buildStatisticsContext($db);
        $result = $context['controller']->getPlatformStatistics($authenticatedUserPayload);
        Response::success($result, 'Platform statistics retrieved');
    } catch (DomainException $e) {
        Response::forbidden($e->getMessage());
    } catch (RuntimeException $e) {
        Response::unauthorized($e->getMessage());
    } catch (Throwable $e) {
        Response::serverError('Failed to fetch platform statistics', $e);
    }
}

/**
 * Rota oficial de instalacao/garantia do schema de estatisticas.
 *
 * @since 1.0.0
 */
function handleStatisticsInstallRoute(PDO $db): void
{
    try {
        $authenticatedUserPayload = verifyAuthenticatedUserPayload();
        $context = buildStatisticsContext($db);
        $result = $context['controller']->installStatistics($authenticatedUserPayload);
        Response::success($result, 'Statistics installation finished.');
    } catch (DomainException $e) {
        Response::forbidden($e->getMessage());
    } catch (RuntimeException $e) {
        Response::unauthorized($e->getMessage());
    } catch (Throwable $e) {
        Response::serverError('Failed to install statistics schema', $e);
    }
}

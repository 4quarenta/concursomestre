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

require_once __DIR__ . '/controllers/SubscriptionsController.php';
require_once __DIR__ . '/services/SubscriptionsService.php';
require_once __DIR__ . '/repositories/SubscriptionsRepository.php';
require_once __DIR__ . '/validators/SubscriptionsValidator.php';
require_once __DIR__ . '/../../shared/auth/request_auth.php';
require_once __DIR__ . '/../../shared/security/AdminSecurity.php';
require_once __DIR__ . '/../../shared/responses/Response.php';
require_once __DIR__ . '/../../config/payment_provider.php';

/**
 * Fabrica o controller do dominio de assinaturas com a infraestrutura oficial.
 *
 * @since 1.0.0
 */
function buildSubscriptionsController(PDO $db): SubscriptionsController
{
    ensurePaymentProviderSchema($db);

    return new SubscriptionsController(
        new SubscriptionsService(
            $db,
            new SubscriptionsRepository($db),
            new SubscriptionsValidator()
        )
    );
}

/**
 * Entrada oficial da validacao de cupom do checkout.
 *
 * @since 1.0.0
 */
function handleSubscriptionsValidateCouponRoute(PDO $db): void
{
    try {
        $body = json_decode(file_get_contents('php://input'), true) ?: [];
        try {
            $authPayload = verifyAuthenticatedUserPayload(false);
        } catch (Throwable $authError) {
            $authPayload = null;
        }
        if (is_array($authPayload) && !empty($authPayload['user_id'])) {
            $body['authenticated_user_id'] = (string) $authPayload['user_id'];
            $body['authenticated_user_email'] = (string) ($authPayload['email'] ?? '');
        }

        $controller = buildSubscriptionsController($db);
        $coupon = $controller->validateCoupon($body);
        http_response_code(200);
        header('Content-Type: application/json; charset=UTF-8');
        echo json_encode([
            'success' => true,
            'coupon' => $coupon,
        ], JSON_UNESCAPED_UNICODE);
        exit;
    } catch (InvalidArgumentException $e) {
        http_response_code(200);
        header('Content-Type: application/json; charset=UTF-8');
        echo json_encode([
            'success' => false,
            'message' => $e->getMessage(),
        ], JSON_UNESCAPED_UNICODE);
        exit;
    } catch (Throwable $e) {
        Response::serverError('Erro ao validar cupom.', $e);
    }
}

/**
 * Entrada oficial da criacao do Checkout Session hospedado da Stripe.
 *
 * @since 1.0.0
 */
function handleSubscriptionsStripeCheckoutRoute(PDO $db): void
{
    try {
        $payload = verifyAuthenticatedUserPayload(true);
        $body = json_decode(file_get_contents('php://input'), true) ?: [];
        $controller = buildSubscriptionsController($db);
        $result = $controller->createStripeCheckoutSession((string) $payload['user_id'], $body);
        $message = ($result['mode'] ?? '') === 'local_credit'
            ? 'Assinatura ativada com credito interno.'
            : 'Checkout Stripe criado com sucesso.';

        Response::success($result, $message);
    } catch (DomainException $e) {
        Response::error($e->getMessage(), 403);
    } catch (InvalidArgumentException $e) {
        Response::badRequest($e->getMessage());
    } catch (OutOfBoundsException $e) {
        Response::notFound($e->getMessage());
    } catch (RuntimeException $e) {
        Response::serverError($e->getMessage(), $e);
    } catch (Throwable $e) {
        Response::serverError('Nao foi possivel iniciar o checkout Stripe.', $e);
    }
}

/**
 * Entrada oficial da criacao do fluxo interno da Stripe com PaymentIntent.
 *
 * @since 1.0.0
 */
function handleSubscriptionsStripeInlineRoute(PDO $db): void
{
    try {
        $payload = verifyAuthenticatedUserPayload(true);
        $body = json_decode(file_get_contents('php://input'), true) ?: [];
        $controller = buildSubscriptionsController($db);
        $result = $controller->createStripeInlineSubscription((string) $payload['user_id'], $body);
        $message = ($result['mode'] ?? '') === 'local_credit'
            ? 'Assinatura ativada com credito interno.'
            : 'Fluxo interno Stripe iniciado com sucesso.';

        Response::success($result, $message);
    } catch (DomainException $e) {
        Response::error($e->getMessage(), 403);
    } catch (InvalidArgumentException $e) {
        Response::badRequest($e->getMessage());
    } catch (OutOfBoundsException $e) {
        Response::notFound($e->getMessage());
    } catch (RuntimeException $e) {
        Response::serverError($e->getMessage(), $e);
    } catch (Throwable $e) {
        Response::serverError('Nao foi possivel iniciar a assinatura Stripe.', $e);
    }
}

/**
 * Entrada oficial da finalizacao do fluxo Stripe apos confirmacao no client.
 *
 * @since 1.0.0
 */
function handleSubscriptionsStripeFinalizeRoute(PDO $db): void
{
    try {
        $payload = verifyAuthenticatedUserPayload(true);
        $body = json_decode(file_get_contents('php://input'), true) ?: [];
        $controller = buildSubscriptionsController($db);
        $result = $controller->finalizeStripeSubscription((string) $payload['user_id'], $body);

        if (($result['response_type'] ?? '') === 'validation_error') {
            Response::validationError($result['error']);
        }

        Response::success(
            $result['data'] ?? [],
            (string) ($result['message'] ?? 'Assinatura Stripe sincronizada com sucesso.')
        );
    } catch (DomainException $e) {
        Response::error($e->getMessage(), 403);
    } catch (InvalidArgumentException $e) {
        Response::badRequest($e->getMessage());
    } catch (OutOfBoundsException $e) {
        Response::notFound($e->getMessage());
    } catch (RuntimeException $e) {
        Response::serverError($e->getMessage(), $e);
    } catch (Throwable $e) {
        Response::serverError('Nao foi possivel finalizar a assinatura Stripe.', $e);
    }
}

/**
 * Entrada oficial de consulta/solicitação da capability pix_payments na Stripe.
 * GET consulta status para o checkout; POST solicita ativação e exige admin.
 *
 * @since 1.0.0
 */
function handleSubscriptionsStripePixCapabilityRoute(PDO $db): void
{
    try {
        $method = strtoupper((string) ($_SERVER['REQUEST_METHOD'] ?? 'GET'));
        $requestCapability = false;

        if ($method === 'GET') {
            verifyAuthenticatedUserPayload(true);
        } elseif ($method === 'POST') {
            requirePlatformAdminSessionContext($db);
            $body = json_decode(file_get_contents('php://input'), true) ?: [];
            $requestCapability = (bool) ($body['request'] ?? true);
        } else {
            Response::error('Metodo nao permitido.', 405);
        }

        $controller = buildSubscriptionsController($db);
        $result = $controller->resolveStripePixCapability($requestCapability);

        Response::success($result, (string) ($result['message'] ?? 'Status PIX Stripe carregado.'));
    } catch (RuntimeException $e) {
        Response::unauthorized($e->getMessage());
    } catch (Throwable $e) {
        Response::serverError('Nao foi possivel consultar a capability PIX da Stripe.', $e);
    }
}

/**
 * Entrada oficial do webhook Stripe do dominio de assinaturas.
 *
 * @since 1.0.0
 */
function handleSubscriptionsStripeWebhookRoute(PDO $db): void
{
    try {
        $controller = buildSubscriptionsController($db);
        $maxPayloadBytes = 1024 * 1024;
        $contentLength = (int) ($_SERVER['CONTENT_LENGTH'] ?? 0);
        if ($contentLength > $maxPayloadBytes) {
            throw new InvalidArgumentException('Payload de webhook acima do limite permitido.');
        }

        $stream = fopen('php://input', 'rb');
        $payload = $stream ? (string) stream_get_contents($stream, $maxPayloadBytes + 1) : '';
        if (is_resource($stream)) {
            fclose($stream);
        }
        if (strlen($payload) > $maxPayloadBytes) {
            throw new InvalidArgumentException('Payload de webhook acima do limite permitido.');
        }
        $signature = (string) ($_SERVER['HTTP_STRIPE_SIGNATURE'] ?? '');
        $result = $controller->enqueueStripeWebhook($payload, $signature);

        http_response_code(200);
        header('Content-Type: application/json; charset=UTF-8');
        echo json_encode($result, JSON_UNESCAPED_UNICODE);
        exit;
    } catch (Throwable $e) {
        error_log('[subscriptions_stripe_webhook] ' . $e->getMessage());
        $statusCode = ($e instanceof RuntimeException && $e->getMessage() === 'Stripe webhook nao configurado.')
            ? 500
            : ($e instanceof InvalidArgumentException ? 413 : 400);
        http_response_code($statusCode);
        header('Content-Type: application/json; charset=UTF-8');
        echo json_encode([
            'success' => false,
            'message' => 'Webhook Stripe não pôde ser processado.',
        ], JSON_UNESCAPED_UNICODE);
        exit;
    }
}

/**
 * Entrada oficial da atualizacao de renovacao automatica.
 *
 * @since 1.0.0
 */
function handleSubscriptionsUpdateRenewalRoute(PDO $db): void
{
    try {
        $payload = verifyAuthenticatedUserPayload(true);
        $body = json_decode(file_get_contents('php://input'), true) ?: [];
        $controller = buildSubscriptionsController($db);
        $result = $controller->updateRenewal((string) $payload['user_id'], $body);

        Response::success([
            'auto_renew' => $result['auto_renew'],
            'cancel_at_period_end' => $result['cancel_at_period_end'],
            'term_commitment_active' => $result['term_commitment_active'],
            'total_installments' => $result['total_installments'],
            'paid_installments' => $result['paid_installments'],
        ], (string) $result['message']);
    } catch (InvalidArgumentException $e) {
        Response::badRequest($e->getMessage());
    } catch (OutOfBoundsException $e) {
        Response::notFound($e->getMessage());
    } catch (RuntimeException $e) {
        Response::unauthorized($e->getMessage());
    } catch (Throwable $e) {
        Response::serverError('Falha ao atualizar renovacao automatica.', $e);
    }
}

/**
 * Consulta a assinatura financeira do usuario autenticado.
 *
 * @since 1.0.0
 */
function handleSubscriptionsCurrentRoute(PDO $db): void
{
    try {
        if (strtoupper((string) ($_SERVER['REQUEST_METHOD'] ?? 'GET')) !== 'GET') {
            Response::error('Metodo nao permitido.', 405);
        }

        $payload = verifyAuthenticatedUserPayload(true);
        $controller = buildSubscriptionsController($db);
        $result = $controller->getCurrentUserBillingSnapshot((string) $payload['user_id']);

        Response::success($result, 'Assinatura carregada com sucesso.');
    } catch (RuntimeException $e) {
        Response::unauthorized($e->getMessage());
    } catch (Throwable $e) {
        Response::serverError('Nao foi possivel carregar a assinatura.', $e);
    }
}

/**
 * Sincroniza a assinatura Stripe do usuario atual para recuperar renovacoes
 * materializadas no provedor que ainda nao refletiram localmente.
 *
 * @since 1.0.0
 */
function handleSubscriptionsSyncCurrentRoute(PDO $db): void
{
    try {
        $payload = verifyAuthenticatedUserPayload(true);
        $controller = buildSubscriptionsController($db);
        $result = $controller->syncCurrentUserStripeState((string) $payload['user_id']);

        Response::success(
            $result,
            !empty($result['materialized_invoice'])
                ? 'Renovacao sincronizada com sucesso.'
                : 'Assinatura verificada com sucesso.'
        );
    } catch (OutOfBoundsException $e) {
        Response::notFound($e->getMessage());
    } catch (InvalidArgumentException $e) {
        Response::badRequest($e->getMessage());
    } catch (RuntimeException $e) {
        Response::validationError($e->getMessage());
    } catch (Throwable $e) {
        Response::serverError('Nao foi possivel sincronizar a assinatura agora.', $e);
    }
}

/**
 * Entrada oficial da abertura do portal Stripe.
 *
 * @since 1.0.0
 */
function handleSubscriptionsStripePortalRoute(PDO $db): void
{
    try {
        $payload = verifyAuthenticatedUserPayload(true);
        $controller = buildSubscriptionsController($db);
        $result = $controller->createStripePortalSession((string) $payload['user_id']);

        Response::success($result, 'Portal Stripe criado com sucesso.');
    } catch (InvalidArgumentException $e) {
        Response::badRequest($e->getMessage());
    } catch (RuntimeException $e) {
        Response::unauthorized($e->getMessage());
    } catch (Throwable $e) {
        Response::serverError('Nao foi possivel abrir o portal Stripe.', $e);
    }
}

/**
 * Entrada oficial do cancelamento de assinatura dentro do prazo de arrependimento.
 *
 * @since 1.0.0
 */
function handleSubscriptionsCancelRoute(PDO $db): void
{
    try {
        $payload = verifyAuthenticatedUserPayload(true);
        $body = json_decode(file_get_contents('php://input'), true) ?: [];
        $controller = buildSubscriptionsController($db);
        $result = $controller->cancelSubscription((string) $payload['user_id'], $body);

        $responseData = [
            'refund_processed' => $result['refund_processed'] ?? false,
        ];
        if (array_key_exists('refund_id', $result)) {
            $responseData['refund_id'] = $result['refund_id'];
        }

        Response::success($responseData, (string) ($result['message'] ?? 'Sua assinatura foi cancelada.'));
    } catch (DomainException $e) {
        Response::error($e->getMessage(), 403);
    } catch (InvalidArgumentException $e) {
        Response::badRequest($e->getMessage());
    } catch (RuntimeException $e) {
        Response::validationError($e->getMessage());
    } catch (Throwable $e) {
        Response::serverError('Nao foi possivel processar o cancelamento da assinatura.', $e);
    }
}

/**
 * Entrada oficial do cancelamento da solicitacao de estorno.
 *
 * @since 1.0.0
 */
function handleSubscriptionsCancelRefundRoute(PDO $db): void
{
    try {
        $payload = verifyAuthenticatedUserPayload(true);
        $controller = buildSubscriptionsController($db);
        $result = $controller->cancelRefundRequest((string) $payload['user_id']);

        Response::success([
            'transaction_id' => $result['transaction_id'] ?? null,
        ], (string) $result['message']);
    } catch (OutOfBoundsException $e) {
        Response::notFound($e->getMessage());
    } catch (Throwable $e) {
        Response::serverError('Nao foi possivel cancelar a solicitacao de reembolso.', $e);
    }
}

/**
 * Entrada oficial da reversao da solicitacao de cancelamento.
 *
 * @since 1.0.0
 */
function handleSubscriptionsUndoCancelRoute(PDO $db): void
{
    try {
        $payload = verifyAuthenticatedUserPayload(true);
        $controller = buildSubscriptionsController($db);
        $result = $controller->undoCancellationRequest((string) $payload['user_id']);

        Response::success([
            'transaction_id' => $result['transaction_id'] ?? null,
        ], (string) $result['message']);
    } catch (OutOfBoundsException $e) {
        Response::notFound($e->getMessage());
    } catch (Throwable $e) {
        Response::serverError('Nao foi possivel reverter a solicitacao de cancelamento.', $e);
    }
}

/**
 * Segredo compartilhado dos jobs legados do dominio de assinaturas.
 *
 * @since 1.0.0
 */
function getSubscriptionsCronSecret(): string
{
    $secret = $_ENV['CRON_SECRET'] ?? getenv('CRON_SECRET') ?? '';
    return trim((string) $secret);
}

/**
 * Garante que o segredo de cron esteja configurado antes de aceitar bridges HTTP.
 *
 * @since 1.0.0
 */
function requireSubscriptionsCronSecret(): string
{
    $secret = getSubscriptionsCronSecret();
    if ($secret === '') {
        throw new RuntimeException('CRON_SECRET nao configurado.');
    }

    return $secret;
}

/**
 * Resolve a chave enviada por query string ou header para cron legado.
 *
 * @since 1.0.0
 */
function resolveSubscriptionsCronRequestKey(): string
{
    $queryKey = trim((string) ($_GET['key'] ?? ''));
    if ($queryKey !== '') {
        return $queryKey;
    }

    return trim((string) ($_SERVER['HTTP_X_CRON_SECRET'] ?? ''));
}

/**
 * Entrada oficial do cron de reconciliacao Stripe.
 *
 * @since 1.0.0
 */
function handleSubscriptionsStripeReconciliationCronRoute(PDO $db): void
{
    try {
        $configuredSecret = requireSubscriptionsCronSecret();
    } catch (RuntimeException $e) {
        http_response_code(500);
        header('Content-Type: application/json; charset=UTF-8');
        echo json_encode([
            'success' => false,
            'message' => $e->getMessage(),
        ], JSON_UNESCAPED_UNICODE);
        exit;
    }

    $providedKey = resolveSubscriptionsCronRequestKey();
    if ($providedKey === '' || !hash_equals($configuredSecret, $providedKey)) {
        http_response_code(403);
        header('Content-Type: application/json; charset=UTF-8');
        echo json_encode([
            'success' => false,
            'message' => 'Acesso negado: chave invalida.',
        ], JSON_UNESCAPED_UNICODE);
        exit;
    }

    try {
        $controller = buildSubscriptionsController($db);
        $summary = $controller->runStripeReconciliationCron();

        http_response_code(200);
        header('Content-Type: application/json; charset=UTF-8');
        echo json_encode([
            'success' => true,
            'summary' => $summary,
        ], JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        exit;
    } catch (Throwable $e) {
        http_response_code(500);
        header('Content-Type: application/json; charset=UTF-8');
        echo json_encode([
            'success' => false,
            'message' => 'Falha ao reconciliar assinaturas Stripe.',
            'details' => $e->getMessage(),
        ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        exit;
    }
}

/**
 * Resolve a URL base da API legada a partir da requisicao atual.
 *
 * @since 1.0.0
 */
function resolveSubscriptionsApiBaseUrl(): string
{
    $scheme = 'http';
    $forwardedProto = trim((string) ($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? ''));
    if ($forwardedProto !== '') {
        $scheme = explode(',', $forwardedProto)[0];
    } elseif (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') {
        $scheme = 'https';
    }

    $host = trim((string) ($_SERVER['HTTP_HOST'] ?? 'localhost'));
    $scriptName = (string) ($_SERVER['SCRIPT_NAME'] ?? '/questao-pro-backend/api/subscriptions/automation_helper.php');
    $apiBasePath = dirname(dirname(str_replace('\\', '/', $scriptName)));

    if ($apiBasePath === '.' || $apiBasePath === '/' || $apiBasePath === '\\') {
        $apiBasePath = '/api';
    }

    return rtrim($scheme . '://' . $host . $apiBasePath, '/');
}

/**
 * Define o caminho oficial dos logs operacionais de assinatura.
 *
 * @since 1.0.0
 */
function getSubscriptionsRuntimeLogPath(string $filename): string
{
    $logDirectory = dirname(__DIR__, 2) . '/storage/logs';
    if (!is_dir($logDirectory)) {
        mkdir($logDirectory, 0777, true);
    }

    return $logDirectory . '/' . ltrim($filename, '/');
}

/**
 * Entrada oficial do helper operacional usado pelo admin para configurar cron.
 *
 * @since 1.0.0
 */
function handleSubscriptionsAutomationHelperRoute(PDO $db): void
{
    $method = strtoupper((string) ($_SERVER['REQUEST_METHOD'] ?? 'GET'));
    if (!in_array($method, ['GET', 'POST'], true)) {
        Response::error('Metodo nao permitido.', 405);
    }

    try {
        $adminContext = requirePlatformAdminSessionContext($db);
        $body = $method === 'POST'
            ? (json_decode(file_get_contents('php://input'), true) ?: [])
            : [];
        $action = trim((string) ($_GET['action'] ?? $body['action'] ?? 'info'));
        $controller = buildSubscriptionsController($db);

        if ($action === 'run_now') {
            if ($method !== 'POST') {
                Response::error('Metodo nao permitido.', 405);
            }

            $cronLock = acquireCronLockOrRespond('subscriptions_stripe_reconciliation');
            register_shutdown_function([$cronLock, 'release']);

            try {
                $summary = $controller->runStripeReconciliationCron();
            } catch (RuntimeException $e) {
                Response::validationError($e->getMessage());
            }

            logAdminAudit(
                $db,
                (string) $adminContext['admin_user_id'],
                'subscriptions.automation.run_now',
                'subscription_automation',
                null,
                [
                    'checked' => (int) ($summary['checked'] ?? 0),
                    'synced_status' => (int) ($summary['synced_status'] ?? 0),
                    'issues' => (int) ($summary['issues'] ?? 0),
                ]
            );

            Response::success([
                'summary' => $summary,
                'ran_at' => gmdate(DATE_ATOM),
            ], 'Rotina de reconciliacao Stripe executada com sucesso.');
        }

        if ($method !== 'GET') {
            Response::error('Metodo nao permitido.', 405);
        }

        $cronSecret = getSubscriptionsCronSecret();
        if ($action === 'download_bat' && $cronSecret === '') {
            Response::validationError('CRON_SECRET nao configurado. Configure o segredo antes de baixar o script do cron.');
        }

        $payload = $controller->buildAutomationHelperPayload(
            resolveSubscriptionsApiBaseUrl(),
            $cronSecret
        );
        $payload['configured'] = $cronSecret !== '';
        if ($cronSecret === '') {
            $payload['cron_url'] = '';
            $payload['download_url'] = '';
            $payload['linux_command'] = '';
            $payload['warning'] = 'CRON_SECRET nao configurado. Configure a variavel de ambiente para habilitar a automacao.';
        }

        if ($action === 'download_bat') {
            logAdminAudit(
                $db,
                (string) $adminContext['admin_user_id'],
                'subscriptions.automation.download',
                'subscription_automation',
                null,
                ['cron_url' => $payload['cron_url']]
            );

            header('Content-Type: application/octet-stream');
            header('Content-Disposition: attachment; filename="concurso_mestre_cron.bat"');
            echo $controller->buildAutomationBatchScript((string) $payload['cron_url']);
            exit;
        }

        if ($action !== 'info') {
            Response::badRequest('Acao invalida.');
        }

        logAdminAudit(
            $db,
            (string) $adminContext['admin_user_id'],
            'subscriptions.automation.view',
            'subscription_automation',
            null,
            ['cron_url' => $payload['cron_url']]
        );

        Response::success($payload);
    } catch (Throwable $e) {
        Response::serverError('Nao foi possivel carregar as instrucoes de automacao.', $e);
    }
}

/**
 * Entrada oficial da matriz de testes Stripe para auditoria administrativa.
 *
 * @since 1.0.0
 */
function handleSubscriptionsStripeTestingMatrixRoute(PDO $db): void
{
    $method = strtoupper((string) ($_SERVER['REQUEST_METHOD'] ?? 'GET'));
    if ($method !== 'GET') {
        Response::error('Metodo nao permitido.', 405);
    }

    try {
        $adminContext = requirePlatformAdminSessionContext($db);
        $controller = buildSubscriptionsController($db);
        $payload = $controller->buildStripeTestingMatrixPayload();

        logAdminAudit(
            $db,
            (string) $adminContext['admin_user_id'],
            'subscriptions.testing_matrix.view',
            'subscription_testing_matrix',
            null,
            ['total_cases' => (int) ($payload['summary']['total'] ?? 0)]
        );

        Response::success($payload, 'Matriz Stripe carregada com sucesso.');
    } catch (Throwable $e) {
        Response::serverError('Nao foi possivel carregar a matriz oficial de testes Stripe.', $e);
    }
}

/**
 * Entrada oficial do historico/registro de execucao guiada da matriz Stripe.
 * GET lista evidencias; POST registra uma nova execucao.
 *
 * @since 1.0.0
 */
function handleSubscriptionsStripeTestingRunsRoute(PDO $db): void
{
    $method = strtoupper((string) ($_SERVER['REQUEST_METHOD'] ?? 'GET'));

    try {
        $adminContext = requirePlatformAdminSessionContext($db);
        $controller = buildSubscriptionsController($db);

        if ($method === 'GET') {
            $limit = (int) ($_GET['limit'] ?? 80);
            $payload = $controller->listStripeTestingRuns($limit);

            logAdminAudit(
                $db,
                (string) $adminContext['admin_user_id'],
                'subscriptions.testing_matrix_runs.view',
                'subscription_testing_matrix_runs',
                null,
                ['limit' => $limit, 'total' => (int) ($payload['total'] ?? 0)]
            );

            Response::success($payload, 'Historico da matriz Stripe carregado com sucesso.');
        }

        if ($method === 'POST') {
            $body = json_decode(file_get_contents('php://input'), true) ?: [];
            $payload = $controller->createStripeTestingRun((string) $adminContext['admin_user_id'], $body);

            logAdminAudit(
                $db,
                (string) $adminContext['admin_user_id'],
                'subscriptions.testing_matrix_runs.create',
                'subscription_testing_matrix_runs',
                (string) ($payload['run_id'] ?? null),
                [
                    'scenario_id' => (string) ($payload['scenario_id'] ?? ''),
                    'execution_result' => (string) ($payload['execution_result'] ?? ''),
                ]
            );

            Response::success($payload, 'Execucao guiada registrada com sucesso.');
        }

        Response::error('Metodo nao permitido.', 405);
    } catch (DomainException $e) {
        Response::error($e->getMessage(), 403);
    } catch (InvalidArgumentException $e) {
        Response::badRequest($e->getMessage());
    } catch (Throwable $e) {
        Response::serverError('Nao foi possivel processar o registro de execucao da matriz Stripe.', $e);
    }
}

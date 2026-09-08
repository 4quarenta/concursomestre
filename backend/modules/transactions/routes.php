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

require_once __DIR__ . '/controllers/TransactionsController.php';
require_once __DIR__ . '/services/TransactionsService.php';
require_once __DIR__ . '/repositories/TransactionsRepository.php';
require_once __DIR__ . '/validators/TransactionsValidator.php';
require_once __DIR__ . '/../../shared/auth/request_auth.php';
require_once __DIR__ . '/../../shared/security/AdminSecurity.php';
require_once __DIR__ . '/../../shared/responses/Response.php';
require_once __DIR__ . '/../../config/payment_provider.php';

/**
 * Fabrica o controller de transacoes usando a infraestrutura oficial do modulo.
 *
 * @since 1.0.0
 */
function buildTransactionsController(PDO $db): TransactionsController
{
    ensurePaymentProviderSchema($db);

    return new TransactionsController(
        new TransactionsService(
            $db,
            new TransactionsRepository($db),
            new TransactionsValidator()
        )
    );
}

/**
 * Entrada oficial da compra direta de materiais no marketplace.
 *
 * @since 1.0.0
 */
function handleTransactionsCreateRoute(PDO $db): void
{
    try {
        $payload = verifyAuthenticatedUserPayload(true);
        $body = json_decode(file_get_contents('php://input'), true) ?: [];
        $controller = buildTransactionsController($db);

        Response::success(
            $controller->createMaterialPurchase((string) $payload['user_id'], $body)
        );
    } catch (InvalidArgumentException $e) {
        Response::badRequest($e->getMessage());
    } catch (OutOfBoundsException $e) {
        Response::notFound($e->getMessage());
    } catch (RuntimeException $e) {
        Response::validationError($e->getMessage());
    } catch (Throwable $e) {
        Response::serverError('Nao foi possivel processar a compra do material.', $e);
    }
}

/**
 * Entrada oficial da listagem paginada de transacoes.
 * Mantem o contrato atual da API enquanto a regra sai do endpoint legado.
 *
 * @since 1.0.0
 */
function handleTransactionsListRoute(PDO $db): void
{
    try {
        $payload = verifyAuthenticatedUserPayload(true);
        $authenticatedUserId = trim((string) ($payload['user_id'] ?? ''));
        $authenticatedUserRole = strtolower(trim((string) ($payload['role'] ?? '')));
        $isPlatformAdmin = $authenticatedUserRole === 'admin';
        $query = $_GET;
        if ($isPlatformAdmin) {
            $query['user_id'] = trim((string) ($_GET['user_id'] ?? ''));
        } else {
            // Usuário comum e staff nunca podem escolher outro comprador/vendedor
            // pela query string. A listagem sempre pertence à própria conta.
            $query['user_id'] = $authenticatedUserId;
        }

        $controller = buildTransactionsController($db);
        Response::success($controller->listTransactions($query));
    } catch (RuntimeException $e) {
        Response::unauthorized($e->getMessage());
    } catch (Throwable $e) {
        Response::serverError('Nao foi possivel carregar as transacoes.', $e);
    }
}

/**
 * Entrada oficial da solicitacao de reembolso do usuario.
 *
 * @since 1.0.0
 */
function handleTransactionsRefundRoute(PDO $db): void
{
    try {
        $payload = verifyAuthenticatedUserPayload(true);
        $body = json_decode(file_get_contents('php://input'), true) ?: [];
        $controller = buildTransactionsController($db);

        Response::success(
            $controller->requestRefund((string) $payload['user_id'], $body),
            'Reembolso solicitado.'
        );
    } catch (InvalidArgumentException $e) {
        Response::badRequest($e->getMessage());
    } catch (OutOfBoundsException $e) {
        Response::notFound($e->getMessage());
    } catch (Throwable $e) {
        Response::serverError('Nao foi possivel solicitar o reembolso.', $e);
    }
}

/**
 * Entrada oficial da aprovacao administrativa de estorno.
 *
 * @since 1.0.0
 */
function handleTransactionsApproveRefundRoute(PDO $db): void
{
    try {
        $adminContext = requirePlatformAdminSessionContext($db);
        $body = json_decode(file_get_contents('php://input'), true) ?: [];
        $body['actor_id'] = (string) $adminContext['admin_user_id'];
        $controller = buildTransactionsController($db);
        $payload = $controller->approveRefund($body);

        logAdminAudit(
            $db,
            (string) $adminContext['admin_user_id'],
            'transaction.approve_refund',
            'transaction',
            (string) ($body['transaction_id'] ?? ''),
            [
                'user_id' => $payload['transaction']['user_id'] ?? null,
                'type' => $payload['transaction']['type'] ?? null,
            ]
        );

        Response::success([], (string) ($payload['message'] ?? 'Estorno realizado com sucesso.'));
    } catch (InvalidArgumentException $e) {
        Response::badRequest($e->getMessage());
    } catch (OutOfBoundsException $e) {
        Response::notFound($e->getMessage());
    } catch (Throwable $e) {
        Response::serverError('Nao foi possivel aprovar o estorno.', $e);
    }
}

function handleTransactionsRetentionDecisionRoute(PDO $db): void
{
    try {
        if (strtoupper((string) ($_SERVER['REQUEST_METHOD'] ?? 'POST')) !== 'POST') {
            Response::error('Metodo nao permitido.', 405);
        }
        $csrfCookie = getCsrfTokenFromCookie();
        if ($csrfCookie !== null && !assertValidCsrfToken($csrfCookie, getCsrfTokenFromRequest())) {
            Response::forbidden('CSRF token invalido.');
        }
        $payload = verifyAuthenticatedUserPayload(true);
        $body = json_decode(file_get_contents('php://input'), true) ?: [];
        $result = buildTransactionsController($db)->decideRefundRetentionOffer(
            (string) ($payload['user_id'] ?? ''),
            $body
        );
        Response::success($result, (string) ($result['message'] ?? 'Decisão registrada.'));
    } catch (DomainException $e) {
        Response::error($e->getMessage(), 409);
    } catch (InvalidArgumentException $e) {
        Response::badRequest($e->getMessage());
    } catch (OutOfBoundsException $e) {
        Response::notFound($e->getMessage());
    } catch (RuntimeException $e) {
        Response::unauthorized($e->getMessage());
    } catch (Throwable $e) {
        Response::serverError('Nao foi possivel registrar a decisao da oferta.', $e);
    }
}

/**
 * Entrada oficial do envio de proposta de retencao para o pedido de estorno.
 *
 * @since 1.0.0
 */
function handleTransactionsRejectRefundRoute(PDO $db): void
{
    try {
        $adminContext = requirePlatformAdminSessionContext($db);
        $body = json_decode(file_get_contents('php://input'), true) ?: [];
        $controller = buildTransactionsController($db);
        $payload = $controller->rejectRefund($body);

        logAdminAudit(
            $db,
            (string) $adminContext['admin_user_id'],
            'transaction.send_retention_offer',
            'transaction',
            (string) ($body['transaction_id'] ?? ''),
            [
                'user_id' => $payload['transaction']['user_id'] ?? null,
                'type' => $payload['transaction']['type'] ?? null,
            ]
        );

        Response::success([], (string) ($payload['message'] ?? 'Proposta enviada ao usuario.'));
    } catch (InvalidArgumentException $e) {
        Response::validationError($e->getMessage());
    } catch (OutOfBoundsException $e) {
        Response::notFound($e->getMessage());
    } catch (Throwable $e) {
        Response::serverError('Nao foi possivel enviar a proposta de permanencia.', $e);
    }
}

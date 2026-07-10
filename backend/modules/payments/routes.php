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

require_once __DIR__ . '/controllers/PaymentsController.php';
require_once __DIR__ . '/services/PaymentsService.php';
require_once __DIR__ . '/repositories/PaymentsRepository.php';
require_once __DIR__ . '/validators/PaymentsValidator.php';
require_once __DIR__ . '/../../shared/auth/request_auth.php';
require_once __DIR__ . '/../../shared/responses/Response.php';
require_once __DIR__ . '/../../config/payment_provider.php';

/**
 * Fabrica o controller oficial do modulo de pagamentos.
 * O repositorio e opcional para permitir consultas pblicas sem dependencia de banco.
 *
 * @since 1.0.0
 */
function buildPaymentsController(?PDO $db = null): PaymentsController
{
    if ($db) {
        ensurePaymentProviderSchema($db);
    }

    return new PaymentsController(
        new PaymentsService(
            $db,
            $db ? new PaymentsRepository($db) : null,
            new PaymentsValidator()
        )
    );
}

/**
 * Responde que o fluxo legado de Mercado Pago foi removido.
 *
 * @since 1.0.0
 */
function respondRemovedMercadoPagoPaymentsRoute(): void
{
    Response::error('Mercado Pago foi removido do produto. Os fluxos financeiros operam apenas com Stripe.', 410);
}

/**
 * Resolve o usurio autenticado obrigatorio para mutacoes financeiras.
 *
 * @since 1.0.0
 */
function requirePaymentsAuthenticatedUserId(): string
{
    $payload = null;

    try {
        $payload = verifyAuthenticatedUserPayload(true);
    } catch (RuntimeException $e) {
        Response::unauthorized($e->getMessage());
    }

    $userId = trim((string) ($payload['user_id'] ?? ''));
    if ($userId === '') {
        Response::unauthorized('Sesso invalida. Faca login novamente.');
    }

    return $userId;
}

/**
 * Entrada oficial da consulta de parcelamento do checkout.
 *
 * @since 1.0.0
 */
function handlePaymentsInstallmentsRoute(): void
{
    try {
        $result = buildPaymentsController()->getInstallments($_GET);
        Response::success($result);
    } catch (InvalidArgumentException $e) {
        Response::badRequest($e->getMessage());
    } catch (Throwable $e) {
        Response::serverError('No foi possvel consultar o parcelamento.', $e);
    }
}

/**
 * Entrada oficial da configurao pblica do checkout.
 *
 * @since 1.0.0
 */
function handlePaymentsClientConfigRoute(PDO $db): void
{
    try {
        $result = buildPaymentsController($db)->getClientConfig();
        Response::success($result);
    } catch (Throwable $e) {
        Response::serverError('No foi possvel carregar a configurao pblica de pagamentos.', $e);
    }
}

/**
 * Entrada oficial da cobrana avulsa de materiais no marketplace.
 *
 * @since 1.0.0
 */
function handlePaymentsProcessMaterialRoute(PDO $db): void
{
    try {
        $authenticatedUserId = requirePaymentsAuthenticatedUserId();
        $body = json_decode(file_get_contents('php://input'), true) ?: [];
        $result = buildPaymentsController($db)->processMaterialPayment($authenticatedUserId, $body);

        Response::success($result);
    } catch (InvalidArgumentException $e) {
        Response::badRequest($e->getMessage());
    } catch (OutOfBoundsException $e) {
        Response::notFound($e->getMessage());
    } catch (RuntimeException $e) {
        Response::validationError($e->getMessage());
    } catch (Throwable $e) {
        Response::serverError('No foi possvel processar o pagamento do material.', $e);
    }
}

/**
 * Entrada oficial da criacao de preferencia hospedada do Mercado Pago.
 *
 * @since 1.0.0
 */
function handlePaymentsCreatePreferenceRoute(PDO $db): void
{
    respondRemovedMercadoPagoPaymentsRoute();
}

/**
 * Entrada oficial do onboarding Stripe Connect para vendedores.
 *
 * @since 1.0.0
 */
function handlePaymentsCreateConnectAccountRoute(PDO $db): void
{
    try {
        $authenticatedUserId = requirePaymentsAuthenticatedUserId();
        $body = json_decode(file_get_contents('php://input'), true) ?: [];
        $result = buildPaymentsController($db)->createStripeConnectAccount($authenticatedUserId, $body);

        Response::success($result);
    } catch (InvalidArgumentException $e) {
        Response::badRequest($e->getMessage());
    } catch (OutOfBoundsException $e) {
        Response::notFound($e->getMessage());
    } catch (RuntimeException $e) {
        Response::validationError($e->getMessage());
    } catch (Throwable $e) {
        Response::serverError('No foi possvel iniciar o onboarding Stripe.', $e);
    }
}

/**
 * Entrada oficial do webhook do Mercado Pago.
 *
 * @since 1.0.0
 */
function handlePaymentsMercadoPagoWebhookRoute(PDO $db): void
{
    respondRemovedMercadoPagoPaymentsRoute();
}

/**
 * Entrada oficial da verificacao tardia de pagamentos Stripe.
 *
 * @since 1.0.0
 */
function handlePaymentsVerifyStripePaymentRoute(PDO $db): void
{
    try {
        $authenticatedUserId = requirePaymentsAuthenticatedUserId();
        $result = buildPaymentsController($db)->verifyStripePayment($_GET, $authenticatedUserId);
        Response::success($result);
    } catch (InvalidArgumentException $e) {
        Response::badRequest($e->getMessage());
    } catch (OutOfBoundsException $e) {
        Response::notFound($e->getMessage());
    } catch (Throwable $e) {
        Response::serverError('No foi possvel verificar o pagamento Stripe.', $e);
    }
}

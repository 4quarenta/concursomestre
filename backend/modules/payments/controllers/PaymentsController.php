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

require_once __DIR__ . '/../services/PaymentsService.php';

/**
 * Controller fino do dominio de pagamentos.
 * Ele apenas repassa a requisicao validada para o service oficial.
 */
class PaymentsController
{
    private PaymentsService $service;

    /**
     * Injeta o service oficial para manter o controller como camada HTTP fina.
     * @since 1.0.0
     */
    public function __construct(PaymentsService $service)
    {
        $this->service = $service;
    }

    /**
     * Exponibiliza as opcoes de parcelamento para o checkout.
     * @since 1.0.0
     */
    public function getInstallments(array $query): array
    {
        return $this->service->getInstallments($query);
    }

    /**
     * Processa a compra avulsa de um material pelo fluxo financeiro oficial.
     * @since 1.0.0
     */
    public function processMaterialPayment(string $authenticatedUserId, array $payload): array
    {
        return $this->service->processMaterialPayment($authenticatedUserId, $payload);
    }

    /**
     * Cria ou reaproveita a conta conectada Stripe do vendedor.
     * @since 1.0.0
     */
    public function createStripeConnectAccount(string $authenticatedUserId, array $payload): array
    {
        return $this->service->createStripeConnectAccount($authenticatedUserId, $payload);
    }

    /**
     * Verifica manualmente um PaymentIntent do Stripe e atualiza a compra local.
     * @since 1.0.0
     */
    public function verifyStripePayment(array $query, string $authenticatedUserId): array
    {
        return $this->service->verifyStripePayment($query, $authenticatedUserId);
    }

    /**
     * Exponibiliza a configurao pblica usada pelo checkout.
     * @since 1.0.0
     */
    public function getClientConfig(): array
    {
        return $this->service->getClientConfig();
    }
}

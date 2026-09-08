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

require_once __DIR__ . '/../services/TransactionsService.php';

/**
 * Controller HTTP do dominio de transacoes.
 *
 * @since 1.0.0
 */
class TransactionsController
{
    private TransactionsService $service;

    /**
     * Injeta o service do dominio de transacoes.
     *
     * @since 1.0.0
     */
    public function __construct(TransactionsService $service)
    {
        $this->service = $service;
    }

    /**
     * Inicia a compra direta de um material.
     *
     * @since 1.0.0
     */
    public function createMaterialPurchase(string $userId, array $data): array
    {
        return $this->service->createMaterialPurchase($userId, $data);
    }

    /**
     * Lista transacoes conforme filtros da consulta.
     *
     * @since 1.0.0
     */
    public function listTransactions(array $query): array
    {
        return $this->service->listTransactions($query);
    }

    /**
     * Solicita estorno de uma transacao.
     *
     * @since 1.0.0
     */
    public function requestRefund(string $userId, array $data): array
    {
        return $this->service->requestRefund($userId, $data);
    }

    /**
     * Aprova estorno solicitado pelo usuario.
     *
     * @since 1.0.0
     */
    public function approveRefund(array $data): array
    {
        return $this->service->approveRefund($data);
    }

    /**
     * Envia proposta de retencao para um estorno solicitado pelo usuario.
     *
     * @since 1.0.0
     */
    public function rejectRefund(array $data): array
    {
        return $this->service->sendRefundRetentionOffer($data);
    }

    public function decideRefundRetentionOffer(string $userId, array $data): array
    {
        return $this->service->decideRefundRetentionOffer($userId, $data);
    }
}

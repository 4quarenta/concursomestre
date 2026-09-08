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

/**
 * Validador das mutacoes do dominio de transacoes.
 */
class TransactionsValidator
{
    /**
     * Normaliza os filtros da listagem de transacoes.
     *
     * @since 1.0.0
     */
    public function validateListFilters(array $data): array
    {
        $scope = strtolower(trim((string) ($data['scope'] ?? 'buyer')));
        if (!in_array($scope, ['buyer', 'seller', 'all'], true)) {
            $scope = 'buyer';
        }

        $page = isset($data['page']) ? (int) $data['page'] : 1;
        $limit = isset($data['limit']) ? (int) $data['limit'] : 20;

        return [
            'user_id' => trim((string) ($data['user_id'] ?? '')),
            'start_date' => trim((string) ($data['start_date'] ?? '')),
            'end_date' => trim((string) ($data['end_date'] ?? '')),
            'status' => trim((string) ($data['status'] ?? '')),
            'type' => trim((string) ($data['type'] ?? '')),
            'scope' => $scope,
            'page' => max(1, $page),
            'limit' => max(1, min(100, $limit)),
        ];
    }

    /**
     * Valida a compra direta de um material.
     *
     * @since 1.0.0
     */
    public function validateMaterialPurchase(array $data): array
    {
        $materialId = trim((string) ($data['material_id'] ?? $data['materialId'] ?? ''));
        if ($materialId === '') {
            throw new InvalidArgumentException('material_id e obrigatorio.');
        }

        return [
            'material_id' => $materialId,
            'coupon_code' => trim((string) ($data['coupon_code'] ?? '')),
        ];
    }

    /**
     * Valida o pedido de reembolso enviado pelo usuario.
     *
     * @since 1.0.0
     */
    public function validateRefundRequest(array $data): array
    {
        $transactionId = trim((string) ($data['transaction_id'] ?? ''));
        $reason = trim((string) ($data['reason'] ?? ''));

        if ($transactionId === '') {
            throw new InvalidArgumentException('ID da transacao obrigatorio.');
        }

        if ($reason === '') {
            throw new InvalidArgumentException('Motivo do reembolso obrigatorio.');
        }

        return [
            'transaction_id' => $transactionId,
            'reason' => $reason,
        ];
    }

    /**
     * Valida o payload de resolucao do reembolso pelo admin.
     *
     * @since 1.0.0
     */
    public function validateRefundResolution(array $data): array
    {
        $transactionId = trim((string) ($data['transaction_id'] ?? ''));
        $reason = trim((string) ($data['reason'] ?? ''));

        if ($transactionId === '') {
            throw new InvalidArgumentException('ID da transacao obrigatorio.');
        }

        return [
            'transaction_id' => $transactionId,
            'reason' => $reason,
        ];
    }

    public function validateRetentionOffer(array $data): array
    {
        $transactionId = trim((string) ($data['transaction_id'] ?? ''));
        $actorId = trim((string) ($data['actor_id'] ?? ''));
        $offeredDays = filter_var($data['offered_days'] ?? null, FILTER_VALIDATE_INT, ['options' => ['min_range' => 1, 'max_range' => 366]]);
        $expiresAt = trim((string) ($data['expires_at'] ?? ''));
        if ($transactionId === '' || $actorId === '' || $offeredDays === false || $expiresAt === '') {
            throw new InvalidArgumentException('Transação, operador, dias oferecidos e expiração são obrigatórios.');
        }
        $expiresTimestamp = strtotime($expiresAt);
        if ($expiresTimestamp === false || $expiresTimestamp <= time() || $expiresTimestamp > time() + (30 * 86400)) {
            throw new InvalidArgumentException('Expiração da oferta deve estar no futuro e dentro de 30 dias.');
        }
        return [
            'transaction_id' => $transactionId,
            'actor_id' => $actorId,
            'offered_days' => (int) $offeredDays,
            'expires_at' => gmdate('Y-m-d H:i:s', $expiresTimestamp),
            'user_note' => mb_substr(trim((string) ($data['user_note'] ?? '')), 0, 1000),
            'internal_note' => mb_substr(trim((string) ($data['internal_note'] ?? $data['reason'] ?? '')), 0, 500),
        ];
    }
}

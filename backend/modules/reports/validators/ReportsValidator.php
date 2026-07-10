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
 * Validator do dominio de denncias.
 * Mantem validao de payload e regras basicas de autorizacao fora do controller.
 */
class ReportsValidator
{
    /**
     * Valida e normaliza o payload de criacao da denncia.
      * @since 1.0.0
     */
    public function validateCreatePayload(array $payload): array
    {
        $targetType = $this->normalizeTargetType((string) ($payload['target_type'] ?? ''));
        $targetId = trim((string) ($payload['target_id'] ?? ''));
        $reason = trim((string) ($payload['reason'] ?? ''));
        $details = trim((string) ($payload['details'] ?? ''));
        $reporterId = trim((string) ($payload['reporter_id'] ?? ''));
        $evidenceUrl = trim((string) ($payload['evidence_url'] ?? ''));

        if ($targetId === '') {
            throw new InvalidArgumentException('Informe o alvo da denncia.');
        }

        if ($reason === '') {
            throw new InvalidArgumentException('Informe o motivo da denncia.');
        }

        if (mb_strlen($reason) > 120) {
            throw new InvalidArgumentException('O motivo da denncia excede o limite permitido.');
        }

        if (mb_strlen($details) > 5000) {
            throw new InvalidArgumentException('Os detalhes da denncia excedem o limite permitido.');
        }

        if ($evidenceUrl !== '' && mb_strlen($evidenceUrl) > 2048) {
            throw new InvalidArgumentException('A URL da prova enviada e muito longa.');
        }

        return [
            'requestedReporterId' => $reporterId !== '' ? $reporterId : null,
            'targetType' => $targetType,
            'targetId' => $targetId,
            'reason' => $reason,
            'details' => $details,
            'evidenceUrl' => $evidenceUrl !== '' ? $evidenceUrl : null,
        ];
    }

    /**
     * Resolve o reporter autenticado, impedindo forjar denncias em nome de outro usurio.
      * @since 1.0.0
     */
    public function resolveReporterId(array $authenticatedUserPayload, ?string $requestedReporterId): string
    {
        $authenticatedUserId = trim((string) ($authenticatedUserPayload['user_id'] ?? ''));
        if ($authenticatedUserId === '') {
            throw new RuntimeException('Sesso invalida. Faca login novamente.');
        }

        $requestedReporterId = trim((string) $requestedReporterId);
        if ($requestedReporterId !== '' && $requestedReporterId !== $authenticatedUserId) {
            throw new RuntimeException('Voc no pode registrar denncias em nome de outro usurio.');
        }

        return $authenticatedUserId;
    }

    /**
     * Garante que a listagem administrativa tenha um admin valido.
      * @since 1.0.0
     */
    public function validateAdminUserId(string $adminUserId): void
    {
        if (trim($adminUserId) === '') {
            throw new RuntimeException('Sesso administrativa invalida.');
        }
    }

    /**
     * Restringe os tipos aceitos para o contrato oficial do app.
      * @since 1.0.0
     */
    private function normalizeTargetType(string $targetType): string
    {
        $normalized = strtolower(trim($targetType));
        $allowed = ['question', 'material', 'comment', 'law_section'];

        if (!in_array($normalized, $allowed, true)) {
            throw new InvalidArgumentException('Tipo de denncia invalido.');
        }

        return $normalized;
    }
}

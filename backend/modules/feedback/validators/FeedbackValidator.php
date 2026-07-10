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
 * Validador do dominio de feedback publico.
 * Centraliza o contrato de entrada das threads e respostas.
 *
 * @since 1.0.0
 */
class FeedbackValidator
{
    /**
     * Valida o payload de criacao e devolve uma estrutura normalizada.
     *
     * @since 1.0.0
     */
    public function validateCreatePayload(array $payload): array
    {
        $type = strtolower(trim((string) ($payload['type'] ?? '')));
        $reason = trim((string) ($payload['reason'] ?? ''));
        $details = trim((string) ($payload['details'] ?? ''));
        $parentId = isset($payload['parent_id']) ? (int) $payload['parent_id'] : null;
        $isPlatformRating = in_array($type, ['testimonial', 'rating', 'platform-rating', 'platform_rating'], true)
            || preg_match('/^avaliar plataforma\b/i', $reason) === 1;
        $publicRating = isset($payload['rating']) ? (int) round((float) $payload['rating']) : null;
        $publicDisplayName = trim((string) ($payload['public_display_name'] ?? $payload['displayName'] ?? $payload['publicName'] ?? ''));
        $publicHeadline = trim((string) ($payload['public_headline'] ?? $payload['headline'] ?? $payload['achievement'] ?? $payload['role'] ?? ''));
        $publicPhotoUrl = trim((string) ($payload['public_photo_url'] ?? $payload['photoUrl'] ?? ''));

        if ($type === '') {
            throw new InvalidArgumentException('Tipo de feedback invalido.');
        }

        if ($details === '') {
            throw new InvalidArgumentException('Os detalhes do feedback sao obrigatorios.');
        }

        if (mb_strlen($details) > 5000) {
            throw new InvalidArgumentException('Os detalhes do feedback excedem o limite permitido.');
        }

        if ($reason !== '' && mb_strlen($reason) > 255) {
            throw new InvalidArgumentException('O motivo do feedback excede o limite permitido.');
        }

        if ($parentId !== null && $parentId <= 0) {
            throw new InvalidArgumentException('Thread de feedback invalida.');
        }

        $allowedTypes = ['suggestion', 'bug', 'other', 'cancellation', 'support', 'info', 'feedback', 'report', 'testimonial', 'rating', 'platform-rating', 'platform_rating'];
        if (!in_array($type, $allowedTypes, true)) {
            throw new InvalidArgumentException('Tipo de feedback nao suportado.');
        }

        if ($isPlatformRating) {
            if ($publicRating === null || $publicRating < 1 || $publicRating > 5) {
                throw new InvalidArgumentException('Informe uma avaliacao entre 1 e 5 estrelas.');
            }

            if (mb_strlen($details) < 20 || mb_strlen($details) > 700) {
                throw new InvalidArgumentException('O depoimento deve ter entre 20 e 700 caracteres.');
            }

            if (mb_strlen($publicDisplayName) < 2 || mb_strlen($publicDisplayName) > 120) {
                throw new InvalidArgumentException('Informe o nome que deve aparecer no depoimento.');
            }

            if (mb_strlen($publicHeadline) < 3 || mb_strlen($publicHeadline) > 180) {
                throw new InvalidArgumentException('Informe o contexto que deve aparecer abaixo do nome.');
            }

            if ($publicPhotoUrl !== '' && mb_strlen($publicPhotoUrl) > 500) {
                throw new InvalidArgumentException('A URL da foto excede o limite permitido.');
            }

            if ($publicPhotoUrl !== '' && !preg_match('/^(https?:\/\/|uploads\/|\/uploads\/)/i', $publicPhotoUrl)) {
                throw new InvalidArgumentException('A foto do depoimento deve usar uma URL publica valida.');
            }
        }

        return [
            'type' => $this->normalizeStorageType($type),
            'reason' => $reason,
            'details' => $details,
            'parentId' => $parentId,
            'publicRating' => $isPlatformRating ? $publicRating : null,
            'publicDisplayName' => $isPlatformRating ? $publicDisplayName : null,
            'publicHeadline' => $isPlatformRating ? $publicHeadline : null,
            'publicPhotoUrl' => $isPlatformRating && $publicPhotoUrl !== '' ? $publicPhotoUrl : null,
        ];
    }

    /**
     * Valida o id da thread consultada.
     *
     * @since 1.0.0
     */
    public function validateThreadId(int $threadId): void
    {
        if ($threadId <= 0) {
            throw new InvalidArgumentException('Thread de feedback invalida.');
        }
    }

    /**
     * Traduz os tipos da UI para os tipos oficiais persistidos no banco.
     *
     * @since 1.0.0
     */
    private function normalizeStorageType(string $type): string
    {
        return match ($type) {
            'bug' => 'bug',
            'testimonial', 'rating', 'platform-rating', 'platform_rating' => 'platform-rating',
            'suggestion', 'feedback' => 'suggestion',
            'cancellation' => 'cancellation',
            'support', 'info' => 'support',
            'report' => 'report',
            default => 'other',
        };
    }
}

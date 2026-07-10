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
 * Validador do dominio de materiais.
 * Mantem as regras de entrada em um unico lugar para evitar validacoes
 * improvisadas espalhadas pelos endpoints legados.
 *
 * @since 1.0.0
 */
require_once __DIR__ . '/../../../shared/security/UploadSecurity.php';

class MaterialsValidator
{
    private const ALLOWED_TYPES = ['PDF', 'Simulado', 'Resumo'];
    private const ALLOWED_MODERATION_STATUSES = ['approved', 'rejected', 'pending'];
    private const ALLOWED_HIGHLIGHT_TYPES = ['highlight', 'underline', 'strikethrough'];
    private const ALLOWED_UPLOAD_MIME_TYPES = [
        'application/pdf' => ['folder' => 'materials', 'extension' => 'pdf', 'maxSize' => 10485760],
        'image/jpeg' => ['folder' => 'covers', 'extension' => 'jpg', 'maxSize' => 5242880],
        'image/png' => ['folder' => 'covers', 'extension' => 'png', 'maxSize' => 5242880],
        'image/webp' => ['folder' => 'covers', 'extension' => 'webp', 'maxSize' => 5242880],
    ];

    /**
     * Valida o payload de criacao de material.
     *
     * @since 1.0.0
     */
    public function validateCreatePayload(array $data): void
    {
        if (trim((string) ($data['title'] ?? '')) === '') {
            throw new InvalidArgumentException('Titulo do material e obrigatorio.');
        }

        if (trim((string) ($data['description'] ?? '')) === '') {
            throw new InvalidArgumentException('Descricao do material e obrigatoria.');
        }

        if (!array_key_exists('price', $data) || !is_numeric($data['price'])) {
            throw new InvalidArgumentException('Preco do material e obrigatorio.');
        }
    }

    /**
     * Valida o payload de atualizacao de material.
     *
     * @since 1.0.0
     */
    public function validateUpdatePayload(array $data): void
    {
        $materialId = trim((string) ($data['id'] ?? ''));
        if ($materialId === '') {
            throw new InvalidArgumentException('ID do material e obrigatorio.');
        }
    }

    /**
     * Valida a decisao de moderacao aplicada a um material.
     *
     * @since 1.0.0
     */
    public function validateModerationPayload(string $materialId, string $status): void
    {
        if ($materialId === '') {
            throw new InvalidArgumentException('ID do material e obrigatorio.');
        }

        if (!in_array($status, self::ALLOWED_MODERATION_STATUSES, true)) {
            throw new InvalidArgumentException('Status de moderacao invalido.');
        }
    }

    /**
     * Valida a exclusao administrativa de um material.
     *
     * @since 1.0.0
     */
    public function validateDeletePayload(string $materialId): void
    {
        if ($materialId === '') {
            throw new InvalidArgumentException('ID do material e obrigatorio.');
        }
    }

    /**
     * Valida a avaliacao atribuida a um material.
     *
     * @since 1.0.0
     */
    public function validateRatingPayload(string $materialId, $rating): void
    {
        if ($materialId === '') {
            throw new InvalidArgumentException('ID do material e obrigatorio.');
        }

        if (!is_numeric($rating)) {
            throw new InvalidArgumentException('Avaliacao invalida.');
        }

        $normalizedRating = (float) $rating;
        if ($normalizedRating < 1.0 || $normalizedRating > 5.0) {
            throw new InvalidArgumentException('Avaliacao deve estar entre 1 e 5.');
        }
    }

    /**
     * Normaliza o tipo do material conforme tabela permitida.
     *
     * @since 1.0.0
     */
    public function normalizeMaterialType(?string $type): string
    {
        $normalizedType = trim((string) $type);
        if ($normalizedType === '' || !in_array($normalizedType, self::ALLOWED_TYPES, true)) {
            return 'PDF';
        }

        return $normalizedType;
    }

    /**
     * Garante que a leitura da biblioteca parta de um usuario autenticado valido.
     *
     * @since 1.0.0
     */
    public function validatePurchasedMaterialsRequest(string $authenticatedUserId, ?string $requestedUserId, bool $isAdmin): string
    {
        $authenticatedUserId = trim($authenticatedUserId);
        if ($authenticatedUserId === '') {
            throw new InvalidArgumentException('Sessao invalida ou expirada.');
        }

        $requestedUserId = trim((string) $requestedUserId);
        if ($requestedUserId === '') {
            return $authenticatedUserId;
        }

        if ($requestedUserId !== $authenticatedUserId && !$isAdmin) {
            throw new RuntimeException('Voce nao pode consultar a biblioteca de outro usuario.');
        }

        return $requestedUserId;
    }

    /**
     * Valida o identificador do material antes de abrir ou baixar o arquivo protegido.
     *
     * @since 1.0.0
     */
    public function validateProtectedMaterialRequest(string $materialId): void
    {
        if (trim($materialId) === '') {
            throw new InvalidArgumentException('ID do material e obrigatorio.');
        }
    }

    /**
     * Valida consultas do leitor que ainda chegam com `user_id` legado na query string.
     * O usuario alvo so pode divergir da sessao quando o contexto for admin.
     *
     * @since 1.0.0
     */
    public function validateReaderStateRequest(
        string $authenticatedUserId,
        ?string $requestedUserId,
        string $materialId,
        bool $isAdmin
    ): array {
        $targetUserId = $this->validatePurchasedMaterialsRequest($authenticatedUserId, $requestedUserId, $isAdmin);
        $this->validateProtectedMaterialRequest($materialId);

        return [
            'targetUserId' => $targetUserId,
            'materialId' => trim($materialId),
        ];
    }

    /**
     * Valida a criacao de um marcador usando a sessao como fonte de verdade.
     *
     * @since 1.0.0
     */
    public function validateSaveBookmarkPayload(array $payload, string $authenticatedUserId): array
    {
        $targetUserId = $this->validatePurchasedMaterialsRequest(
            $authenticatedUserId,
            trim((string) ($payload['user_id'] ?? '')) ?: null,
            false
        );

        $materialId = trim((string) ($payload['material_id'] ?? ''));
        $pageNum = (int) ($payload['page_num'] ?? 0);
        $label = trim((string) ($payload['label'] ?? ''));

        if ($materialId === '') {
            throw new InvalidArgumentException('ID do material e obrigatorio.');
        }

        if ($pageNum <= 0) {
            throw new InvalidArgumentException('Pagina do marcador invalida.');
        }

        if ($label === '') {
            $label = 'Pagina ' . $pageNum;
        }

        return [
            'userId' => $targetUserId,
            'materialId' => $materialId,
            'pageNum' => $pageNum,
            'label' => substr($label, 0, 255),
        ];
    }

    /**
     * Valida a remocao de um marcador/destaque por identificador numerico.
     *
     * @since 1.0.0
     */
    public function validateInteractionId($id, string $entityLabel): int
    {
        $normalizedId = (int) $id;
        if ($normalizedId <= 0) {
            throw new InvalidArgumentException('ID de ' . $entityLabel . ' invalido.');
        }

        return $normalizedId;
    }

    /**
     * Valida a criacao de um destaque visual no leitor.
     *
     * @since 1.0.0
     */
    public function validateSaveHighlightPayload(array $payload, string $authenticatedUserId): array
    {
        $targetUserId = $this->validatePurchasedMaterialsRequest(
            $authenticatedUserId,
            trim((string) ($payload['user_id'] ?? '')) ?: null,
            false
        );

        $materialId = trim((string) ($payload['material_id'] ?? ''));
        $pageNum = (int) ($payload['page_num'] ?? 0);
        $type = trim((string) ($payload['type'] ?? 'highlight'));
        $color = trim((string) ($payload['color'] ?? '#ffeb3b'));
        $text = trim((string) ($payload['text'] ?? ''));
        $rects = $payload['rects'] ?? null;

        if ($materialId === '') {
            throw new InvalidArgumentException('ID do material e obrigatorio.');
        }

        if ($pageNum <= 0) {
            throw new InvalidArgumentException('Pagina do destaque invalida.');
        }

        if ($rects === null || $rects === '' || $rects === []) {
            throw new InvalidArgumentException('As coordenadas do destaque sao obrigatorias.');
        }

        if (!in_array($type, self::ALLOWED_HIGHLIGHT_TYPES, true)) {
            throw new InvalidArgumentException('Tipo de destaque invalido.');
        }

        if ($color === '') {
            $color = '#ffeb3b';
        }

        return [
            'userId' => $targetUserId,
            'materialId' => $materialId,
            'pageNum' => $pageNum,
            'color' => $color,
            'rectsJson' => is_string($rects) ? $rects : json_encode($rects, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
            'text' => $text,
            'type' => $type,
        ];
    }

    /**
     * Valida o payload de anotacao livre do material.
     *
     * @since 1.0.0
     */
    public function validateSaveNotePayload(array $payload, string $authenticatedUserId): array
    {
        $targetUserId = $this->validatePurchasedMaterialsRequest(
            $authenticatedUserId,
            trim((string) ($payload['user_id'] ?? '')) ?: null,
            false
        );

        $materialId = trim((string) ($payload['material_id'] ?? ''));
        if ($materialId === '') {
            throw new InvalidArgumentException('ID do material e obrigatorio.');
        }

        if (!array_key_exists('note_text', $payload)) {
            throw new InvalidArgumentException('Texto da anotacao e obrigatorio.');
        }

        return [
            'userId' => $targetUserId,
            'materialId' => $materialId,
            'noteText' => (string) ($payload['note_text'] ?? ''),
        ];
    }

    /**
     * Valida o arquivo enviado para o marketplace e devolve metadados seguros.
     * A extensao final passa a ser derivada do MIME real, sem confiar no nome enviado pelo cliente.
     *
     * @since 1.0.0
     */
    public function validateUploadPayload(array $file, ?string $password): array
    {
        $upload = UploadSecurity::validate($file, self::ALLOWED_UPLOAD_MIME_TYPES, [
            'invalidTypeMessage' => 'Tipo de arquivo invalido. Apenas PDF e imagens JPG, PNG e WEBP sao permitidos.',
        ]);

        return [
            'mimeType' => $upload['mimeType'],
            'folder' => $upload['folder'],
            'extension' => $upload['extension'],
            'password' => $password !== null ? trim($password) : null,
        ];
    }
}

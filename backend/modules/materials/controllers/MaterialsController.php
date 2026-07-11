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

require_once __DIR__ . '/../services/MaterialsService.php';

/**
 * Controller do dominio de materiais.
 * Mantem as rotas finas e deixa a regra dentro do service.
 *
 * @since 1.0.0
 */
class MaterialsController
{
    private MaterialsService $service;

    /**
     * Injeta o service oficial do dominio de materiais.
     *
     * @since 1.0.0
     */
    public function __construct(MaterialsService $service)
    {
        $this->service = $service;
    }

    /**
     * Lista materiais conforme escopo do viewer.
     *
     * @since 1.0.0
     */
    public function list(?string $viewerUserId, bool $isAdmin): array
    {
        return $this->service->list($viewerUserId, $isAdmin);
    }

    /**
     * Exibe a biblioteca de materiais comprados.
     *
     * @since 1.0.0
     */
    public function listPurchasedMaterials(string $authenticatedUserId, ?string $requestedUserId, bool $isAdmin): array
    {
        return $this->service->listPurchasedMaterials($authenticatedUserId, $requestedUserId, $isAdmin);
    }

    /**
     * Lista marcadores do leitor para um material especifico.
     *
     * @since 1.0.0
     */
    public function listBookmarks(string $authenticatedUserId, ?string $requestedUserId, string $materialId, bool $isAdmin): array
    {
        return $this->service->listBookmarks($authenticatedUserId, $requestedUserId, $materialId, $isAdmin);
    }

    /**
     * Cria um novo marcador do leitor.
     *
     * @since 1.0.0
     */
    public function createBookmark(string $authenticatedUserId, array $payload): array
    {
        return $this->service->createBookmark($authenticatedUserId, $payload);
    }

    /**
     * Remove um marcador do leitor.
     *
     * @since 1.0.0
     */
    public function deleteBookmark(string $authenticatedUserId, int $bookmarkId): array
    {
        return $this->service->deleteBookmark($authenticatedUserId, $bookmarkId);
    }

    /**
     * Lista destaques do leitor para um material especifico.
     *
     * @since 1.0.0
     */
    public function listHighlights(string $authenticatedUserId, ?string $requestedUserId, string $materialId, bool $isAdmin): array
    {
        return $this->service->listHighlights($authenticatedUserId, $requestedUserId, $materialId, $isAdmin);
    }

    /**
     * Cria um novo destaque do leitor.
     *
     * @since 1.0.0
     */
    public function createHighlight(string $authenticatedUserId, array $payload): array
    {
        return $this->service->createHighlight($authenticatedUserId, $payload);
    }

    /**
     * Remove um destaque do leitor.
     *
     * @since 1.0.0
     */
    public function deleteHighlight(string $authenticatedUserId, int $highlightId): array
    {
        return $this->service->deleteHighlight($authenticatedUserId, $highlightId);
    }

    /**
     * Le a anotacao salva do leitor para um material.
     *
     * @since 1.0.0
     */
    public function getMaterialNote(string $authenticatedUserId, ?string $requestedUserId, string $materialId, bool $isAdmin): array
    {
        return $this->service->getMaterialNote($authenticatedUserId, $requestedUserId, $materialId, $isAdmin);
    }

    /**
     * Salva a anotacao do leitor para um material.
     *
     * @since 1.0.0
     */
    public function saveMaterialNote(string $authenticatedUserId, array $payload): array
    {
        return $this->service->saveMaterialNote($authenticatedUserId, $payload);
    }

    /**
     * Gera o PDF protegido para visualizacao inline.
     *
     * @since 1.0.0
     */
    public function buildProtectedAccessPdf(string $authenticatedUserId, string $materialId): array
    {
        return $this->service->buildProtectedAccessPdf($authenticatedUserId, $materialId);
    }

    /**
     * Gera o PDF protegido para download com marca d'agua reforcada.
     *
     * @since 1.0.0
     */
    public function buildProtectedDownloadPdf(string $authenticatedUserId, string $materialId): array
    {
        return $this->service->buildProtectedDownloadPdf($authenticatedUserId, $materialId);
    }

    /**
     * Processa o upload autenticado de arquivos do marketplace.
     *
     * @since 1.0.0
     */
    public function uploadFile(string $authenticatedUserId, array $file): array
    {
        return $this->service->uploadFile($authenticatedUserId, $file);
    }

    /**
     * Cria um material no marketplace.
     *
     * @since 1.0.0
     */
    public function create(string $authorId, array $data): array
    {
        return $this->service->create($authorId, $data);
    }

    /**
     * Atualiza dados de um material existente.
     *
     * @since 1.0.0
     */
    public function update(string $userId, array $data): array
    {
        return $this->service->update($userId, $data);
    }

    /**
     * Aplica moderacao administrativa a um material.
     *
     * @since 1.0.0
     */
    public function moderate(string $materialId, string $status, ?string $reason, string $moderatorUserId): array
    {
        return $this->service->moderate($materialId, $status, $reason, $moderatorUserId);
    }

    /**
     * Remove um material da plataforma.
     *
     * @since 1.0.0
     */
    public function delete(string $materialId, string $moderatorUserId): array
    {
        return $this->service->delete($materialId, $moderatorUserId);
    }

    /**
     * Busca a avaliacao do usuario para um material.
     *
     * @since 1.0.0
     */
    public function getUserRating(string $userId, string $materialId): int
    {
        return $this->service->getUserRating($userId, $materialId);
    }

    /**
     * Registra a avaliacao do usuario em um material.
     *
     * @since 1.0.0
     */
    public function rate(string $userId, array $data): array
    {
        return $this->service->rate($userId, $data);
    }
}

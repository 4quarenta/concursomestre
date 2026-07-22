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

require_once __DIR__ . '/../repositories/MaterialsRepository.php';
require_once __DIR__ . '/../validators/MaterialsValidator.php';
require_once __DIR__ . '/../../../config/notification_helper.php';
require_once __DIR__ . '/../../../config/gamification_helper.php';
require_once __DIR__ . '/../../../vendor/autoload.php';
require_once __DIR__ . '/../../../shared/pagination/SignedKeysetCursor.php';

use setasign\Fpdi\Tcpdf\Fpdi;

/**
 * Service do dominio de materiais.
 * Centraliza regra de visibilidade, CRUD, moderacao e avaliacao.
 *
 * @since 1.0.0
 */
class MaterialsService
{
    private MaterialsRepository $repository;
    private MaterialsValidator $validator;
    private PDO $db;

    /**
     * Injeta dependencias do dominio de materiais.
     *
     * @since 1.0.0
     */
    public function __construct(
        PDO $db,
        MaterialsRepository $repository,
        MaterialsValidator $validator
    ) {
        $this->db = $db;
        $this->repository = $repository;
        $this->validator = $validator;
        $this->repository->ensureSchema();
    }

    /**
     * Lista materiais conforme escopo do viewer.
     *
     * @since 1.0.0
     */
    public function list(
        ?string $viewerUserId,
        bool $isAdmin,
        int $limit = 24,
        ?string $cursor = null
    ): array
    {
        $safeLimit = max(1, min(50, $limit));
        $rows = $this->repository->fetchMaterials($viewerUserId, $isAdmin, $safeLimit, $cursor);
        $hasMore = count($rows) > $safeLimit;
        if ($hasMore) {
            $rows = array_slice($rows, 0, $safeLimit);
        }

        $materialIds = array_map(static fn (array $row): string => (string) $row['id'], $rows);
        $salesCounts = $this->repository->fetchSalesCountsForMaterials($materialIds);
        $materials = array_map(
            function (array $row) use ($salesCounts): array {
                $row['salesCount'] = $salesCounts[(string) ($row['id'] ?? '')] ?? 0;
                return $this->normalizeMaterialRow($row);
            },
            $rows
        );

        $items = $this->attachCommentsToMaterials($materials);
        $lastRow = $rows !== [] ? $rows[count($rows) - 1] : null;
        $nextCursor = $hasMore && is_array($lastRow)
            ? SignedKeysetCursor::encode(
                'materials.list',
                (string) ($lastRow['createdAt'] ?? ''),
                (string) ($lastRow['id'] ?? '')
            )
            : null;

        return [
            'items' => $items,
            'pageInfo' => [
                'limit' => $safeLimit,
                'hasMore' => $hasMore,
                'nextCursor' => $nextCursor,
            ],
        ];
    }

    /**
     * Retorna a biblioteca de materiais adquiridos pelo usuario autenticado.
     * A validacao impede leitura arbitraria por query string quando nao ha contexto admin.
     *
     * @since 1.0.0
     */
    public function listPurchasedMaterials(string $authenticatedUserId, ?string $requestedUserId, bool $isAdmin): array
    {
        $targetUserId = $this->validator->validatePurchasedMaterialsRequest(
            $authenticatedUserId,
            $requestedUserId,
            $isAdmin
        );

        $materials = array_map(
            fn (array $row): array => $this->normalizePurchasedMaterialRow($row),
            $this->repository->fetchPurchasedMaterialsByUser($targetUserId)
        );

        return [
            'materials' => $materials,
        ];
    }

    /**
     * Retorna os marcadores do leitor para o material informado.
     *
     * @since 1.0.0
     */
    public function listBookmarks(
        string $authenticatedUserId,
        ?string $requestedUserId,
        string $materialId,
        bool $isAdmin
    ): array {
        $request = $this->validator->validateReaderStateRequest(
            $authenticatedUserId,
            $requestedUserId,
            $materialId,
            $isAdmin
        );

        $this->assertReaderAccessToMaterial($authenticatedUserId, $request['materialId']);
        $bookmarks = array_map(
            fn (array $row): array => $this->normalizeBookmarkRow($row),
            $this->repository->fetchBookmarksByMaterial($request['targetUserId'], $request['materialId'])
        );

        return [
            'bookmarks' => $bookmarks,
        ];
    }

    /**
     * Persiste um novo marcador vinculado ao usuario autenticado.
     *
     * @since 1.0.0
     */
    public function createBookmark(string $authenticatedUserId, array $payload): array
    {
        $data = $this->validator->validateSaveBookmarkPayload($payload, $authenticatedUserId);
        $this->assertReaderAccessToMaterial($authenticatedUserId, $data['materialId']);

        $bookmarkId = $this->repository->createBookmark(
            $data['userId'],
            $data['materialId'],
            $data['pageNum'],
            $data['label']
        );

        return [
            'bookmark' => [
                'id' => $bookmarkId,
                'page_num' => $data['pageNum'],
                'label' => $data['label'],
                'created_at' => date('c'),
            ],
        ];
    }

    /**
     * Remove um marcador do usuario atual.
     *
     * @since 1.0.0
     */
    public function deleteBookmark(string $authenticatedUserId, int $bookmarkId): array
    {
        $normalizedBookmarkId = $this->validator->validateInteractionId($bookmarkId, 'marcador');
        if (!$this->repository->deleteBookmarkById($authenticatedUserId, $normalizedBookmarkId)) {
            throw new OutOfBoundsException('Marcador nao encontrado.');
        }

        return [
            'id' => $normalizedBookmarkId,
        ];
    }

    /**
     * Lista os destaques do leitor para o material informado.
     *
     * @since 1.0.0
     */
    public function listHighlights(
        string $authenticatedUserId,
        ?string $requestedUserId,
        string $materialId,
        bool $isAdmin
    ): array {
        $request = $this->validator->validateReaderStateRequest(
            $authenticatedUserId,
            $requestedUserId,
            $materialId,
            $isAdmin
        );

        $this->assertReaderAccessToMaterial($authenticatedUserId, $request['materialId']);
        $highlights = array_map(
            fn (array $row): array => $this->normalizeHighlightRow($row),
            $this->repository->fetchHighlightsByMaterial($request['targetUserId'], $request['materialId'])
        );

        return [
            'highlights' => $highlights,
        ];
    }

    /**
     * Persiste um destaque do leitor.
     *
     * @since 1.0.0
     */
    public function createHighlight(string $authenticatedUserId, array $payload): array
    {
        $data = $this->validator->validateSaveHighlightPayload($payload, $authenticatedUserId);
        $this->assertReaderAccessToMaterial($authenticatedUserId, $data['materialId']);

        $highlightId = $this->repository->createHighlight(
            $data['userId'],
            $data['materialId'],
            $data['pageNum'],
            $data['color'],
            $data['rectsJson'],
            $data['text'],
            $data['type']
        );

        return [
            'highlight' => [
                'id' => $highlightId,
                'page_num' => $data['pageNum'],
                'color' => $data['color'],
                'rects' => json_decode($data['rectsJson'], true) ?: [],
                'text' => $data['text'],
                'type' => $data['type'],
                'created_at' => date('c'),
            ],
        ];
    }

    /**
     * Remove um destaque do usuario atual.
     *
     * @since 1.0.0
     */
    public function deleteHighlight(string $authenticatedUserId, int $highlightId): array
    {
        $normalizedHighlightId = $this->validator->validateInteractionId($highlightId, 'destaque');
        if (!$this->repository->deleteHighlightById($authenticatedUserId, $normalizedHighlightId)) {
            throw new OutOfBoundsException('Destaque nao encontrado.');
        }

        return [
            'id' => $normalizedHighlightId,
        ];
    }

    /**
     * Le a anotacao livre do usuario para o material.
     *
     * @since 1.0.0
     */
    public function getMaterialNote(
        string $authenticatedUserId,
        ?string $requestedUserId,
        string $materialId,
        bool $isAdmin
    ): array {
        $request = $this->validator->validateReaderStateRequest(
            $authenticatedUserId,
            $requestedUserId,
            $materialId,
            $isAdmin
        );

        $this->assertReaderAccessToMaterial($authenticatedUserId, $request['materialId']);
        $note = $this->repository->findMaterialNote($request['targetUserId'], $request['materialId']);

        return [
            'note' => $note ? $this->normalizeMaterialNoteRow($note) : null,
        ];
    }

    /**
     * Cria ou atualiza a anotacao do usuario autenticado.
     *
     * @since 1.0.0
     */
    public function saveMaterialNote(string $authenticatedUserId, array $payload): array
    {
        $data = $this->validator->validateSaveNotePayload($payload, $authenticatedUserId);
        $this->assertReaderAccessToMaterial($authenticatedUserId, $data['materialId']);

        $this->repository->upsertMaterialNote($data['userId'], $data['materialId'], $data['noteText']);

        return [
            'note' => [
                'note_text' => $data['noteText'],
                'updated_at' => date('c'),
            ],
        ];
    }

    /**
     * Gera o PDF protegido para visualizacao inline do material comprado.
     *
     * @since 1.0.0
     */
    public function buildProtectedAccessPdf(string $authenticatedUserId, string $materialId): array
    {
        $context = $this->resolveProtectedMaterialContext($authenticatedUserId, $materialId);
        $user = $context['user'];
        $material = $context['material'];
        $filePath = $context['filePath'];

        $watermarkText = trim((string) ($user['name'] ?? 'Usuario')) . ' - ' . trim((string) (($user['cpf'] ?? '') ?: 'CPF ND'));
        $pdf = new Fpdi();
        $pdf->setPrintHeader(false);
        $pdf->setPrintFooter(false);
        $pdf->SetCreator('Concurso Mestre');
        $pdf->SetAuthor('Concurso Mestre');
        $pdf->SetTitle((string) ($material['title'] ?? 'Material'));

        $pageCount = $pdf->setSourceFile($filePath);

        for ($pageNumber = 1; $pageNumber <= $pageCount; $pageNumber++) {
            $templateIndex = $pdf->importPage($pageNumber);
            $size = $pdf->getTemplateSize($templateIndex);

            $pdf->AddPage($size['orientation'], [$size['width'], $size['height']]);
            $pdf->useTemplate($templateIndex);

            $pdf->SetFont('helvetica', 'B', 8);
            $pdf->SetTextColor(150, 150, 150);
            $pdf->SetAlpha(0.5);
            $pdf->SetXY(0, $size['height'] - 10);
            $pdf->Cell(
                0,
                10,
                'Este material pertence a: ' . $watermarkText . ' | Concurso Mestre (Anti-Pirataria)',
                0,
                0,
                'C'
            );
            $pdf->SetAlpha(1);
        }

        return [
            'content' => $pdf->Output('', 'S'),
            'filename' => basename($filePath),
            'contentType' => 'application/pdf',
            'disposition' => 'inline',
        ];
    }

    /**
     * Gera o PDF protegido para download, com marca d'agua reforcada e rodape nominal.
     *
     * @since 1.0.0
     */
    public function buildProtectedDownloadPdf(string $authenticatedUserId, string $materialId): array
    {
        $context = $this->resolveProtectedMaterialContext($authenticatedUserId, $materialId);
        $user = $context['user'];
        $material = $context['material'];
        $filePath = $context['filePath'];

        $proibicao = 'DOCUMENTO PERSONALIZADO PARA USO EXCLUSIVO DO TITULAR - E PROIBIDO REPRODUZIR, COMPARTILHAR OU VENDER ESTE MATERIAL.';
        $userName = strtoupper((string) ($user['name'] ?? 'USUARIO'));
        $userEmail = (string) ($user['email'] ?? '');
        $dataDl = date('d/m/Y H:i');
        $prefixoMarca = "{$userName} | {$userEmail} | {$dataDl}";

        $pdf = new Fpdi();
        $pdf->setPrintHeader(false);
        $pdf->setPrintFooter(false);
        $pageCount = $pdf->setSourceFile($filePath);

        for ($pageIndex = 1; $pageIndex <= $pageCount; $pageIndex++) {
            $template = $pdf->importPage($pageIndex);
            $templateSize = $pdf->getTemplateSize($template);
            $orientation = ($templateSize['width'] > $templateSize['height']) ? 'L' : 'P';

            $pdf->AddPage($orientation, [$templateSize['width'], $templateSize['height']]);
            $pdf->useTemplate($template);

            $pageWidth = $templateSize['width'];
            $pageHeight = $templateSize['height'];

            $pdf->SetFont('helvetica', 'B', 11);
            $pdf->SetTextColor(180, 180, 180);
            $pdf->SetAlpha(0.20);

            $rows = (int) ceil($pageHeight / 40);
            for ($rowIndex = 0; $rowIndex < $rows; $rowIndex++) {
                $y = ($rowIndex * 40) + 20;
                $pdf->SetXY(0, $y);
                $pdf->StartTransform();
                $pdf->Rotate(25, $pageWidth / 2, $y);
                $pdf->SetX(0);
                $pdf->Cell($pageWidth, 8, $prefixoMarca, 0, 0, 'C');
                $pdf->StopTransform();
            }

            $pdf->SetAlpha(1.0);

            $footerHeight = 14;
            $footerY = $pageHeight - $footerHeight - 2;

            $pdf->SetFillColor(230, 230, 230);
            $pdf->Rect(0, $footerY - 1, $pageWidth, $footerHeight + 3, 'F');

            $pdf->SetFont('helvetica', 'B', 7);
            $pdf->SetTextColor(80, 80, 80);
            $pdf->SetXY(4, $footerY);
            $pdf->Cell(
                ($pageWidth / 2) - 4,
                5,
                "Licenciado para: {$userName}  |  {$userEmail}  |  Download: {$dataDl}",
                0,
                2,
                'L'
            );

            $pdf->SetFont('helvetica', 'B', 6);
            $pdf->SetTextColor(160, 30, 30);
            $pdf->SetX(4);
            $pdf->Cell($pageWidth - 8, 4, $proibicao, 0, 0, 'L');

            $pdf->SetFont('helvetica', '', 7);
            $pdf->SetTextColor(120, 120, 120);
            $pdf->SetXY($pageWidth - 30, $footerY);
            $pdf->Cell(26, 5, "Pag. {$pageIndex}/{$pageCount}", 0, 0, 'R');
        }

        $fileName = $this->buildProtectedDownloadFileName((string) ($material['title'] ?? 'material'), (string) ($user['id'] ?? 'usuario'));

        return [
            'content' => $pdf->Output('', 'S'),
            'filename' => $fileName,
            'contentType' => 'application/pdf',
            'disposition' => 'attachment',
        ];
    }

    /**
     * Centraliza o upload de PDFs e capas do marketplace.
     * O arquivo final e nomeado a partir do MIME validado para evitar confiar em extensao do cliente.
     *
     * @since 1.0.0
     */
    public function uploadFile(string $authenticatedUserId, array $file): array
    {
        $user = $this->repository->findUserById($authenticatedUserId);
        if (!$user) {
            throw new RuntimeException('Usuario autenticado nao encontrado.');
        }

        $upload = $this->validator->validateUploadPayload($file);
        $filename = bin2hex(random_bytes(20)) . '.' . $upload['extension'];

        if ($upload['mimeType'] !== 'application/pdf') {
            $uploadDirectory = $this->ensurePublicCoverUploadDirectory();
            $targetPath = $uploadDirectory . DIRECTORY_SEPARATOR . $filename;

            if (!move_uploaded_file((string) $file['tmp_name'], $targetPath)) {
                throw new RuntimeException('Falha ao salvar o arquivo no servidor.');
            }

            return [
                'publicUrl' => '/uploads/covers/' . $filename,
                'pageCount' => null,
            ];
        }

        $uploadDirectory = $this->ensurePrivateMaterialStorageDirectory();
        $targetPath = $uploadDirectory . DIRECTORY_SEPARATOR . $filename;

        if (!move_uploaded_file((string) $file['tmp_name'], $targetPath)) {
            throw new RuntimeException('Falha ao salvar o arquivo no servidor.');
        }

        $pageCount = $this->readPdfPageCount($targetPath);
        $storageKey = 'private://materials/' . $filename;

        try {
            $this->repository->createMaterialUpload([
                ':storage_key' => $storageKey,
                ':uploaded_by_user_id' => $authenticatedUserId,
                ':mime_type' => $upload['mimeType'],
                ':size_bytes' => (int) $upload['size'],
                ':checksum_sha256' => hash_file('sha256', $targetPath),
            ]);
        } catch (Throwable $e) {
            @unlink($targetPath);
            throw $e;
        }

        return [
            'fileRef' => $storageKey,
            'pageCount' => $pageCount,
        ];
    }

    /**
     * Cria um novo material no marketplace.
     *
     * @since 1.0.0
     */
    public function create(string $authorId, array $data): array
    {
        $this->validator->validateCreatePayload($data);

        $author = $this->repository->findUserById($authorId);
        if (!$author) {
            throw new RuntimeException('Autor autenticado nao encontrado.');
        }

        $materialId = trim((string) ($data['id'] ?? ''));
        if ($materialId === '') {
            $materialId = 'mat-' . uniqid();
        }

        $type = $this->validator->normalizeMaterialType($data['type'] ?? null);
        $fileAttachment = $this->resolveOwnedPendingMaterialUpload($authorId, $data);
        if ($type === 'PDF' && $fileAttachment === null) {
            throw new InvalidArgumentException('Envie o PDF pelo fluxo seguro antes de criar o material.');
        }

        $this->db->beginTransaction();
        try {
            $this->repository->createMaterial([
                ':id' => $materialId,
                ':author_id' => $authorId,
                ':title' => trim((string) ($data['title'] ?? '')),
                ':description' => trim((string) ($data['description'] ?? '')),
                ':price' => (float) ($data['price'] ?? 0),
                ':type' => $type,
                ':subject_id' => $this->normalizeNullableInteger($data, 'subjectId'),
                ':topic_id' => $this->normalizeNullableInteger($data, 'topicId'),
                ':subject_text' => $this->normalizeNullableString($data, 'subjectText'),
                ':topic' => $this->normalizeNullableString($data, 'topic'),
                ':page_count' => $this->normalizeNullableInteger($data, 'pageCount'),
                ':year' => $this->normalizeNullableInteger($data, 'year'),
                ':exam_target' => $this->normalizeNullableString($data, 'examTarget'),
                ':files_json' => $this->encodeMaterialFiles($fileAttachment),
                ':preview_url' => $this->normalizeNullableString($data, 'previewUrl'),
                ':cover_url' => $this->normalizeNullableString($data, 'coverUrl'),
                ':status' => 'pending',
            ]);

            if ($fileAttachment !== null && !$this->repository->attachPendingMaterialUpload(
                (string) $fileAttachment['storage_key'],
                $authorId,
                $materialId
            )) {
                throw new RuntimeException('O arquivo privado nao esta mais disponivel para este material.');
            }

            $this->db->commit();
        } catch (Throwable $e) {
            if ($this->db->inTransaction()) {
                $this->db->rollBack();
            }
            throw $e;
        }

        createNotification(
            $this->db,
            $authorId,
            'Material enviado para revisao',
            'Seu material "' . trim((string) ($data['title'] ?? '')) . '" foi enviado e aguarda analise da equipe.',
            'info',
            'marketplace',
            '/partner'
        );

        createAdminNotification(
            $this->db,
            'Material aguardando moderacao',
            'Um vendedor enviou o material "' . trim((string) ($data['title'] ?? '')) . '" para revisao.',
            'warning',
            'marketplace',
            '/admin/marketplace/materials'
        );

        $material = $this->repository->fetchMaterialDetailsById($materialId);
        if (!$material) {
            throw new RuntimeException('Material criado, mas nao localizado para retorno.');
        }

        return $this->normalizeMaterialRow($material);
    }

    /**
     * Atualiza dados de um material existente.
     *
     * @since 1.0.0
     */
    public function update(string $userId, array $data): array
    {
        $this->validator->validateUpdatePayload($data);

        $materialId = trim((string) ($data['id'] ?? ''));
        $material = $this->repository->findMaterialRecordById($materialId);
        if (!$material) {
            throw new OutOfBoundsException('Material nao encontrado.');
        }

        if ((string) ($material['author_id'] ?? '') !== $userId) {
            throw new RuntimeException('Voce so pode editar os seus proprios materiais.');
        }

        $fields = [];
        $fields['updated_by_user_id'] = $userId;

        if (array_key_exists('title', $data)) {
            $fields['title'] = trim((string) $data['title']);
        }

        if (array_key_exists('description', $data)) {
            $fields['description'] = trim((string) $data['description']);
        }

        if (array_key_exists('price', $data)) {
            $fields['price'] = (float) $data['price'];
        }

        if (array_key_exists('subjectId', $data)) {
            $fields['subject_id'] = $this->normalizeNullableInteger($data, 'subjectId');
        }

        if (array_key_exists('subjectText', $data)) {
            $fields['subject_text'] = $this->normalizeNullableString($data, 'subjectText');
        }

        if (array_key_exists('topicId', $data)) {
            $fields['topic_id'] = $this->normalizeNullableInteger($data, 'topicId');
        }

        if (array_key_exists('topic', $data)) {
            $fields['topic'] = $this->normalizeNullableString($data, 'topic');
        }

        if (array_key_exists('pageCount', $data)) {
            $fields['page_count'] = $this->normalizeNullableInteger($data, 'pageCount');
        }

        if (array_key_exists('year', $data)) {
            $fields['year'] = $this->normalizeNullableInteger($data, 'year');
        }

        if (array_key_exists('examTarget', $data)) {
            $fields['exam_target'] = $this->normalizeNullableString($data, 'examTarget');
        }

        if (array_key_exists('previewUrl', $data)) {
            $fields['preview_url'] = $this->normalizeNullableString($data, 'previewUrl');
        }

        if (array_key_exists('coverUrl', $data)) {
            $fields['cover_url'] = $this->normalizeNullableString($data, 'coverUrl');
        }

        $existingFiles = json_decode((string) ($material['files_json'] ?? '{}'), true) ?: [];
        $existingStorageKey = trim((string) ($existingFiles['storageKey'] ?? $existingFiles['fileUrl'] ?? ''));
        $incomingFileRef = trim((string) ($data['fileRef'] ?? ''));
        if (($material['status'] ?? '') === 'approved' && $incomingFileRef !== '' && $incomingFileRef !== $existingStorageKey) {
            throw new RuntimeException('Nao e permitido trocar o PDF de um material aprovado.');
        }

        $canUpdateFiles = ($material['status'] ?? '') !== 'approved';
        $fileAttachment = null;
        if ($canUpdateFiles && $incomingFileRef !== '' && $incomingFileRef !== $existingStorageKey) {
            $fileAttachment = $this->resolveOwnedPendingMaterialUpload($userId, $data);
            $fields['files_json'] = $this->encodeMaterialFiles($fileAttachment);
        }

        if (count($fields) === 1) {
            throw new InvalidArgumentException('Nenhum campo valido foi enviado para atualizacao.');
        }

        $this->db->beginTransaction();
        try {
            $this->repository->updateMaterial($materialId, $fields);
            if ($fileAttachment !== null && !$this->repository->attachPendingMaterialUpload(
                (string) $fileAttachment['storage_key'],
                $userId,
                $materialId
            )) {
                throw new RuntimeException('O arquivo privado nao esta mais disponivel para este material.');
            }
            $this->db->commit();
        } catch (Throwable $e) {
            if ($this->db->inTransaction()) {
                $this->db->rollBack();
            }
            throw $e;
        }

        $updatedMaterial = $this->repository->fetchMaterialDetailsById($materialId);
        if (!$updatedMaterial) {
            throw new RuntimeException('Material atualizado, mas nao localizado para retorno.');
        }

        return $this->normalizeMaterialRow($updatedMaterial);
    }

    /**
     * Aplica moderacao administrativa ao material.
     *
     * @since 1.0.0
     */
    public function moderate(string $materialId, string $status, ?string $reason, string $moderatorUserId): array
    {
        $normalizedReason = trim((string) $reason);
        $this->validator->validateModerationPayload($materialId, $status);

        $material = $this->repository->findMaterialRecordById($materialId);
        if (!$material) {
            throw new OutOfBoundsException('Material nao encontrado.');
        }

        $this->repository->updateModeration(
            $materialId,
            $status,
            $normalizedReason !== '' ? $normalizedReason : null,
            $moderatorUserId
        );
        $this->repository->recordModerationEvent(
            $materialId,
            $moderatorUserId,
            'moderate',
            isset($material['status']) ? (string) $material['status'] : null,
            $status,
            $normalizedReason !== '' ? $normalizedReason : null
        );

        $authorId = (string) ($material['author_id'] ?? '');
        $title = trim((string) ($material['title'] ?? 'Material'));

        if ($authorId !== '') {
            if ($status === 'approved') {
                createNotification(
                    $this->db,
                    $authorId,
                    'Material aprovado',
                    'Seu material "' . $title . '" foi aprovado e ja esta disponivel na loja.',
                    'success',
                    'marketplace',
                    '/marketplace'
                );

                applyMaterialModerationGamification(
                    $this->db,
                    $authorId,
                    $materialId,
                    $status,
                    isset($material['status']) ? (string) $material['status'] : null,
                    $title
                );
            } elseif ($status === 'rejected') {
                $message = 'Seu material "' . $title . '" foi rejeitado.';
                if ($normalizedReason !== '') {
                    $message .= ' Motivo: ' . $normalizedReason;
                }

                createNotification(
                    $this->db,
                    $authorId,
                    'Material rejeitado',
                    $message,
                    'error',
                    'marketplace',
                    '/partner'
                );
            }
        }

        return [
            'id' => $materialId,
            'status' => $status,
            'rejectionReason' => $normalizedReason !== '' ? $normalizedReason : null,
            'previousStatus' => $material['status'] ?? null,
        ];
    }

    /**
     * Remove um material da vitrine e sinaliza o autor.
     *
     * @since 1.0.0
     */
    public function delete(string $materialId, string $moderatorUserId): array
    {
        $this->validator->validateDeletePayload($materialId);

        $material = $this->repository->findMaterialRecordById($materialId);
        if (!$material) {
            throw new OutOfBoundsException('Material nao encontrado.');
        }

        $removalReason = 'Material removido administrativamente da vitrine e do fluxo comercial.';
        $this->repository->updateModeration($materialId, 'rejected', $removalReason, $moderatorUserId);
        $this->repository->recordModerationEvent(
            $materialId,
            $moderatorUserId,
            'remove',
            isset($material['status']) ? (string) $material['status'] : null,
            'rejected',
            $removalReason
        );

        $authorId = (string) ($material['author_id'] ?? '');
        if ($authorId !== '') {
            createNotification(
                $this->db,
                $authorId,
                'Material removido',
                'Seu material "' . trim((string) ($material['title'] ?? 'Material')) . '" foi removido da plataforma pela administracao.',
                'error',
                'marketplace',
                '/partner'
            );
        }

        return [
            'id' => $materialId,
            'title' => trim((string) ($material['title'] ?? '')),
            'previousStatus' => $material['status'] ?? null,
        ];
    }

    /**
     * Consulta a avaliacao do usuario para um material.
     *
     * @since 1.0.0
     */
    public function getUserRating(string $userId, string $materialId): int
    {
        $material = $this->repository->findMaterialRecordById($materialId);
        if (!$material) {
            throw new OutOfBoundsException('Material nao encontrado.');
        }

        return $this->repository->findUserRating($userId, $materialId) ?? 0;
    }

    /**
     * Registra a avaliacao do usuario e recalcula o ranking do material.
     *
     * @since 1.0.0
     */
    public function rate(string $userId, array $data): array
    {
        $materialId = trim((string) ($data['materialId'] ?? ''));
        $rating = $data['rating'] ?? null;
        $this->validator->validateRatingPayload($materialId, $rating);

        $material = $this->repository->findMaterialRecordById($materialId);
        if (!$material) {
            throw new OutOfBoundsException('Material nao encontrado.');
        }

        if (($material['status'] ?? '') !== 'approved') {
            throw new RuntimeException('Avaliacao indisponivel para um material que nao esta publicado.');
        }

        if (hash_equals((string) ($material['author_id'] ?? ''), $userId)) {
            throw new RuntimeException('O autor nao pode avaliar o proprio material.');
        }

        if (!$this->repository->hasApprovedPurchase($userId, $materialId)) {
            throw new RuntimeException('Voce precisa comprar este material para avalia-lo.');
        }

        $this->repository->upsertRating($userId, $materialId, (float) $rating);
        $stats = $this->repository->refreshMaterialRatingStats($materialId);

        $authorId = (string) ($material['author_id'] ?? '');
        if ($authorId !== '' && $authorId !== $userId) {
            $user = $this->repository->findUserById($userId);
            $userName = trim((string) ($user['name'] ?? $user['nome'] ?? 'Um aluno'));

            createNotification(
                $this->db,
                $authorId,
                $userName,
                $userName . ' avaliou o seu material "' . trim((string) ($material['title'] ?? 'Material')) . '" com ' . (int) round((float) $rating) . ' estrelas.',
                'success',
                'social',
                '/marketplace'
            );
        }

        return $stats;
    }

    /**
     * Anexa comentarios e respostas na lista de materiais.
     *
     * @since 1.0.0
     */
    private function attachCommentsToMaterials(array $materials): array
    {
        if ($materials === []) {
            return [];
        }

        $materialIds = array_map(
            static fn (array $material): string => (string) $material['id'],
            $materials
        );

        $rawComments = $this->repository->fetchCommentsForMaterials($materialIds);
        if ($rawComments === []) {
            return $materials;
        }

        $lookup = [];
        foreach ($rawComments as $row) {
            $lookup[$row['id']] = [
                'id' => $row['id'],
                'userId' => $row['user_id'],
                'userName' => $row['userName'] ?? 'Usuario indisponivel',
                'userAvatar' => $row['userAvatar'] ?? null,
                'userPlan' => $row['userPlan'] ?? 'Gratuito',
                'text' => $row['content'],
                'date' => date('c', strtotime((string) $row['created_at'])),
                'likes' => (int) ($row['likes'] ?? 0),
                'isLiked' => false,
                'parentId' => $row['parent_id'],
                'replies' => [],
            ];
        }

        foreach ($rawComments as $row) {
            $commentId = $row['id'];
            $parentId = $row['parent_id'];

            if ($parentId && isset($lookup[$parentId])) {
                $lookup[$parentId]['replies'][] = &$lookup[$commentId];
            }
        }

        $commentsByMaterial = [];
        foreach ($rawComments as $row) {
            if ($row['parent_id']) {
                continue;
            }

            $targetId = (string) $row['target_id'];
            if (!isset($commentsByMaterial[$targetId])) {
                $commentsByMaterial[$targetId] = [];
            }

            $commentsByMaterial[$targetId][] = $lookup[$row['id']];
        }

        foreach ($materials as &$material) {
            $material['comments'] = $commentsByMaterial[$material['id']] ?? [];
        }
        unset($material);

        return $materials;
    }

    /**
     * Normaliza a linha de material para o contrato do frontend.
     *
     * @since 1.0.0
     */
    private function normalizeMaterialRow(array $row): array
    {
        $files = json_decode((string) ($row['filesJson'] ?? '{}'), true) ?: [];
        $createdAt = $row['createdAt'] ?? null;

        return [
            'id' => (string) ($row['id'] ?? ''),
            'title' => (string) ($row['title'] ?? ''),
            'description' => (string) ($row['description'] ?? ''),
            'authorId' => (string) ($row['authorId'] ?? ''),
            'authorName' => (string) ($row['authorName'] ?? ''),
            'price' => (float) ($row['price'] ?? 0),
            'type' => (string) ($row['type'] ?? 'PDF'),
            'subject' => (string) ($row['subjectText'] ?? ''),
            'subjectId' => isset($row['subjectId']) ? (int) $row['subjectId'] : null,
            'subjectText' => (string) ($row['subjectText'] ?? ''),
            'topicId' => isset($row['topicId']) ? (int) $row['topicId'] : null,
            'topic' => (string) ($row['topic'] ?? ''),
            'pageCount' => isset($row['pageCount']) ? (int) $row['pageCount'] : null,
            'year' => isset($row['year']) ? (int) $row['year'] : null,
            'examTarget' => (string) ($row['examTarget'] ?? ''),
            'coverUrl' => $this->normalizeNullableValue($row['coverUrl'] ?? null),
            'previewUrl' => $this->normalizeNullableValue($row['previewUrl'] ?? ($files['previewUrl'] ?? null)),
            'hasFile' => trim((string) ($files['storageKey'] ?? $files['fileUrl'] ?? '')) !== '',
            'status' => (string) ($row['status'] ?? 'approved'),
            'rejectionReason' => $this->normalizeNullableValue($row['rejectionReason'] ?? null),
            'salesCount' => (int) ($row['salesCount'] ?? 0),
            'rating' => (float) ($row['rating'] ?? 0),
            'createdAt' => is_string($createdAt) ? strtotime($createdAt) * 1000 : (int) ($createdAt ?? 0),
            'comments' => $row['comments'] ?? [],
        ];
    }

    /**
     * Mantem o contrato da biblioteca do usuario com os campos legados consumidos no perfil.
     *
     * @since 1.0.0
     */
    private function normalizePurchasedMaterialRow(array $row): array
    {
        $material = $this->normalizeMaterialRow($row);

        return array_merge($material, [
            'purchasedAt' => $row['purchasedAt'] ?? null,
        ]);
    }

    /**
     * Resolve o contexto de acesso protegido ao PDF: sessao, permissao e arquivo local.
     *
     * @since 1.0.0
     */
    private function resolveProtectedMaterialContext(string $authenticatedUserId, string $materialId): array
    {
        $this->validator->validatePurchasedMaterialsRequest($authenticatedUserId, null, false);
        $this->validator->validateProtectedMaterialRequest($materialId);

        $context = $this->assertReaderAccessToMaterial($authenticatedUserId, $materialId);
        $user = $context['user'];
        $material = $context['material'];
        $isAdmin = $context['isAdmin'];
        $isAuthor = $context['isAuthor'];

        $filesObj = json_decode((string) ($material['files_json'] ?? '{}'), true) ?: [];
        $storageKey = trim((string) ($filesObj['storageKey'] ?? $filesObj['fileUrl'] ?? ''));
        if ($storageKey === '') {
            throw new OutOfBoundsException('Arquivo do material nao encontrado.');
        }

        $filePath = $this->resolveMaterialFilePath($storageKey);
        if (!$filePath || !file_exists($filePath)) {
            throw new OutOfBoundsException('Arquivo PDF nao encontrado no servidor.');
        }

        return [
            'user' => $user,
            'material' => $material,
            'filePath' => $filePath,
            'isAdmin' => $isAdmin,
            'isAuthor' => $isAuthor,
        ];
    }

    /**
     * Resolve o contexto minimo de leitura do material e garante permissao.
     *
     * @since 1.0.0
     */
    private function assertReaderAccessToMaterial(string $authenticatedUserId, string $materialId): array
    {
        $user = $this->repository->findUserById($authenticatedUserId);
        if (!$user) {
            throw new RuntimeException('Usuario autenticado nao encontrado.');
        }

        $material = $this->repository->findMaterialRecordById($materialId);
        if (!$material) {
            throw new OutOfBoundsException('Material nao encontrado.');
        }

        $isAdmin = (($user['role'] ?? '') === 'admin');
        $isAuthor = ((string) ($material['author_id'] ?? '') === (string) ($user['id'] ?? ''));

        if (!$isAdmin && !$isAuthor && (($material['status'] ?? '') !== 'approved')) {
            throw new OutOfBoundsException('Material nao encontrado ou nao disponivel.');
        }

        if (
            !$isAdmin
            && !$isAuthor
            && !$this->repository->hasApprovedPurchase((string) $user['id'], (string) $material['id'])
        ) {
            throw new RuntimeException('Voce nao possui acesso a este material.');
        }

        return [
            'user' => $user,
            'material' => $material,
            'isAdmin' => $isAdmin,
            'isAuthor' => $isAuthor,
        ];
    }

    /**
     * Garante que apenas arquivos internos da instalacao possam ser servidos.
     *
     * @since 1.0.0
     */
    private function resolveMaterialFilePath(string $storageKey): ?string
    {
        $storageKey = trim($storageKey);
        $privatePrefix = 'private://materials/';
        if (str_starts_with($storageKey, $privatePrefix)) {
            $basename = basename(substr($storageKey, strlen($privatePrefix)));
            if ($basename === '' || $basename !== substr($storageKey, strlen($privatePrefix))) {
                return null;
            }

            return $this->resolvePathInsideDirectory($this->privateMaterialStorageDirectory(), $basename);
        }

        // Temporary compatibility for a legacy record that predates private
        // storage. New uploads never receive this form and the public list no
        // longer exposes it.
        $legacyPrefix = 'uploads/materials/';
        $legacyRelativePath = ltrim((string) preg_replace('#^/questao-pro-backend/#', '', $storageKey), '/');
        if (!str_starts_with($legacyRelativePath, $legacyPrefix)) {
            return null;
        }

        return $this->resolvePathInsideDirectory(
            dirname(__DIR__, 3) . '/uploads/materials',
            basename(substr($legacyRelativePath, strlen($legacyPrefix)))
        );
    }

    /**
     * Gera um nome seguro e previsivel para o PDF baixado.
     *
     * @since 1.0.0
     */
    private function buildProtectedDownloadFileName(string $title, string $userId): string
    {
        $safeTitle = preg_replace('/[^a-z0-9_\\-]/i', '_', $title) ?: 'material';
        return $safeTitle . '_' . $userId . '.pdf';
    }

    /**
     * Mantem o contrato legado de marcadores com pagina numerica e label.
     *
     * @since 1.0.0
     */
    private function normalizeBookmarkRow(array $row): array
    {
        return [
            'id' => (int) ($row['id'] ?? 0),
            'page_num' => (int) ($row['page_num'] ?? 0),
            'label' => (string) ($row['label'] ?? ''),
            'created_at' => (string) ($row['created_at'] ?? ''),
        ];
    }

    /**
     * Normaliza destaques para a UI sem vazar JSON cru para a camada de tela.
     *
     * @since 1.0.0
     */
    private function normalizeHighlightRow(array $row): array
    {
        return [
            'id' => (int) ($row['id'] ?? 0),
            'page_num' => (int) ($row['page_num'] ?? 0),
            'color' => (string) ($row['color'] ?? '#ffeb3b'),
            'rects' => json_decode((string) ($row['rects'] ?? '[]'), true) ?: [],
            'text' => (string) ($row['text'] ?? ''),
            'type' => (string) ($row['type'] ?? 'highlight'),
            'created_at' => (string) ($row['created_at'] ?? ''),
        ];
    }

    /**
     * Normaliza a anotacao livre do material.
     *
     * @since 1.0.0
     */
    private function normalizeMaterialNoteRow(array $row): array
    {
        return [
            'note_text' => (string) ($row['note_text'] ?? ''),
            'updated_at' => (string) ($row['updated_at'] ?? ''),
        ];
    }

    /**
     * Normaliza valores inteiros opcionais a partir de payloads.
     *
     * @since 1.0.0
     */
    private function normalizeNullableInteger(array $data, string $key): ?int
    {
        if (!array_key_exists($key, $data) || $data[$key] === '' || $data[$key] === null) {
            return null;
        }

        return (int) $data[$key];
    }

    /**
     * Normaliza strings opcionais sem deixar vazios ambiguos.
     *
     * @since 1.0.0
     */
    private function normalizeNullableString(array $data, string $key): ?string
    {
        if (!array_key_exists($key, $data)) {
            return null;
        }

        $value = trim((string) ($data[$key] ?? ''));
        return $value === '' ? null : $value;
    }

    /**
     * Normaliza valores opcionais genericos.
     *
     * @since 1.0.0
     */
    private function normalizeNullableValue($value)
    {
        if ($value === null) {
            return null;
        }

        $normalizedValue = trim((string) $value);
        return $normalizedValue === '' ? null : $normalizedValue;
    }

    /**
     * Garante a existencia da pasta fisica de upload dentro da instalacao oficial.
     *
     * @since 1.0.0
     */
    private function ensurePrivateMaterialStorageDirectory(): string
    {
        $directory = $this->privateMaterialStorageDirectory();
        if (!is_dir($directory)) {
            mkdir($directory, 0775, true);
        }

        return $directory;
    }

    /**
     * Capas podem ser publicas; PDFs integrais nunca compartilham esse diretorio.
     */
    private function ensurePublicCoverUploadDirectory(): string
    {
        $directory = dirname(__DIR__, 3) . '/uploads/covers';
        if (!is_dir($directory)) {
            mkdir($directory, 0775, true);
        }

        return $directory;
    }

    /**
     * Resolve o diretorio privado fora do webroot do CloudPanel.
     */
    private function privateMaterialStorageDirectory(): string
    {
        $configured = trim((string) (getenv('MATERIAL_PRIVATE_STORAGE_PATH') ?: ''));
        if ($configured !== '') {
            return rtrim($configured, "/\\");
        }

        return dirname(dirname(__DIR__, 3), 3) . '/private/materials';
    }

    /**
     * Resolve somente arquivos fisicos abaixo do diretorio permitido.
     */
    private function resolvePathInsideDirectory(string $directory, string $filename): ?string
    {
        if ($filename === '' || basename($filename) !== $filename) {
            return null;
        }

        $root = realpath($directory);
        $candidate = realpath(rtrim($directory, "/\\") . DIRECTORY_SEPARATOR . $filename);
        if ($root === false || $candidate === false) {
            return null;
        }

        $root = rtrim(str_replace(['/', '\\'], DIRECTORY_SEPARATOR, $root), DIRECTORY_SEPARATOR);
        $candidate = str_replace(['/', '\\'], DIRECTORY_SEPARATOR, $candidate);

        return str_starts_with($candidate, $root . DIRECTORY_SEPARATOR) ? $candidate : null;
    }

    /**
     * Le a contagem de paginas do PDF e aplica senha opcional para materiais pagos.
     *
     * @since 1.0.0
     */
    private function readPdfPageCount(string $targetPath): ?int
    {
        try {
            $pdf = new \setasign\Fpdi\TcpdfFpdi();
            return $pdf->setSourceFile($targetPath);
        } catch (Throwable $e) {
            error_log('Materials upload PDF processing error: ' . $e->getMessage());
            return null;
        }
    }

    /**
     * Confere que um PDF privado foi enviado pela mesma conta e ainda nao foi
     * anexado a outro material. O frontend nunca escolhe caminho de disco.
     */
    private function resolveOwnedPendingMaterialUpload(string $userId, array $data): ?array
    {
        $storageKey = trim((string) ($data['fileRef'] ?? ''));
        if ($storageKey === '') {
            return null;
        }

        if (!str_starts_with($storageKey, 'private://materials/')) {
            throw new InvalidArgumentException('Referencia de arquivo invalida. Envie o PDF pelo fluxo seguro.');
        }

        $upload = $this->repository->findPendingMaterialUploadForOwner($storageKey, $userId);
        if (!$upload) {
            throw new RuntimeException('O arquivo informado nao pertence a sua conta ou ja foi utilizado.');
        }

        if ($this->resolveMaterialFilePath($storageKey) === null) {
            throw new OutOfBoundsException('Arquivo privado nao encontrado no servidor.');
        }

        return $upload;
    }

    /**
     * Persiste apenas metadados nao secretos do PDF privado.
     */
    private function encodeMaterialFiles(?array $upload): string
    {
        if ($upload === null) {
            return '{}';
        }

        return json_encode([
            'storageKey' => (string) $upload['storage_key'],
            'mimeType' => (string) $upload['mime_type'],
            'sizeBytes' => (int) $upload['size_bytes'],
            'checksumSha256' => (string) $upload['checksum_sha256'],
        ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    }
}

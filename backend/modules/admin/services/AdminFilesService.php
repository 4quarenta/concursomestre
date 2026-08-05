<?php

/*
* ----------------------------------------------------
* @author: 4quarenta
* @author URI: https://github.com/4quarenta
* @copyright: (c) 2026 ConcursoMestre. All rights reserved
* ----------------------------------------------------
*
* @since 1.0.0
*/

declare(strict_types=1);

require_once __DIR__ . '/../repositories/AdminFilesRepository.php';
require_once dirname(__DIR__, 3) . '/shared/storage/ObjectStorage.php';

final class AdminFilesService
{
    public function __construct(private AdminFilesRepository $repository, private ObjectStorage $storage)
    {
    }

    public function list(array $query): array
    {
        $page = max(1, (int) ($query['page'] ?? 1));
        $limit = max(1, min(100, (int) ($query['limit'] ?? 30)));
        $result = $this->repository->list([
            'search' => $query['search'] ?? '',
            'type' => $query['type'] ?? '',
            'source' => $query['source'] ?? '',
            'link' => $query['link'] ?? '',
            'limit' => $limit,
            'offset' => ($page - 1) * $limit,
        ]);
        $items = array_map(fn (array $row): array => $this->normalize($row), $result['items']);
        return [
            'items' => $items,
            'pageInfo' => [
                'page' => $page,
                'limit' => $limit,
                'total' => $result['total'],
                'pages' => max(1, (int) ceil($result['total'] / $limit)),
            ],
        ];
    }

    public function delete(string $id): void
    {
        if (!preg_match('/^([a-z_]+):([A-Za-z0-9-]+)$/', $id, $match)) {
            throw new InvalidArgumentException('Identificador de arquivo invalido.');
        }
        $removed = $this->repository->removeFileReference($match[1], $match[2]);
        if ($removed === null) {
            throw new RuntimeException('O arquivo nao existe ou ja foi removido.');
        }

        $reference = trim((string) $removed['file_ref']);
        if ($reference === '' || $this->repository->hasActiveReference($reference)) {
            return;
        }
        $storageKey = $this->storage->storageKeyFromPublicUrl($reference);
        if ($storageKey === null && !preg_match('#^(?:https?:)?//#i', $reference) && !str_starts_with($reference, '/')) {
            $storageKey = $reference;
        }
        if ($storageKey !== null) {
            try {
                $this->storage->delete($storageKey);
            } catch (Throwable $exception) {
                error_log('AdminFilesService: referencia removida, mas a limpeza fisica falhou: ' . $exception->getMessage());
            }
        }
    }

    private function normalize(array $row): array
    {
        $reference = trim((string) ($row['file_ref'] ?? ''));
        $url = $reference;
        if ($reference !== '' && !preg_match('#^(?:https?:)?//#i', $reference) && !str_starts_with($reference, '/')) {
            try {
                $url = $this->storage->publicUrl($reference);
            } catch (Throwable) {
                $url = '/' . ltrim($reference, '/');
            }
        }
        $type = (string) ($row['file_type'] ?? 'file');
        if ($type === 'file' && preg_match('/\.(?:png|jpe?g|webp|gif|svg)(?:\?.*)?$/i', $reference)) $type = 'image';
        if ($type === 'file' && preg_match('/\.pdf(?:\?.*)?$/i', $reference)) $type = 'pdf';
        $availability = 'unknown';
        $storageKey = $this->storage->storageKeyFromPublicUrl($reference);
        if ($storageKey !== null) {
            $exists = $this->storage->exists($storageKey);
            $availability = $exists === null ? 'unknown' : ($exists ? 'available' : 'missing');
        }
        return [
            'id' => (string) $row['id'],
            'name' => (string) $row['name'],
            'type' => $type,
            'source' => (string) $row['source_type'],
            'url' => $url,
            'mimeType' => $row['mime_type'] ?: null,
            'size' => isset($row['size_bytes']) ? (int) $row['size_bytes'] : null,
            'createdAt' => $row['created_at'] ?? null,
            'ownerType' => $row['owner_type'] ?? null,
            'ownerId' => $row['owner_id'] ?? null,
            'ownerLabel' => $row['owner_label'] ?? null,
            'linked' => (bool) $row['linked'],
            'deletable' => (bool) $row['deletable'],
            'availability' => $availability,
        ];
    }
}

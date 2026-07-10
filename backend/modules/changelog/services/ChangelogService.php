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

require_once __DIR__ . '/../repositories/ChangelogRepository.php';
require_once __DIR__ . '/../validators/ChangelogValidator.php';

/**
 * Service do dominio de changelog.
 * Normaliza o conteudo persistido antes de entregar ao frontend.
 *
 * @since 1.0.0
 */
class ChangelogService
{
    private ChangelogRepository $repository;
    private ChangelogValidator $validator;

    /**
     * Inicializa o service de changelog.
     *
     * @since 1.0.0
     */
    public function __construct(ChangelogRepository $repository, ChangelogValidator $validator)
    {
        $this->repository = $repository;
        $this->validator = $validator;
    }

    /**
     * Lista entradas publicas com o JSON de conteudo normalizado.
     *
     * @since 1.0.0
     */
    public function listEntries(): array
    {
        $rows = $this->repository->listEntries();
        $entries = [];

        foreach ($rows as $row) {
            $entries[] = [
                'id' => (int) ($row['id'] ?? 0),
                'version' => trim((string) ($row['version'] ?? '')),
                'release_date' => (string) ($row['release_date'] ?? ''),
                'title' => trim((string) ($row['title'] ?? '')),
                'description' => trim((string) ($row['description'] ?? '')),
                'content_json' => $this->validator->normalizeContentJson($row['content_json'] ?? null),
            ];
        }

        return $entries;
    }
}

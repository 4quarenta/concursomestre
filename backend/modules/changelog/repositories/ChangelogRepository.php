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
 * Repositorio do dominio de changelog.
 * Centraliza a leitura das publicacoes versionadas da plataforma.
 *
 * @since 1.0.0
 */
class ChangelogRepository
{
    private PDO $db;

    /**
     * Inicializa o repository com a conexao do banco.
     *
     * @since 1.0.0
     */
    public function __construct(PDO $db)
    {
        $this->db = $db;
    }

    /**
     * Busca o changelog publico em ordem decrescente de data.
     *
     * @since 1.0.0
     */
    public function listEntries(): array
    {
        $stmt = $this->db->prepare("
            SELECT id, version, release_date, title, description, content_json
            FROM changelogs
            ORDER BY release_date DESC, id DESC
        ");
        $stmt->execute();

        return $stmt->fetchAll(PDO::FETCH_ASSOC) ?: [];
    }
}

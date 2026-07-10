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
 * Repositorio do dominio de planos.
 * Centraliza a leitura do catalogo comercial no banco.
 *
 * @since 1.0.0
 */
class PlansRepository
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
     * Retorna o catalogo completo de planos.
     *
     * @since 1.0.0
     */
    public function fetchAll(): array
    {
        $stmt = $this->db->prepare('SELECT * FROM plans ORDER BY price ASC');
        $stmt->execute();

        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }

    /**
     * Expõe a conexao para helpers que leem configuracoes globais.
     *
     * @since 1.0.0
     */
    public function getConnection(): PDO
    {
        return $this->db;
    }
}

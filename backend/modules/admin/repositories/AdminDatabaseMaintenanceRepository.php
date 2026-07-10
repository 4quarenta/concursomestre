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
 * Repositorio das operacoes administrativas de manutencao da base.
 */
class AdminDatabaseMaintenanceRepository
{
    private PDO $db;

    /**
     * Inicializa o repositorio com a conexao PDO.
     *
     * @since 1.0.0
     */
    public function __construct(PDO $db)
    {
        $this->db = $db;
    }

    /**
     * Recupera o modo atual da aplicacao salvo nas configuracoes.
     *
     * @since 1.0.0
     */
    public function fetchAppModeSetting(): ?string
    {
        $stmt = $this->db->prepare("SELECT value_json FROM system_settings WHERE key_name = 'appMode' LIMIT 1");
        $stmt->execute();
        $row = $stmt->fetch(PDO::FETCH_ASSOC);

        return $row ? (string) json_decode((string) $row['value_json']) : null;
    }

    /**
     * Busca credenciais basicas do admin para validacao do reset.
     *
     * @since 1.0.0
     */
    public function findAdminCredentialsById(string $adminUserId): ?array
    {
        $stmt = $this->db->prepare("
            SELECT name, email, password_hash, two_factor_secret, two_factor_enabled
            FROM users
            WHERE id = :id
            LIMIT 1
        ");
        $stmt->execute([':id' => $adminUserId]);

        $user = $stmt->fetch(PDO::FETCH_ASSOC);

        return $user ?: null;
    }

    /**
     * Lista todas as tabelas existentes na base.
     *
     * @since 1.0.0
     */
    public function listExistingTables(): array
    {
        return $this->db->query('SHOW TABLES')->fetchAll(PDO::FETCH_COLUMN);
    }

    /**
     * Desativa checagens de chave estrangeira para reset seguro.
     *
     * @since 1.0.0
     */
    public function disableForeignKeyChecks(): void
    {
        $this->db->exec('SET FOREIGN_KEY_CHECKS = 0');
    }

    /**
     * Reativa checagens de chave estrangeira apos o reset.
     *
     * @since 1.0.0
     */
    public function enableForeignKeyChecks(): void
    {
        $this->db->exec('SET FOREIGN_KEY_CHECKS = 1');
    }

    /**
     * Limpa uma tabela liberada sem usar TRUNCATE.
     * O reset administrativo precisa permanecer dentro de transacao,
     * e o TRUNCATE em MySQL executa commit implicito.
     *
     * @since 1.0.0
     */
    public function clearTable(string $tableName): void
    {
        $this->db->exec("DELETE FROM `{$tableName}`");
    }

    /**
     * Remove todos os usuarios mantendo apenas o admin atual.
     *
     * @since 1.0.0
     */
    public function deleteAllUsersExcept(string $adminUserId): void
    {
        $stmt = $this->db->prepare('DELETE FROM users WHERE id != :id');
        $stmt->execute([':id' => $adminUserId]);
    }
}

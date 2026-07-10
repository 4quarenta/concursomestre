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
 * Repository oficial de notificacoes.
 * Concentra o acesso SQL do dominio para evitar queries espalhadas em rotas.
 *
 * @since 1.0.0
 */
class NotificationsRepository
{
    /**
     * Inicializa o repository com a conexao do banco.
     *
     * @since 1.0.0
     */
    public function __construct(private readonly PDO $db)
    {
        $this->ensureSchema();
    }

    /**
     * Lista as notificacoes mais recentes do destinatario informado.
     *
     * @since 1.0.0
     */
    public function listByUserId(string $userId, ?string $since = null, int $limit = 50): array
    {
        $safeLimit = max(1, min($limit, 100));
        $roleStmt = $this->db->prepare('SELECT role FROM users WHERE id = :user_id LIMIT 1');
        $roleStmt->execute([':user_id' => $userId]);
        $userRole = strtolower(trim((string) $roleStmt->fetchColumn()));
        $query = "SELECT id, user_id, title, message, type, category, is_read, created_at, link, evidence_url, deleted_at
                  FROM notifications
                  WHERE user_id = :user_id
                    AND (
                        deleted_at IS NULL
                        OR deleted_at >= DATE_SUB(NOW(), INTERVAL 30 DAY)
                    )";

        if ($userRole === 'staff') {
            $query .= "
                AND category NOT IN ('finance', 'marketing', 'marketplace', 'settings', 'security', 'users')
                AND (
                    link IS NULL
                    OR (
                        link NOT LIKE '/admin/finance%'
                        AND link NOT LIKE '/admin/settings%'
                        AND link NOT LIKE '/admin/marketing%'
                        AND link NOT LIKE '/admin/marketplace%'
                        AND link NOT LIKE '/admin/users%'
                        AND link NOT LIKE '/admin/dashboard%'
                        AND link NOT LIKE '/admin/support/refunds%'
                    )
                )";
        }

        if ($since !== null && $since !== '') {
            $query .= " AND created_at > :since";
        }

        $query .= " ORDER BY created_at DESC LIMIT {$safeLimit}";

        $stmt = $this->db->prepare($query);
        $stmt->bindValue(':user_id', $userId);

        if ($since !== null && $since !== '') {
            $stmt->bindValue(':since', $since);
        }

        $stmt->execute();
        return $stmt->fetchAll(PDO::FETCH_ASSOC) ?: [];
    }

    /**
     * Marca uma notificacao individual como lida respeitando o dono do registro.
     *
     * @since 1.0.0
     */
    public function markAsRead(string $userId, string $notificationId): void
    {
        $stmt = $this->db->prepare(
            "UPDATE notifications
             SET is_read = 1
             WHERE id = :id
               AND user_id = :user_id"
        );
        $stmt->bindValue(':id', $notificationId);
        $stmt->bindValue(':user_id', $userId);
        $stmt->execute();
    }

    /**
     * Marca todas as notificacoes do destinatario como lidas.
     *
     * @since 1.0.0
     */
    public function markAllAsRead(string $userId): void
    {
        $stmt = $this->db->prepare(
            "UPDATE notifications
             SET is_read = 1
             WHERE user_id = :user_id"
        );
        $stmt->bindValue(':user_id', $userId);
        $stmt->execute();
    }

    /**
     * Move uma notificacao para a lixeira logica do usuario.
     *
     * @since 1.0.0
     */
    public function softDelete(string $userId, string $notificationId): void
    {
        $stmt = $this->db->prepare(
            "UPDATE notifications
             SET deleted_at = NOW()
             WHERE id = :id
               AND user_id = :user_id"
        );
        $stmt->bindValue(':id', $notificationId);
        $stmt->bindValue(':user_id', $userId);
        $stmt->execute();
    }

    /**
     * Move todas as notificacoes do destinatario para a lixeira logica.
     *
     * @since 1.0.0
     */
    public function clearAll(string $userId): void
    {
        $stmt = $this->db->prepare(
            "UPDATE notifications
             SET deleted_at = NOW()
             WHERE user_id = :user_id
               AND deleted_at IS NULL"
        );
        $stmt->bindValue(':user_id', $userId);
        $stmt->execute();
    }

    /**
     * Restaura uma notificacao removida logicamente.
     *
     * @since 1.0.0
     */
    public function restore(string $userId, string $notificationId): void
    {
        $stmt = $this->db->prepare(
            "UPDATE notifications
             SET deleted_at = NULL
             WHERE id = :id
               AND user_id = :user_id"
        );
        $stmt->bindValue(':id', $notificationId);
        $stmt->bindValue(':user_id', $userId);
        $stmt->execute();
    }

    /**
     * Exclui definitivamente uma notificacao do usuario.
     *
     * @since 1.0.0
     */
    public function permanentDelete(string $userId, string $notificationId): void
    {
        $stmt = $this->db->prepare(
            "DELETE FROM notifications
             WHERE id = :id
               AND user_id = :user_id"
        );
        $stmt->bindValue(':id', $notificationId);
        $stmt->bindValue(':user_id', $userId);
        $stmt->execute();
    }

    /**
     * Persiste uma notificacao nova no historico oficial.
     *
     * @since 1.0.0
     */
    public function insert(array $notification): void
    {
        $stmt = $this->db->prepare(
            "INSERT INTO notifications (
                id,
                user_id,
                title,
                message,
                type,
                category,
                link,
                evidence_url,
                is_read,
                created_at
            ) VALUES (
                :id,
                :user_id,
                :title,
                :message,
                :type,
                :category,
                :link,
                :evidence_url,
                :is_read,
                :created_at
            )"
        );

        $stmt->bindValue(':id', $notification['id']);
        $stmt->bindValue(':user_id', $notification['user_id']);
        $stmt->bindValue(':title', $notification['title']);
        $stmt->bindValue(':message', $notification['message']);
        $stmt->bindValue(':type', $notification['type']);
        $stmt->bindValue(':category', $notification['category']);
        $stmt->bindValue(':link', $notification['link']);
        $stmt->bindValue(':evidence_url', $notification['evidence_url']);
        $stmt->bindValue(':is_read', (int) ($notification['is_read'] ?? 0), PDO::PARAM_INT);
        $stmt->bindValue(':created_at', $notification['created_at']);
        $stmt->execute();
    }

    /**
     * Lista os IDs dos administradores/staff ativos aptos a receber avisos operacionais.
     *
     * @since 1.0.0
     */
    public function listActiveAdminIds(): array
    {
        $stmt = $this->db->prepare(
            "SELECT id
             FROM users
             WHERE role IN ('admin', 'staff')
               AND COALESCE(status, 'active') = 'active'"
        );
        $stmt->execute();

        return array_values(array_filter(array_map(
            static fn ($row) => isset($row['id']) ? (string) $row['id'] : '',
            $stmt->fetchAll(PDO::FETCH_ASSOC) ?: []
        )));
    }

    /**
     * Lista os IDs dos usuários ativos para campanhas globais.
     *
     * @since 1.0.0
     */
    public function listActiveUserIds(): array
    {
        $stmt = $this->db->prepare(
            "SELECT id
             FROM users
             WHERE COALESCE(status, 'active') = 'active'"
        );
        $stmt->execute();

        return array_values(array_filter(array_map(
            static fn ($row) => isset($row['id']) ? (string) $row['id'] : '',
            $stmt->fetchAll(PDO::FETCH_ASSOC) ?: []
        )));
    }

    /**
     * Garante que o schema usado pelo servico atual exista tambem em bancos
     * instalados a partir do SQL legado.
     *
     * @since 1.0.0
     */
    private function ensureSchema(): void
    {
        $this->db->exec("
            CREATE TABLE IF NOT EXISTS notifications (
                id VARCHAR(64) PRIMARY KEY,
                user_id VARCHAR(64) NOT NULL,
                title VARCHAR(255) NULL,
                message TEXT NULL,
                type VARCHAR(20) NOT NULL DEFAULT 'info',
                category VARCHAR(40) NOT NULL DEFAULT 'system',
                is_read TINYINT(1) NOT NULL DEFAULT 0,
                link VARCHAR(255) NULL,
                evidence_url VARCHAR(500) NULL,
                deleted_at DATETIME NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                INDEX idx_notifications_user_visible (user_id, deleted_at, created_at),
                INDEX idx_notifications_user_unread (user_id, is_read, deleted_at)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        ");

        $this->ensureColumn('category', "ALTER TABLE notifications ADD COLUMN category VARCHAR(40) NOT NULL DEFAULT 'system' AFTER type");
        $this->ensureColumn('is_read', "ALTER TABLE notifications ADD COLUMN is_read TINYINT(1) NOT NULL DEFAULT 0 AFTER type");
        $this->ensureColumn('link', "ALTER TABLE notifications ADD COLUMN link VARCHAR(255) NULL AFTER is_read");
        $this->ensureColumn('evidence_url', "ALTER TABLE notifications ADD COLUMN evidence_url VARCHAR(500) NULL AFTER link");
        $this->ensureColumn('deleted_at', "ALTER TABLE notifications ADD COLUMN deleted_at DATETIME NULL AFTER evidence_url");
        $this->ensureColumn('created_at', "ALTER TABLE notifications ADD COLUMN created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP");

        $this->ensureIdColumnCapacity();
        $this->ensureIndex('idx_notifications_user_visible', 'CREATE INDEX idx_notifications_user_visible ON notifications (user_id, deleted_at, created_at)');
        $this->ensureIndex('idx_notifications_user_unread', 'CREATE INDEX idx_notifications_user_unread ON notifications (user_id, is_read, deleted_at)');
    }

    private function ensureColumn(string $column, string $alterSql): void
    {
        if ($this->columnExists($column)) {
            return;
        }

        $this->db->exec($alterSql);
    }

    private function columnExists(string $column): bool
    {
        $stmt = $this->db->prepare("
            SELECT COUNT(*)
            FROM INFORMATION_SCHEMA.COLUMNS
            WHERE TABLE_SCHEMA = DATABASE()
              AND TABLE_NAME = 'notifications'
              AND COLUMN_NAME = :column
        ");
        $stmt->execute([':column' => $column]);

        return (int) $stmt->fetchColumn() > 0;
    }

    private function ensureIdColumnCapacity(): void
    {
        $stmt = $this->db->prepare("
            SELECT CHARACTER_MAXIMUM_LENGTH
            FROM INFORMATION_SCHEMA.COLUMNS
            WHERE TABLE_SCHEMA = DATABASE()
              AND TABLE_NAME = 'notifications'
              AND COLUMN_NAME = 'id'
            LIMIT 1
        ");
        $stmt->execute();
        $length = (int) $stmt->fetchColumn();

        if ($length > 0 && $length < 64) {
            $this->db->exec('ALTER TABLE notifications MODIFY id VARCHAR(64) NOT NULL');
        }
    }

    private function ensureIndex(string $indexName, string $createSql): void
    {
        if ($this->indexExists($indexName)) {
            return;
        }

        $this->db->exec($createSql);
    }

    private function indexExists(string $indexName): bool
    {
        $stmt = $this->db->prepare("
            SELECT COUNT(*)
            FROM INFORMATION_SCHEMA.STATISTICS
            WHERE TABLE_SCHEMA = DATABASE()
              AND TABLE_NAME = 'notifications'
              AND INDEX_NAME = :index_name
        ");
        $stmt->execute([':index_name' => $indexName]);

        return (int) $stmt->fetchColumn() > 0;
    }
}

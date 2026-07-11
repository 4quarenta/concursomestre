<?php

require_once __DIR__ . '/../../../shared/database/SchemaReadiness.php';

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
        $query = "SELECT id, user_id, title, message, type, category, event_key, severity, channel, entity_type, entity_id, action_key, is_read, created_at, link, evidence_url, deleted_at
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
                event_key,
                severity,
                channel,
                entity_type,
                entity_id,
                action_key,
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
                :event_key,
                :severity,
                :channel,
                :entity_type,
                :entity_id,
                :action_key,
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
        $stmt->bindValue(':event_key', $notification['event_key'] ?? null);
        $stmt->bindValue(':severity', $notification['severity'] ?? null);
        $stmt->bindValue(':channel', $notification['channel'] ?? null);
        $stmt->bindValue(':entity_type', $notification['entity_type'] ?? null);
        $stmt->bindValue(':entity_id', $notification['entity_id'] ?? null);
        $stmt->bindValue(':action_key', $notification['action_key'] ?? null);
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

    private function ensureSchema(): void
    {
        SchemaReadiness::assertTablesAndColumns($this->db, 'notificacoes', [
            'notifications' => [
                'id',
                'user_id',
                'title',
                'message',
                'type',
                'category',
                'is_read',
                'link',
                'evidence_url',
                'deleted_at',
                'created_at',
            ],
        ]);
    }
}

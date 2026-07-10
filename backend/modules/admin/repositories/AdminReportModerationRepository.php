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
 * Repositorio do fluxo administrativo de moderacao de denuncias.
 * Centraliza persistencia e ajustes estruturais necessarios da tabela.
 */
class AdminReportModerationRepository
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
     * Garante colunas extras usadas pela moderacao admin.
     *
     * @since 1.0.0
     */
    public function ensureAdminColumns(): void
    {
        $columns = $this->db->query("SHOW COLUMNS FROM reports")->fetchAll(PDO::FETCH_COLUMN);

        if (!in_array('admin_reason', $columns, true)) {
            $this->db->exec("ALTER TABLE reports ADD COLUMN admin_reason TEXT NULL AFTER details");
        }

        if (!in_array('handled_by', $columns, true)) {
            $this->db->exec("ALTER TABLE reports ADD COLUMN handled_by VARCHAR(64) NULL AFTER admin_reason");
        }

        if (!in_array('user_response', $columns, true)) {
            $this->db->exec("ALTER TABLE reports ADD COLUMN user_response TEXT NULL AFTER admin_reason");
        }

        if (!in_array('internal_note', $columns, true)) {
            $this->db->exec("ALTER TABLE reports ADD COLUMN internal_note TEXT NULL AFTER user_response");
        }

        if (!in_array('moderation_action', $columns, true)) {
            $this->db->exec("ALTER TABLE reports ADD COLUMN moderation_action VARCHAR(80) NULL AFTER internal_note");
        }
    }

    /**
     * Busca uma denuncia completa para moderacao.
     *
     * @since 1.0.0
     */
    public function findById(string $reportId): ?array
    {
        $stmt = $this->db->prepare("
            SELECT
                r.*,
                u.name AS reporter_name,
                u.email AS reporter_email
            FROM reports r
            LEFT JOIN users u ON u.id = r.reporter_id
            WHERE r.id = :id
            LIMIT 1
        ");
        $stmt->execute([':id' => $reportId]);

        $report = $stmt->fetch(PDO::FETCH_ASSOC);

        return $report ?: null;
    }

    /**
     * Persiste a decisao administrativa sobre uma denuncia.
     *
     * @since 1.0.0
     */
    public function moderateReport(
        string $reportId,
        string $status,
        string $adminReason,
        string $userResponse,
        string $internalNote,
        string $moderationAction,
        ?string $evidenceUrl,
        string $adminUserId
    ): void {
        $stmt = $this->db->prepare("
            UPDATE reports
            SET status = :status,
                resolved_at = NOW(),
                admin_reason = :admin_reason,
                user_response = :user_response,
                internal_note = :internal_note,
                moderation_action = :moderation_action,
                evidence_url = :evidence_url,
                handled_by = :handled_by
            WHERE id = :id
        ");

        $stmt->execute([
            ':status' => $status,
            ':admin_reason' => $adminReason,
            ':user_response' => $userResponse,
            ':internal_note' => $internalNote,
            ':moderation_action' => $moderationAction,
            ':evidence_url' => $evidenceUrl,
            ':handled_by' => $adminUserId,
            ':id' => $reportId,
        ]);
    }
}

<?php

require_once __DIR__ . '/../../../shared/database/SchemaReadiness.php';
require_once __DIR__ . '/../../../shared/pagination/SignedKeysetCursor.php';

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
 * Repositorio do dominio de denuncias.
 * Centraliza SQL de criacao, deduplicacao e listagem administrativa.
  * @since 1.0.0
 */
class ReportsRepository
{
    private bool $schemaEnsured = false;

    public function __construct(private readonly PDO $db)
    {
    }

    public function getConnection(): PDO
    {
        return $this->db;
    }

    /**
     * Confere se o reporter existe para evitar gravar referencia quebrada.
      * @since 1.0.0
     */
    public function findUserById(string $userId): ?array
    {
        $stmt = $this->db->prepare('
            SELECT id, name, email, role, level
            FROM users
            WHERE id = :id
            LIMIT 1
        ');
        $stmt->execute([':id' => $userId]);

        $user = $stmt->fetch(PDO::FETCH_ASSOC);
        return $user ?: null;
    }

    public function findFirstAdmin(): ?array
    {
        $stmt = $this->db->prepare("
            SELECT id, name, email
            FROM users
            WHERE role = 'admin'
              AND email IS NOT NULL
              AND email <> ''
              AND COALESCE(status, 'active') NOT IN ('deleted', 'pending_deletion', 'banned', 'suspended')
            ORDER BY id ASC
            LIMIT 1
        ");
        $stmt->execute();

        $admin = $stmt->fetch(PDO::FETCH_ASSOC);
        return $admin ?: null;
    }

    /**
     * Evita spam de denuncias pendentes para o mesmo alvo pelo mesmo usuario.
      * @since 1.0.0
     */
    public function findPendingDuplicate(string $reporterId, string $targetType, string $targetId): ?array
    {
        $this->ensureReportsSchema();

        $stmt = $this->db->prepare("
            SELECT id, status
            FROM reports
            WHERE reporter_id = :reporter_id
              AND target_type = :target_type
              AND target_id = :target_id
              AND resolved_at IS NULL
              AND status NOT IN ('resolved', 'rejected', 'dismissed', 'closed')
            LIMIT 1
        ");
        $stmt->execute([
            ':reporter_id' => $reporterId,
            ':target_type' => $targetType,
            ':target_id' => $targetId,
        ]);

        $report = $stmt->fetch(PDO::FETCH_ASSOC);
        return $report ?: null;
    }

    /**
     * Persiste a denuncia com timestamp explicito para manter previsibilidade.
      * @since 1.0.0
     */
    public function insertReport(array $payload): void
    {
        $this->ensureReportsSchema();

        $stmt = $this->db->prepare('
            INSERT INTO reports (
                id,
                reporter_id,
                target_type,
                target_id,
                reason,
                details,
                status,
                evidence_url,
                created_at
            ) VALUES (
                :id,
                :reporter_id,
                :target_type,
                :target_id,
                :reason,
                :details,
                :status,
                :evidence_url,
                NOW()
            )
        ');

        $stmt->execute([
            ':id' => $payload['id'],
            ':reporter_id' => $payload['reporter_id'],
            ':target_type' => $payload['target_type'],
            ':target_id' => $payload['target_id'],
            ':reason' => $payload['reason'],
            ':details' => $payload['details'],
            ':status' => $payload['status'],
            ':evidence_url' => $payload['evidence_url'],
        ]);
    }

    /**
     * Lista as denuncias para o painel admin com os dados do reporter.
      * @since 1.0.0
     */
    public function listReports(int $limit = 50, ?string $cursor = null): array
    {
        $this->ensureReportsSchema();

        $safeLimit = max(1, min(100, $limit));
        $cursorParts = SignedKeysetCursor::decode($cursor, 'reports.admin') ?? [
            'createdAt' => null,
            'id' => '',
        ];

        $query = '
            SELECT
                r.id,
                r.reporter_id AS userId,
                r.target_type AS targetType,
                r.target_id,
                r.reason,
                r.details,
                r.status,
                r.created_at AS timestamp,
                r.evidence_url AS evidenceUrl,
                r.resolved_at AS resolvedAt,
                u.name AS userName,
                u.email AS email,
                u.role AS role,
                u.level AS level
            FROM reports r
            LEFT JOIN users u ON u.id = r.reporter_id
            WHERE 1 = 1';
        if ($cursorParts['createdAt'] !== null) {
            $query .= ' AND (
                r.created_at < :cursor_created_at
                OR (r.created_at = :cursor_created_at AND r.id < :cursor_id)
            )';
        }
        $query .= ' ORDER BY r.created_at DESC, r.id DESC LIMIT ' . ($safeLimit + 1);

        $stmt = $this->db->prepare($query);
        if ($cursorParts['createdAt'] !== null) {
            $stmt->bindValue(':cursor_created_at', $cursorParts['createdAt']);
            $stmt->bindValue(':cursor_id', $cursorParts['id']);
        }
        $stmt->execute();

        $reports = $stmt->fetchAll(PDO::FETCH_ASSOC) ?: [];
        return $this->hydrateReportTargetPreviews($reports);
    }

    /**
     * Notifica administradores sobre denuncias novas.
     *
     * @since 1.0.0
     */
    public function notifyAdmins(string $title, string $message, string $type, string $category, string $link): int
    {
        require_once __DIR__ . '/../../../config/notification_helper.php';

        return createAdminNotification($this->db, $title, $message, $type, $category, $link);
    }

    private function ensureReportsSchema(): void
    {
        if ($this->schemaEnsured) {
            return;
        }

        SchemaReadiness::assertTablesAndColumns($this->db, 'denuncias', [
            'reports' => [
                'id', 'reporter_id', 'target_type', 'target_id', 'reason', 'details',
                'status', 'evidence_url', 'resolved_at', 'created_at',
            ],
        ]);

        $this->schemaEnsured = true;
    }

    /**
     * Resolve conteudo de comentarios comuns e da Lei Comentada em lote.
     */
    private function hydrateReportTargetPreviews(array $reports): array
    {
        $commentTargetIds = array_values(array_unique(array_filter(array_map(
            static fn (array $report): string => ($report['targetType'] ?? '') === 'comment'
                ? trim((string) ($report['target_id'] ?? ''))
                : '',
            $reports
        ))));
        if ($commentTargetIds === []) {
            return array_map(
                fn (array $report): array => array_merge($report, $this->emptyTargetPreview()),
                $reports
            );
        }

        $placeholders = implode(',', array_fill(0, count($commentTargetIds), '?'));
        $previewById = [];
        $genericStmt = $this->db->prepare(
            "SELECT id, content, target_type, target_id
             FROM comments
             WHERE id IN ({$placeholders})"
        );
        $genericStmt->execute($commentTargetIds);
        foreach ($genericStmt->fetchAll(PDO::FETCH_ASSOC) ?: [] as $comment) {
            $previewById[(string) $comment['id']] = [
                'targetContent' => trim((string) ($comment['content'] ?? '')),
                'targetLabel' => 'Comentario',
                'targetContext' => trim((string) ($comment['target_type'] ?? ''))
                    . ' #' . trim((string) ($comment['target_id'] ?? '')),
                'targetUrl' => null,
            ];
        }

        $unresolvedIds = array_values(array_filter(
            $commentTargetIds,
            static fn (string $id): bool => !isset($previewById[$id])
        ));
        if ($unresolvedIds !== []) {
            $legalPlaceholders = implode(',', array_fill(0, count($unresolvedIds), '?'));
            $legalStmt = $this->db->prepare(
                "SELECT c.id, c.body, c.law_article_id, a.article_number, l.slug AS law_slug, l.title AS law_title
                 FROM legal_user_comments c
                 LEFT JOIN law_articles a ON a.id = c.law_article_id
                 LEFT JOIN laws l ON l.id = a.law_id
                 WHERE c.id IN ({$legalPlaceholders})"
            );
            $legalStmt->execute($unresolvedIds);
            foreach ($legalStmt->fetchAll(PDO::FETCH_ASSOC) ?: [] as $comment) {
                $lawSlug = trim((string) ($comment['law_slug'] ?? ''));
                $articleNumber = trim((string) ($comment['article_number'] ?? ''));
                $previewById[(string) $comment['id']] = [
                    'targetContent' => trim((string) ($comment['body'] ?? '')),
                    'targetLabel' => 'Comentario da Lei Comentada',
                    'targetContext' => trim((string) ($comment['law_title'] ?? 'Lei Comentada'))
                        . ($articleNumber !== '' ? ' - Art. ' . $articleNumber : ''),
                    'targetUrl' => $lawSlug !== '' ? '/lei-comentada/' . rawurlencode($lawSlug) : null,
                ];
            }
        }

        return array_map(function (array $report) use ($previewById): array {
            if (($report['targetType'] ?? '') !== 'comment') {
                return array_merge($report, $this->emptyTargetPreview());
            }
            $targetId = trim((string) ($report['target_id'] ?? ''));
            return array_merge($report, $previewById[$targetId] ?? [
                'targetContent' => null,
                'targetLabel' => 'Comentario nao encontrado',
                'targetContext' => 'O comentario pode ter sido removido ou pertencer a uma origem antiga.',
                'targetUrl' => null,
            ]);
        }, $reports);
    }

    private function emptyTargetPreview(): array
    {
        return [
            'targetContent' => null,
            'targetLabel' => null,
            'targetContext' => null,
            'targetUrl' => null,
        ];
    }

    private function findReportTargetPreview(string $targetType, string $targetId): array
    {
        if ($targetType !== 'comment' || trim($targetId) === '') {
            return [
                'targetContent' => null,
                'targetLabel' => null,
                'targetContext' => null,
                'targetUrl' => null,
            ];
        }

        $genericComment = $this->findGenericCommentPreview($targetId);
        if ($genericComment) {
            return $genericComment;
        }

        $legalComment = $this->findLegalCommentPreview($targetId);
        if ($legalComment) {
            return $legalComment;
        }

        return [
            'targetContent' => null,
            'targetLabel' => 'Comentário não encontrado',
            'targetContext' => 'O comentário pode ter sido removido ou pertencer a uma origem antiga.',
            'targetUrl' => null,
        ];
    }

    private function findGenericCommentPreview(string $targetId): ?array
    {
        if (!$this->tableExists('comments')) {
            return null;
        }

        $stmt = $this->db->prepare("
            SELECT id, content, target_type, target_id
            FROM comments
            WHERE id = :id
            LIMIT 1
        ");
        $stmt->execute([':id' => $targetId]);

        $comment = $stmt->fetch(PDO::FETCH_ASSOC);
        if (!$comment) {
            return null;
        }

        return [
            'targetContent' => trim((string) ($comment['content'] ?? '')),
            'targetLabel' => 'Comentário',
            'targetContext' => trim((string) ($comment['target_type'] ?? '')) . ' #' . trim((string) ($comment['target_id'] ?? '')),
            'targetUrl' => null,
        ];
    }

    private function findLegalCommentPreview(string $targetId): ?array
    {
        if (!$this->tableExists('legal_user_comments')) {
            return null;
        }

        $stmt = $this->db->prepare("
            SELECT c.id, c.body, c.law_article_id, a.number AS article_number, l.slug AS law_slug, l.title AS law_title
            FROM legal_user_comments c
            LEFT JOIN law_articles a ON a.id = c.law_article_id
            LEFT JOIN laws l ON l.id = a.law_id
            WHERE c.id = :id
            LIMIT 1
        ");
        $stmt->execute([':id' => $targetId]);

        $comment = $stmt->fetch(PDO::FETCH_ASSOC);
        if (!$comment) {
            return null;
        }

        $lawSlug = trim((string) ($comment['law_slug'] ?? ''));
        $articleNumber = trim((string) ($comment['article_number'] ?? ''));

        return [
            'targetContent' => trim((string) ($comment['body'] ?? '')),
            'targetLabel' => 'Comentário da Lei Comentada',
            'targetContext' => trim((string) ($comment['law_title'] ?? 'Lei Comentada')) . ($articleNumber !== '' ? ' - Art. ' . $articleNumber : ''),
            'targetUrl' => $lawSlug !== '' ? '/lei-comentada/' . rawurlencode($lawSlug) : null,
        ];
    }

    private function tableExists(string $table): bool
    {
        $stmt = $this->db->prepare("
            SELECT COUNT(*)
            FROM INFORMATION_SCHEMA.TABLES
            WHERE TABLE_SCHEMA = DATABASE()
              AND TABLE_NAME = :table
        ");
        $stmt->execute([':table' => $table]);

        return (int) $stmt->fetchColumn() > 0;
    }

}

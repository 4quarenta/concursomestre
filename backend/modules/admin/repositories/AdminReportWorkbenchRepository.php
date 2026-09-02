<?php

require_once __DIR__ . '/../../reports/services/ReportReasonCatalog.php';
require_once __DIR__ . '/../../../shared/database/SchemaReadiness.php';

/**
 * Persistencia do workbench contextual de moderacao.
 */
class AdminReportWorkbenchRepository
{
    public function __construct(private readonly PDO $db)
    {
    }

    public function connection(): PDO
    {
        return $this->db;
    }

    public function ensureInfrastructure(): void
    {
        SchemaReadiness::assertTablesAndColumns($this->db, 'workbench de moderacao', [
            'reports' => ['id', 'target_type', 'target_id', 'reason', 'details', 'status', 'report_type', 'reason_slug', 'metadata_json', 'priority', 'workflow_status', 'admin_reason', 'user_response', 'internal_note', 'moderation_action', 'handled_by'],
            'report_moderation_history' => ['id', 'report_id', 'target_type', 'target_id', 'reason_slug', 'action_slug', 'moderator_user_id', 'status_before', 'status_after', 'content_before_json', 'content_after_json', 'justification', 'internal_note', 'user_response', 'email_status', 'email_error', 'version_id', 'created_at'],
            'report_moderation_drafts' => ['report_id', 'moderator_user_id', 'action_slug', 'payload_json', 'user_response', 'internal_note', 'created_at', 'updated_at'],
        ]);
    }

    public function findReport(string $reportId, bool $forUpdate = false): ?array
    {
        $sql = "
            SELECT
                r.*,
                u.name AS reporter_name,
                u.email AS reporter_email,
                u.role AS reporter_role
            FROM reports r
            LEFT JOIN users u ON u.id = r.reporter_id
            WHERE r.id = :id
            LIMIT 1
        ";
        if ($forUpdate) {
            $sql .= ' FOR UPDATE';
        }

        $stmt = $this->db->prepare($sql);
        $stmt->execute([':id' => $reportId]);
        $report = $stmt->fetch(PDO::FETCH_ASSOC);

        return $report ?: null;
    }

    public function loadTarget(array $report, bool $forUpdate = false): array
    {
        $targetType = (string) ($report['target_type'] ?? '');
        $targetId = (string) ($report['target_id'] ?? '');

        return match ($targetType) {
            'question' => $this->loadQuestion($targetId, $forUpdate),
            'law_section' => $this->loadLawTarget($report, $forUpdate),
            'comment' => $this->loadComment($targetId, $forUpdate),
            'material' => $this->loadMaterial($targetId, $forUpdate),
            default => $this->missingTarget($targetType, $targetId, 'Tipo de alvo não suportado.'),
        };
    }

    public function findDraft(string $reportId, string $moderatorUserId): ?array
    {
        $stmt = $this->db->prepare(
            "SELECT action_slug, payload_json, user_response, internal_note, updated_at
             FROM report_moderation_drafts
             WHERE report_id = :report_id AND moderator_user_id = :moderator_user_id
             LIMIT 1"
        );
        $stmt->execute([
            ':report_id' => $reportId,
            ':moderator_user_id' => $moderatorUserId,
        ]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);
        if (!$row) {
            return null;
        }

        return [
            'actionSlug' => $row['action_slug'] ?: null,
            'changes' => $this->decodeJson($row['payload_json'] ?? null),
            'userResponse' => (string) ($row['user_response'] ?? ''),
            'internalNote' => (string) ($row['internal_note'] ?? ''),
            'updatedAt' => $row['updated_at'] ?? null,
        ];
    }

    public function saveDraft(
        string $reportId,
        string $moderatorUserId,
        string $actionSlug,
        array $changes,
        string $userResponse,
        string $internalNote
    ): void {
        $stmt = $this->db->prepare(
            "INSERT INTO report_moderation_drafts (
                report_id, moderator_user_id, action_slug, payload_json, user_response, internal_note
             ) VALUES (
                :report_id, :moderator_user_id, :action_slug, :payload_json, :user_response, :internal_note
             )
             ON DUPLICATE KEY UPDATE
                moderator_user_id = VALUES(moderator_user_id),
                action_slug = VALUES(action_slug),
                payload_json = VALUES(payload_json),
                user_response = VALUES(user_response),
                internal_note = VALUES(internal_note),
                updated_at = NOW()"
        );
        $stmt->execute([
            ':report_id' => $reportId,
            ':moderator_user_id' => $moderatorUserId,
            ':action_slug' => $actionSlug !== '' ? $actionSlug : null,
            ':payload_json' => $this->encodeJson($changes),
            ':user_response' => $userResponse,
            ':internal_note' => $internalNote,
        ]);
    }

    public function deleteDraft(string $reportId): void
    {
        $stmt = $this->db->prepare('DELETE FROM report_moderation_drafts WHERE report_id = :report_id');
        $stmt->execute([':report_id' => $reportId]);
    }

    public function listHistory(string $reportId): array
    {
        $stmt = $this->db->prepare(
            "SELECT
                h.*,
                u.name AS moderator_name,
                u.role AS moderator_role
             FROM report_moderation_history h
             LEFT JOIN users u ON u.id = h.moderator_user_id
             WHERE h.report_id = :report_id
             ORDER BY h.created_at DESC, h.id DESC"
        );
        $stmt->execute([':report_id' => $reportId]);

        return array_map(function (array $row): array {
            return [
                'id' => (int) $row['id'],
                'actionSlug' => (string) $row['action_slug'],
                'moderatorId' => (string) $row['moderator_user_id'],
                'moderatorName' => (string) ($row['moderator_name'] ?? 'Equipe ConcursoMestre'),
                'moderatorRole' => (string) ($row['moderator_role'] ?? 'staff'),
                'statusBefore' => (string) $row['status_before'],
                'statusAfter' => (string) $row['status_after'],
                'contentBefore' => $this->decodeJson($row['content_before_json'] ?? null),
                'contentAfter' => $this->decodeJson($row['content_after_json'] ?? null),
                'justification' => (string) ($row['justification'] ?? ''),
                'internalNote' => (string) ($row['internal_note'] ?? ''),
                'userResponse' => (string) ($row['user_response'] ?? ''),
                'emailStatus' => (string) ($row['email_status'] ?? 'pending'),
                'emailError' => ($row['email_error'] ?? null) ?: null,
                'createdAt' => $row['created_at'] ?? null,
            ];
        }, $stmt->fetchAll(PDO::FETCH_ASSOC) ?: []);
    }

    public function insertHistory(array $payload): int
    {
        $stmt = $this->db->prepare(
            "INSERT INTO report_moderation_history (
                report_id, target_type, target_id, reason_slug, action_slug,
                moderator_user_id, status_before, status_after,
                content_before_json, content_after_json, justification,
                internal_note, user_response, email_status, version_id
             ) VALUES (
                :report_id, :target_type, :target_id, :reason_slug, :action_slug,
                :moderator_user_id, :status_before, :status_after,
                :content_before_json, :content_after_json, :justification,
                :internal_note, :user_response, 'pending', :version_id
             )"
        );
        $stmt->execute([
            ':report_id' => $payload['report_id'],
            ':target_type' => $payload['target_type'],
            ':target_id' => $payload['target_id'],
            ':reason_slug' => $payload['reason_slug'],
            ':action_slug' => $payload['action_slug'],
            ':moderator_user_id' => $payload['moderator_user_id'],
            ':status_before' => $payload['status_before'],
            ':status_after' => $payload['status_after'],
            ':content_before_json' => $this->encodeJson($payload['content_before'] ?? []),
            ':content_after_json' => $this->encodeJson($payload['content_after'] ?? []),
            ':justification' => $payload['justification'] ?? '',
            ':internal_note' => $payload['internal_note'] ?? '',
            ':user_response' => $payload['user_response'],
            ':version_id' => $payload['version_id'] ?? null,
        ]);

        return (int) $this->db->lastInsertId();
    }

    public function updateHistoryEmailResult(int $historyId, string $status, ?string $error): void
    {
        $stmt = $this->db->prepare(
            'UPDATE report_moderation_history SET email_status = :status, email_error = :error WHERE id = :id'
        );
        $stmt->execute([
            ':status' => $status,
            ':error' => $error,
            ':id' => $historyId,
        ]);
    }

    public function updateReportDecision(
        string $reportId,
        string $status,
        string $workflowStatus,
        string $actionSlug,
        string $justification,
        string $userResponse,
        string $internalNote,
        string $moderatorUserId,
        bool $resolved
    ): void {
        $stmt = $this->db->prepare(
            "UPDATE reports
             SET status = :status,
                 workflow_status = :workflow_status,
                 reason_slug = COALESCE(NULLIF(reason_slug, ''), :reason_slug),
                 report_type = :report_type,
                 admin_reason = :admin_reason,
                 user_response = :user_response,
                 internal_note = :internal_note,
                 moderation_action = :moderation_action,
                 handled_by = :handled_by,
                 resolved_at = CASE WHEN :resolved = 1 THEN NOW() ELSE NULL END
             WHERE id = :id"
        );
        $report = $this->findReport($reportId);
        $reasonSlug = ReportReasonCatalog::normalizeReasonSlug(
            (string) ($report['reason'] ?? ''),
            (string) ($report['reason_slug'] ?? '')
        );
        $stmt->execute([
            ':status' => $status,
            ':workflow_status' => $workflowStatus,
            ':reason_slug' => $reasonSlug,
            ':report_type' => ReportReasonCatalog::reportTypeForReason($reasonSlug),
            ':admin_reason' => $justification,
            ':user_response' => $userResponse,
            ':internal_note' => $internalNote,
            ':moderation_action' => $actionSlug,
            ':handled_by' => $moderatorUserId,
            ':resolved' => $resolved ? 1 : 0,
            ':id' => $reportId,
        ]);
    }

    public function updateQuestion(string $questionId, array $changes): array
    {
        $current = $this->loadQuestion($questionId, true);
        if (!$current['exists']) {
            throw new OutOfBoundsException('Questão não encontrada.');
        }

        $row = $current['raw'];
        $data = $this->decodeJson($row['data_json'] ?? null);
        $updates = [];
        $params = [':id' => $questionId];

        if (array_key_exists('answerIndex', $changes)) {
            $answerIndex = (int) $changes['answerIndex'];
            $options = $current['current']['options'];
            if ($answerIndex < 0 || $answerIndex >= count($options)) {
                throw new InvalidArgumentException('Selecione uma alternativa válida para o novo gabarito.');
            }
            $updates[] = 'resposta_correta_item_index = :answer_index';
            $params[':answer_index'] = $answerIndex;
            $data['correctOptionIndex'] = $answerIndex;
        }

        if (array_key_exists('statement', $changes)) {
            $statement = trim((string) $changes['statement']);
            if ($statement === '') {
                throw new InvalidArgumentException('O novo enunciado não pode ficar vazio.');
            }
            $updates[] = 'enunciado = :statement';
            $updates[] = 'enunciado_clean = :statement_clean';
            $params[':statement'] = $statement;
            $params[':statement_clean'] = trim(strip_tags($statement));
        }

        if (array_key_exists('supportText', $changes)) {
            $updates[] = 'intro_text = :support_text';
            $params[':support_text'] = (string) $changes['supportText'];
        }

        if (array_key_exists('referenceText', $changes)) {
            $updates[] = 'reference_text = :reference_text';
            $params[':reference_text'] = (string) $changes['referenceText'];
            $data['referenceText'] = (string) $changes['referenceText'];
            $data['reference_text'] = (string) $changes['referenceText'];
        }

        if (array_key_exists('teacherComment', $changes)) {
            $data['teacherComment'] = trim((string) $changes['teacherComment']);
        }

        if (array_key_exists('detailedComment', $changes)) {
            $data['detailedComment'] = trim((string) $changes['detailedComment']);
        }

        if (array_key_exists('imageUrl', $changes)) {
            $data['imageUrl'] = trim((string) $changes['imageUrl']);
        }

        if (array_key_exists('annulled', $changes)) {
            $updates[] = 'anulada = :annulled';
            $params[':annulled'] = !empty($changes['annulled']) ? 1 : 0;
        }

        if (array_key_exists('outdated', $changes)) {
            $updates[] = 'desatualizada = :outdated';
            $params[':outdated'] = !empty($changes['outdated']) ? 1 : 0;
        }

        if (array_key_exists('publishStatus', $changes)) {
            $publishStatus = (string) $changes['publishStatus'];
            if (!in_array($publishStatus, ['published', 'draft', 'scheduled'], true)) {
                throw new InvalidArgumentException('Status de publicação inválido.');
            }
            $updates[] = 'publish_status = :publish_status';
            $params[':publish_status'] = $publishStatus;
        }

        $updates[] = 'data_json = :data_json';
        $updates[] = 'updated_at = NOW()';
        $params[':data_json'] = $this->encodeJson($data);

        $stmt = $this->db->prepare('UPDATE questions SET ' . implode(', ', array_unique($updates)) . ' WHERE id = :id');
        $stmt->execute($params);

        return $this->loadQuestion($questionId, false);
    }

    public function updateQuestionFilters(string $questionId, array $filterIds): array
    {
        $normalized = array_values(array_unique(array_filter(
            array_map('intval', $filterIds),
            static fn (int $value): bool => $value > 0
        )));

        if ($normalized === []) {
            throw new InvalidArgumentException('Selecione ao menos uma classificação válida.');
        }

        $placeholders = implode(',', array_fill(0, count($normalized), '?'));
        $check = $this->db->prepare("SELECT id FROM filters WHERE id IN ({$placeholders})");
        $check->execute($normalized);
        $validIds = array_map('intval', $check->fetchAll(PDO::FETCH_COLUMN) ?: []);
        if (count($validIds) !== count($normalized)) {
            throw new InvalidArgumentException('Uma ou mais classificações selecionadas não existem.');
        }

        $this->db->prepare('DELETE FROM question_filters WHERE question_id = ?')->execute([$questionId]);
        $insert = $this->db->prepare('INSERT INTO question_filters (question_id, filter_id) VALUES (?, ?)');
        foreach ($validIds as $filterId) {
            $insert->execute([$questionId, $filterId]);
        }

        return $this->loadQuestion($questionId, false);
    }

    public function updateComment(string $targetId, array $changes): array
    {
        $target = $this->loadComment($targetId, true);
        if (!$target['exists']) {
            throw new OutOfBoundsException('Comentário não encontrado.');
        }

        if (($target['source'] ?? '') === 'comments') {
            $fields = [];
            $params = [':id' => $targetId];
            if (array_key_exists('content', $changes)) {
                $fields[] = 'content = :content';
                $params[':content'] = trim((string) $changes['content']);
            }
            if (array_key_exists('moderationStatus', $changes)) {
                $status = (string) $changes['moderationStatus'];
                if (!in_array($status, ['approved', 'pending', 'spam', 'trash'], true)) {
                    throw new InvalidArgumentException('Status de moderação inválido.');
                }
                $fields[] = 'moderation_status = :moderation_status';
                $params[':moderation_status'] = $status;
            }
            if ($fields !== []) {
                $stmt = $this->db->prepare('UPDATE comments SET ' . implode(', ', $fields) . ' WHERE id = :id');
                $stmt->execute($params);
            }
        } else {
            $fields = ['updated_at = NOW()'];
            $params = [':id' => $targetId];
            if (array_key_exists('content', $changes)) {
                $fields[] = 'body = :content';
                $params[':content'] = trim((string) $changes['content']);
            }
            if (array_key_exists('moderationStatus', $changes)) {
                $status = (string) $changes['moderationStatus'];
                $map = [
                    'approved' => ['approved', 'visible'],
                    'pending' => ['pending', 'hidden'],
                    'spam' => ['spam', 'hidden'],
                    'trash' => ['spam', 'hidden'],
                ];
                if (!isset($map[$status])) {
                    throw new InvalidArgumentException('Status de moderação inválido.');
                }
                $fields[] = 'moderation_status = :moderation_status';
                $fields[] = 'status = :status';
                $params[':moderation_status'] = $map[$status][0];
                $params[':status'] = $map[$status][1];
            }
            $stmt = $this->db->prepare('UPDATE legal_user_comments SET ' . implode(', ', $fields) . ' WHERE id = :id');
            $stmt->execute($params);
        }

        return $this->loadComment($targetId, false);
    }

    public function updateLegalTarget(array $target, array $changes): array
    {
        if (!$target['exists'] || empty($target['current']['article']['id'])) {
            throw new OutOfBoundsException('Item da Lei Comentada não encontrado.');
        }

        $articleId = (string) $target['current']['article']['id'];

        if (array_key_exists('officialText', $changes)) {
            $text = trim((string) $changes['officialText']);
            if ($text === '') {
                throw new InvalidArgumentException('O texto legal não pode ficar vazio.');
            }
            $stmt = $this->db->prepare(
                'UPDATE law_articles SET official_text = :text, is_recently_changed = 1, updated_at = NOW() WHERE id = :id'
            );
            $stmt->execute([':text' => $text, ':id' => $articleId]);
        }

        if (!empty($changes['teacherCommentAction'])) {
            $action = (string) $changes['teacherCommentAction'];
            $body = trim((string) ($changes['teacherComment'] ?? ''));
            $commentId = (int) ($changes['teacherCommentId'] ?? 0);

            if (in_array($action, ['create', 'replace', 'append'], true) && $body === '') {
                throw new InvalidArgumentException('Revise o comentário antes de publicar.');
            }

            if ($action === 'create') {
                $stmt = $this->db->prepare(
                    "INSERT INTO teacher_comments (
                        law_article_id, title, body, author_name, author_role, reviewed_at
                     ) VALUES (:article_id, :title, :body, :author_name, 'Equipe editorial', NOW())"
                );
                $stmt->execute([
                    ':article_id' => $articleId,
                    ':title' => trim((string) ($changes['teacherCommentTitle'] ?? 'Comentário do professor')),
                    ':body' => $body,
                    ':author_name' => trim((string) ($changes['authorName'] ?? 'Equipe ConcursoMestre')),
                ]);
            } elseif ($action === 'replace') {
                if ($commentId <= 0) {
                    throw new InvalidArgumentException('Selecione o comentário que será substituído.');
                }
                $stmt = $this->db->prepare(
                    'UPDATE teacher_comments SET body = :body, reviewed_at = NOW(), updated_at = NOW() WHERE id = :id AND law_article_id = :article_id'
                );
                $stmt->execute([':body' => $body, ':id' => $commentId, ':article_id' => $articleId]);
                if ($stmt->rowCount() < 1) {
                    throw new OutOfBoundsException('Comentário existente não encontrado.');
                }
            } elseif ($action === 'append') {
                if ($commentId <= 0) {
                    throw new InvalidArgumentException('Selecione o comentário que receberá o complemento.');
                }
                $stmt = $this->db->prepare(
                    "UPDATE teacher_comments
                     SET body = CONCAT(TRIM(body), '\n\n', :body), reviewed_at = NOW(), updated_at = NOW()
                     WHERE id = :id AND law_article_id = :article_id"
                );
                $stmt->execute([':body' => $body, ':id' => $commentId, ':article_id' => $articleId]);
                if ($stmt->rowCount() < 1) {
                    throw new OutOfBoundsException('Comentário existente não encontrado.');
                }
            } elseif ($action === 'remove') {
                if ($commentId <= 0) {
                    throw new InvalidArgumentException('Selecione o comentário que será removido.');
                }
                $stmt = $this->db->prepare('DELETE FROM teacher_comments WHERE id = :id AND law_article_id = :article_id');
                $stmt->execute([':id' => $commentId, ':article_id' => $articleId]);
            }
        }

        $report = ['target_id' => (string) $target['id'], 'details' => '', 'metadata_json' => $this->encodeJson([
            'law_id' => $target['current']['law']['id'] ?? null,
            'section_id' => $target['current']['section']['id'] ?? null,
            'article_id' => $articleId,
            'block_id' => $target['current']['block']['id'] ?? null,
        ])];

        return $this->loadLawTarget($report, false);
    }

    private function loadQuestion(string $targetId, bool $forUpdate): array
    {
        $sql = "
            SELECT q.*, p.nome AS exam_name, p.ano AS exam_year
            FROM questions q
            LEFT JOIN provas p ON p.id = q.prova_id
            WHERE q.id = :id
            LIMIT 1
        " . ($forUpdate ? ' FOR UPDATE' : '');
        $stmt = $this->db->prepare($sql);
        $stmt->execute([':id' => $targetId]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);
        if (!$row) {
            return $this->missingTarget('question', $targetId, 'Questão não encontrada no banco.');
        }

        $data = $this->decodeJson($row['data_json'] ?? null);
        $options = $data['itens'] ?? $data['items'] ?? [];
        $filtersStmt = $this->db->prepare(
            "SELECT f.id, f.type, f.name, f.slug, f.parent_id
             FROM question_filters qf
             INNER JOIN filters f ON f.id = qf.filter_id
             WHERE qf.question_id = :id
             ORDER BY f.type, f.name"
        );
        $filtersStmt->execute([':id' => $targetId]);
        $filters = $filtersStmt->fetchAll(PDO::FETCH_ASSOC) ?: [];

        return [
            'exists' => true,
            'type' => 'question',
            'id' => (string) $targetId,
            'label' => 'Questão #' . $targetId,
            'url' => '/admin/operation/questions/' . rawurlencode($targetId) . '/edit',
            'source' => 'questions',
            'current' => [
                'statement' => (string) ($row['enunciado'] ?? ''),
                'supportText' => (string) ($row['intro_text'] ?? ''),
                'referenceText' => (string) ($row['reference_text'] ?? ''),
                'options' => is_array($options) ? array_values($options) : [],
                'answerIndex' => (int) ($row['resposta_correta_item_index'] ?? $data['correctOptionIndex'] ?? 0),
                'teacherComment' => (string) ($data['teacherComment'] ?? $data['teacher_comment'] ?? ''),
                'detailedComment' => (string) ($data['detailedComment'] ?? $data['detailed_comment'] ?? ''),
                'imageUrl' => (string) ($data['imageUrl'] ?? $data['image_url'] ?? ''),
                'difficulty' => (int) ($row['dificuldade'] ?? 1),
                'annulled' => !empty($row['anulada']),
                'outdated' => !empty($row['desatualizada']),
                'publishStatus' => (string) ($row['publish_status'] ?? 'published'),
                'exam' => [
                    'id' => $row['prova_id'] ?? null,
                    'name' => $row['exam_name'] ?? null,
                    'year' => $row['exam_year'] ?? null,
                ],
                'filters' => $filters,
            ],
            'raw' => $row,
        ];
    }

    private function loadComment(string $targetId, bool $forUpdate): array
    {
        $suffix = $forUpdate ? ' FOR UPDATE' : '';
        if ($this->tableExists('comments')) {
            $stmt = $this->db->prepare(
                "SELECT c.*, u.name AS author_name, u.email AS author_email
                 FROM comments c
                 LEFT JOIN users u ON u.id = c.user_id
                 WHERE c.id = :id
                 LIMIT 1{$suffix}"
            );
            $stmt->execute([':id' => $targetId]);
            $row = $stmt->fetch(PDO::FETCH_ASSOC);
            if ($row) {
                return [
                    'exists' => true,
                    'type' => 'comment',
                    'id' => (string) $targetId,
                    'label' => 'Comentário',
                    'url' => null,
                    'source' => 'comments',
                    'current' => [
                        'content' => (string) ($row['content'] ?? ''),
                        'authorId' => (string) ($row['user_id'] ?? ''),
                        'authorName' => (string) ($row['author_name'] ?? 'Usuário'),
                        'authorEmail' => ($row['author_email'] ?? null) ?: null,
                        'targetType' => (string) ($row['target_type'] ?? ''),
                        'targetId' => (string) ($row['target_id'] ?? ''),
                        'status' => (string) ($row['moderation_status'] ?? 'approved'),
                        'createdAt' => $row['created_at'] ?? null,
                    ],
                    'raw' => $row,
                ];
            }
        }

        if ($this->tableExists('legal_user_comments')) {
            $stmt = $this->db->prepare(
                "SELECT
                    c.*, a.article_number, a.slug AS article_slug,
                    l.id AS law_id, l.title AS law_title, l.slug AS law_slug
                 FROM legal_user_comments c
                 INNER JOIN law_articles a ON a.id = c.law_article_id
                 INNER JOIN laws l ON l.id = a.law_id
                 WHERE c.id = :id
                 LIMIT 1{$suffix}"
            );
            $stmt->execute([':id' => $targetId]);
            $row = $stmt->fetch(PDO::FETCH_ASSOC);
            if ($row) {
                return [
                    'exists' => true,
                    'type' => 'comment',
                    'id' => (string) $targetId,
                    'label' => 'Comentário da Lei Comentada',
                    'url' => '/lei-comentada/' . rawurlencode((string) $row['law_slug']),
                    'source' => 'legal_user_comments',
                    'current' => [
                        'content' => (string) ($row['body'] ?? ''),
                        'authorId' => (string) ($row['user_id'] ?? ''),
                        'authorName' => (string) ($row['user_name'] ?? 'Usuário'),
                        'targetType' => 'law_article',
                        'targetId' => (string) ($row['law_article_id'] ?? ''),
                        'targetLabel' => (string) ($row['law_title'] ?? '') . ' - Art. ' . (string) ($row['article_number'] ?? ''),
                        'status' => (string) ($row['moderation_status'] ?? 'approved'),
                        'visibility' => (string) ($row['status'] ?? 'visible'),
                        'createdAt' => $row['created_at'] ?? null,
                        'updatedAt' => $row['updated_at'] ?? null,
                    ],
                    'raw' => $row,
                ];
            }
        }

        return $this->missingTarget('comment', $targetId, 'Comentário não encontrado nas origens disponíveis.');
    }

    private function loadMaterial(string $targetId, bool $forUpdate): array
    {
        if (!$this->tableExists('materials')) {
            return $this->missingTarget('material', $targetId, 'Tabela de materiais não disponível.');
        }
        $stmt = $this->db->prepare(
            "SELECT m.*, u.name AS author_name, u.email AS author_email
             FROM materials m
             LEFT JOIN users u ON u.id = m.author_id
             WHERE m.id = :id
             LIMIT 1" . ($forUpdate ? ' FOR UPDATE' : '')
        );
        $stmt->execute([':id' => $targetId]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);
        if (!$row) {
            return $this->missingTarget('material', $targetId, 'Material não encontrado.');
        }

        return [
            'exists' => true,
            'type' => 'material',
            'id' => (string) $targetId,
            'label' => (string) ($row['title'] ?? 'Material'),
            'url' => '/marketplace/material/' . rawurlencode($targetId),
            'source' => 'materials',
            'current' => [
                'title' => (string) ($row['title'] ?? ''),
                'description' => (string) ($row['description'] ?? ''),
                'status' => (string) ($row['status'] ?? ''),
                'authorName' => (string) ($row['author_name'] ?? ''),
                'coverUrl' => (string) ($row['cover_url'] ?? ''),
                'previewUrl' => (string) ($row['preview_url'] ?? ''),
                'files' => $this->decodeJson($row['files_json'] ?? null),
            ],
            'raw' => $row,
        ];
    }

    private function loadLawTarget(array $report, bool $forUpdate): array
    {
        if (!$this->tableExists('law_articles')) {
            return $this->missingTarget('law_section', (string) ($report['target_id'] ?? ''), 'Acervo da Lei Comentada não disponível.');
        }

        $metadata = $this->decodeJson($report['metadata_json'] ?? null);
        $targetId = (string) ($report['target_id'] ?? '');
        $details = (string) ($report['details'] ?? '');
        $resolved = $this->resolveLawIdentifiers($targetId, $details, $metadata);
        $articleId = $resolved['article_id'];
        $sectionId = $resolved['section_id'];
        $lawId = $resolved['law_id'];

        $conditions = [];
        $params = [];
        if ($articleId !== '') {
            $conditions[] = 'a.id = :article_id';
            $params[':article_id'] = $articleId;
        }
        if ($sectionId !== '') {
            $conditions[] = 'a.section_id = :section_id';
            $params[':section_id'] = $sectionId;
        }
        if ($lawId !== '') {
            $conditions[] = 'a.law_id = :law_id';
            $params[':law_id'] = $lawId;
        }
        if ($conditions === []) {
            return $this->missingTarget('law_section', $targetId, 'O identificador da lei, seção ou artigo não pôde ser interpretado.');
        }

        $sql = "
            SELECT
                a.*,
                l.title AS law_title,
                l.short_title AS law_short_title,
                l.law_number,
                l.official_url,
                l.slug AS law_slug,
                s.display_title AS section_title,
                s.title_label,
                s.title_name,
                s.chapter_label,
                s.chapter_name
            FROM law_articles a
            INNER JOIN laws l ON l.id = a.law_id
            LEFT JOIN law_sections s ON s.id = a.section_id
            WHERE " . implode(' AND ', $conditions) . '
            ORDER BY a.sort_order ASC
            LIMIT 1' . ($forUpdate ? ' FOR UPDATE' : '');
        $stmt = $this->db->prepare($sql);
        $stmt->execute($params);
        $article = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!$article) {
            return $this->missingTarget(
                'law_section',
                $targetId,
                'Nenhum artigo corresponde aos identificadores informados.',
                $resolved
            );
        }

        $articleId = (string) $article['id'];
        $blocks = $this->fetchAll(
            'SELECT * FROM law_article_blocks WHERE law_article_id = :article_id ORDER BY sort_order',
            [':article_id' => $articleId]
        );
        $teacherComments = $this->fetchAll(
            'SELECT * FROM teacher_comments WHERE law_article_id = :article_id ORDER BY created_at',
            [':article_id' => $articleId]
        );
        $doctrine = $this->fetchAll(
            'SELECT * FROM article_doutrina WHERE law_article_id = :article_id ORDER BY priority, id',
            [':article_id' => $articleId]
        );
        $precedents = $this->fetchAll(
            'SELECT * FROM article_jurisprudence WHERE law_article_id = :article_id ORDER BY priority, id',
            [':article_id' => $articleId]
        );
        $sumulas = $this->fetchAll(
            'SELECT * FROM article_sumulas WHERE law_article_id = :article_id ORDER BY priority, id',
            [':article_id' => $articleId]
        );
        $tips = $this->fetchAll(
            'SELECT * FROM article_exam_tips WHERE law_article_id = :article_id ORDER BY id',
            [':article_id' => $articleId]
        );

        $block = null;
        $requestedBlockId = $resolved['block_id'];
        foreach ($blocks as $candidate) {
            if (
                ($requestedBlockId !== '' && (string) $candidate['id'] === $requestedBlockId)
                || ($requestedBlockId !== '' && (string) $candidate['block_uid'] === $requestedBlockId)
            ) {
                $block = $candidate;
                break;
            }
        }

        return [
            'exists' => true,
            'type' => 'law_section',
            'id' => $targetId,
            'label' => (string) ($article['law_short_title'] ?: $article['law_title']) . ' - Art. ' . (string) $article['article_number'],
            'url' => '/lei-comentada/' . rawurlencode((string) $article['law_slug']),
            'source' => 'law_articles',
            'current' => [
                'law' => [
                    'id' => (string) $article['law_id'],
                    'title' => (string) $article['law_title'],
                    'shortTitle' => (string) $article['law_short_title'],
                    'number' => (string) $article['law_number'],
                    'officialUrl' => (string) $article['official_url'],
                    'slug' => (string) $article['law_slug'],
                ],
                'section' => [
                    'id' => $article['section_id'] !== null ? (string) $article['section_id'] : null,
                    'title' => (string) ($article['section_title'] ?? ''),
                    'titleLabel' => (string) ($article['title_label'] ?? ''),
                    'titleName' => (string) ($article['title_name'] ?? ''),
                    'chapterLabel' => (string) ($article['chapter_label'] ?? ''),
                    'chapterName' => (string) ($article['chapter_name'] ?? ''),
                ],
                'article' => [
                    'id' => $articleId,
                    'number' => (string) $article['article_number'],
                    'title' => (string) ($article['title'] ?? ''),
                    'officialText' => (string) ($article['official_text'] ?? ''),
                    'paragraphs' => $this->decodeJson($article['paragraphs_json'] ?? null),
                    'updatedAt' => $article['updated_at'] ?? null,
                ],
                'block' => $block,
                'blocks' => $blocks,
                'teacherComments' => $teacherComments,
                'doctrine' => $doctrine,
                'precedents' => $precedents,
                'sumulas' => $sumulas,
                'examTips' => $tips,
            ],
            'raw' => $article,
        ];
    }

    private function resolveLawIdentifiers(string $targetId, string $details, array $metadata): array
    {
        $lawId = trim((string) ($metadata['law_id'] ?? $metadata['lawId'] ?? ''));
        $sectionId = trim((string) ($metadata['section_id'] ?? $metadata['sectionId'] ?? ''));
        $articleId = trim((string) ($metadata['article_id'] ?? $metadata['articleId'] ?? ''));
        $blockId = trim((string) ($metadata['block_id'] ?? $metadata['blockId'] ?? ''));

        if (preg_match('/C[oó]digo do pedido:\s*(?:teacher_request|analysis_request):([^:\s]+):([^:\s]+):([^\s]+)/iu', $details, $match)) {
            $lawId = $lawId !== '' ? $lawId : trim($match[1]);
            $sectionId = $sectionId !== '' ? $sectionId : trim($match[2]);
            $targetParts = explode(':', trim($match[3]));
            $articleId = $articleId !== '' ? $articleId : trim((string) ($targetParts[0] ?? ''));
            $blockId = $blockId !== '' ? $blockId : trim((string) ($targetParts[1] ?? ''));
        }

        $parts = array_values(array_filter(array_map('trim', explode(':', $targetId)), static fn ($part) => $part !== ''));
        if ($sectionId === '' && isset($parts[0]) && ctype_digit($parts[0])) {
            $sectionId = $parts[0];
        }
        if ($articleId === '' && isset($parts[1])) {
            if (ctype_digit($parts[1])) {
                $articleId = $parts[1];
            } elseif (preg_match('/^(\d+)(?:-block-|$)/', $parts[1], $articleMatch)) {
                $articleId = $articleMatch[1];
            }
        }
        if ($blockId === '' && isset($parts[1]) && !ctype_digit($parts[1])) {
            $blockId = $parts[1];
        }
        if ($blockId === '' && isset($parts[2])) {
            $blockId = $parts[2];
        }

        return [
            'law_id' => $lawId,
            'section_id' => $sectionId,
            'article_id' => $articleId,
            'block_id' => $blockId,
        ];
    }

    private function missingTarget(string $type, string $id, string $error, array $diagnostics = []): array
    {
        return [
            'exists' => false,
            'type' => $type,
            'id' => $id,
            'label' => 'Alvo não encontrado',
            'url' => null,
            'source' => null,
            'current' => null,
            'error' => $error,
            'diagnostics' => array_merge([
                'targetType' => $type,
                'targetId' => $id,
            ], $diagnostics),
        ];
    }

    private function tableExists(string $table): bool
    {
        $stmt = $this->db->prepare(
            "SELECT COUNT(*)
             FROM INFORMATION_SCHEMA.TABLES
             WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = :table"
        );
        $stmt->execute([':table' => $table]);

        return (int) $stmt->fetchColumn() > 0;
    }

    private function fetchAll(string $sql, array $params): array
    {
        $stmt = $this->db->prepare($sql);
        $stmt->execute($params);

        return $stmt->fetchAll(PDO::FETCH_ASSOC) ?: [];
    }

    private function decodeJson(mixed $value): array
    {
        if (is_array($value)) {
            return $value;
        }
        if (!is_string($value) || trim($value) === '') {
            return [];
        }
        $decoded = json_decode($value, true);

        return is_array($decoded) ? $decoded : [];
    }

    private function encodeJson(mixed $value): string
    {
        $encoded = json_encode($value, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_INVALID_UTF8_SUBSTITUTE);
        if (!is_string($encoded)) {
            throw new RuntimeException('Não foi possível serializar os dados da moderação.');
        }

        return $encoded;
    }
}

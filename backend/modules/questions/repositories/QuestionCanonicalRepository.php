<?php

declare(strict_types=1);

require_once __DIR__ . '/../../../shared/database/SchemaReadiness.php';

/**
 * Persists the normalized aggregate behind the public question-import.v2
 * contract. The legacy questions.data_json value is retained only as a
 * compatibility snapshot for historical readers.
 */
final class QuestionCanonicalRepository
{
    private bool $schemaChecked = false;

    public function __construct(private readonly PDO $db)
    {
    }

    public function assertSchemaReady(): void
    {
        if ($this->schemaChecked) {
            return;
        }

        SchemaReadiness::assertTablesAndColumns($this->db, 'agregado canonico de questoes', [
            'question_options' => ['id', 'question_id', 'display_order', 'label', 'body', 'is_correct'],
            'question_contexts' => ['id', 'external_key', 'context_type', 'body'],
            'question_context_questions' => ['context_id', 'question_id', 'relation_role'],
            'question_assets' => ['id', 'question_id', 'context_id', 'option_id', 'usage_type'],
            'question_editorials' => ['id', 'question_id', 'editorial_type', 'body', 'status'],
            'prova_extracao_itens' => ['id', 'prova_id', 'question_id', 'item_type', 'status'],
        ]);
        $this->schemaChecked = true;
    }

    /**
     * Reads may continue with the legacy snapshot before the additive migration
     * is applied. Writes of canonical payloads deliberately require readiness.
     */
    public function isAvailable(): bool
    {
        try {
            $stmt = $this->db->prepare(
                'SELECT COUNT(*) FROM information_schema.TABLES
                 WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME IN (
                    \'question_options\', \'question_contexts\', \'question_context_questions\', \'question_assets\', \'question_editorials\'
                 )'
            );
            $stmt->execute();
            return (int) $stmt->fetchColumn() === 5;
        } catch (Throwable) {
            return false;
        }
    }

    /**
     * Replaces the normalized children of a question in the current transaction.
     */
    public function replaceQuestionAggregate(int $questionId, array $question, ?int $contextId = null): void
    {
        $this->assertSchemaReady();

        $this->db->prepare('DELETE FROM question_assets WHERE question_id = :question_id')->execute([
            ':question_id' => $questionId,
        ]);
        $this->db->prepare('DELETE FROM question_editorials WHERE question_id = :question_id')->execute([
            ':question_id' => $questionId,
        ]);
        $this->db->prepare('DELETE FROM question_options WHERE question_id = :question_id')->execute([
            ':question_id' => $questionId,
        ]);
        $this->db->prepare('DELETE FROM question_context_questions WHERE question_id = :question_id')->execute([
            ':question_id' => $questionId,
        ]);

        $optionIdsByKey = [];
        $answer = is_array($question['answer'] ?? null) ? $question['answer'] : [];
        $correctKeys = array_values(array_filter(array_map(
            static fn (mixed $key): string => trim((string) $key),
            is_array($answer['correctAlternativeTempIds'] ?? null)
                ? $answer['correctAlternativeTempIds']
                : []
        ), static fn (string $key): bool => $key !== ''));
        $rawAnswer = strtoupper(trim((string) ($answer['raw'] ?? '')));

        $insertOption = $this->db->prepare(
            'INSERT INTO question_options
                (question_id, external_key, display_order, label, body, body_clean, is_correct, metadata_json)
             VALUES
                (:question_id, :external_key, :display_order, :label, :body, :body_clean, :is_correct, :metadata_json)'
        );
        foreach (array_values(is_array($question['alternatives'] ?? null) ? $question['alternatives'] : []) as $index => $alternative) {
            if (!is_array($alternative)) {
                continue;
            }
            $externalKey = trim((string) ($alternative['tempId'] ?? $alternative['id'] ?? ''));
            $label = trim((string) ($alternative['label'] ?? chr(65 + $index)));
            $displayOrder = max(1, (int) ($alternative['order'] ?? ($index + 1)));
            $isCorrect = ($externalKey !== '' && in_array($externalKey, $correctKeys, true))
                || ($rawAnswer !== '' && $rawAnswer === strtoupper($label));
            $metadata = [
                'text_clean' => (string) ($alternative['textClean'] ?? ''),
            ];
            $insertOption->execute([
                ':question_id' => $questionId,
                ':external_key' => $externalKey !== '' ? $externalKey : null,
                ':display_order' => $displayOrder,
                ':label' => $label !== '' ? $label : chr(65 + $index),
                ':body' => (string) ($alternative['text'] ?? ''),
                ':body_clean' => (string) ($alternative['textClean'] ?? strip_tags((string) ($alternative['text'] ?? ''))),
                ':is_correct' => $isCorrect ? 1 : 0,
                ':metadata_json' => $this->encodeJson($metadata),
            ]);
            $optionId = (int) $this->db->lastInsertId();
            if ($externalKey !== '') {
                $optionIdsByKey[$externalKey] = $optionId;
            }
            $this->insertAssets($questionId, null, $optionId, $alternative['assets'] ?? []);
        }

        $this->insertAssets($questionId, null, null, $question['assets'] ?? []);

        if ($contextId !== null && $contextId > 0) {
            $this->linkQuestionContext($contextId, $questionId, 'shared');
        }

        $insertEditorial = $this->db->prepare(
            'INSERT INTO question_editorials
                (question_id, editorial_type, title, body, status, generated_by, metadata_json)
             VALUES
                (:question_id, :editorial_type, :title, :body, :status, :generated_by, :metadata_json)'
        );
        foreach (is_array($question['editorial'] ?? null) ? $question['editorial'] : [] as $editorial) {
            if (!is_array($editorial)) {
                continue;
            }
            $type = trim((string) ($editorial['type'] ?? ''));
            if (!in_array($type, ['teacher_comment', 'detailed_analysis'], true)) {
                continue;
            }
            $insertEditorial->execute([
                ':question_id' => $questionId,
                ':editorial_type' => $type,
                ':title' => trim((string) ($editorial['title'] ?? '')) ?: null,
                ':body' => (string) ($editorial['body'] ?? ''),
                ':status' => trim((string) ($editorial['status'] ?? 'draft')) ?: 'draft',
                ':generated_by' => trim((string) ($editorial['generatedBy'] ?? $editorial['generated_by'] ?? '')) ?: null,
                ':metadata_json' => $this->encodeJson(is_array($editorial['metadata'] ?? null) ? $editorial['metadata'] : []),
            ]);
        }
    }

    public function saveContext(array $context, string $actorUserId = ''): int
    {
        $this->assertSchemaReady();

        $externalKey = trim((string) ($context['tempId'] ?? $context['id'] ?? $context['contextKey'] ?? ''));
        if ($externalKey === '') {
            throw new InvalidArgumentException('Contexto sem identificador temporario.');
        }
        $find = $this->db->prepare('SELECT id FROM question_contexts WHERE external_key = :external_key LIMIT 1');
        $find->execute([':external_key' => $externalKey]);
        $contextId = $find->fetchColumn();
        $params = [
            ':external_key' => $externalKey,
            ':context_type' => trim((string) ($context['type'] ?? 'shared')) ?: 'shared',
            ':body' => (string) ($context['body'] ?? $context['texto'] ?? $context['text'] ?? ''),
            ':body_clean' => (string) ($context['bodyClean'] ?? $context['textoClean'] ?? ''),
            ':reference_text' => (string) ($context['reference'] ?? ''),
            ':source_page' => $this->positiveIntOrNull($context['sourcePage'] ?? null),
            ':metadata_json' => $this->encodeJson([
                'question_numbers' => array_values($context['questionNumbers'] ?? $context['questionIds'] ?? []),
            ]),
            ':actor' => $actorUserId !== '' ? $actorUserId : null,
        ];
        if ($contextId === false) {
            $insert = $this->db->prepare(
                'INSERT INTO question_contexts
                    (external_key, context_type, body, body_clean, reference_text, source_page, metadata_json, created_by_user_id, updated_by_user_id)
                 VALUES
                    (:external_key, :context_type, :body, :body_clean, :reference_text, :source_page, :metadata_json, :actor, :actor)'
            );
            $insert->execute($params);
            $id = (int) $this->db->lastInsertId();
        } else {
            $id = (int) $contextId;
            $update = $this->db->prepare(
                'UPDATE question_contexts
                 SET context_type = :context_type,
                     body = :body,
                     body_clean = :body_clean,
                     reference_text = :reference_text,
                     source_page = :source_page,
                     metadata_json = :metadata_json,
                     updated_by_user_id = :actor
                 WHERE id = :id'
            );
            $params[':id'] = $id;
            $update->execute($params);
            $this->db->prepare('DELETE FROM question_assets WHERE context_id = :context_id')->execute([':context_id' => $id]);
        }
        $this->insertAssets(null, $id, null, $context['assets'] ?? []);
        return $id;
    }

    public function linkQuestionContext(int $contextId, int $questionId, string $role = 'shared'): void
    {
        $stmt = $this->db->prepare(
            'INSERT INTO question_context_questions (context_id, question_id, relation_role)
             VALUES (:context_id, :question_id, :relation_role)
             ON DUPLICATE KEY UPDATE relation_role = VALUES(relation_role)'
        );
        $stmt->execute([
            ':context_id' => $contextId,
            ':question_id' => $questionId,
            ':relation_role' => $role,
        ]);
    }

    public function recordExtractionItem(?int $provaId, ?int $questionId, array $question, string $status): void
    {
        $this->assertSchemaReady();
        $source = is_array($question['source'] ?? null) ? $question['source'] : [];
        $stmt = $this->db->prepare(
            'INSERT INTO prova_extracao_itens
                (prova_id, question_id, external_key, item_type, item_number, status, payload_json, diagnostics_json)
             VALUES
                (:prova_id, :question_id, :external_key, :item_type, :item_number, :status, :payload_json, :diagnostics_json)'
        );
        $stmt->execute([
            ':prova_id' => $provaId,
            ':question_id' => $questionId,
            ':external_key' => trim((string) ($question['tempId'] ?? '')) ?: null,
            ':item_type' => 'question',
            ':item_number' => $this->positiveIntOrNull($source['questionNumber'] ?? null),
            ':status' => $status,
            ':payload_json' => $this->encodeJson($question),
            ':diagnostics_json' => $this->encodeJson(is_array($question['review'] ?? null) ? $question['review'] : []),
        ]);
    }

    /**
     * Loads normalized children for API output. Null means the record predates
     * the canonical migration and callers should use the legacy snapshot.
     */
    public function loadQuestionAggregate(int $questionId): ?array
    {
        $this->assertSchemaReady();
        $optionsStmt = $this->db->prepare(
            'SELECT id, external_key, display_order, label, body, body_clean, is_correct, metadata_json
             FROM question_options WHERE question_id = :question_id ORDER BY display_order, id'
        );
        $optionsStmt->execute([':question_id' => $questionId]);
        $optionRows = $optionsStmt->fetchAll(PDO::FETCH_ASSOC) ?: [];
        if ($optionRows === []) {
            return null;
        }
        $optionIds = array_map(static fn (array $row): int => (int) $row['id'], $optionRows);
        $optionAssets = $this->loadAssets('option_id', $optionIds);
        $alternatives = [];
        $correct = [];
        foreach ($optionRows as $row) {
            $externalKey = trim((string) ($row['external_key'] ?? ''));
            $alternatives[] = [
                'tempId' => $externalKey !== '' ? $externalKey : 'option_' . (int) $row['id'],
                'order' => (int) $row['display_order'],
                'label' => (string) $row['label'],
                'text' => (string) $row['body'],
                'textClean' => (string) ($row['body_clean'] ?? ''),
                'assets' => $optionAssets[(int) $row['id']] ?? [],
            ];
            if ((int) $row['is_correct'] === 1) {
                $correct[] = $externalKey !== '' ? $externalKey : 'option_' . (int) $row['id'];
            }
        }
        $editorialsStmt = $this->db->prepare(
            'SELECT editorial_type, title, body, status, generated_by, metadata_json
             FROM question_editorials WHERE question_id = :question_id ORDER BY id'
        );
        $editorialsStmt->execute([':question_id' => $questionId]);
        $editorial = [];
        foreach ($editorialsStmt->fetchAll(PDO::FETCH_ASSOC) ?: [] as $row) {
            $editorial[] = [
                'type' => (string) $row['editorial_type'],
                'title' => (string) ($row['title'] ?? ''),
                'body' => (string) $row['body'],
                'status' => (string) $row['status'],
                'generatedBy' => (string) ($row['generated_by'] ?? ''),
                'metadata' => $this->decodeJson($row['metadata_json'] ?? null),
            ];
        }
        $contextsStmt = $this->db->prepare(
            'SELECT c.id, c.external_key, c.context_type, c.body, c.body_clean, c.reference_text, c.source_page
             FROM question_context_questions cq
             INNER JOIN question_contexts c ON c.id = cq.context_id
             WHERE cq.question_id = :question_id
             ORDER BY c.id'
        );
        $contextsStmt->execute([':question_id' => $questionId]);
        $contexts = $contextsStmt->fetchAll(PDO::FETCH_ASSOC) ?: [];
        $contextIds = array_map(static fn (array $row): int => (int) $row['id'], $contexts);
        $contextAssets = $this->loadAssets('context_id', $contextIds);

        return [
            'alternatives' => $alternatives,
            'answer' => [
                'mode' => count($correct) > 1 ? 'multiple' : 'single',
                'raw' => '',
                'correctAlternativeTempIds' => $correct,
            ],
            'assets' => ($this->loadAssets('question_id', [$questionId])[$questionId] ?? []),
            'editorial' => $editorial,
            'contexts' => array_map(static fn (array $row): array => [
                'id' => (int) $row['id'],
                'tempId' => (string) ($row['external_key'] ?? ''),
                'type' => (string) $row['context_type'],
                'body' => (string) $row['body'],
                'bodyClean' => (string) ($row['body_clean'] ?? ''),
                'reference' => (string) ($row['reference_text'] ?? ''),
                'sourcePage' => isset($row['source_page']) ? (int) $row['source_page'] : null,
                'assets' => $contextAssets[(int) $row['id']] ?? [],
            ], $contexts),
        ];
    }

    private function insertAssets(?int $questionId, ?int $contextId, ?int $optionId, mixed $assets): void
    {
        if (!is_array($assets)) {
            return;
        }
        $insert = $this->db->prepare(
            'INSERT INTO question_assets
                (question_id, context_id, option_id, external_key, asset_type, usage_type, storage_path, public_url, alt_text, caption, source_page, display_order, metadata_json)
             VALUES
                (:question_id, :context_id, :option_id, :external_key, :asset_type, :usage_type, :storage_path, :public_url, :alt_text, :caption, :source_page, :display_order, :metadata_json)'
        );
        foreach (array_values($assets) as $index => $asset) {
            if (!is_array($asset)) {
                continue;
            }
            $url = trim((string) ($asset['url'] ?? ''));
            if ($url === '') {
                continue;
            }
            $insert->execute([
                ':question_id' => $questionId,
                ':context_id' => $contextId,
                ':option_id' => $optionId,
                ':external_key' => trim((string) ($asset['tempId'] ?? $asset['id'] ?? '')) ?: null,
                ':asset_type' => trim((string) ($asset['type'] ?? 'image')) ?: 'image',
                ':usage_type' => trim((string) ($asset['usage'] ?? 'statement')) ?: 'statement',
                ':storage_path' => trim((string) ($asset['storagePath'] ?? $asset['storage_path'] ?? '')) ?: null,
                ':public_url' => $url,
                ':alt_text' => trim((string) ($asset['alt'] ?? '')) ?: null,
                ':caption' => trim((string) ($asset['caption'] ?? '')) ?: null,
                ':source_page' => $this->positiveIntOrNull($asset['sourcePage'] ?? $asset['source_page'] ?? null),
                ':display_order' => max(0, (int) ($asset['order'] ?? $index + 1)),
                ':metadata_json' => $this->encodeJson([
                    'manualCropApplied' => !empty($asset['manualCropApplied'] ?? false),
                ]),
            ]);
        }
    }

    private function loadAssets(string $foreignKey, array $ids): array
    {
        if ($ids === []) {
            return [];
        }
        if (!in_array($foreignKey, ['question_id', 'option_id', 'context_id'], true)) {
            throw new InvalidArgumentException('Chave de ativo invalida.');
        }
        $placeholders = implode(', ', array_fill(0, count($ids), '?'));
        $stmt = $this->db->prepare(
            'SELECT ' . $foreignKey . ' AS parent_id, external_key, asset_type, usage_type, storage_path, public_url, alt_text, caption, source_page, display_order, metadata_json
             FROM question_assets WHERE ' . $foreignKey . ' IN (' . $placeholders . ') ORDER BY display_order, id'
        );
        $stmt->execute(array_values($ids));
        $assets = [];
        foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) ?: [] as $row) {
            $parentId = (int) $row['parent_id'];
            $assets[$parentId][] = [
                'tempId' => (string) ($row['external_key'] ?? ''),
                'type' => (string) $row['asset_type'],
                'usage' => (string) $row['usage_type'],
                'url' => (string) ($row['public_url'] ?? ''),
                'storagePath' => (string) ($row['storage_path'] ?? ''),
                'alt' => (string) ($row['alt_text'] ?? ''),
                'caption' => (string) ($row['caption'] ?? ''),
                'sourcePage' => isset($row['source_page']) ? (int) $row['source_page'] : null,
                'order' => (int) $row['display_order'],
                ...$this->decodeJson($row['metadata_json'] ?? null),
            ];
        }
        return $assets;
    }

    private function positiveIntOrNull(mixed $value): ?int
    {
        return is_numeric($value) && (int) $value > 0 ? (int) $value : null;
    }

    private function encodeJson(array $value): string
    {
        return json_encode($value, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR);
    }

    private function decodeJson(mixed $value): array
    {
        if (!is_string($value) || trim($value) === '') {
            return [];
        }
        $decoded = json_decode($value, true);
        return is_array($decoded) ? $decoded : [];
    }
}

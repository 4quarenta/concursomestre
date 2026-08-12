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
            'question_contexts' => [
                'id', 'external_key', 'context_type', 'body', 'prova_id', 'source_provider', 'source_external_id',
            ],
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
        $this->db->prepare('DELETE FROM question_context_questions WHERE question_id = :question_id')->execute([
            ':question_id' => $questionId,
        ]);

        $optionIdsByKey = [];
        $currentOptionIds = [];
        $answer = is_array($question['answer'] ?? null) ? $question['answer'] : [];
        $correctKeys = array_values(array_filter(array_map(
            static fn (mixed $key): string => trim((string) $key),
            is_array($answer['correctAlternativeTempIds'] ?? null)
                ? $answer['correctAlternativeTempIds']
                : []
        ), static fn (string $key): bool => $key !== ''));
        $rawAnswer = strtoupper(trim((string) ($answer['raw'] ?? '')));

        $alternatives = [];
        $seenExternalKeys = [];
        $seenDisplayOrders = [];
        foreach (array_values(is_array($question['alternatives'] ?? null) ? $question['alternatives'] : []) as $index => $alternative) {
            if (!is_array($alternative)) {
                continue;
            }
            $externalKey = trim((string) ($alternative['tempId'] ?? $alternative['id'] ?? ''));
            if ($externalKey !== '') {
                if (isset($seenExternalKeys[$externalKey])) {
                    throw new InvalidArgumentException('As alternativas da questao possuem external_key duplicada.');
                }
                $seenExternalKeys[$externalKey] = true;
            }
            $displayOrder = max(1, (int) ($alternative['order'] ?? ($index + 1)));
            if (isset($seenDisplayOrders[$displayOrder])) {
                throw new InvalidArgumentException('As alternativas da questao possuem ordem duplicada.');
            }
            $seenDisplayOrders[$displayOrder] = true;
            $alternatives[] = [
                'payload' => $alternative,
                'external_key' => $externalKey,
                'display_order' => $displayOrder,
                'label' => trim((string) ($alternative['label'] ?? chr(65 + $index))) ?: chr(65 + $index),
                'index' => $index,
            ];
        }

        $existingStatement = $this->db->prepare(
            'SELECT id, external_key, display_order
             FROM question_options
             WHERE question_id = :question_id
             ORDER BY display_order, id'
        );
        $existingStatement->execute([':question_id' => $questionId]);
        $existingOptions = $existingStatement->fetchAll(PDO::FETCH_ASSOC) ?: [];
        $existingByKey = [];
        $existingByOrder = [];
        foreach ($existingOptions as $parkingIndex => $existing) {
            $existingId = (int) ($existing['id'] ?? 0);
            $existingKey = trim((string) ($existing['external_key'] ?? ''));
            if ($existingId < 1) {
                continue;
            }
            if ($existingKey !== '') {
                $existingByKey[$existingKey] = $existing;
            }
            $existingByOrder[(int) ($existing['display_order'] ?? 0)] = $existing;
        }

        $matchedExistingIds = [];
        foreach ($alternatives as $index => $normalized) {
            $externalKey = $normalized['external_key'];
            if ($externalKey === '' || !isset($existingByKey[$externalKey])) {
                continue;
            }
            $existingId = (int) $existingByKey[$externalKey]['id'];
            $alternatives[$index]['existing_id'] = $existingId;
            $matchedExistingIds[$existingId] = true;
        }
        foreach ($alternatives as $index => $normalized) {
            if (isset($normalized['existing_id'])) {
                continue;
            }
            $candidate = $existingByOrder[$normalized['display_order']] ?? null;
            $candidateId = is_array($candidate) ? (int) ($candidate['id'] ?? 0) : 0;
            if ($candidateId < 1 || isset($matchedExistingIds[$candidateId])) {
                continue;
            }
            $alternatives[$index]['existing_id'] = $candidateId;
            $matchedExistingIds[$candidateId] = true;
        }

        // Libera temporariamente a chave unica (question_id, display_order),
        // permitindo reordenar opcoes sem apagar seus IDs canonicos.
        $parkOption = $this->db->prepare(
            'UPDATE question_options SET display_order = :display_order WHERE id = :id AND question_id = :question_id'
        );
        foreach ($existingOptions as $parkingIndex => $existing) {
            $existingId = (int) ($existing['id'] ?? 0);
            if ($existingId > 0) {
                $parkOption->execute([
                    ':display_order' => -($parkingIndex + 1),
                    ':id' => $existingId,
                    ':question_id' => $questionId,
                ]);
            }
        }

        $insertOption = $this->db->prepare(
            'INSERT INTO question_options
                (question_id, external_key, display_order, label, body, body_clean, is_correct, metadata_json)
             VALUES
                (:question_id, :external_key, :display_order, :label, :body, :body_clean, :is_correct, :metadata_json)'
        );
        $updateOption = $this->db->prepare(
            'UPDATE question_options
             SET external_key = :external_key,
                 display_order = :display_order,
                 label = :label,
                 body = :body,
                 body_clean = :body_clean,
                 is_correct = :is_correct,
                 metadata_json = :metadata_json
             WHERE id = :id AND question_id = :question_id'
        );
        foreach ($alternatives as $normalized) {
            $alternative = $normalized['payload'];
            $index = (int) $normalized['index'];
            $externalKey = (string) $normalized['external_key'];
            $label = (string) $normalized['label'];
            $displayOrder = (int) $normalized['display_order'];
            $isCorrect = ($externalKey !== '' && in_array($externalKey, $correctKeys, true))
                || ($rawAnswer !== '' && $rawAnswer === strtoupper($label));
            $metadata = [
                'text_clean' => (string) ($alternative['textClean'] ?? ''),
            ];
            $bindings = [
                ':question_id' => $questionId,
                ':external_key' => $externalKey !== '' ? $externalKey : null,
                ':display_order' => $displayOrder,
                ':label' => $label !== '' ? $label : chr(65 + $index),
                ':body' => (string) ($alternative['text'] ?? ''),
                ':body_clean' => (string) ($alternative['textClean'] ?? strip_tags((string) ($alternative['text'] ?? ''))),
                ':is_correct' => $isCorrect ? 1 : 0,
                ':metadata_json' => $this->encodeJson($metadata),
            ];
            $optionId = (int) ($normalized['existing_id'] ?? 0);
            if ($optionId > 0) {
                $updateOption->execute($bindings + [':id' => $optionId]);
            } else {
                $insertOption->execute($bindings);
                $optionId = (int) $this->db->lastInsertId();
            }
            if ($externalKey !== '') {
                $optionIdsByKey[$externalKey] = $optionId;
            }
            $currentOptionIds[] = $optionId;
            $this->insertAssets($questionId, null, $optionId, $alternative['assets'] ?? []);
        }

        $currentOptionIds = array_values(array_unique(array_filter($currentOptionIds)));
        if ($currentOptionIds === []) {
            $deleteOptions = $this->db->prepare('DELETE FROM question_options WHERE question_id = :question_id');
            $deleteOptions->execute([':question_id' => $questionId]);
        } else {
            $placeholders = implode(',', array_fill(0, count($currentOptionIds), '?'));
            $deleteOptions = $this->db->prepare(
                "DELETE FROM question_options WHERE question_id = ? AND id NOT IN ({$placeholders})"
            );
            $deleteOptions->execute(array_merge([$questionId], $currentOptionIds));
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
        foreach ($this->normalizeEditorialEntries($question) as $editorial) {
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

    /**
     * Accept only the canonical list internally. The temporary
     * `editorialComments` reader exists so records saved before the contract
     * consolidation retain their authored content during the migration.
     *
     * @return array<int, array<string, mixed>>
     */
    private function normalizeEditorialEntries(array $question): array
    {
        $entries = is_array($question['editorial'] ?? null) ? $question['editorial'] : [];
        $byType = [];
        foreach ($entries as $editorial) {
            if (!is_array($editorial)) {
                continue;
            }
            $type = trim((string) ($editorial['type'] ?? ''));
            if (!in_array($type, ['teacher_comment', 'detailed_analysis'], true)) {
                continue;
            }
            $byType[$type] = $editorial;
        }

        $legacy = is_array($question['editorialComments'] ?? null) ? $question['editorialComments'] : [];
        foreach ([
            'teacher_comment' => $legacy['teacherComment'] ?? $question['teacherComment'] ?? null,
            'detailed_analysis' => $legacy['detailedComment'] ?? $question['detailedComment'] ?? null,
        ] as $type => $body) {
            if (trim((string) $body) === '') {
                continue;
            }
            $entry = is_array($byType[$type] ?? null) ? $byType[$type] : ['type' => $type];
            $entry['body'] = (string) $body;
            $byType[$type] = $entry;
        }

        return array_values($byType);
    }

    public function saveContext(array $context, string $actorUserId = ''): int
    {
        $this->assertSchemaReady();

        $externalKey = trim((string) ($context['tempId'] ?? $context['id'] ?? $context['contextKey'] ?? ''));
        if ($externalKey === '') {
            throw new InvalidArgumentException('Contexto sem identificador temporario.');
        }
        $source = is_array($context['source'] ?? null) ? $context['source'] : [];
        $sourceProvider = $this->normalizeSourceProvider(
            $source['provider'] ?? $context['sourceProvider'] ?? $context['source_provider'] ?? null
        );
        $sourceExternalId = $this->normalizeSourceExternalId(
            $source['externalId'] ?? $context['sourceExternalId'] ?? $context['source_external_id'] ?? null
        );
        $provaId = $this->positiveIntOrNull(
            $context['provaId'] ?? $context['prova_id'] ?? $source['examId'] ?? $source['exam_id'] ?? null
        );
        if ($provaId === null) {
            throw new InvalidArgumentException('Todo contexto de questoes precisa estar vinculado a uma prova.');
        }

        if ($sourceProvider !== '' && $sourceExternalId !== '') {
            $find = $this->db->prepare(
                'SELECT id, prova_id FROM question_contexts
                 WHERE source_provider = :source_provider AND source_external_id = :source_external_id
                 LIMIT 1'
            );
            $find->execute([
                ':source_provider' => $sourceProvider,
                ':source_external_id' => $sourceExternalId,
            ]);
        } else {
            $find = $this->db->prepare('SELECT id, prova_id FROM question_contexts WHERE external_key = :external_key LIMIT 1');
            $find->execute([':external_key' => $externalKey]);
        }
        $existing = $find->fetch(PDO::FETCH_ASSOC);
        $contextId = is_array($existing) ? (int) ($existing['id'] ?? 0) : 0;
        $existingProvaId = is_array($existing) ? $this->positiveIntOrNull($existing['prova_id'] ?? null) : null;
        if ($existingProvaId !== null && $existingProvaId !== $provaId) {
            throw new InvalidArgumentException('O contexto ja pertence a outra prova e nao pode ser reutilizado entre provas.');
        }
        if ($contextId > 0 && $sourceProvider !== '' && $sourceExternalId !== '') {
            // Reviewed Gran contexts are authoritative; a repeated collection
            // only points at the same canonical record.
            if ($existingProvaId === null) {
                $this->db->prepare('UPDATE question_contexts SET prova_id = :prova_id WHERE id = :id')
                    ->execute([':prova_id' => $provaId, ':id' => $contextId]);
            }
            return $contextId;
        }
        $params = [
            ':external_key' => $externalKey,
            ':source_provider' => $sourceProvider !== '' ? $sourceProvider : null,
            ':source_external_id' => $sourceExternalId !== '' ? $sourceExternalId : null,
            ':context_type' => trim((string) ($context['type'] ?? 'shared')) ?: 'shared',
            ':prova_id' => $provaId,
            ':body' => (string) ($context['body'] ?? $context['texto'] ?? $context['text'] ?? ''),
            ':body_clean' => (string) ($context['bodyClean'] ?? $context['textoClean'] ?? ''),
            ':reference_text' => (string) ($context['reference'] ?? ''),
            ':source_page' => $this->positiveIntOrNull($context['sourcePage'] ?? null),
            ':metadata_json' => $this->encodeJson([
                'question_numbers' => array_values($context['questionNumbers'] ?? $context['questionIds'] ?? []),
            ]),
            ':created_by_actor' => $actorUserId !== '' ? $actorUserId : null,
            ':updated_by_actor' => $actorUserId !== '' ? $actorUserId : null,
        ];
        if ($contextId <= 0) {
            $insert = $this->db->prepare(
                'INSERT INTO question_contexts
                    (external_key, source_provider, source_external_id, context_type, prova_id, body, body_clean, reference_text, source_page, metadata_json, created_by_user_id, updated_by_user_id)
                 VALUES
                    (:external_key, :source_provider, :source_external_id, :context_type, :prova_id, :body, :body_clean, :reference_text, :source_page, :metadata_json, :created_by_actor, :updated_by_actor)'
            );
            $insert->execute($params);
            $id = (int) $this->db->lastInsertId();
        } else {
            $id = $contextId;
            $update = $this->db->prepare(
                'UPDATE question_contexts
                 SET external_key = :external_key,
                     source_provider = :source_provider,
                     source_external_id = :source_external_id,
                     context_type = :context_type,
                     prova_id = :prova_id,
                     body = :body,
                     body_clean = :body_clean,
                     reference_text = :reference_text,
                     source_page = :source_page,
                     metadata_json = :metadata_json,
                     updated_by_user_id = :updated_by_actor
                 WHERE id = :id'
            );
            $params[':id'] = $id;
            $updateParams = $params;
            unset($updateParams[':created_by_actor']);
            $update->execute($updateParams);
            $this->db->prepare('DELETE FROM question_assets WHERE context_id = :context_id')->execute([':context_id' => $id]);
        }
        $this->insertAssets(null, $id, null, $context['assets'] ?? []);
        return $id;
    }

    private function normalizeSourceProvider(mixed $value): string
    {
        $value = strtolower(trim((string) $value));
        if ($value === '' || strlen($value) > 40 || preg_match('/^[a-z0-9][a-z0-9_-]*$/', $value) !== 1) {
            return '';
        }

        return $value;
    }

    private function normalizeSourceExternalId(mixed $value): string
    {
        $value = trim((string) $value);
        if ($value === '' || strlen($value) > 120 || preg_match('/[\x00-\x1F\x7F]/', $value) === 1) {
            return '';
        }

        return $value;
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
            ':payload_json' => $this->encodeJson([
                'tempId' => trim((string) ($question['tempId'] ?? '')) ?: null,
                'questionNumber' => $this->positiveIntOrNull($source['questionNumber'] ?? null),
            ]),
            ':diagnostics_json' => $this->encodeJson([
                'needsReview' => !empty($question['review']['needsReview']) || !empty($question['review']['required']),
                'reasonCount' => is_array($question['review']['statusReasons'] ?? $question['review']['reasons'] ?? null)
                    ? count($question['review']['statusReasons'] ?? $question['review']['reasons'])
                    : 0,
            ]),
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
                'canonicalId' => (int) $row['id'],
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
            'SELECT c.id, c.prova_id, c.external_key, c.context_type, c.body, c.body_clean, c.reference_text, c.source_page
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
                'provaId' => isset($row['prova_id']) ? (int) $row['prova_id'] : null,
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

    /**
     * Carrega alternativas, assets e contextos de varias questoes com consultas
     * em lote. O gabarito permanece interno ao agregado e e removido pela
     * politica de saida do DTO publico.
     *
     * @return array<int, array<string, mixed>>
     * @since 1.0.0
     */
    public function loadQuestionAggregates(array $questionIds): array
    {
        $this->assertSchemaReady();
        $ids = array_values(array_unique(array_filter(array_map(
            static fn (mixed $id): int => (int) $id,
            $questionIds
        ), static fn (int $id): bool => $id > 0)));
        if ($ids === []) {
            return [];
        }

        $placeholders = implode(',', array_fill(0, count($ids), '?'));
        $optionsStmt = $this->db->prepare(
            "SELECT id, question_id, external_key, display_order, label, body, body_clean, is_correct, metadata_json
             FROM question_options
             WHERE question_id IN ({$placeholders})
             ORDER BY question_id, display_order, id"
        );
        $optionsStmt->execute($ids);
        $optionRows = $optionsStmt->fetchAll(PDO::FETCH_ASSOC) ?: [];
        $optionIds = array_map(static fn (array $row): int => (int) $row['id'], $optionRows);
        $optionAssets = $this->loadAssets('option_id', $optionIds);

        $contextsStmt = $this->db->prepare(
            "SELECT cq.question_id, c.id, c.prova_id, c.external_key, c.context_type, c.body, c.body_clean, c.reference_text, c.source_page
             FROM question_context_questions cq
             INNER JOIN question_contexts c ON c.id = cq.context_id
             WHERE cq.question_id IN ({$placeholders})
             ORDER BY cq.question_id, c.id"
        );
        $contextsStmt->execute($ids);
        $contextRows = $contextsStmt->fetchAll(PDO::FETCH_ASSOC) ?: [];
        $contextIds = array_values(array_unique(array_map(
            static fn (array $row): int => (int) $row['id'],
            $contextRows
        )));
        $contextAssets = $this->loadAssets('context_id', $contextIds);
        $questionAssets = $this->loadAssets('question_id', $ids);

        $aggregates = [];
        foreach ($ids as $questionId) {
            $aggregates[$questionId] = [
                'alternatives' => [],
                'answer' => [
                    'mode' => 'single',
                    'raw' => '',
                    'correctAlternativeTempIds' => [],
                ],
                'assets' => $questionAssets[$questionId] ?? [],
                'editorial' => [],
                'contexts' => [],
            ];
        }

        foreach ($optionRows as $row) {
            $questionId = (int) $row['question_id'];
            $externalKey = trim((string) ($row['external_key'] ?? ''));
            $optionKey = $externalKey !== '' ? $externalKey : 'option_' . (int) $row['id'];
            $aggregates[$questionId]['alternatives'][] = [
                'canonicalId' => (int) $row['id'],
                'tempId' => $optionKey,
                'order' => (int) $row['display_order'],
                'label' => (string) $row['label'],
                'text' => (string) $row['body'],
                'textClean' => (string) ($row['body_clean'] ?? ''),
                'assets' => $optionAssets[(int) $row['id']] ?? [],
            ];
            if ((int) $row['is_correct'] === 1) {
                $aggregates[$questionId]['answer']['correctAlternativeTempIds'][] = $optionKey;
            }
        }

        foreach ($aggregates as &$aggregate) {
            if (count($aggregate['answer']['correctAlternativeTempIds']) > 1) {
                $aggregate['answer']['mode'] = 'multiple';
            }
        }
        unset($aggregate);

        foreach ($contextRows as $row) {
            $questionId = (int) $row['question_id'];
            $contextId = (int) $row['id'];
            $aggregates[$questionId]['contexts'][] = [
                'id' => $contextId,
                'provaId' => isset($row['prova_id']) ? (int) $row['prova_id'] : null,
                'tempId' => (string) ($row['external_key'] ?? ''),
                'type' => (string) $row['context_type'],
                'body' => (string) $row['body'],
                'bodyClean' => (string) ($row['body_clean'] ?? ''),
                'reference' => (string) ($row['reference_text'] ?? ''),
                'sourcePage' => isset($row['source_page']) ? (int) $row['source_page'] : null,
                'assets' => $contextAssets[$contextId] ?? [],
            ];
        }

        return array_filter($aggregates, static fn (array $aggregate): bool => $aggregate['alternatives'] !== []);
    }

    /**
     * Retorna somente a presenca dos editoriais usados pela listagem
     * administrativa. O corpo continua restrito ao endpoint de detalhe.
     *
     * @return array<string, array{hasTeacherComment: bool, hasDetailedAnalysis: bool}>
     * @since 1.0.0
     */
    public function listQuestionEditorialFlags(array $questionIds): array
    {
        $ids = array_values(array_unique(array_filter(array_map(
            static fn (mixed $id): int => (int) $id,
            $questionIds
        ), static fn (int $id): bool => $id > 0)));
        if ($ids === []) {
            return [];
        }

        $placeholders = implode(',', array_fill(0, count($ids), '?'));
        $stmt = $this->db->prepare(
            "SELECT question_id,
                    MAX(CASE WHEN editorial_type = 'teacher_comment' AND TRIM(body) <> '' THEN 1 ELSE 0 END) AS has_teacher_comment,
                    MAX(CASE WHEN editorial_type = 'detailed_analysis' AND TRIM(body) <> '' THEN 1 ELSE 0 END) AS has_detailed_analysis
             FROM question_editorials
             WHERE question_id IN ({$placeholders})
             GROUP BY question_id"
        );
        $stmt->execute($ids);

        $flags = [];
        foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) ?: [] as $row) {
            $flags[(string) $row['question_id']] = [
                'hasTeacherComment' => (int) ($row['has_teacher_comment'] ?? 0) === 1,
                'hasDetailedAnalysis' => (int) ($row['has_detailed_analysis'] ?? 0) === 1,
            ];
        }

        return $flags;
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
                ':metadata_json' => $this->encodeJson(array_filter([
                    'manualCropApplied' => !empty($asset['manualCropApplied'] ?? false),
                    'mimeType' => trim((string) ($asset['mimeType'] ?? '')) ?: null,
                    'size' => is_numeric($asset['size'] ?? null) ? max(0, (int) $asset['size']) : null,
                    'storageDriver' => trim((string) ($asset['storageDriver'] ?? '')) ?: null,
                    'sourceProvider' => trim((string) ($asset['sourceProvider'] ?? '')) ?: null,
                    'sourceUrlHash' => preg_match('/^[a-f0-9]{64}$/', (string) ($asset['sourceUrlHash'] ?? '')) === 1
                        ? (string) $asset['sourceUrlHash']
                        : null,
                    'status' => trim((string) ($asset['status'] ?? '')) ?: null,
                    'materializedAt' => trim((string) ($asset['materializedAt'] ?? '')) ?: null,
                ], static fn (mixed $value): bool => $value !== null)),
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

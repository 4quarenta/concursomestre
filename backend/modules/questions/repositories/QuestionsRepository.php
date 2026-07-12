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

require_once __DIR__ . '/../../../shared/database/SchemaReadiness.php';

/**
 * Repository oficial do dominio de questes.
 * Centraliza SQL de leitura, progressao, salvos, histrico e estatisticas.
  * @since 1.0.0
 */
class QuestionsRepository
{
    private bool $publicationColumnsEnsured = false;
    private bool $gamificationSchemaEnsured = false;

    public function __construct(private readonly PDO $db)
    {
    }

    /**
     * Persiste uma resposta individual do usurio.
      * @since 1.0.0
     */
    public function insertUserAnswer(array $answer): void
    {
        $stmt = $this->db->prepare(
            "INSERT INTO user_answers (
                user_id,
                question_id,
                simulation_id,
                selected_option_index,
                is_correct,
                time_taken_seconds
            ) VALUES (
                :user_id,
                :question_id,
                :simulation_id,
                :selected_option_index,
                :is_correct,
                :time_taken_seconds
            )"
        );

        $stmt->bindValue(':user_id', $answer['user_id']);
        $stmt->bindValue(':question_id', $answer['question_id']);
        $stmt->bindValue(':simulation_id', $answer['simulation_id']);
        $stmt->bindValue(':selected_option_index', $answer['selected_option_index']);
        $stmt->bindValue(':is_correct', $answer['is_correct'], PDO::PARAM_INT);
        $stmt->bindValue(':time_taken_seconds', $answer['time_taken_seconds']);
        $stmt->execute();
    }

    /**
     * Garante a existencia da linha agregada de estatisticas da questo.
      * @since 1.0.0
     */
    public function ensureQuestionStatsRow(string|int $questionId): void
    {
        $checkStmt = $this->db->prepare(
            "SELECT question_id
             FROM question_stats
             WHERE question_id = :question_id
             LIMIT 1"
        );
        $checkStmt->bindValue(':question_id', $questionId);
        $checkStmt->execute();

        if ($checkStmt->fetch(PDO::FETCH_ASSOC)) {
            return;
        }

        $insertStmt = $this->db->prepare(
            "INSERT INTO question_stats (question_id, total_attempts, correct_count, wrong_count)
             VALUES (:question_id, 0, 0, 0)"
        );
        $insertStmt->bindValue(':question_id', $questionId);
        $insertStmt->execute();
    }

    /**
     * Incrementa os agregados da questo conforme a resposta informada.
      * @since 1.0.0
     */
    public function incrementQuestionStats(string|int $questionId, bool $isCorrect): void
    {
        $stmt = $this->db->prepare(
            "UPDATE question_stats
             SET total_attempts = total_attempts + 1,
                 correct_count = correct_count + :correct_increment,
                 wrong_count = wrong_count + :wrong_increment
             WHERE question_id = :question_id"
        );
        $stmt->bindValue(':correct_increment', $isCorrect ? 1 : 0, PDO::PARAM_INT);
        $stmt->bindValue(':wrong_increment', $isCorrect ? 0 : 1, PDO::PARAM_INT);
        $stmt->bindValue(':question_id', $questionId);
        $stmt->execute();
    }

    /**
     * Busca o snapshot de XP e nivel antes/depois da atualizacao.
      * @since 1.0.0
     */
    public function findUserProgressSnapshot(string $userId): ?array
    {
        $stmt = $this->db->prepare(
            "SELECT id, xp, level, plan, subscription_end, name
             FROM users
             WHERE id = :user_id
             LIMIT 1"
        );
        $stmt->bindValue(':user_id', $userId);
        $stmt->execute();

        $snapshot = $stmt->fetch(PDO::FETCH_ASSOC);
        return is_array($snapshot) ? $snapshot : null;
    }

    /**
     * Aplica o ganho de XP da resposta atualizando tambm o nivel derivado.
      * @since 1.0.0
     */
    public function incrementUserXp(string $userId, int $xpGain, int $xpPerLevel = 1000): void
    {
        $stmt = $this->db->prepare(
            "UPDATE users
             SET xp = xp + :xp_gain,
                 level = FLOOR((xp + :xp_gain) / :xp_per_level) + 1
             WHERE id = :user_id"
        );
        $stmt->bindValue(':xp_gain', $xpGain, PDO::PARAM_INT);
        $stmt->bindValue(':xp_per_level', $xpPerLevel, PDO::PARAM_INT);
        $stmt->bindValue(':user_id', $userId);
        $stmt->execute();
    }

    /**
     * Busca o histrico de respostas de uma questo para o usurio.
      * @since 1.0.0
     */
    public function listQuestionHistory(string $userId, string|int $questionId): array
    {
        $stmt = $this->db->prepare(
            "SELECT selected_option_index, is_correct, created_at
             FROM user_answers
             WHERE user_id = :user_id
               AND question_id = :question_id
             ORDER BY created_at DESC"
        );
        $stmt->bindValue(':user_id', $userId);
        $stmt->bindValue(':question_id', $questionId);
        $stmt->execute();

        return $stmt->fetchAll(PDO::FETCH_ASSOC) ?: [];
    }

    /**
     * Remove todas as respostas ativas do usurio.
      * @since 1.0.0
     */
    public function resetUserAnswers(string $userId): int
    {
        $stmt = $this->db->prepare("DELETE FROM user_answers WHERE user_id = :user_id");
        $stmt->bindValue(':user_id', $userId);
        $stmt->execute();

        return $stmt->rowCount();
    }

    /**
     * Informa se a questo j esta salva para o usurio.
      * @since 1.0.0
     */
    public function hasSavedQuestion(string $userId, string|int $questionId): bool
    {
        $stmt = $this->db->prepare(
            "SELECT 1
             FROM user_saved_questions
             WHERE user_id = :user_id
               AND question_id = :question_id
             LIMIT 1"
        );
        $stmt->bindValue(':user_id', $userId);
        $stmt->bindValue(':question_id', $questionId);
        $stmt->execute();

        return (bool) $stmt->fetchColumn();
    }

    /**
     * Salva a questo para o usurio.
      * @since 1.0.0
     */
    public function addSavedQuestion(string $userId, string|int $questionId): void
    {
        $stmt = $this->db->prepare(
            "INSERT INTO user_saved_questions (user_id, question_id)
             VALUES (:user_id, :question_id)"
        );
        $stmt->bindValue(':user_id', $userId);
        $stmt->bindValue(':question_id', $questionId);
        $stmt->execute();
    }

    /**
     * Remove a questo dos salvos do usurio.
      * @since 1.0.0
     */
    public function removeSavedQuestion(string $userId, string|int $questionId): void
    {
        $stmt = $this->db->prepare(
            "DELETE FROM user_saved_questions
             WHERE user_id = :user_id
               AND question_id = :question_id"
        );
        $stmt->bindValue(':user_id', $userId);
        $stmt->bindValue(':question_id', $questionId);
        $stmt->execute();
    }

    /**
     * Atualiza o bonus de plano e a notificao de recompensa por level up.
      * @since 1.0.0
     */
    public function updateUserRewardPlan(string $userId, string $plan, string $subscriptionEnd): void
    {
        $stmt = $this->db->prepare(
            "UPDATE users
             SET plan = :plan,
                 subscription_end = :subscription_end
             WHERE id = :user_id"
        );
        $stmt->bindValue(':plan', $plan);
        $stmt->bindValue(':subscription_end', $subscriptionEnd);
        $stmt->bindValue(':user_id', $userId);
        $stmt->execute();
    }

    /**
     * Registra uma notificao sistemica para o usurio recompensado.
      * @since 1.0.0
     */
    public function insertNotification(array $notification): void
    {
        require_once __DIR__ . '/../../../config/notification_helper.php';
        if (!isNotificationDeliveryEnabled(
            $this->db,
            (string) ($notification['title'] ?? ''),
            (string) ($notification['category'] ?? 'system')
        )) {
            return;
        }

        ensureNotificationTableSupportsCurrentContract($this->db);

        $stmt = $this->db->prepare(
            "INSERT INTO notifications (id, user_id, title, message, category, type, link)
             VALUES (:id, :user_id, :title, :message, :category, :type, :link)"
        );
        $stmt->bindValue(':id', $notification['id']);
        $stmt->bindValue(':user_id', $notification['user_id']);
        $stmt->bindValue(':title', $notification['title']);
        $stmt->bindValue(':message', $notification['message']);
        $stmt->bindValue(':category', $notification['category']);
        $stmt->bindValue(':type', $notification['type']);
        $stmt->bindValue(':link', $notification['link']);
        $stmt->execute();
    }

    /**
     * Recalculates the public aggregate from every persisted attempt. The
     * method name is retained for route compatibility with older callers.
     */
    public function refreshQuestionStatsFromLatestAnswers(string|int $questionId): void
    {
        $this->ensureQuestionStatsRow($questionId);

        $stmt = $this->db->prepare(
            "SELECT
                SUM(CASE WHEN is_correct = 1 THEN 1 ELSE 0 END) AS correct_count,
                SUM(CASE WHEN is_correct = 1 THEN 0 ELSE 1 END) AS wrong_count,
                COUNT(*) AS total_attempts
             FROM user_answers
             WHERE question_id = :question_id"
        );
        $stmt->bindValue(':question_id', $questionId);
        $stmt->execute();

        $row = $stmt->fetch(PDO::FETCH_ASSOC) ?: [];
        $correct = (int) ($row['correct_count'] ?? 0);
        $wrong = (int) ($row['wrong_count'] ?? 0);
        $total = (int) ($row['total_attempts'] ?? 0);

        $updateStmt = $this->db->prepare(
            "UPDATE question_stats
             SET total_attempts = :total_attempts,
                 correct_count = :correct_count,
                 wrong_count = :wrong_count
             WHERE question_id = :question_id"
        );
        $updateStmt->bindValue(':total_attempts', $total, PDO::PARAM_INT);
        $updateStmt->bindValue(':correct_count', $correct, PDO::PARAM_INT);
        $updateStmt->bindValue(':wrong_count', $wrong, PDO::PARAM_INT);
        $updateStmt->bindValue(':question_id', $questionId);
        $updateStmt->execute();
    }

    /**
     * Atualiza a sequencia diaria de respostas do usuario.
     *
     * @since 1.0.0
     */
    public function touchDailyAnswerStreak(string $userId): array
    {
        $this->ensureGamificationSchema();

        $today = date('Y-m-d');
        $yesterday = date('Y-m-d', strtotime('-1 day'));

        $stmt = $this->db->prepare(
            "SELECT user_id, current_streak, longest_streak, last_activity_date
             FROM user_streaks
             WHERE user_id = :user_id
             LIMIT 1
             FOR UPDATE"
        );
        $stmt->execute([':user_id' => $userId]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);

        if (!is_array($row)) {
            $insertStmt = $this->db->prepare(
                "INSERT INTO user_streaks (user_id, current_streak, longest_streak, last_activity_date, updated_at)
                 VALUES (:user_id, 1, 1, :today, NOW())"
            );
            $insertStmt->execute([
                ':user_id' => $userId,
                ':today' => $today,
            ]);

            return [
                'current_streak' => 1,
                'longest_streak' => 1,
                'last_activity_date' => $today,
                'advanced_today' => true,
            ];
        }

        $lastActivityDate = (string) ($row['last_activity_date'] ?? '');
        $currentStreak = (int) ($row['current_streak'] ?? 0);
        $longestStreak = (int) ($row['longest_streak'] ?? 0);

        if ($lastActivityDate === $today) {
            return [
                'current_streak' => $currentStreak,
                'longest_streak' => $longestStreak,
                'last_activity_date' => $today,
                'advanced_today' => false,
            ];
        }

        $currentStreak = $lastActivityDate === $yesterday ? $currentStreak + 1 : 1;
        $longestStreak = max($longestStreak, $currentStreak);

        $updateStmt = $this->db->prepare(
            "UPDATE user_streaks
             SET current_streak = :current_streak,
                 longest_streak = :longest_streak,
                 last_activity_date = :today,
                 updated_at = NOW()
             WHERE user_id = :user_id"
        );
        $updateStmt->execute([
            ':current_streak' => $currentStreak,
            ':longest_streak' => $longestStreak,
            ':today' => $today,
            ':user_id' => $userId,
        ]);

        return [
            'current_streak' => $currentStreak,
            'longest_streak' => $longestStreak,
            'last_activity_date' => $today,
            'advanced_today' => true,
        ];
    }

    /**
     * Retorna totais usados por badges de progresso.
     *
     * @since 1.0.0
     */
    public function getUserAnswerTotals(string $userId): array
    {
        $stmt = $this->db->prepare(
            "SELECT COUNT(*) AS total_answers,
                    SUM(CASE WHEN is_correct = 1 THEN 1 ELSE 0 END) AS correct_answers
             FROM user_answers
             WHERE user_id = :user_id"
        );
        $stmt->execute([':user_id' => $userId]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC) ?: [];

        return [
            'total_answers' => (int) ($row['total_answers'] ?? 0),
            'correct_answers' => (int) ($row['correct_answers'] ?? 0),
        ];
    }

    /**
     * Concede um badge de forma idempotente.
     *
     * @since 1.0.0
     */
    public function grantUserBadge(string $userId, string $badgeKey, string $title, string $description): bool
    {
        $this->ensureGamificationSchema();

        $stmt = $this->db->prepare(
            "INSERT IGNORE INTO user_badges (user_id, badge_key, title, description, awarded_at)
             VALUES (:user_id, :badge_key, :title, :description, NOW())"
        );
        $stmt->execute([
            ':user_id' => $userId,
            ':badge_key' => $badgeKey,
            ':title' => $title,
            ':description' => $description,
        ]);

        return $stmt->rowCount() > 0;
    }

    /**
     * Registra um evento de gamificacao no ledger transversal.
     *
     * @since 1.0.0
     */
    public function grantGamificationEvent(
        string $userId,
        string $eventName,
        string $eventKey,
        int $xpDelta = 0,
        int $reputationDelta = 0,
        ?array $badge = null,
        ?array $metadata = null
    ): array {
        require_once __DIR__ . '/../../../config/gamification_helper.php';

        return grantGamificationEvent(
            $this->db,
            $userId,
            $eventName,
            $eventKey,
            $xpDelta,
            $reputationDelta,
            $badge,
            $metadata
        );
    }

    private function ensureGamificationSchema(): void
    {
        if ($this->gamificationSchemaEnsured) {
            return;
        }

        SchemaReadiness::assertTablesAndColumns($this->db, 'gamificacao de questoes', [
            'user_streaks' => ['user_id', 'current_streak', 'longest_streak', 'last_activity_date'],
            'user_badges' => ['user_id', 'badge_key', 'title', 'awarded_at'],
        ]);

        $this->gamificationSchemaEnsured = true;
    }

    /**
     * Informa se a tabela principal de questes existe na base atual.
      * @since 1.0.0
     */
    public function hasQuestionsTable(): bool
    {
        $stmt = $this->db->query("SHOW TABLES LIKE 'questions'");
        $exists = $stmt !== false && $stmt->rowCount() > 0;
        if ($exists) {
            $this->ensurePublicationColumns();
        }

        return $exists;
    }

    /**
     * Conta o total bruto de questes para a listagem principal.
      * @since 1.0.0
     */
    public function countAllQuestions(array $filters = [], ?string $userId = null): int
    {
        $this->ensurePublicationColumns();

        [$whereClause, $params] = $this->buildPublicQuestionWhereClause($filters, $userId);
        $stmt = $this->db->prepare("SELECT COUNT(*) FROM questions q WHERE {$whereClause}");
        foreach ($params as $key => $value) {
            $stmt->bindValue($key, $value, is_int($value) ? PDO::PARAM_INT : PDO::PARAM_STR);
        }
        $stmt->execute();

        return (int) $stmt->fetchColumn();
    }

    /**
     * Lista uma pagina de questes com o grupo relacionado, quando existir.
      * @since 1.0.0
     */
    public function listQuestionPageRows(int $limit, int $offset, array $filters = [], ?string $userId = null): array
    {
        $this->ensurePublicationColumns();
        $this->ensureQuestionGroupInfrastructure();
        [$whereClause, $params] = $this->buildPublicQuestionWhereClause($filters, $userId);

        $stmt = $this->db->prepare(
            "SELECT q.*,
                    g.id AS group_id,
                    g.enunciado AS group_enunciado,
                    g.enunciado_clean AS group_enunciado_clean,
                    g.texto AS group_texto,
                    g.image_url AS group_image_url,
                    g.assets_json AS group_assets_json
             FROM questions q
             LEFT JOIN questions_groups g ON q.grupo_questao_id = g.id
             WHERE {$whereClause}
             ORDER BY COALESCE(q.published_at, q.created_at) DESC, q.id DESC
             LIMIT :limit OFFSET :offset"
        );
        foreach ($params as $key => $value) {
            $stmt->bindValue($key, $value, is_int($value) ? PDO::PARAM_INT : PDO::PARAM_STR);
        }
        $stmt->bindValue(':limit', $limit, PDO::PARAM_INT);
        $stmt->bindValue(':offset', $offset, PDO::PARAM_INT);
        $stmt->execute();

        return $stmt->fetchAll(PDO::FETCH_ASSOC) ?: [];
    }

    /**
     * Lista uma pagina publica leve pelo contrato v2. Nao carrega data_json,
     * alternativas, editoriais, contextos completos nem agregados canonicos.
     *
     * @since 1.0.0
     */
    public function listQuestionSummaryRows(int $limit, int $offset, array $filters = [], ?string $userId = null): array
    {
        $this->ensurePublicationColumns();
        [$whereClause, $params] = $this->buildPublicQuestionWhereClause($filters, $userId);

        $stmt = $this->db->prepare(
            "SELECT q.id,
                    q.enunciado_clean,
                    q.tipo,
                    q.dificuldade,
                    q.anulada,
                    q.desatualizada,
                    q.publish_status,
                    q.visibility_status,
                    q.published_at,
                    q.created_at,
                    q.prova_id,
                    q.grupo_questao_id,
                    qs.total_attempts,
                    qs.correct_count,
                    qs.wrong_count,
                    EXISTS (
                        SELECT 1
                        FROM question_assets qa
                        WHERE qa.question_id = q.id
                        LIMIT 1
                    ) AS has_canonical_asset
             FROM questions q
             LEFT JOIN question_stats qs ON qs.question_id = q.id
             WHERE {$whereClause}
             ORDER BY COALESCE(q.published_at, q.created_at) DESC, q.id DESC
             LIMIT :limit OFFSET :offset"
        );
        foreach ($params as $key => $value) {
            $stmt->bindValue($key, $value, is_int($value) ? PDO::PARAM_INT : PDO::PARAM_STR);
        }
        $stmt->bindValue(':limit', $limit, PDO::PARAM_INT);
        $stmt->bindValue(':offset', $offset, PDO::PARAM_INT);
        $stmt->execute();

        return $stmt->fetchAll(PDO::FETCH_ASSOC) ?: [];
    }

    /**
     * Carrega somente os campos base necessarios aos DTOs v2 de detalhe.
     *
     * @since 1.0.0
     */
    public function findQuestionContractRowById(string|int $questionId): ?array
    {
        $this->ensurePublicationColumns();

        $stmt = $this->db->prepare(
            "SELECT id,
                    enunciado,
                    enunciado_clean,
                    intro_text,
                    reference_text,
                    tipo,
                    dificuldade,
                    resposta_correta_item_index,
                    anulada,
                    desatualizada,
                    publish_status,
                    visibility_status,
                    scheduled_at,
                    published_at,
                    created_at,
                    prova_id,
                    grupo_questao_id,
                    import_fingerprint,
                    source_exam_key,
                    source_question_number,
                    source_page,
                    data_json
             FROM questions
             WHERE id = :question_id
             LIMIT 1"
        );
        $stmt->bindValue(':question_id', $questionId);
        $stmt->execute();

        $row = $stmt->fetch(PDO::FETCH_ASSOC);
        return is_array($row) ? $row : null;
    }

    /**
     * Monta o WHERE compartilhado entre pagina e total da pratica.
     * @since 1.0.0
     */
    private function buildPublicQuestionWhereClause(array $filters = [], ?string $userId = null): array
    {
        $clauses = [
            "(q.publish_status = 'published' OR (q.publish_status = 'scheduled' AND q.scheduled_at IS NOT NULL AND q.scheduled_at <= NOW()))",
        ];
        $params = [];

        $keyword = trim((string) ($filters['keyword'] ?? ''));
        if ($keyword !== '') {
            $clauses[] = '(q.enunciado_clean LIKE :keyword OR q.enunciado LIKE :keyword OR q.id LIKE :keyword)';
            $params[':keyword'] = '%' . $keyword . '%';
        }

        $this->appendInClause($clauses, $params, 'q.id', 'question_id', $filters['questionIds'] ?? [], true);

        $difficultyMap = [
            'muito facil' => 1,
            "muito f\u{00E1}cil" => 1,
            'facil' => 2,
            "f\u{00E1}cil" => 2,
            'medio' => 3,
            "m\u{00E9}dio" => 3,
            'dificil' => 4,
            "dif\u{00ED}cil" => 4,
            'muito dificil' => 5,
            "muito dif\u{00ED}cil" => 5,
        ];
        $difficultyValues = [];
        foreach ($filters['difficulty'] ?? [] as $difficulty) {
            $normalized = mb_strtolower(trim((string) $difficulty), 'UTF-8');
            if (isset($difficultyMap[$normalized])) {
                $difficultyValues[] = $difficultyMap[$normalized];
            }
        }
        $this->appendInClause($clauses, $params, 'q.dificuldade', 'difficulty', array_values(array_unique($difficultyValues)), true);

        $this->appendInClause($clauses, $params, 'q.level', 'level', $filters['level'] ?? []);

        $modalities = [];
        foreach ($filters['modality'] ?? [] as $modality) {
            $normalized = mb_strtolower(trim((string) $modality), 'UTF-8');
            $modalities[] = str_contains($normalized, 'certo') ? 'certo ou errado' : 'multipla escolha';
        }
        $this->appendInClause($clauses, $params, 'q.tipo', 'modality', array_values(array_unique($modalities)));

        if (!empty($filters['hasTeacherComment'])) {
            $clauses[] = "(JSON_UNQUOTE(JSON_EXTRACT(q.data_json, '$.teacherComment')) IS NOT NULL AND JSON_UNQUOTE(JSON_EXTRACT(q.data_json, '$.teacherComment')) <> '')";
        }
        if (!empty($filters['hasDetailedComment'])) {
            $clauses[] = "(JSON_UNQUOTE(JSON_EXTRACT(q.data_json, '$.detailedComment')) IS NOT NULL AND JSON_UNQUOTE(JSON_EXTRACT(q.data_json, '$.detailedComment')) <> '')";
        }
        if (!empty($filters['excludeCanceled'])) {
            $clauses[] = '(q.anulada IS NULL OR q.anulada = 0)';
        }
        if (!empty($filters['excludeOutdated'])) {
            $clauses[] = '(q.desatualizada IS NULL OR q.desatualizada = 0)';
        }
        if (!empty($filters['onlySaved']) && $userId !== null && $userId !== '') {
            $clauses[] = 'EXISTS (SELECT 1 FROM user_saved_questions usq WHERE usq.question_id = q.id AND usq.user_id = :saved_user_id)';
            $params[':saved_user_id'] = $userId;
        }
        if (!empty($filters['excludeAnswered']) && $userId !== null && $userId !== '') {
            $clauses[] = 'NOT EXISTS (SELECT 1 FROM user_answers ua WHERE ua.question_id = q.id AND ua.user_id = :answered_user_id)';
            $params[':answered_user_id'] = $userId;
        }

        $this->appendFilterExistsClause($clauses, $params, 'banca', 'agency', $filters['agency'] ?? []);
        $this->appendFilterExistsClause($clauses, $params, 'orgao', 'organization', $filters['organization'] ?? []);
        $this->appendFilterExistsClause($clauses, $params, 'ano', 'year', $filters['year'] ?? []);
        $this->appendFilterExistsClause($clauses, $params, 'cargo', 'role', $filters['role'] ?? []);
        $this->appendFilterExistsClause($clauses, $params, 'carreira', 'career', $filters['career'] ?? []);
        $this->appendSubjectFilterClause($clauses, $params, $filters['subject'] ?? [], true);
        $this->appendSubjectFilterClause($clauses, $params, $filters['topic'] ?? [], false);

        return [implode(' AND ', $clauses), $params];
    }

    private function appendInClause(array &$clauses, array &$params, string $column, string $prefix, array $values, bool $asInt = false): void
    {
        $cleanValues = array_values(array_filter($values, static fn ($value) => trim((string) $value) !== ''));
        if ($cleanValues === []) {
            return;
        }

        $placeholders = [];
        foreach ($cleanValues as $index => $value) {
            $key = ':' . $prefix . '_' . $index;
            $placeholders[] = $key;
            $params[$key] = $asInt ? (int) $value : (string) $value;
        }
        $clauses[] = $column . ' IN (' . implode(', ', $placeholders) . ')';
    }

    private function appendFilterExistsClause(array &$clauses, array &$params, string $type, string $prefix, array $values): void
    {
        $cleanValues = array_values(array_filter($values, static fn ($value) => trim((string) $value) !== ''));
        if ($cleanValues === []) {
            return;
        }

        $placeholders = [];
        foreach ($cleanValues as $index => $value) {
            $key = ':' . $prefix . '_filter_' . $index;
            $placeholders[] = $key;
            $params[$key] = (string) $value;
        }
        $typeKey = ':' . $prefix . '_filter_type';
        $params[$typeKey] = $type;
        $clauses[] = "EXISTS (
            SELECT 1
            FROM question_filters qf
            INNER JOIN filters f ON f.id = qf.filter_id
            WHERE qf.question_id = q.id
              AND f.type = {$typeKey}
              AND f.name IN (" . implode(', ', $placeholders) . ")
        )";
    }

    private function appendSubjectFilterClause(array &$clauses, array &$params, array $values, bool $onlyRoot): void
    {
        $cleanValues = array_values(array_filter($values, static fn ($value) => trim((string) $value) !== ''));
        if ($cleanValues === []) {
            return;
        }

        $prefix = $onlyRoot ? 'subject' : 'topic';
        $placeholders = [];
        foreach ($cleanValues as $index => $value) {
            $key = ':' . $prefix . '_filter_' . $index;
            $placeholders[] = $key;
            $params[$key] = (string) $value;
        }
        $rootCondition = $onlyRoot
            ? 'AND (f.meta_materia = 1 OR f.parent_id IS NULL)'
            : 'AND NOT (f.meta_materia = 1 OR f.parent_id IS NULL)';
        $clauses[] = "EXISTS (
            SELECT 1
            FROM question_filters qf
            INNER JOIN filters f ON f.id = qf.filter_id
            WHERE qf.question_id = q.id
              AND f.type = 'assunto'
              {$rootCondition}
              AND f.name IN (" . implode(', ', $placeholders) . ")
        )";
    }

    /**
     * Lista grupos de apoio reutilizaveis para o editor administrativo.
      * @since 1.0.0
     */
    public function listQuestionGroups(string $keyword = '', int $limit = 100): array
    {
        $this->ensureQuestionGroupInfrastructure();

        $sql = "SELECT g.id,
                       g.enunciado,
                       g.enunciado_clean,
                       g.texto,
                       g.image_url,
                       g.assets_json,
                       COUNT(q.id) AS question_count,
                       GROUP_CONCAT(q.id ORDER BY q.id SEPARATOR ',') AS question_ids
                FROM questions_groups g
                LEFT JOIN questions q ON q.grupo_questao_id = g.id";

        if ($keyword !== '') {
            $sql .= " WHERE g.enunciado LIKE :keyword
                       OR g.enunciado_clean LIKE :keyword
                       OR g.texto LIKE :keyword
                       OR g.id = :id_keyword";
        }

        $sql .= " GROUP BY g.id, g.enunciado, g.enunciado_clean, g.texto, g.image_url, g.assets_json
                  ORDER BY g.id DESC
                  LIMIT :limit";

        $stmt = $this->db->prepare($sql);
        if ($keyword !== '') {
            $stmt->bindValue(':keyword', '%' . $keyword . '%');
            $stmt->bindValue(':id_keyword', ctype_digit($keyword) ? (int) $keyword : 0, PDO::PARAM_INT);
        }
        $stmt->bindValue(':limit', $limit, PDO::PARAM_INT);
        $stmt->execute();

        return $stmt->fetchAll(PDO::FETCH_ASSOC) ?: [];
    }

    /**
     * Busca um grupo de apoio pelo id.
      * @since 1.0.0
     */
    public function findQuestionGroupById(string|int $groupId): ?array
    {
        $this->ensureQuestionGroupInfrastructure();

        $stmt = $this->db->prepare(
            "SELECT g.id,
                    g.enunciado,
                    g.enunciado_clean,
                    g.texto,
                    g.image_url,
                    g.assets_json,
                    COUNT(q.id) AS question_count,
                       GROUP_CONCAT(q.id ORDER BY q.id SEPARATOR ',') AS question_ids
             FROM questions_groups g
             LEFT JOIN questions q ON q.grupo_questao_id = g.id
             WHERE g.id = :group_id
             GROUP BY g.id, g.enunciado, g.enunciado_clean, g.texto, g.image_url, g.assets_json
             LIMIT 1"
        );
        $stmt->bindValue(':group_id', $groupId, PDO::PARAM_INT);
        $stmt->execute();

        $row = $stmt->fetch(PDO::FETCH_ASSOC);
        return is_array($row) ? $row : null;
    }

    /**
     * Cria ou atualiza um grupo de apoio.
      * @since 1.0.0
     */
    public function saveQuestionGroup(array $payload): int
    {
        $this->ensureQuestionGroupInfrastructure();

        if (!empty($payload['id'])) {
            $stmt = $this->db->prepare(
                "UPDATE questions_groups
                 SET enunciado = :enunciado,
                     enunciado_clean = :enunciado_clean,
                     texto = :texto,
                     image_url = :image_url,
                     assets_json = :assets_json,
                     updated_by_user_id = :updated_by_user_id,
                     updated_at = NOW()
                 WHERE id = :group_id"
            );
            $stmt->bindValue(':group_id', (int) $payload['id'], PDO::PARAM_INT);
        } else {
            $stmt = $this->db->prepare(
                "INSERT INTO questions_groups (
                    enunciado,
                    enunciado_clean,
                    texto,
                    image_url,
                    assets_json,
                    created_by_user_id,
                    updated_by_user_id,
                    created_at,
                    updated_at
                 ) VALUES (
                    :enunciado,
                    :enunciado_clean,
                    :texto,
                    :image_url,
                    :assets_json,
                    :created_by_user_id,
                    :updated_by_user_id,
                    NOW(),
                    NOW()
                 )"
            );
        }

        $text = trim((string) ($payload['texto'] ?? ''));
        $assets = is_array($payload['assets'] ?? null) ? array_values($payload['assets']) : [];
        $firstAssetUrl = '';
        foreach ($assets as $asset) {
            if (is_array($asset) && trim((string) ($asset['url'] ?? '')) !== '') {
                $firstAssetUrl = trim((string) $asset['url']);
                break;
            }
        }
        $assetsJson = json_encode($assets, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);

        // Colunas antigas continuam sincronizadas somente para leitores legados.
        $stmt->bindValue(':enunciado', $text);
        $stmt->bindValue(':enunciado_clean', trim(strip_tags($text)));
        $stmt->bindValue(':texto', $text);
        $stmt->bindValue(
            ':image_url',
            $firstAssetUrl !== '' ? $firstAssetUrl : null,
            $firstAssetUrl !== '' ? PDO::PARAM_STR : PDO::PARAM_NULL
        );
        $stmt->bindValue(':assets_json', is_string($assetsJson) ? $assetsJson : '[]');
        if (empty($payload['id'])) {
            $stmt->bindValue(
                ':created_by_user_id',
                ($payload['created_by_user_id'] ?? '') !== '' ? $payload['created_by_user_id'] : null,
                ($payload['created_by_user_id'] ?? '') !== '' ? PDO::PARAM_STR : PDO::PARAM_NULL
            );
        }
        $stmt->bindValue(
            ':updated_by_user_id',
            ($payload['updated_by_user_id'] ?? '') !== '' ? $payload['updated_by_user_id'] : null,
            ($payload['updated_by_user_id'] ?? '') !== '' ? PDO::PARAM_STR : PDO::PARAM_NULL
        );
        $stmt->execute();

        return !empty($payload['id']) ? (int) $payload['id'] : (int) $this->db->lastInsertId();
    }

    /**
     * Remove um grupo e desvincula questoes associadas.
      * @since 1.0.0
     */
    public function deleteQuestionGroup(string|int $groupId): int
    {
        $this->ensureQuestionGroupInfrastructure();

        $unlinkStmt = $this->db->prepare(
            "UPDATE questions
             SET grupo_questao_id = NULL
             WHERE grupo_questao_id = :group_id"
        );
        $unlinkStmt->bindValue(':group_id', $groupId, PDO::PARAM_INT);
        $unlinkStmt->execute();

        $stmt = $this->db->prepare("DELETE FROM questions_groups WHERE id = :group_id");
        $stmt->bindValue(':group_id', $groupId, PDO::PARAM_INT);
        $stmt->execute();

        return $stmt->rowCount();
    }

    public function findQuestionGroupOwnershipById(string|int $groupId): ?array
    {
        $this->ensureQuestionGroupInfrastructure();

        $stmt = $this->db->prepare(
            "SELECT id, created_by_user_id, updated_by_user_id
             FROM questions_groups
             WHERE id = :group_id
             LIMIT 1"
        );
        $stmt->bindValue(':group_id', $groupId, PDO::PARAM_INT);
        $stmt->execute();

        $row = $stmt->fetch(PDO::FETCH_ASSOC);
        return is_array($row) ? $row : null;
    }

    /**
     * Sincroniza as questoes vinculadas a um contexto.
     * @since 1.0.0
     */
    public function syncQuestionGroupLinks(string|int $groupId, array $questionIds): void
    {
        $this->ensureQuestionGroupInfrastructure();

        $cleanIds = [];
        foreach ($questionIds as $questionId) {
            $normalizedId = (int) $questionId;
            if ($normalizedId > 0) {
                $cleanIds[$normalizedId] = $normalizedId;
            }
        }
        $cleanIds = array_values($cleanIds);

        $unlinkStmt = $this->db->prepare(
            "UPDATE questions
             SET grupo_questao_id = NULL
             WHERE grupo_questao_id = :group_id"
        );
        $unlinkStmt->bindValue(':group_id', $groupId, PDO::PARAM_INT);
        $unlinkStmt->execute();

        if ($cleanIds === []) {
            return;
        }

        $placeholders = [];
        $bindings = [];
        foreach ($cleanIds as $index => $questionId) {
            $key = ':question_id_' . $index;
            $placeholders[] = $key;
            $bindings[$key] = $questionId;
        }

        $stmt = $this->db->prepare(
            "UPDATE questions
             SET grupo_questao_id = :group_id
             WHERE id IN (" . implode(', ', $placeholders) . ")"
        );
        $stmt->bindValue(':group_id', $groupId, PDO::PARAM_INT);
        foreach ($bindings as $key => $questionId) {
            $stmt->bindValue($key, $questionId, PDO::PARAM_INT);
        }
        $stmt->execute();
    }
    /**
     * Carrega os agregados de estatistica para varias questes em uma unica consulta.
      * @since 1.0.0
     */
    public function listQuestionStatsMap(array $questionIds): array
    {
        if ($questionIds === []) {
            return [];
        }

        [$placeholders, $bindings] = $this->buildInClause('question_id', $questionIds);
        $stmt = $this->db->prepare(
            "SELECT question_id, total_attempts, correct_count, wrong_count
             FROM question_stats
             WHERE question_id IN ({$placeholders})"
        );

        foreach ($bindings as $placeholder => $value) {
            $stmt->bindValue($placeholder, $value);
        }

        $stmt->execute();
        $rows = $stmt->fetchAll(PDO::FETCH_ASSOC) ?: [];

        $mapped = [];
        foreach ($rows as $row) {
            $mapped[(string) $row['question_id']] = [
                'totalAttempts' => (int) ($row['total_attempts'] ?? 0),
                'correctCount' => (int) ($row['correct_count'] ?? 0),
                'wrongCount' => (int) ($row['wrong_count'] ?? 0),
            ];
        }

        return $mapped;
    }

    /**
     * Conta os comentrios raiz de cada questo listada.
      * @since 1.0.0
     */
    public function listQuestionCommentCounts(array $questionIds): array
    {
        if ($questionIds === []) {
            return [];
        }

        [$placeholders, $bindings] = $this->buildInClause('comment_question_id', $questionIds);
        $stmt = $this->db->prepare(
            "SELECT target_id, COUNT(*) AS count
             FROM comments
             WHERE parent_id IS NULL
               AND target_id IN ({$placeholders})
             GROUP BY target_id"
        );

        foreach ($bindings as $placeholder => $value) {
            $stmt->bindValue($placeholder, $value);
        }

        $stmt->execute();
        $rows = $stmt->fetchAll(PDO::FETCH_ASSOC) ?: [];

        $mapped = [];
        foreach ($rows as $row) {
            $mapped[(string) $row['target_id']] = (int) ($row['count'] ?? 0);
        }

        return $mapped;
    }

    /**
     * Carrega todos os filtros vinculados a um lote de questes.
      * @since 1.0.0
     */
    public function listQuestionFiltersByIds(array $questionIds): array
    {
        if ($questionIds === []) {
            return [];
        }

        [$placeholders, $bindings] = $this->buildInClause('filter_question_id', $questionIds);
        $stmt = $this->db->prepare(
            "SELECT qf.question_id,
                    f.id,
                    f.type,
                    f.name,
                    f.slug,
                    f.parent_id,
                    f.meta_materia
             FROM question_filters qf
             INNER JOIN filters f ON f.id = qf.filter_id
             WHERE qf.question_id IN ({$placeholders})
             ORDER BY f.type, f.name"
        );

        foreach ($bindings as $placeholder => $value) {
            $stmt->bindValue($placeholder, $value);
        }

        $stmt->execute();
        $rows = $stmt->fetchAll(PDO::FETCH_ASSOC) ?: [];

        $mapped = [];
        foreach ($rows as $row) {
            $questionId = (string) $row['question_id'];
            if (!isset($mapped[$questionId])) {
                $mapped[$questionId] = [];
            }
            $mapped[$questionId][] = $row;
        }

        return $mapped;
    }

    /**
     * Carrega as provas canônicas vinculadas a um lote de questões.
     *
     * @since 1.0.0
     */
    public function listQuestionProvasByIds(array $questionIds): array
    {
        if ($questionIds === []) {
            return [];
        }

        $this->ensureImportedExamInfrastructure();

        [$placeholders, $bindings] = $this->buildInClause('prova_question_id', $questionIds);
        $stmt = $this->db->prepare(
            "SELECT qp.question_id,
                    qp.numero_na_prova,
                    qp.caderno_id,
                    p.id,
                    p.nome,
                    p.slug,
                    p.ano,
                    p.banca_id,
                    p.orgao_id,
                    p.cargo_id,
                    pc.nome AS caderno_nome,
                    pc.tipo AS caderno_tipo,
                    pc.cor AS caderno_cor
             FROM question_provas qp
             INNER JOIN provas p ON p.id = qp.prova_id
             LEFT JOIN prova_cadernos pc ON pc.id = qp.caderno_id
             WHERE qp.question_id IN ({$placeholders})
             ORDER BY qp.question_id, p.ano DESC, p.nome"
        );

        foreach ($bindings as $placeholder => $value) {
            $stmt->bindValue($placeholder, $value);
        }

        $stmt->execute();
        $mapped = [];
        foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) ?: [] as $row) {
            $questionId = (string) $row['question_id'];
            if (!isset($mapped[$questionId])) {
                $mapped[$questionId] = [];
            }
            $mapped[$questionId][] = [
                'id' => (int) $row['id'],
                'nome' => (string) $row['nome'],
                'slug' => (string) $row['slug'],
                'ano' => $row['ano'] !== null ? (int) $row['ano'] : null,
                'bancaId' => $row['banca_id'] !== null ? (int) $row['banca_id'] : null,
                'orgaoId' => $row['orgao_id'] !== null ? (int) $row['orgao_id'] : null,
                'cargoId' => $row['cargo_id'] !== null ? (int) $row['cargo_id'] : null,
                'numeroNaProva' => $row['numero_na_prova'] !== null ? (int) $row['numero_na_prova'] : null,
                'numero_na_prova' => $row['numero_na_prova'] !== null ? (int) $row['numero_na_prova'] : null,
                'cadernoId' => $row['caderno_id'] !== null ? (int) $row['caderno_id'] : null,
                'caderno_id' => $row['caderno_id'] !== null ? (int) $row['caderno_id'] : null,
                'caderno' => $row['caderno_nome'],
                'tipoCaderno' => $row['caderno_tipo'],
                'corCaderno' => $row['caderno_cor'],
            ];
        }

        return $mapped;
    }

    /**
     * Busca a resposta mais recente do usurio para cada questo listada.
      * @since 1.0.0
     */
    public function listLatestUserAnswersMap(string $userId, array $questionIds): array
    {
        if ($questionIds === []) {
            return [];
        }

        [$placeholders, $bindings] = $this->buildInClause('answer_question_id', $questionIds);
        $stmt = $this->db->prepare(
            "SELECT question_id, is_correct, selected_option_index, created_at
             FROM user_answers
             WHERE user_id = :user_id
               AND question_id IN ({$placeholders})
             ORDER BY created_at DESC"
        );
        $stmt->bindValue(':user_id', $userId);

        foreach ($bindings as $placeholder => $value) {
            $stmt->bindValue($placeholder, $value);
        }

        $stmt->execute();
        $rows = $stmt->fetchAll(PDO::FETCH_ASSOC) ?: [];

        $mapped = [];
        foreach ($rows as $row) {
            $questionId = (string) $row['question_id'];
            if (isset($mapped[$questionId])) {
                continue;
            }

            $mapped[$questionId] = [
                'isCorrect' => (bool) ($row['is_correct'] ?? false),
                'selectedOptionIndex' => (int) ($row['selected_option_index'] ?? 0),
            ];
        }

        return $mapped;
    }

    /**
     * Lista questes do painel administrativo com stats agregadas e filtros serializados.
      * @since 1.0.0
     */
    public function listFilteredQuestionRows(int $limit, int $offset, string $keyword = ''): array
    {
        $this->ensurePublicationColumns();

        $sql = "SELECT q.*,
                       qs.total_attempts,
                       qs.correct_count,
                       qs.wrong_count,
                       (
                         SELECT GROUP_CONCAT(
                             CONCAT(f.type, '::', f.name, '::', f.slug, '::', IFNULL(f.meta_materia, 0))
                             SEPARATOR '|||'
                         )
                         FROM question_filters qf
                         INNER JOIN filters f ON f.id = qf.filter_id
                         WHERE qf.question_id = q.id
                       ) AS filters_string
                FROM questions q
                LEFT JOIN question_stats qs ON qs.question_id = q.id";

        if ($keyword !== '') {
            $sql .= " WHERE q.enunciado_clean LIKE :keyword OR q.id LIKE :keyword";
        }

        $sql .= " ORDER BY COALESCE(q.published_at, q.created_at) DESC, q.created_at DESC, q.id DESC LIMIT :limit OFFSET :offset";

        $stmt = $this->db->prepare($sql);
        if ($keyword !== '') {
            $stmt->bindValue(':keyword', '%' . $keyword . '%');
        }
        $stmt->bindValue(':limit', $limit, PDO::PARAM_INT);
        $stmt->bindValue(':offset', $offset, PDO::PARAM_INT);
        $stmt->execute();

        return $stmt->fetchAll(PDO::FETCH_ASSOC) ?: [];
    }

    /**
     * Conta o total de questes visiveis no filtro administrativo atual.
      * @since 1.0.0
     */
    public function countFilteredQuestions(string $keyword = ''): int
    {
        $sql = "SELECT COUNT(*) FROM questions q";
        if ($keyword !== '') {
            $sql .= " WHERE q.enunciado_clean LIKE :keyword OR q.id LIKE :keyword";
        }

        $stmt = $this->db->prepare($sql);
        if ($keyword !== '') {
            $stmt->bindValue(':keyword', '%' . $keyword . '%');
        }
        $stmt->execute();

        return (int) $stmt->fetchColumn();
    }

    /**
     * Agrega a distribuicao de respostas por alternativa da questo.
      * @since 1.0.0
     */
    public function getQuestionOptionDistribution(string|int $questionId): array
    {
        $stmt = $this->db->prepare(
            "SELECT selected_option_index, COUNT(*) AS count
             FROM user_answers
             WHERE question_id = :question_id
             GROUP BY selected_option_index"
        );
        $stmt->bindValue(':question_id', $questionId);
        $stmt->execute();

        $distribution = [];
        foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) ?: [] as $row) {
            $distribution[(string) $row['selected_option_index']] = (int) ($row['count'] ?? 0);
        }

        return $distribution;
    }

    /**
     * Agrega os totais de acerto e erro da questo.
      * @since 1.0.0
     */
    public function getQuestionOutcomeCounts(string|int $questionId): array
    {
        $stmt = $this->db->prepare(
            "SELECT is_correct, COUNT(*) AS count
             FROM user_answers
             WHERE question_id = :question_id
             GROUP BY is_correct"
        );
        $stmt->bindValue(':question_id', $questionId);
        $stmt->execute();

        $correct = 0;
        $wrong = 0;

        foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) ?: [] as $row) {
            if ((int) ($row['is_correct'] ?? 0) === 1) {
                $correct = (int) ($row['count'] ?? 0);
                continue;
            }

            $wrong += (int) ($row['count'] ?? 0);
        }

        return [
            'correctCount' => $correct,
            'wrongCount' => $wrong,
            'totalAttempts' => $correct + $wrong,
        ];
    }

    /**
     * Busca uma questo isolada para o fluxo de edicao.
      * @since 1.0.0
     */
    public function findQuestionById(string|int $questionId): ?array
    {
        $this->ensurePublicationColumns();

        $stmt = $this->db->prepare(
            "SELECT *
             FROM questions
             WHERE id = :question_id
             LIMIT 1"
        );
        $stmt->bindValue(':question_id', $questionId);
        $stmt->execute();

        $row = $stmt->fetch(PDO::FETCH_ASSOC);
        return is_array($row) ? $row : null;
    }

    /**
     * Busca somente os dados canônicos necessários para corrigir respostas de
     * simulado, sem serializar nem expor gabaritos ao navegador.
     *
     * @param array<int, int> $questionIds
     * @return array<string, array<string, mixed>>
     */
    public function findQuestionAnswerKeysByIds(array $questionIds): array
    {
        $ids = array_values(array_unique(array_filter($questionIds, static fn (mixed $id): bool => is_numeric($id) && (int) $id > 0)));
        if ($ids === []) {
            return [];
        }

        $placeholders = [];
        $params = [];
        foreach ($ids as $index => $id) {
            $placeholder = ':question_id_' . $index;
            $placeholders[] = $placeholder;
            $params[$placeholder] = (int) $id;
        }

        $stmt = $this->db->prepare(
            'SELECT id, resposta_correta_item_index, data_json
             FROM questions
             WHERE id IN (' . implode(', ', $placeholders) . ')'
        );
        $stmt->execute($params);

        $mapped = [];
        foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) ?: [] as $row) {
            $mapped[(string) ($row['id'] ?? '')] = $row;
        }

        return $mapped;
    }

    /**
     * Localiza uma questao ja importada pela identidade oficial da prova.
     *
     * @since 1.0.0
     */
    public function findQuestionByImportIdentity(?string $fingerprint, ?string $examKey, ?string $questionNumber): ?array
    {
        $this->ensurePublicationColumns();

        $clauses = [];
        $params = [];

        $fingerprint = trim((string) $fingerprint);
        if ($fingerprint !== '') {
            $clauses[] = 'import_fingerprint = :import_fingerprint';
            $params[':import_fingerprint'] = $fingerprint;
        }

        $examKey = trim((string) $examKey);
        $questionNumber = trim((string) $questionNumber);
        if ($examKey !== '' && $questionNumber !== '') {
            $clauses[] = '(source_exam_key = :source_exam_key AND source_question_number = :source_question_number)';
            $params[':source_exam_key'] = $examKey;
            $params[':source_question_number'] = $questionNumber;
        }

        if ($clauses === []) {
            return null;
        }

        $stmt = $this->db->prepare(
            'SELECT *
             FROM questions
             WHERE ' . implode(' OR ', $clauses) . '
             ORDER BY id DESC
             LIMIT 1'
        );
        foreach ($params as $key => $value) {
            $stmt->bindValue($key, $value);
        }
        $stmt->execute();

        $row = $stmt->fetch(PDO::FETCH_ASSOC);
        return is_array($row) ? $row : null;
    }

    /**
     * Insere uma questo nova e devolve o id gerado.
      * @since 1.0.0
     */
    public function insertQuestion(array $record): string
    {
        $this->ensurePublicationColumns();

        $stmt = $this->db->prepare(
            "INSERT INTO questions (
                enunciado,
                enunciado_clean,
                tipo,
                dificuldade,
                intro_text,
                reference_text,
                data_json,
                import_fingerprint,
                source_exam_key,
                source_question_number,
                resposta_correta_item_index,
                prova_id,
                grupo_questao_id,
                anulada,
                desatualizada,
                publish_status,
                visibility_status,
                scheduled_at,
                published_at,
                created_by_user_id,
                updated_by_user_id,
                published_by_user_id,
                created_at
            ) VALUES (
                :enunciado,
                :enunciado_clean,
                :tipo,
                :dificuldade,
                :intro_text,
                :reference_text,
                :data_json,
                :import_fingerprint,
                :source_exam_key,
                :source_question_number,
                :resposta_correta_item_index,
                :prova_id,
                :grupo_questao_id,
                :anulada,
                :desatualizada,
                :publish_status,
                :visibility_status,
                :scheduled_at,
                :published_at,
                :created_by_user_id,
                :updated_by_user_id,
                :published_by_user_id,
                NOW()
            )"
        );

        $this->bindQuestionRecord($stmt, $record);
        $stmt->execute();

        return (string) $this->db->lastInsertId();
    }

    /**
     * Atualiza uma questo existente.
      * @since 1.0.0
     */
    public function updateQuestion(string|int $questionId, array $record): void
    {
        $this->ensurePublicationColumns();

        $stmt = $this->db->prepare(
            "UPDATE questions
             SET enunciado = :enunciado,
                 enunciado_clean = :enunciado_clean,
                 tipo = :tipo,
                 dificuldade = :dificuldade,
                 intro_text = :intro_text,
                 reference_text = :reference_text,
                 data_json = :data_json,
                 import_fingerprint = :import_fingerprint,
                 source_exam_key = :source_exam_key,
                 source_question_number = :source_question_number,
                 resposta_correta_item_index = :resposta_correta_item_index,
                 prova_id = :prova_id,
                 grupo_questao_id = :grupo_questao_id,
                 anulada = :anulada,
                 desatualizada = :desatualizada,
                 publish_status = :publish_status,
                 visibility_status = :visibility_status,
                 scheduled_at = :scheduled_at,
                 published_at = :published_at,
                 updated_by_user_id = :updated_by_user_id,
                 published_by_user_id = COALESCE(:published_by_user_id, published_by_user_id),
                 updated_at = NOW()
             WHERE id = :question_id"
        );

        $this->bindQuestionRecord($stmt, $record);
        $stmt->bindValue(':question_id', $questionId);
        $stmt->execute();
    }

    /**
     * Mantem a tabela canonica question_provas sincronizada com o vinculo legado prova_id.
     * Nao remove outros vinculos da questao, pois a mesma questao pode pertencer a provas/cadernos diferentes.
     *
     * @since 1.0.0
     */
    public function syncPrimaryQuestionProva(string|int $questionId, mixed $provaId, mixed $numeroNaProva = null): void
    {
        $questionIdInt = (int) $questionId;
        $provaIdInt = is_numeric($provaId) ? (int) $provaId : 0;

        if ($questionIdInt <= 0 || $provaIdInt <= 0) {
            return;
        }

        $this->ensureImportedExamInfrastructure();

        $number = is_numeric($numeroNaProva) ? (int) $numeroNaProva : null;
        $metadata = json_encode(
            [
                'source' => 'question_save',
                'syncedAt' => gmdate('c'),
            ],
            JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_INVALID_UTF8_SUBSTITUTE
        );
        if (!is_string($metadata)) {
            $metadata = null;
        }

        $find = $this->db->prepare(
            "SELECT id, numero_na_prova
             FROM question_provas
             WHERE question_id = :question_id
               AND prova_id = :prova_id
               AND caderno_id IS NULL
             ORDER BY id ASC
             LIMIT 1"
        );
        $find->execute([
            ':question_id' => $questionIdInt,
            ':prova_id' => $provaIdInt,
        ]);

        $existing = $find->fetch(PDO::FETCH_ASSOC);
        if (is_array($existing)) {
            $update = $this->db->prepare(
                "UPDATE question_provas
                 SET numero_na_prova = COALESCE(:numero_na_prova, numero_na_prova),
                     metadata_json = :metadata_json
                 WHERE id = :id"
            );
            $update->bindValue(':numero_na_prova', $number, $number === null ? PDO::PARAM_NULL : PDO::PARAM_INT);
            $update->bindValue(':metadata_json', $metadata);
            $update->bindValue(':id', (int) $existing['id'], PDO::PARAM_INT);
            $update->execute();
            return;
        }

        $insert = $this->db->prepare(
            "INSERT INTO question_provas (question_id, prova_id, caderno_id, numero_na_prova, metadata_json)
             VALUES (:question_id, :prova_id, NULL, :numero_na_prova, :metadata_json)"
        );
        $insert->bindValue(':question_id', $questionIdInt, PDO::PARAM_INT);
        $insert->bindValue(':prova_id', $provaIdInt, PDO::PARAM_INT);
        $insert->bindValue(':numero_na_prova', $number, $number === null ? PDO::PARAM_NULL : PDO::PARAM_INT);
        $insert->bindValue(':metadata_json', $metadata);
        $insert->execute();
    }

    /**
     * Remove a questo pelo id informado.
      * @since 1.0.0
     */
    public function deleteQuestionById(string|int $questionId): int
    {
        $stmt = $this->db->prepare("DELETE FROM questions WHERE id = :question_id");
        $stmt->bindValue(':question_id', $questionId);
        $stmt->execute();

        return $stmt->rowCount();
    }

    public function findQuestionOwnershipById(string|int $questionId): ?array
    {
        $this->ensurePublicationColumns();

        $stmt = $this->db->prepare(
            "SELECT id, created_by_user_id, updated_by_user_id, published_by_user_id
             FROM questions
             WHERE id = :question_id
             LIMIT 1"
        );
        $stmt->bindValue(':question_id', $questionId);
        $stmt->execute();

        $row = $stmt->fetch(PDO::FETCH_ASSOC);
        return is_array($row) ? $row : null;
    }

    /**
     * Limpa os vinculos de filtros da questo antes de recriar a relao atual.
      * @since 1.0.0
     */
    public function clearQuestionFilters(string|int $questionId): void
    {
        $stmt = $this->db->prepare("DELETE FROM question_filters WHERE question_id = :question_id");
        $stmt->bindValue(':question_id', $questionId);
        $stmt->execute();
    }

    /**
     * Procura um filtro existente pelo tipo e pela identidade principal.
      * @since 1.0.0
     */
    public function findFilterIdByIdentity(string $type, string $name, string $slug, ?int $parentId = null): ?int
    {
        $stmt = $this->db->prepare(
            "SELECT id
             FROM filters
             WHERE type = :type
               AND (name = :name OR slug = :slug)
               AND ((:parent_id_null IS NULL AND parent_id IS NULL) OR parent_id = :parent_id_value)
             LIMIT 1"
        );
        $stmt->bindValue(':type', $type);
        $stmt->bindValue(':name', $name);
        $stmt->bindValue(':slug', $slug);
        $stmt->bindValue(':parent_id_null', $parentId, $parentId === null ? PDO::PARAM_NULL : PDO::PARAM_INT);
        $stmt->bindValue(':parent_id_value', $parentId, $parentId === null ? PDO::PARAM_NULL : PDO::PARAM_INT);
        $stmt->execute();

        $value = $stmt->fetchColumn();
        return $value !== false ? (int) $value : null;
    }

    /**
     * Procura uma taxonomia pelo nome sem restringir o pai.
     * Usado para resolver pais criados no mesmo salvamento da questao.
     *
      * @since 1.0.0
     */
    public function findFilterIdByIdentityAnyParent(string $type, string $name, string $slug, bool $preferRoot = false): ?int
    {
        $parentOrder = $preferRoot ? 'DESC' : 'ASC';
        $stmt = $this->db->prepare(
            "SELECT id
             FROM filters
             WHERE type = :type
               AND (name = :name OR slug = :slug)
             ORDER BY parent_id IS NULL {$parentOrder}, id DESC
             LIMIT 1"
        );
        $stmt->bindValue(':type', $type);
        $stmt->bindValue(':name', $name);
        $stmt->bindValue(':slug', $slug);
        $stmt->execute();

        $value = $stmt->fetchColumn();
        return $value !== false ? (int) $value : null;
    }

    /**
     * Cria um filtro novo quando a taxonomia ainda no existe.
      * @since 1.0.0
     */
    public function createFilter(
        string $type,
        string $name,
        string $slug,
        int $metaMateria = 0,
        int $metaCarreira = 0,
        ?int $parentId = null
    ): int {
        $stmt = $this->db->prepare(
            "INSERT INTO filters (type, name, slug, parent_id, meta_materia, meta_carreira)
             VALUES (:type, :name, :slug, :parent_id, :meta_materia, :meta_carreira)"
        );
        $stmt->bindValue(':type', $type);
        $stmt->bindValue(':name', $name);
        $stmt->bindValue(':slug', $slug);
        $stmt->bindValue(':parent_id', $parentId, $parentId === null ? PDO::PARAM_NULL : PDO::PARAM_INT);
        $stmt->bindValue(':meta_materia', $metaMateria, PDO::PARAM_INT);
        $stmt->bindValue(':meta_carreira', $metaCarreira, PDO::PARAM_INT);
        $stmt->execute();

        return (int) $this->db->lastInsertId();
    }

    /**
     * Localiza uma prova importada pela identidade oficial usada no importador.
     *
     * @since 1.0.0
     */
    public function findImportedExamId(array $record): ?int
    {
        $this->ensureExamInfrastructure();

        $stmt = $this->db->prepare(
            "SELECT id
             FROM provas
             WHERE id = :id
                OR (slug = :slug AND ano = :ano)
                OR (nome = :nome AND ano = :ano_name)
             ORDER BY CASE WHEN id = :preferred_id THEN 0 ELSE 1 END, id DESC
             LIMIT 1"
        );
        $stmt->execute([
            ':id' => (int) ($record['id'] ?? 0),
            ':preferred_id' => (int) ($record['id'] ?? 0),
            ':slug' => $record['slug'],
            ':ano' => (int) $record['ano'],
            ':nome' => $record['nome'],
            ':ano_name' => (int) $record['ano'],
        ]);

        $existingId = $stmt->fetchColumn();
        return $existingId === false ? null : (int) $existingId;
    }

    /**
     * Retorna a autoria de uma prova para aplicar a regra de escopo do staff.
     *
     * @since 1.0.0
     */
    public function findImportedExamOwnershipById(int $examId): ?array
    {
        $this->ensureExamInfrastructure();

        $stmt = $this->db->prepare(
            'SELECT id, created_by_user_id, updated_by_user_id, published_by_user_id
             FROM provas
             WHERE id = :exam_id
             LIMIT 1'
        );
        $stmt->bindValue(':exam_id', $examId, PDO::PARAM_INT);
        $stmt->execute();

        $row = $stmt->fetch(PDO::FETCH_ASSOC);
        return is_array($row) ? $row : null;
    }

    public function findUserRoleById(string $userId): string
    {
        $stmt = $this->db->prepare('SELECT role FROM users WHERE id = :user_id LIMIT 1');
        $stmt->bindValue(':user_id', $userId);
        $stmt->execute();

        return strtolower(trim((string) ($stmt->fetchColumn() ?: '')));
    }

    /**
     * Cria ou atualiza a prova importada em lote e devolve seu ID real.
     *
     * @since 1.0.0
     */
    public function saveImportedExam(array $record): int
    {
        $this->ensureExamInfrastructure();

        $stmt = $this->db->prepare(
            "SELECT id
             FROM provas
             WHERE id = :id
                OR (slug = :slug AND ano = :ano)
                OR (nome = :nome AND ano = :ano_name)
             ORDER BY CASE WHEN id = :preferred_id THEN 0 ELSE 1 END, id DESC
             LIMIT 1"
        );
        $stmt->execute([
            ':id' => (int) ($record['id'] ?? 0),
            ':preferred_id' => (int) ($record['id'] ?? 0),
            ':slug' => $record['slug'],
            ':ano' => (int) $record['ano'],
            ':nome' => $record['nome'],
            ':ano_name' => (int) $record['ano'],
        ]);

        $existingId = $stmt->fetchColumn();
        if ($existingId !== false) {
            $updateStmt = $this->db->prepare(
                "UPDATE provas
                 SET nome = :nome,
                     slug = :slug,
                     ano = :ano,
                     banca_id = :banca_id,
                     orgao_id = :orgao_id,
                     cargo_id = :cargo_id,
                     nivel_id = :nivel_id,
                     tipo_prova_id = :tipo_prova_id,
                     carreira_id = :carreira_id,
                     pdf_url = COALESCE(:pdf_url, pdf_url),
                     metadata_json = :metadata_json,
                     updated_by_user_id = :updated_by_user_id,
                     published_by_user_id = COALESCE(:published_by_user_id, published_by_user_id),
                     updated_at = NOW()
                 WHERE id = :id"
            );
            $this->bindImportedExamRecord($updateStmt, $record);
            $updateStmt->bindValue(':id', (int) $existingId, PDO::PARAM_INT);
            $updateStmt->execute();

            $this->syncImportedExamCanonicalData((int) $existingId, $record);
            return (int) $existingId;
        }

        $insertStmt = $this->db->prepare(
            "INSERT INTO provas (
                nome,
                slug,
                ano,
                banca_id,
                orgao_id,
                cargo_id,
                nivel_id,
                tipo_prova_id,
                carreira_id,
                pdf_url,
                metadata_json,
                created_by_user_id,
                updated_by_user_id,
                published_by_user_id,
                created_at,
                updated_at
            ) VALUES (
                :nome,
                :slug,
                :ano,
                :banca_id,
                :orgao_id,
                :cargo_id,
                :nivel_id,
                :tipo_prova_id,
                :carreira_id,
                :pdf_url,
                :metadata_json,
                :created_by_user_id,
                :updated_by_user_id,
                :published_by_user_id,
                NOW(),
                NOW()
            )"
        );
        $this->bindImportedExamRecord($insertStmt, $record);
        $insertStmt->execute();

        $newExamId = (int) $this->db->lastInsertId();
        $this->syncImportedExamCanonicalData($newExamId, $record);
        return $newExamId;
    }

    private function syncImportedExamCanonicalData(int $examId, array $record): void
    {
        SchemaReadiness::assertTablesAndColumns($this->db, 'sincronizacao canonica de provas importadas', [
            'prova_filters' => ['prova_id', 'filter_id', 'role'],
            'prova_arquivos' => ['prova_id', 'tipo', 'nome_original', 'caminho'],
            'prova_cadernos' => ['id', 'prova_id', 'nome'],
            'question_provas' => ['question_id', 'prova_id', 'numero_na_prova'],
        ]);

        $roleMap = [
            'banca' => $record['banca_id'] ?? null,
            'orgao' => $record['orgao_id'] ?? null,
            'cargo' => $record['cargo_id'] ?? null,
            'nivel' => $record['nivel_id'] ?? null,
            'tipo_prova' => $record['tipo_prova_id'] ?? null,
            'carreira' => $record['carreira_id'] ?? null,
        ];

        $deleteFilters = $this->db->prepare("DELETE FROM prova_filters WHERE prova_id = :prova_id AND role IN ('banca', 'orgao', 'cargo', 'nivel', 'tipo_prova', 'carreira')");
        $deleteFilters->execute([':prova_id' => $examId]);

        $insertFilter = $this->db->prepare("INSERT IGNORE INTO prova_filters (prova_id, filter_id, role) VALUES (:prova_id, :filter_id, :role)");
        foreach ($roleMap as $role => $filterId) {
            if ($filterId === null || (int) $filterId <= 0) {
                continue;
            }
            $insertFilter->execute([
                ':prova_id' => $examId,
                ':filter_id' => (int) $filterId,
                ':role' => $role,
            ]);
        }

        $metadata = [];
        if (isset($record['metadata_json']) && is_string($record['metadata_json'])) {
            $decoded = json_decode($record['metadata_json'], true);
            $metadata = is_array($decoded) ? $decoded : [];
        }

        $files = [];
        if (!empty($record['pdf_url'])) {
            $files[] = [
                'kind' => 'prova',
                'name' => 'Prova',
                'url' => $record['pdf_url'],
            ];
        }
        foreach (['files', 'examFiles'] as $filesKey) {
            if (!empty($metadata[$filesKey]) && is_array($metadata[$filesKey])) {
                foreach ($metadata[$filesKey] as $file) {
                    if (is_array($file)) {
                        $files[] = $file;
                    }
                }
            }
        }

        $insertFile = $this->db->prepare("INSERT INTO prova_arquivos (prova_id, tipo, nome_original, caminho, mime_type, tamanho, metadata_json)
            SELECT :prova_id, :tipo, :nome, :caminho, :mime, :tamanho, :metadata
            WHERE NOT EXISTS (
                SELECT 1 FROM prova_arquivos WHERE prova_id = :exists_prova_id AND caminho = :exists_caminho
            )");
        foreach ($files as $file) {
            $url = trim((string) ($file['url'] ?? $file['caminho'] ?? ''));
            if ($url === '') {
                continue;
            }
            $kind = (string) ($file['kind'] ?? $file['tipo'] ?? 'outro');
            if (!in_array($kind, ['edital', 'prova', 'gabarito', 'outro'], true)) {
                $kind = 'outro';
            }
            $insertFile->execute([
                ':prova_id' => $examId,
                ':tipo' => $kind,
                ':nome' => trim((string) ($file['name'] ?? $file['label'] ?? ucfirst($kind))),
                ':caminho' => $url,
                ':mime' => $file['mimeType'] ?? $file['mime_type'] ?? null,
                ':tamanho' => isset($file['size']) ? (int) $file['size'] : null,
                ':metadata' => json_encode($file, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
                ':exists_prova_id' => $examId,
                ':exists_caminho' => $url,
            ]);
        }

        $bookletName = trim((string) ($metadata['caderno'] ?? ''));
        $bookletType = trim((string) ($metadata['tipoCaderno'] ?? $metadata['bookletType'] ?? ''));
        $bookletColor = trim((string) ($metadata['corCaderno'] ?? $metadata['bookletColor'] ?? ''));
        if ($bookletName === '' && ($bookletType !== '' || $bookletColor !== '')) {
            $bookletName = trim(implode(' - ', array_filter([$bookletType, $bookletColor])));
        }
        if ($bookletName !== '') {
            $insertBooklet = $this->db->prepare("INSERT INTO prova_cadernos (prova_id, nome, tipo, cor, ordem, metadata_json)
                VALUES (:prova_id, :nome, :tipo, :cor, 0, :metadata)
                ON DUPLICATE KEY UPDATE tipo = VALUES(tipo), cor = VALUES(cor), metadata_json = VALUES(metadata_json)");
            $insertBooklet->execute([
                ':prova_id' => $examId,
                ':nome' => $bookletName,
                ':tipo' => $bookletType !== '' ? $bookletType : null,
                ':cor' => $bookletColor !== '' ? $bookletColor : null,
                ':metadata' => json_encode([
                    'source' => 'importador',
                    'tipoCaderno' => $bookletType,
                    'corCaderno' => $bookletColor,
                ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
            ]);
        }
    }

    private function bindImportedExamRecord(PDOStatement $stmt, array $record): void
    {
        $stmt->bindValue(':nome', $record['nome']);
        $stmt->bindValue(':slug', $record['slug']);
        $stmt->bindValue(':ano', (int) $record['ano'], PDO::PARAM_INT);
        foreach (['banca_id', 'orgao_id', 'cargo_id', 'nivel_id', 'tipo_prova_id', 'carreira_id'] as $key) {
            $value = $record[$key] ?? null;
            $stmt->bindValue(':' . $key, $value, $value === null ? PDO::PARAM_NULL : PDO::PARAM_INT);
        }
        $stmt->bindValue(
            ':pdf_url',
            ($record['pdf_url'] ?? '') !== '' ? $record['pdf_url'] : null,
            ($record['pdf_url'] ?? '') !== '' ? PDO::PARAM_STR : PDO::PARAM_NULL
        );
        $stmt->bindValue(':metadata_json', $record['metadata_json'] ?? '{}');
        if (str_starts_with(ltrim($stmt->queryString), 'INSERT')) {
            $stmt->bindValue(
                ':created_by_user_id',
                ($record['created_by_user_id'] ?? '') !== '' ? $record['created_by_user_id'] : null,
                ($record['created_by_user_id'] ?? '') !== '' ? PDO::PARAM_STR : PDO::PARAM_NULL
            );
        }
        $stmt->bindValue(
            ':updated_by_user_id',
            ($record['updated_by_user_id'] ?? '') !== '' ? $record['updated_by_user_id'] : null,
            ($record['updated_by_user_id'] ?? '') !== '' ? PDO::PARAM_STR : PDO::PARAM_NULL
        );
        $stmt->bindValue(
            ':published_by_user_id',
            ($record['published_by_user_id'] ?? '') !== '' ? $record['published_by_user_id'] : null,
            ($record['published_by_user_id'] ?? '') !== '' ? PDO::PARAM_STR : PDO::PARAM_NULL
        );
    }

    /**
     * Relaciona a questo ao filtro informado sem duplicar o vinculo.
      * @since 1.0.0
     */
    public function linkQuestionFilter(string|int $questionId, int $filterId): void
    {
        $stmt = $this->db->prepare(
            "INSERT IGNORE INTO question_filters (question_id, filter_id)
             VALUES (:question_id, :filter_id)"
        );
        $stmt->bindValue(':question_id', $questionId);
        $stmt->bindValue(':filter_id', $filterId, PDO::PARAM_INT);
        $stmt->execute();
    }

    /**
     * Gera placeholders nomeados para consultas com IN.
      * @since 1.0.0
     */
    private function buildInClause(string $prefix, array $values): array
    {
        $placeholders = [];
        $bindings = [];

        foreach (array_values($values) as $index => $value) {
            $placeholder = ':' . $prefix . '_' . $index;
            $placeholders[] = $placeholder;
            $bindings[$placeholder] = $value;
        }

        return [implode(', ', $placeholders), $bindings];
    }

    /**
     * Aplica o bind do registro principal da questo nas operaes de insert/update.
      * @since 1.0.0
     */
    private function bindQuestionRecord(PDOStatement $stmt, array $record): void
    {
        $stmt->bindValue(':enunciado', $record['enunciado']);
        $stmt->bindValue(':enunciado_clean', $record['enunciado_clean']);
        $stmt->bindValue(':tipo', $record['tipo']);
        $stmt->bindValue(':dificuldade', $record['dificuldade'], PDO::PARAM_INT);
        $stmt->bindValue(':intro_text', $record['intro_text']);
        $stmt->bindValue(':reference_text', $record['reference_text'] ?? '');
        $stmt->bindValue(':data_json', $record['data_json']);
        $stmt->bindValue(
            ':import_fingerprint',
            ($record['import_fingerprint'] ?? '') !== '' ? $record['import_fingerprint'] : null,
            ($record['import_fingerprint'] ?? '') !== '' ? PDO::PARAM_STR : PDO::PARAM_NULL
        );
        $stmt->bindValue(
            ':source_exam_key',
            ($record['source_exam_key'] ?? '') !== '' ? $record['source_exam_key'] : null,
            ($record['source_exam_key'] ?? '') !== '' ? PDO::PARAM_STR : PDO::PARAM_NULL
        );
        $stmt->bindValue(
            ':source_question_number',
            ($record['source_question_number'] ?? '') !== '' ? $record['source_question_number'] : null,
            ($record['source_question_number'] ?? '') !== '' ? PDO::PARAM_STR : PDO::PARAM_NULL
        );
        $stmt->bindValue(':resposta_correta_item_index', $record['resposta_correta_item_index'], PDO::PARAM_INT);
        $stmt->bindValue(':prova_id', $record['prova_id']);
        $stmt->bindValue(
            ':grupo_questao_id',
            $record['grupo_questao_id'],
            $record['grupo_questao_id'] === null ? PDO::PARAM_NULL : PDO::PARAM_INT
        );
        $stmt->bindValue(':anulada', $record['anulada'], PDO::PARAM_INT);
        $stmt->bindValue(':desatualizada', $record['desatualizada'], PDO::PARAM_INT);
        $stmt->bindValue(':publish_status', $record['publish_status']);
        $stmt->bindValue(':visibility_status', $record['visibility_status']);
        $stmt->bindValue(':scheduled_at', $record['scheduled_at']);
        $stmt->bindValue(':published_at', $record['published_at']);
        if (str_starts_with(ltrim($stmt->queryString), 'INSERT')) {
            $stmt->bindValue(
                ':created_by_user_id',
                ($record['created_by_user_id'] ?? '') !== '' ? $record['created_by_user_id'] : null,
                ($record['created_by_user_id'] ?? '') !== '' ? PDO::PARAM_STR : PDO::PARAM_NULL
            );
        }
        $stmt->bindValue(
            ':updated_by_user_id',
            ($record['updated_by_user_id'] ?? '') !== '' ? $record['updated_by_user_id'] : null,
            ($record['updated_by_user_id'] ?? '') !== '' ? PDO::PARAM_STR : PDO::PARAM_NULL
        );
        $stmt->bindValue(
            ':published_by_user_id',
            ($record['published_by_user_id'] ?? '') !== '' ? $record['published_by_user_id'] : null,
            ($record['published_by_user_id'] ?? '') !== '' ? PDO::PARAM_STR : PDO::PARAM_NULL
        );
    }

    /**
     * Garante o suporte editorial real da tabela de questoes.
     *
     * @since 1.0.0
     */
    public function ensurePublicationColumns(): void
    {
        if ($this->publicationColumnsEnsured) {
            return;
        }


        SchemaReadiness::assertTablesAndColumns($this->db, 'publicacao de questoes', [
            'questions' => [
                'reference_text', 'publish_status', 'visibility_status', 'scheduled_at', 'published_at',
                'created_by_user_id', 'updated_by_user_id', 'published_by_user_id', 'grupo_questao_id',
                'import_fingerprint', 'source_exam_key', 'source_question_number', 'prova_id',
            ],
        ]);

        $this->ensureQuestionImportIdentityInfrastructure();
        $this->ensureQuestionGroupInfrastructure();

        $this->publicationColumnsEnsured = true;
    }

    /**
     * Garante identidade unica para importacoes em massa sem duplicar questoes.
     *
     * @since 1.0.0
     */
    private function ensureQuestionImportIdentityInfrastructure(): void
    {
        SchemaReadiness::assertTablesAndColumns($this->db, 'identidade de importacao de questoes', [
            'questions' => ['import_fingerprint', 'source_exam_key', 'source_question_number'],
        ]);
    }

    /**
     * Garante tabela e vinculo para textos/imagens de apoio reutilizaveis.
     *
     * @since 1.0.0
     */
    private function ensureQuestionGroupInfrastructure(): void
    {
        SchemaReadiness::assertTablesAndColumns($this->db, 'grupos legados de questoes', [
            'questions_groups' => ['id', 'texto', 'assets_json', 'created_by_user_id', 'updated_by_user_id'],
            'questions' => ['grupo_questao_id'],
        ]);
    }

    /**
     * Garante a infraestrutura canonica minima usada para vincular questoes ao Banco de Provas.
     *
     * @since 1.0.0
     */
    private function ensureImportedExamInfrastructure(): void
    {
        $this->ensureExamInfrastructure();
        SchemaReadiness::assertTablesAndColumns($this->db, 'vinculo de questoes ao banco de provas', [
            'prova_cadernos' => ['id', 'prova_id', 'nome'],
            'question_provas' => ['question_id', 'prova_id', 'numero_na_prova'],
            'prova_filters' => ['prova_id', 'filter_id', 'role'],
            'prova_arquivos' => ['prova_id', 'tipo', 'caminho'],
        ]);
    }

    /**
     * Garante que o banco de provas tenha os campos exigidos pelo importador em massa.
     *
     * @since 1.0.0
     */
    private function ensureExamInfrastructure(): void
    {
        SchemaReadiness::assertTablesAndColumns($this->db, 'provas importadas', [
            'provas' => [
                'id', 'nome', 'slug', 'ano', 'banca_id', 'orgao_id', 'cargo_id', 'nivel_id', 'tipo_prova_id',
                'carreira_id', 'pdf_url', 'metadata_json', 'created_by_user_id', 'updated_by_user_id', 'published_by_user_id',
            ],
        ]);
    }

    /**
     * Verifica coluna sem depender de migrations ja executadas.
     *
     * @since 1.0.0
     */
    private function questionColumnExists(string $column): bool
    {
        $stmt = $this->db->prepare("SHOW COLUMNS FROM questions LIKE :column_name");
        $stmt->bindValue(':column_name', $column);
        $stmt->execute();

        return (bool) $stmt->fetch(PDO::FETCH_ASSOC);
    }

    private function questionGroupColumnExists(string $column): bool
    {
        $stmt = $this->db->prepare("SHOW COLUMNS FROM questions_groups LIKE :column_name");
        $stmt->bindValue(':column_name', $column);
        $stmt->execute();

        return (bool) $stmt->fetch(PDO::FETCH_ASSOC);
    }

    private function ensureQuestionIndex(string $indexName, string $sql): void
    {
        if ($this->questionIndexExists($indexName)) {
            return;
        }

        $this->db->exec($sql);
    }

    private function questionIndexExists(string $indexName): bool
    {
        $stmt = $this->db->prepare('SHOW INDEX FROM questions WHERE Key_name = :index_name');
        $stmt->bindValue(':index_name', $indexName);
        $stmt->execute();

        return (bool) $stmt->fetch(PDO::FETCH_ASSOC);
    }

    private function examColumnExists(string $column): bool
    {
        $stmt = $this->db->prepare("SHOW COLUMNS FROM provas LIKE :column_name");
        $stmt->bindValue(':column_name', $column);
        $stmt->execute();

        return (bool) $stmt->fetch(PDO::FETCH_ASSOC);
    }

    private function ensureExamIndex(string $indexName, string $sql): void
    {
        if ($this->examIndexExists($indexName)) {
            return;
        }

        $this->db->exec($sql);
    }

    private function examIndexExists(string $indexName): bool
    {
        $stmt = $this->db->prepare('SHOW INDEX FROM provas WHERE Key_name = :index_name');
        $stmt->bindValue(':index_name', $indexName);
        $stmt->execute();

        return (bool) $stmt->fetch(PDO::FETCH_ASSOC);
    }
}



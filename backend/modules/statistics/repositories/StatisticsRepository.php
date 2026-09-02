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
 * Repository do dominio de estatisticas.
 * Toda consulta SQL usada pelo raio-x da banca fica centralizada aqui.
 *
 * @since 1.0.0
 */
class StatisticsRepository
{
    /**
     * Injeta a conexao compartilhada pelo modulo para consultas agregadas e instalacao de schema.
     *
     * @since 1.0.0
     */
    public function __construct(private readonly PDO $db)
    {
    }

    /**
     * Le a configurao global de cache para o modulo.
     *
     * @since 1.0.0
     */
    public function getCacheSettings(): array
    {
        try {
            $stmt = $this->db->prepare("SELECT enabled, default_ttl FROM cache_settings LIMIT 1");
            $stmt->execute();
            $result = $stmt->fetch(PDO::FETCH_ASSOC);

            if (is_array($result)) {
                return [
                    'enabled' => (int) ($result['enabled'] ?? 0),
                    'default_ttl' => (int) ($result['default_ttl'] ?? 300),
                ];
            }
        } catch (Throwable) {
            // Mantem fallback seguro quando a infraestrutura ainda no existe.
        }

        return [
            'enabled' => 0,
            'default_ttl' => 300,
        ];
    }

    /**
     * Busca o id do filtro pelo tipo e nome exibidos no app.
     *
     * @since 1.0.0
     */
    public function findFilterIdByTypeAndName(string $type, string $name): ?int
    {
        $stmt = $this->db->prepare("SELECT id FROM filters WHERE type = :type AND name = :name LIMIT 1");
        $stmt->execute([
            ':type' => $type,
            ':name' => $name,
        ]);

        $value = $stmt->fetchColumn();
        return $value !== false ? (int) $value : null;
    }

    /**
     * Lista as questes que combinam com a banca e filtros opcionais.
     *
     * @since 1.0.0
     */
    public function listQuestionsForXray(int $bancaFilterId, ?int $cargoFilterId, ?int $anoFilterId): array
    {
        $query = "SELECT q.id, q.enunciado_clean, q.intro_text, q.dificuldade
            FROM questions q
            JOIN question_filters qf_banca
                ON q.id = qf_banca.question_id
                AND qf_banca.filter_id = :bancaFilterId";

        $params = [
            ':bancaFilterId' => $bancaFilterId,
        ];

        if ($cargoFilterId !== null) {
            $query .= " JOIN question_filters qf_cargo
                ON q.id = qf_cargo.question_id
                AND qf_cargo.filter_id = :cargoFilterId";
            $params[':cargoFilterId'] = $cargoFilterId;
        }

        if ($anoFilterId !== null) {
            $query .= " JOIN question_filters qf_ano
                ON q.id = qf_ano.question_id
                AND qf_ano.filter_id = :anoFilterId";
            $params[':anoFilterId'] = $anoFilterId;
        }

        $stmt = $this->db->prepare($query);
        $stmt->execute($params);

        return $stmt->fetchAll(PDO::FETCH_ASSOC) ?: [];
    }

    /**
     * Busca os filtros de assunto associados a um conjunto de questes.
     *
     * @since 1.0.0
     */
    public function listSubjectFiltersForQuestions(array $questionIds): array
    {
        if ($questionIds === []) {
            return [];
        }

        $placeholders = implode(', ', array_fill(0, count($questionIds), '?'));
        $stmt = $this->db->prepare("
            SELECT qf.question_id, f.id, f.name, f.parent_id, f.meta_materia
            FROM question_filters qf
            JOIN filters f ON f.id = qf.filter_id
            WHERE qf.question_id IN ($placeholders)
              AND f.type = 'assunto'
        ");
        $stmt->execute(array_values($questionIds));

        return $stmt->fetchAll(PDO::FETCH_ASSOC) ?: [];
    }

    /**
     * Resolve em lote os nomes de filtros pais usados para reconstruir a hierarquia.
     *
     * @since 1.0.0
     */
    public function listFilterNamesByIds(array $filterIds): array
    {
        $filterIds = array_values(array_unique(array_filter(array_map('intval', $filterIds))));
        if ($filterIds === []) {
            return [];
        }

        $placeholders = implode(', ', array_fill(0, count($filterIds), '?'));
        $stmt = $this->db->prepare("SELECT id, name FROM filters WHERE id IN ($placeholders)");
        $stmt->execute($filterIds);

        $rows = $stmt->fetchAll(PDO::FETCH_ASSOC) ?: [];
        $mapped = [];
        foreach ($rows as $row) {
            $mapped[(int) $row['id']] = (string) ($row['name'] ?? '');
        }

        return $mapped;
    }

    /**
     * Lista provas cadastradas para a banca.
     *
     * @since 1.0.0
     */
    public function listExamsByBancaId(int $bancaId): array
    {
        $stmt = $this->db->prepare("
            SELECT id, nome, ano
            FROM provas
            WHERE banca_id = :bancaId
            ORDER BY ano DESC, nome ASC
        ");
        $stmt->execute([
            ':bancaId' => $bancaId,
        ]);

        return $stmt->fetchAll(PDO::FETCH_ASSOC) ?: [];
    }

    /**
     * Le uma configurao textual/JSON do sistema.
     *
     * @since 1.0.0
     */
    public function getSystemSettingValue(string $key, $default = null)
    {
        $stmt = $this->db->prepare("
            SELECT value_json
            FROM system_settings
            WHERE key_name = :key
            LIMIT 1
        ");
        $stmt->execute([
            ':key' => $key,
        ]);

        $value = $stmt->fetchColumn();
        if ($value === false) {
            return $default;
        }

        $decoded = json_decode((string) $value, true);
        if (json_last_error() === JSON_ERROR_NONE) {
            return $decoded;
        }

        return $value;
    }

    /**
     * Busca a linha agregada do usurio.
     *
     * @since 1.0.0
     */
    public function findUserStatisticsByUserId(string $userId): ?array
    {
        $stmt = $this->db->prepare("SELECT * FROM user_statistics WHERE user_id = :userId LIMIT 1");
        $stmt->execute([
            ':userId' => $userId,
        ]);

        $row = $stmt->fetch(PDO::FETCH_ASSOC);
        return is_array($row) ? $row : null;
    }

    /**
     * Registra uma sessao auditavel de estudo para o usuario autenticado.
     *
     * @since 1.0.0
     */
    public function createStudySession(array $payload): void
    {
        $stmt = $this->db->prepare("
            INSERT INTO study_sessions (
                id,
                user_id,
                practice_study_time,
                simulation_study_time,
                reading_study_time,
                question_study_time,
                total_study_time,
                started_at,
                ended_at,
                source_context
            ) VALUES (
                :id,
                :user_id,
                :practice_study_time,
                :simulation_study_time,
                :reading_study_time,
                :question_study_time,
                :total_study_time,
                :started_at,
                :ended_at,
                :source_context
            )
        ");

        $stmt->execute([
            ':id' => (string) ($payload['id'] ?? ''),
            ':user_id' => (string) ($payload['user_id'] ?? ''),
            ':practice_study_time' => (int) ($payload['practice_study_time'] ?? 0),
            ':simulation_study_time' => (int) ($payload['simulation_study_time'] ?? 0),
            ':reading_study_time' => (int) ($payload['reading_study_time'] ?? 0),
            ':question_study_time' => (int) ($payload['question_study_time'] ?? 0),
            ':total_study_time' => (int) ($payload['total_study_time'] ?? 0),
            ':started_at' => $payload['started_at'] ?? null,
            ':ended_at' => $payload['ended_at'] ?? date('Y-m-d H:i:s'),
            ':source_context' => $payload['source_context'] ?? null,
        ]);
    }

    /**
     * Incrementa os totais agregados de estudo do usuario.
     *
     * @since 1.0.0
     */
    public function incrementUserStudyTimeTotals(
        string $userId,
        int $questionSeconds,
        int $readingSeconds,
        string $lastActivityAt
    ): int {
        $totalSeconds = max(0, $questionSeconds + $readingSeconds);

        $stmt = $this->db->prepare("
            INSERT INTO user_statistics (
                user_id,
                total_study_time,
                question_study_time,
                reading_study_time,
                last_activity
            ) VALUES (
                :user_id,
                :total_study_time,
                :question_study_time,
                :reading_study_time,
                :last_activity
            )
            ON DUPLICATE KEY UPDATE
                total_study_time = total_study_time + VALUES(total_study_time),
                question_study_time = question_study_time + VALUES(question_study_time),
                reading_study_time = reading_study_time + VALUES(reading_study_time),
                last_activity = VALUES(last_activity)
        ");

        $stmt->execute([
            ':user_id' => $userId,
            ':total_study_time' => $totalSeconds,
            ':question_study_time' => max(0, $questionSeconds),
            ':reading_study_time' => max(0, $readingSeconds),
            ':last_activity' => $lastActivityAt,
        ]);

        return $stmt->rowCount() === 1 ? 1 : 0;
    }

    /**
     * Lista o agregado por materia do usurio.
     *
     * @since 1.0.0
     */
    public function listSubjectStatisticsByUserId(string $userId): array
    {
        $stmt = $this->db->prepare("SELECT * FROM subject_statistics WHERE user_id = :userId");
        $stmt->execute([
            ':userId' => $userId,
        ]);

        return $stmt->fetchAll(PDO::FETCH_ASSOC) ?: [];
    }

    /**
     * Busca o agregado da questo.
     *
     * @since 1.0.0
     */
    public function findQuestionStatisticsByQuestionId(int $questionId): ?array
    {
        $stmt = $this->db->prepare("SELECT * FROM question_stats WHERE question_id = :questionId LIMIT 1");
        $stmt->execute([
            ':questionId' => $questionId,
        ]);

        $row = $stmt->fetch(PDO::FETCH_ASSOC);
        return is_array($row) ? $row : null;
    }

    /**
     * Total de usurios cadastrados.
     *
     * @since 1.0.0
     */
    public function countTotalUsers(): int
    {
        return (int) $this->db->query("SELECT COUNT(*) FROM users")->fetchColumn();
    }

    /**
     * Total de usurios ativos nos ltimos 30 dias.
     *
     * @since 1.0.0
     */
    public function countActiveUsersLast30Days(): int
    {
        return (int) $this->db->query("
            SELECT COUNT(DISTINCT user_id)
            FROM user_statistics
            WHERE last_activity >= DATE_SUB(NOW(), INTERVAL 30 DAY)
        ")->fetchColumn();
    }

    /**
     * Total de questes cadastradas.
     *
     * @since 1.0.0
     */
    public function countTotalQuestions(): int
    {
        return (int) $this->db->query("SELECT COUNT(*) FROM questions")->fetchColumn();
    }

    /**
     * Soma total de respostas registradas no agregado.
     *
     * @since 1.0.0
     */
    public function sumTotalAnswers(): int
    {
        return (int) ($this->db->query("SELECT SUM(total_questions_answered) FROM user_statistics")->fetchColumn() ?: 0);
    }

    /**
     * Media de acuracia considerando usurios com respostas.
     *
     * @since 1.0.0
     */
    public function getAverageAccuracy(): float
    {
        return (float) ($this->db->query("
            SELECT AVG(accuracy_rate)
            FROM user_statistics
            WHERE total_questions_answered > 0
        ")->fetchColumn() ?: 0);
    }

    /**
     * Lista materias mais populares da plataforma.
     *
     * @since 1.0.0
     */
    public function listPopularSubjects(int $limit = 10): array
    {
        $stmt = $this->db->prepare("
            SELECT subject,
                   SUM(total_questions) AS question_count,
                   SUM(total_questions) AS attempt_count
            FROM subject_statistics
            GROUP BY subject
            ORDER BY question_count DESC
            LIMIT :limit
        ");
        $stmt->bindValue(':limit', $limit, PDO::PARAM_INT);
        $stmt->execute();

        return $stmt->fetchAll(PDO::FETCH_ASSOC) ?: [];
    }

    /**
     * Lista os usurios de maior performance para o agregado global.
     *
     * @since 1.0.0
     */
    public function listTopPerformers(int $limit = 10): array
    {
        $stmt = $this->db->prepare("
            SELECT us.user_id, u.name AS user_name,
                   us.total_questions_answered AS score,
                   us.accuracy_rate AS accuracy
            FROM user_statistics us
            LEFT JOIN users u ON u.id = us.user_id
            WHERE us.total_questions_answered > 10
            ORDER BY us.accuracy_rate DESC, us.total_questions_answered DESC
            LIMIT :limit
        ");
        $stmt->bindValue(':limit', $limit, PDO::PARAM_INT);
        $stmt->execute();

        return $stmt->fetchAll(PDO::FETCH_ASSOC) ?: [];
    }

    /**
     * Garante a tabela principal de estatisticas do usurio.
     *
     * @since 1.0.0
     */
    public function ensureUserStatisticsTable(): void
    {
        SchemaReadiness::assertTablesAndColumns($this->db, 'estatisticas do usuario', [
            'user_statistics' => ['user_id', 'total_questions_answered', 'correct_answers', 'wrong_answers', 'accuracy_rate', 'current_streak', 'best_streak', 'total_study_time', 'question_study_time', 'reading_study_time', 'last_activity', 'updated_at'],
        ]);
    }

    /**
     * Garante a tabela de estatisticas por materia.
     *
     * @since 1.0.0
     */
    public function ensureSubjectStatisticsTable(): void
    {
        SchemaReadiness::assertTablesAndColumns($this->db, 'estatisticas por materia', [
            'subject_statistics' => ['id', 'user_id', 'subject', 'total_questions', 'correct_answers', 'wrong_answers', 'accuracy_rate', 'average_time', 'updated_at'],
        ]);
    }

    /**
     * Garante as colunas extras usadas no agregado da questo.
     *
     * @since 1.0.0
     */
    public function ensureQuestionStatsEnhancements(): bool
    {
        SchemaReadiness::assertTablesAndColumns($this->db, 'estatisticas de questoes', [
            'question_stats' => ['question_id', 'option_distribution', 'average_time_spent', 'difficulty_rating'],
        ]);

        return false;
    }

    /**
     * Garante a infraestrutura de auditoria para sessoes de estudo.
     *
     * @since 1.0.0
     */
    public function ensureStudySessionsTable(): void
    {
        SchemaReadiness::assertTablesAndColumns($this->db, 'sessoes de estudo', [
            'study_sessions' => ['id', 'user_id', 'practice_study_time', 'simulation_study_time', 'reading_study_time', 'question_study_time', 'total_study_time', 'started_at', 'ended_at', 'source_context', 'created_at'],
        ]);
    }

    /**
     * Garante todo o schema necessario para o tempo de estudo.
     *
     * @since 1.0.0
     */
    public function ensureStudyTimeSchema(): void
    {
        $this->ensureUserStatisticsTable();
        $this->ensureStudySessionsTable();
    }

}

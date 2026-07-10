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
 * Repositorio do dominio de rankings.
 *
 * @since 1.0.0
 */
class RankingsRepository
{
    private PDO $db;

    /**
     * Inicializa o repository com a conexao do banco.
     *
     * @since 1.0.0
     */
    public function __construct(PDO $db)
    {
        $this->db = $db;
    }

    /**
     * Retorna o papel do usuario.
     *
     * @since 1.0.0
     */
    public function findUserRoleById(string $userId): ?string
    {
        $stmt = $this->db->prepare("SELECT role FROM users WHERE id = :id LIMIT 1");
        $stmt->execute([':id' => $userId]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);

        return $row['role'] ?? null;
    }

    /**
     * Indica se a tabela de rankings existe.
     *
     * @since 1.0.0
     */
    public function rankingsTableExists(): bool
    {
        $stmt = $this->db->query("SHOW TABLES LIKE 'rankings'");
        return $stmt->rowCount() > 0;
    }

    /**
     * Carrega rankings com opcao de incluir pendentes.
     *
     * @since 1.0.0
     */
    public function fetchRankings(bool $includePending): array
    {
        $query = "SELECT * FROM rankings";
        if (!$includePending) {
            $query .= " WHERE status = 'approved'";
        }
        $query .= " ORDER BY created_at DESC";

        $stmt = $this->db->prepare($query);
        $stmt->execute();

        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }

    /**
     * Carrega as entradas do ranking.
     *
     * @since 1.0.0
     */
    public function fetchEntries(): array
    {
        $stmt = $this->db->prepare("SELECT * FROM ranking_entries ORDER BY score DESC, created_at ASC");
        $stmt->execute();

        return $stmt->fetchAll(PDO::FETCH_ASSOC);
    }

    /**
     * Insere um ranking.
     *
     * @since 1.0.0
     */
    public function insertRanking(array $payload): void
    {
        $this->ensureRankingRuntimeColumns();

        $stmt = $this->db->prepare("
            INSERT INTO rankings
            (id, name, institution, total_questions, vacancies, vacancies_ac, vacancies_afro, vacancies_pcd, official_key_release_date, key_status, correct_key, has_discursive, exam_types, status, created_by_user_id, created_at)
            VALUES
            (:id, :name, :institution, :total_questions, :vacancies, :vacancies_ac, :vacancies_afro, :vacancies_pcd, :official_key_release_date, :key_status, :correct_key, :has_discursive, :exam_types, :status, :created_by_user_id, NOW())
        ");
        $stmt->execute($payload);
    }

    /**
     * Insere ou atualiza uma entrada do ranking.
     *
     * @since 1.0.0
     */
    public function upsertEntry(array $payload): void
    {
        $stmt = $this->db->prepare("
            INSERT INTO ranking_entries
            (id, ranking_id, user_id, user_name, registration_number, exam_type, category, user_answers, score, discursive_score, status, created_at)
            VALUES
            (:id, :ranking_id, :user_id, :user_name, :registration_number, :exam_type, :category, :user_answers, :score, :discursive_score, :status, NOW())
            ON DUPLICATE KEY UPDATE
            user_name = :user_name_up,
            registration_number = :registration_number_up,
            category = :category_up,
            user_answers = :user_answers_up,
            score = :score_up,
            discursive_score = :discursive_score_up,
            exam_type = :exam_type_up,
            status = :status_up
        ");
        $stmt->execute($payload);
    }

    /**
     * Busca uma participacao do usuario no ranking.
     *
     * @since 1.0.0
     */
    public function findEntryByRankingAndUser(string $rankingId, string $userId): ?array
    {
        $stmt = $this->db->prepare("
            SELECT *
            FROM ranking_entries
            WHERE ranking_id = :ranking_id
              AND user_id = :user_id
            LIMIT 1
        ");
        $stmt->execute([
            ':ranking_id' => $rankingId,
            ':user_id' => $userId,
        ]);

        $row = $stmt->fetch(PDO::FETCH_ASSOC);
        return $row ?: null;
    }

    /**
     * Atualiza o status do ranking.
     *
     * @since 1.0.0
     */
    public function updateRankingStatus(string $rankingId, string $status): int
    {
        $stmt = $this->db->prepare("UPDATE rankings SET status = :status WHERE id = :id");
        $stmt->execute([
            ':status' => $status,
            ':id' => $rankingId,
        ]);

        return $stmt->rowCount();
    }

    /**
     * Atualiza os dados do ranking.
     *
     * @since 1.0.0
     */
    public function updateRanking(array $payload): int
    {
        $stmt = $this->db->prepare("
            UPDATE rankings
            SET name = :name,
                institution = :institution,
                total_questions = :total_questions,
                vacancies = :vacancies,
                vacancies_ac = :vacancies_ac,
                vacancies_afro = :vacancies_afro,
                vacancies_pcd = :vacancies_pcd,
                reserve_limit = :reserve_limit,
                official_key_release_date = :official_key_release_date,
                key_status = :key_status,
                correct_key = :correct_key,
                has_discursive = :has_discursive,
                exam_types = :exam_types
            WHERE id = :id
        ");
        $stmt->execute($payload);

        return $stmt->rowCount();
    }

    /**
     * Busca um ranking pelo id.
     *
     * @since 1.0.0
     */
    public function findRankingById(string $rankingId): ?array
    {
        $stmt = $this->db->prepare("SELECT * FROM rankings WHERE id = :id LIMIT 1");
        $stmt->execute([':id' => $rankingId]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);

        return $row ?: null;
    }

    /**
     * Retorna participantes unicos de um ranking.
     *
     * @since 1.0.0
     */
    public function fetchRankingParticipantUserIds(string $rankingId): array
    {
        $stmt = $this->db->prepare("
            SELECT DISTINCT user_id
            FROM ranking_entries
            WHERE ranking_id = :ranking_id
              AND user_id IS NOT NULL
              AND user_id <> ''
              AND COALESCE(status, 'active') <> 'disqualified'
        ");
        $stmt->execute([':ranking_id' => $rankingId]);

        return array_values(array_filter(array_map('strval', $stmt->fetchAll(PDO::FETCH_COLUMN) ?: [])));
    }

    /**
     * Notifica administradores sobre ranking pendente.
     *
     * @since 1.0.0
     */
    public function notifyAdminsPendingRanking(string $rankingId, string $rankingName): int
    {
        require_once __DIR__ . '/../../../config/notification_helper.php';

        return createAdminNotification(
            $this->db,
            'Ranking aguardando moderacao',
            'Um ranking foi criado pela comunidade e precisa de aprovacao: ' . $rankingName,
            'info',
            'ranking',
            '/admin/database/rankings'
        );
    }

    /**
     * Notifica o criador apos moderacao do ranking.
     *
     * @since 1.0.0
     */
    public function notifyRankingCreatorModeration(array $ranking, string $status): bool
    {
        $creatorId = trim((string) ($ranking['created_by_user_id'] ?? ''));
        if ($creatorId === '') {
            return false;
        }

        require_once __DIR__ . '/../../../config/notification_helper.php';

        $approved = $status === 'approved';
        return createNotification(
            $this->db,
            $creatorId,
            $approved ? 'Ranking aprovado' : 'Ranking rejeitado',
            $approved
                ? 'Seu ranking foi aprovado e ja esta disponivel para a comunidade.'
                : 'Seu ranking foi rejeitado pela moderacao. Revise as informacoes antes de enviar novamente.',
            $approved ? 'success' : 'warning',
            'ranking',
            $approved ? '/ranking/' . (string) ($ranking['id'] ?? '') : '/ranking'
        );
    }

    /**
     * Recompensa o criador quando um ranking comunitario e aprovado.
     *
     * @since 1.0.0
     */
    public function applyRankingCreatorModerationGamification(array $ranking, string $status): void
    {
        if ($status !== 'approved') {
            return;
        }

        require_once __DIR__ . '/../../../config/gamification_helper.php';

        $creatorId = trim((string) ($ranking['created_by_user_id'] ?? ''));
        $rankingId = trim((string) ($ranking['id'] ?? ''));
        if ($creatorId === '' || $rankingId === '') {
            return;
        }

        $reward = grantGamificationEvent(
            $this->db,
            $creatorId,
            'ranking_approved',
            'ranking_approved:' . $rankingId,
            25,
            1,
            [
                'key' => 'first_community_ranking_approved',
                'title' => 'Ranking aprovado',
                'description' => 'Um ranking criado por voce foi aprovado pela moderacao.',
            ],
            [
                'ranking_id' => $rankingId,
                'ranking_name' => (string) ($ranking['name'] ?? ''),
            ]
        );

        if (!empty($reward['badge_awarded'])) {
            createNotification(
                $this->db,
                $creatorId,
                'Badge desbloqueado',
                'Ranking aprovado: sua contribuicao entrou na comunidade.',
                'success',
                'system',
                '/profile?tab=achievements'
            );
        }
    }

    /**
     * Notifica o participante quando a entrada e registrada.
     *
     * @since 1.0.0
     */
    public function notifyRankingParticipantJoin(string $rankingId, string $userId, string $rankingName): bool
    {
        require_once __DIR__ . '/../../../config/notification_helper.php';

        return createNotification(
            $this->db,
            $userId,
            'Participacao registrada',
            'Seu gabarito foi registrado no ranking: ' . $rankingName,
            'success',
            'ranking',
            '/ranking/' . $rankingId
        );
    }

    /**
     * Recompensa a primeira participacao efetiva em cada ranking.
     *
     * @since 1.0.0
     */
    public function applyRankingParticipantJoinGamification(string $rankingId, string $userId, string $rankingName): void
    {
        require_once __DIR__ . '/../../../config/gamification_helper.php';

        $rankingId = trim($rankingId);
        $userId = trim($userId);
        if ($rankingId === '' || $userId === '') {
            return;
        }

        $reward = grantGamificationEvent(
            $this->db,
            $userId,
            'ranking_participation',
            'ranking_join:' . $rankingId . ':' . $userId,
            20,
            0,
            [
                'key' => 'first_ranking_participation',
                'title' => 'Primeiro ranking',
                'description' => 'Voce registrou sua primeira participacao em ranking.',
            ],
            [
                'ranking_id' => $rankingId,
                'ranking_name' => $rankingName,
            ]
        );

        if (!empty($reward['badge_awarded'])) {
            createNotification(
                $this->db,
                $userId,
                'Badge desbloqueado',
                'Primeiro ranking: voce entrou na disputa.',
                'success',
                'system',
                '/profile?tab=achievements'
            );
        }
    }

    /**
     * Notifica participantes quando o gabarito oficial e publicado.
     *
     * @since 1.0.0
     */
    public function notifyRankingParticipantsOfficialKey(array $ranking): int
    {
        require_once __DIR__ . '/../../../config/notification_helper.php';

        $rankingId = (string) ($ranking['id'] ?? '');
        $rankingName = (string) ($ranking['name'] ?? 'ranking');
        $created = 0;

        foreach ($this->fetchRankingParticipantUserIds($rankingId) as $userId) {
            if (createNotification(
                $this->db,
                $userId,
                'Gabarito oficial publicado',
                'O gabarito oficial do ranking foi publicado: ' . $rankingName,
                'info',
                'ranking',
                '/ranking/' . $rankingId
            )) {
                $created++;
            }
        }

        return $created;
    }

    /**
     * Recompensa participantes quando o gabarito oficial consolida o resultado.
     *
     * @since 1.0.0
     */
    public function applyRankingOfficialKeyGamification(array $ranking): void
    {
        require_once __DIR__ . '/../../../config/gamification_helper.php';

        $rankingId = trim((string) ($ranking['id'] ?? ''));
        if ($rankingId === '') {
            return;
        }

        $position = 0;
        foreach ($this->fetchActiveRankingEntries($rankingId) as $entry) {
            $userId = trim((string) ($entry['user_id'] ?? ''));
            if ($userId === '') {
                continue;
            }

            $position++;
            $xp = 10;
            $reputation = 0;
            $badge = null;

            if ($position === 1) {
                $xp = 60;
                $reputation = 3;
                $badge = [
                    'key' => 'ranking_first_place',
                    'title' => '1o lugar em ranking',
                    'description' => 'Voce ficou em primeiro lugar em um ranking com gabarito oficial.',
                ];
            } elseif ($position <= 3) {
                $xp = 40;
                $reputation = 2;
                $badge = [
                    'key' => 'ranking_top_3',
                    'title' => 'Top 3 em ranking',
                    'description' => 'Voce ficou entre os tres primeiros em um ranking.',
                ];
            } elseif ($position <= 10) {
                $xp = 25;
                $reputation = 1;
                $badge = [
                    'key' => 'ranking_top_10',
                    'title' => 'Top 10 em ranking',
                    'description' => 'Voce ficou entre os dez primeiros em um ranking.',
                ];
            }

            $reward = grantGamificationEvent(
                $this->db,
                $userId,
                'ranking_official_result',
                'ranking_result:' . $rankingId . ':' . $userId,
                $xp,
                $reputation,
                $badge,
                [
                    'ranking_id' => $rankingId,
                    'ranking_name' => (string) ($ranking['name'] ?? ''),
                    'position' => $position,
                    'score' => (float) ($entry['score'] ?? 0),
                ]
            );

            if (!empty($reward['badge_awarded']) && $badge) {
                createNotification(
                    $this->db,
                    $userId,
                    'Badge desbloqueado',
                    $badge['title'] . ': resultado consolidado no ranking.',
                    'success',
                    'system',
                    '/profile?tab=achievements'
                );
            }
        }
    }

    /**
     * Lista entradas ativas ordenadas por desempenho para premiacao.
     *
     * @since 1.0.0
     */
    public function fetchActiveRankingEntries(string $rankingId): array
    {
        $stmt = $this->db->prepare("
            SELECT *
            FROM ranking_entries
            WHERE ranking_id = :ranking_id
              AND user_id IS NOT NULL
              AND user_id <> ''
              AND COALESCE(status, 'active') <> 'disqualified'
            ORDER BY score DESC, COALESCE(discursive_score, 0) DESC, created_at ASC
        ");
        $stmt->execute([':ranking_id' => $rankingId]);

        return $stmt->fetchAll(PDO::FETCH_ASSOC) ?: [];
    }

    /**
     * Remove todas as entradas de um ranking.
     *
     * @since 1.0.0
     */
    public function deleteEntriesByRankingId(string $rankingId): void
    {
        $stmt = $this->db->prepare("DELETE FROM ranking_entries WHERE ranking_id = :ranking_id");
        $stmt->execute([':ranking_id' => $rankingId]);
    }

    /**
     * Exclui um ranking pelo id.
     *
     * @since 1.0.0
     */
    public function deleteRanking(string $rankingId): void
    {
        $stmt = $this->db->prepare("DELETE FROM rankings WHERE id = :id");
        $stmt->execute([':id' => $rankingId]);
    }

    /**
     * Cria a tabela de rankings caso nao exista.
     *
     * @since 1.0.0
     */
    public function ensureRankingsTable(): void
    {
        $this->db->exec("
            CREATE TABLE IF NOT EXISTS rankings (
                id VARCHAR(36) PRIMARY KEY,
                name VARCHAR(255) NOT NULL,
                institution VARCHAR(255) NOT NULL,
                total_questions INT NOT NULL DEFAULT 60,
                vacancies INT NOT NULL DEFAULT 10,
                official_key_release_date DATETIME NULL,
                key_status ENUM('pending', 'official') DEFAULT 'pending',
                has_discursive BOOLEAN DEFAULT FALSE,
                exam_types JSON,
                correct_key TEXT,
                image_url VARCHAR(255),
                reserve_limit INT DEFAULT 10,
                status VARCHAR(20) DEFAULT 'active',
                created_by_user_id VARCHAR(64) NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        ");
    }

    /**
     * Cria a tabela de entradas de ranking caso nao exista.
     *
     * @since 1.0.0
     */
    public function ensureRankingEntriesTable(): void
    {
        $this->db->exec("
            CREATE TABLE IF NOT EXISTS ranking_entries (
                id VARCHAR(36) PRIMARY KEY,
                ranking_id VARCHAR(36) NOT NULL,
                user_id VARCHAR(36) NOT NULL,
                user_name VARCHAR(255),
                registration_number VARCHAR(100),
                exam_type VARCHAR(100),
                category VARCHAR(50) DEFAULT 'AC',
                user_answers TEXT,
                score DECIMAL(10,2) DEFAULT 0,
                discursive_score DECIMAL(5,2) DEFAULT NULL,
                status ENUM('active', 'disqualified') DEFAULT 'active',
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                INDEX (ranking_id),
                UNIQUE KEY unique_participation (ranking_id, registration_number)
            )
        ");
    }

    /**
     * Garante que uma coluna exista na tabela de rankings.
     *
     * @since 1.0.0
     */
    public function ensureRankingColumn(string $column, string $sql): bool
    {
        $stmt = $this->db->query("SHOW TABLES LIKE 'rankings'");
        if (!$stmt instanceof PDOStatement || $stmt->rowCount() === 0) {
            return false;
        }

        $check = $this->db->query("SHOW COLUMNS FROM rankings LIKE " . $this->db->quote($column));
        if ($check instanceof PDOStatement && $check->rowCount() > 0) {
            return false;
        }

        $this->db->exec($sql);
        return true;
    }

    /**
     * Garante que uma coluna exista na tabela de entradas.
     *
     * @since 1.0.0
     */
    public function ensureRankingEntryColumn(string $column, string $sql): bool
    {
        $stmt = $this->db->query("SHOW TABLES LIKE 'ranking_entries'");
        if (!$stmt instanceof PDOStatement || $stmt->rowCount() === 0) {
            return false;
        }

        $check = $this->db->query("SHOW COLUMNS FROM ranking_entries LIKE " . $this->db->quote($column));
        if ($check instanceof PDOStatement && $check->rowCount() > 0) {
            return false;
        }

        $this->db->exec($sql);
        return true;
    }

    /**
     * Corrige o tipo da coluna score.
     *
     * @since 1.0.0
     */
    public function ensureRankingScoreColumnShape(): bool
    {
        $stmt = $this->db->query("SHOW TABLES LIKE 'ranking_entries'");
        if (!$stmt instanceof PDOStatement || $stmt->rowCount() === 0) {
            return false;
        }

        $this->db->exec("ALTER TABLE ranking_entries MODIFY COLUMN score DECIMAL(10,2) DEFAULT 0");
        return true;
    }

    /**
     * Verifica se o indice unico ja existe.
     *
     * @since 1.0.0
     */
    public function hasRankingEntriesUniqueParticipationIndex(): bool
    {
        $stmt = $this->db->query("SHOW INDEX FROM ranking_entries WHERE Key_name = 'unique_participation'");
        return $stmt instanceof PDOStatement && $stmt->rowCount() > 0;
    }

    /**
     * Garante o indice unico de participacao.
     *
     * @since 1.0.0
     */
    public function ensureRankingEntriesUniqueParticipationIndex(): bool
    {
        if ($this->hasRankingEntriesUniqueParticipationIndex()) {
            return false;
        }

        $this->db->exec("ALTER TABLE ranking_entries ADD UNIQUE KEY unique_participation (ranking_id, registration_number)");
        return true;
    }

    /**
     * Garante colunas necessarias por fluxos atuais em tabelas antigas.
     *
     * @since 1.0.0
     */
    private function ensureRankingRuntimeColumns(): void
    {
        $this->ensureRankingColumn('created_by_user_id', "ALTER TABLE rankings ADD COLUMN created_by_user_id VARCHAR(64) NULL AFTER status");
    }
}

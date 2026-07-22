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
 * Repository oficial do dominio de simulados.
 * Centraliza persistencia da sessao e das respostas vinculadas.
 *
 * @since 1.0.0
 */
class SimulationsRepository
{
    /**
     * Registra o PDO para operacoes transacionais do dominio.
     *
     * @since 1.0.0
     */
    public function __construct(private readonly PDO $db)
    {
    }

    /**
     * Executa a persistencia principal do simulado como uma unica unidade atomica.
     *
     * @template T
     * @param callable(): T $callback
     * @return T
     */
    public function transactional(callable $callback): mixed
    {
        $ownsTransaction = !$this->db->inTransaction();
        if ($ownsTransaction) {
            $this->db->beginTransaction();
        }

        try {
            $result = $callback();
            if ($ownsTransaction && $this->db->inTransaction()) {
                $this->db->commit();
            }

            return $result;
        } catch (Throwable $e) {
            if ($ownsTransaction && $this->db->inTransaction()) {
                $this->db->rollBack();
            }
            throw $e;
        }
    }

    /**
     * Bloqueia uma sessao existente durante o upsert e devolve seu proprietario.
     */
    public function findSimulationOwnerIdForUpdate(string $simulationId): ?string
    {
        $stmt = $this->db->prepare(
            "SELECT user_id
             FROM simulations
             WHERE id = :id
             LIMIT 1
             FOR UPDATE"
        );
        $stmt->execute([':id' => $simulationId]);
        $ownerId = $stmt->fetchColumn();

        return is_string($ownerId) && trim($ownerId) !== '' ? trim($ownerId) : null;
    }

    /**
     * Salva ou atualiza a sessao principal de simulado.
     *
     * @since 1.0.0
     */
    public function upsertSimulation(array $payload): void
    {
        $stmt = $this->db->prepare(
            "INSERT INTO simulations
                (id, user_id, name, status, score, start_time, end_time, config_json)
             VALUES
                (:id, :user_id, :name, :status, :score, FROM_UNIXTIME(:start_time / 1000), FROM_UNIXTIME(:end_time / 1000), :config_json)
             ON DUPLICATE KEY UPDATE
                status = VALUES(status),
                score = VALUES(score),
                end_time = VALUES(end_time),
                config_json = VALUES(config_json)"
        );

        $stmt->execute([
            ':id' => $payload['id'],
            ':user_id' => $payload['user_id'],
            ':name' => $payload['name'],
            ':status' => $payload['status'],
            ':score' => $payload['score'],
            ':start_time' => $payload['startTime'],
            ':end_time' => $payload['endTime'],
            ':config_json' => $payload['configJson'],
        ]);
    }

    /**
     * Salva ou atualiza uma resposta vinculada ao simulado.
     *
     * @since 1.0.0
     */
    public function upsertSimulationAnswer(array $payload): void
    {
        $stmt = $this->db->prepare(
            "INSERT INTO user_answers
                (user_id, question_id, simulation_id, selected_option_index, is_correct, time_taken_seconds)
             VALUES
                (:user_id, :question_id, :simulation_id, :selected_option_index, :is_correct, :time_taken_seconds)
             ON DUPLICATE KEY UPDATE
                selected_option_index = VALUES(selected_option_index),
                is_correct = VALUES(is_correct),
                time_taken_seconds = VALUES(time_taken_seconds)"
        );

        $stmt->execute([
            ':user_id' => $payload['user_id'],
            ':question_id' => $payload['question_id'],
            ':simulation_id' => $payload['simulation_id'],
            ':selected_option_index' => $payload['selected_option_index'],
            ':is_correct' => $payload['is_correct'],
            ':time_taken_seconds' => $payload['time_taken_seconds'],
        ]);
    }

    /**
     * Remove respostas antigas de uma mesma sessao antes de salvar o snapshot final.
     *
     * @since 1.0.0
     */
    public function deleteSimulationAnswers(string $userId, string $simulationId): void
    {
        $stmt = $this->db->prepare(
            "DELETE FROM user_answers
             WHERE user_id = :user_id
               AND simulation_id = :simulation_id"
        );

        $stmt->execute([
            ':user_id' => $userId,
            ':simulation_id' => $simulationId,
        ]);
    }

    /**
     * Remove apenas respostas que não pertencem mais ao snapshot atual. Isso evita
     * uma janela sem dados quando o simulado é persistido novamente.
     *
     * @param array<int, string> $questionIds
     */
    public function deleteStaleSimulationAnswers(string $userId, string $simulationId, array $questionIds): void
    {
        if ($questionIds === []) {
            $this->deleteSimulationAnswers($userId, $simulationId);
            return;
        }

        $placeholders = [];
        $params = [':user_id' => $userId, ':simulation_id' => $simulationId];
        foreach (array_values($questionIds) as $index => $questionId) {
            $placeholder = ':question_id_' . $index;
            $placeholders[] = $placeholder;
            $params[$placeholder] = $questionId;
        }

        $stmt = $this->db->prepare(
            'DELETE FROM user_answers
             WHERE user_id = :user_id
               AND simulation_id = :simulation_id
               AND question_id NOT IN (' . implode(', ', $placeholders) . ')'
        );
        $stmt->execute($params);
    }

    /**
     * Lista sessoes de simulado do usuario autenticado.
     *
     * @since 1.0.0
     */
    public function listSimulationsByUserId(string $userId, int $limit = 50): array
    {
        $stmt = $this->db->prepare(
            "SELECT id, name, status, score, start_time, end_time, config_json
             FROM simulations
             WHERE user_id = :user_id
             ORDER BY COALESCE(end_time, start_time) DESC
             LIMIT :limit"
        );

        $stmt->bindValue(':user_id', $userId);
        $stmt->bindValue(':limit', max(1, min(100, $limit)), PDO::PARAM_INT);
        $stmt->execute();

        return $stmt->fetchAll(PDO::FETCH_ASSOC) ?: [];
    }

    /**
     * Lista respostas vinculadas a simulados do usuario, agrupadas pelo service.
     *
     * @since 1.0.0
     */
    public function listSimulationAnswersByUserId(string $userId): array
    {
        $stmt = $this->db->prepare(
            "SELECT simulation_id, question_id, selected_option_index, is_correct, time_taken_seconds
             FROM user_answers
             WHERE user_id = :user_id
               AND simulation_id IS NOT NULL
             ORDER BY created_at ASC"
        );

        $stmt->execute([':user_id' => $userId]);
        $rows = $stmt->fetchAll(PDO::FETCH_ASSOC) ?: [];
        $grouped = [];

        foreach ($rows as $row) {
            $simulationId = (string) ($row['simulation_id'] ?? '');
            if ($simulationId === '') {
                continue;
            }

            $grouped[$simulationId][] = $row;
        }

        return $grouped;
    }

    /**
     * Busca XP e nivel atualizados apos recompensas de simulado.
     *
     * @since 1.0.0
     */
    public function findUserProgressSnapshot(string $userId): ?array
    {
        $stmt = $this->db->prepare(
            "SELECT xp, level
             FROM users
             WHERE id = :user_id
             LIMIT 1"
        );
        $stmt->execute([':user_id' => $userId]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);

        return is_array($row) ? $row : null;
    }

    /**
     * Recompensa uma conclusao real de simulado uma unica vez por sessao.
     *
     * @since 1.0.0
     */
    public function applySimulationCompletedGamification(
        string $userId,
        string $simulationId,
        string $simulationName,
        int $answeredCount,
        int $correctCount
    ): array {
        require_once __DIR__ . '/../../../config/gamification_helper.php';

        $userId = trim($userId);
        $simulationId = trim($simulationId);
        if ($userId === '' || $simulationId === '' || $answeredCount <= 0) {
            return ['applied' => false, 'badge_awarded' => false, 'xp' => 0];
        }

        $volumeXp = min(40, max(0, $answeredCount));
        $accuracyXp = min(30, max(0, $correctCount) * 2);
        $totalXp = 15 + $volumeXp + $accuracyXp;

        $reward = grantGamificationEvent(
            $this->db,
            $userId,
            'simulation_completed',
            'simulation_completed:' . $userId . ':' . $simulationId,
            $totalXp,
            $answeredCount >= 10 ? 1 : 0,
            [
                'key' => 'first_completed_simulation',
                'title' => 'Primeiro simulado concluido',
                'description' => 'Voce concluiu seu primeiro simulado na plataforma.',
            ],
            [
                'simulation_id' => $simulationId,
                'simulation_name' => $simulationName,
                'answered_count' => $answeredCount,
                'correct_count' => $correctCount,
            ]
        );

        if (!empty($reward['badge_awarded'])) {
            createNotification(
                $this->db,
                $userId,
                'Badge desbloqueado',
                'Primeiro simulado concluido: treino de prova registrado.',
                'success',
                'system',
                '/profile?tab=achievements'
            );
        }

        if (!empty($reward['applied'])) {
            createNotification(
                $this->db,
                $userId,
                'Simulado concluido',
                'Seu simulado "' . trim($simulationName) . '" rendeu +' . $totalXp . ' XP.',
                'success',
                'system',
                '/simulation'
            );
        }

        return [
            'applied' => !empty($reward['applied']),
            'badge_awarded' => !empty($reward['badge_awarded']),
            'xp' => !empty($reward['applied']) ? $totalXp : 0,
        ];
    }
}

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
 * Persistencia do cronograma de estudos por usuario.
 *
 * @since 1.0.0
 */
class StudyScheduleRepository
{
    public function __construct(private readonly PDO $db)
    {
    }

    /**
     * Cria a tabela operacional caso o deploy ainda nao tenha aplicado migration.
     *
     * @since 1.0.0
     */
    public function ensureSchema(): void
    {
        $this->db->exec("
            CREATE TABLE IF NOT EXISTS user_study_schedules (
                user_id VARCHAR(36) PRIMARY KEY,
                form_json MEDIUMTEXT NOT NULL,
                plan_json MEDIUMTEXT NULL,
                generated_at DATETIME NULL,
                saved_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
                INDEX idx_user_study_schedules_saved_at (saved_at),
                CONSTRAINT fk_user_study_schedules_user
                    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
        ");
    }

    /**
     * Busca o snapshot salvo do usuario.
     *
     * @since 1.0.0
     */
    public function findByUserId(string $userId): ?array
    {
        $this->ensureSchema();

        $stmt = $this->db->prepare('
            SELECT user_id, form_json, plan_json, generated_at, saved_at, created_at, updated_at
            FROM user_study_schedules
            WHERE user_id = :user_id
            LIMIT 1
        ');
        $stmt->execute([':user_id' => $userId]);
        $row = $stmt->fetch(PDO::FETCH_ASSOC);

        return $row ? $this->mapRow($row) : null;
    }

    /**
     * Salva ou atualiza o cronograma do usuario.
     *
     * @since 1.0.0
     */
    public function upsert(string $userId, array $payload): array
    {
        $this->ensureSchema();

        $formJson = json_encode($payload['form'], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        $planJson = $payload['generated_plan'] !== null
            ? json_encode($payload['generated_plan'], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES)
            : null;

        if (!is_string($formJson) || ($payload['generated_plan'] !== null && !is_string($planJson))) {
            throw new RuntimeException('Nao foi possivel preparar o cronograma para salvamento.');
        }

        $stmt = $this->db->prepare('
            INSERT INTO user_study_schedules (user_id, form_json, plan_json, generated_at, saved_at)
            VALUES (:user_id, :form_json, :plan_json, :generated_at, UTC_TIMESTAMP())
            ON DUPLICATE KEY UPDATE
                form_json = VALUES(form_json),
                plan_json = VALUES(plan_json),
                generated_at = VALUES(generated_at),
                saved_at = UTC_TIMESTAMP(),
                updated_at = CURRENT_TIMESTAMP
        ');
        $stmt->execute([
            ':user_id' => $userId,
            ':form_json' => $formJson,
            ':plan_json' => $planJson,
            ':generated_at' => $payload['generated_at'],
        ]);

        return $this->findByUserId($userId) ?: [];
    }

    /**
     * Remove o cronograma salvo.
     *
     * @since 1.0.0
     */
    public function deleteByUserId(string $userId): void
    {
        $this->ensureSchema();

        $stmt = $this->db->prepare('DELETE FROM user_study_schedules WHERE user_id = :user_id');
        $stmt->execute([':user_id' => $userId]);
    }

    /**
     * Resolve o maior plano atualmente associado ao usuario.
     *
     * @since 1.0.0
     */
    public function resolveUserPlanName(string $userId): string
    {
        $planName = 'Gratuito';

        if ($this->tableExists('users') && $this->columnExists('users', 'plan')) {
            $stmt = $this->db->prepare('SELECT plan FROM users WHERE id = :user_id LIMIT 1');
            $stmt->execute([':user_id' => $userId]);
            $userPlan = trim((string) $stmt->fetchColumn());
            if ($userPlan !== '') {
                $planName = $userPlan;
            }
        }

        if (!$this->tableExists('user_subscriptions') || !$this->tableExists('plans')) {
            return $planName;
        }

        $stmt = $this->db->prepare("
            SELECT COALESCE(p.name, us.plan_name, '') AS plan_name
            FROM user_subscriptions us
            LEFT JOIN plans p ON p.id = us.plan_id
            WHERE us.user_id = :user_id
              AND us.status IN ('active', 'trialing')
            ORDER BY us.id DESC
            LIMIT 1
        ");
        $stmt->execute([':user_id' => $userId]);
        $subscriptionPlan = trim((string) $stmt->fetchColumn());

        if ($subscriptionPlan !== '' && $this->planTier($subscriptionPlan) > $this->planTier($planName)) {
            return $subscriptionPlan;
        }

        return $planName;
    }

    /**
     * Verifica se o modulo esta ativo nas configuracoes.
     *
     * @since 1.0.0
     */
    public function isFeatureEnabled(): bool
    {
        if (!$this->tableExists('system_settings')) {
            return true;
        }

        $stmt = $this->db->prepare("SELECT value_json FROM system_settings WHERE key_name = 'features' LIMIT 1");
        $stmt->execute();
        $raw = $stmt->fetchColumn();
        if (!is_string($raw) || trim($raw) === '') {
            return true;
        }

        $decoded = json_decode($raw, true);
        if (!is_array($decoded) || !array_key_exists('studyScheduleEnabled', $decoded)) {
            return true;
        }

        return filter_var($decoded['studyScheduleEnabled'], FILTER_VALIDATE_BOOLEAN, FILTER_NULL_ON_FAILURE) ?? true;
    }

    private function mapRow(array $row): array
    {
        $form = json_decode((string) ($row['form_json'] ?? '{}'), true);
        $plan = null;
        $planJson = trim((string) ($row['plan_json'] ?? ''));
        if ($planJson !== '') {
            $decodedPlan = json_decode($planJson, true);
            $plan = is_array($decodedPlan) ? $decodedPlan : null;
        }

        return [
            'userId' => (string) ($row['user_id'] ?? ''),
            'form' => is_array($form) ? $form : [],
            'generatedPlan' => $plan,
            'generatedAt' => $row['generated_at'] ?? null,
            'savedAt' => $row['saved_at'] ?? null,
            'createdAt' => $row['created_at'] ?? null,
            'updatedAt' => $row['updated_at'] ?? null,
        ];
    }

    private function tableExists(string $table): bool
    {
        $stmt = $this->db->prepare('SHOW TABLES LIKE :table_name');
        $stmt->execute([':table_name' => $table]);
        return (bool) $stmt->fetchColumn();
    }

    private function columnExists(string $table, string $column): bool
    {
        $stmt = $this->db->prepare("SHOW COLUMNS FROM `$table` LIKE :column_name");
        $stmt->execute([':column_name' => $column]);
        return (bool) $stmt->fetch(PDO::FETCH_ASSOC);
    }

    private function planTier(string $planName): int
    {
        $normalized = strtolower($planName);

        if (str_contains($normalized, 'elite')) {
            return 4;
        }

        if (str_contains($normalized, 'pro')) {
            return 3;
        }

        if (str_contains($normalized, 'essencial')) {
            return 2;
        }

        return 1;
    }
}

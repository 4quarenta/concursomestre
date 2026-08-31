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
 * Repositorio das configuracoes sistemicas.
 * Concentra leitura/escrita do banco para settings e planos administrativos.
 */
class AdminSettingsRepository
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
     * Retorna todas as configuracoes salvas no system_settings.
     *
     * @since 1.0.0
     */
    public function fetchAllSystemSettings(): array
    {
        $rows = $this->db->query('SELECT key_name, value_json FROM system_settings')->fetchAll(PDO::FETCH_ASSOC) ?: [];
        $settings = [];

        foreach ($rows as $row) {
            $key = (string) ($row['key_name'] ?? '');
            if ($key === '') {
                continue;
            }

            $decoded = json_decode((string) ($row['value_json'] ?? ''), true);
            $settings[$key] = json_last_error() === JSON_ERROR_NONE ? $decoded : ($row['value_json'] ?? null);
        }

        return $settings;
    }

    /**
     * Salva ou atualiza uma configuracao simples no system_settings.
     *
     * @since 1.0.0
     */
    public function upsertSystemSetting(string $key, $value): void
    {
        if ($key === '' || is_numeric($key)) {
            return;
        }

        $valueJson = json_encode($value, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        $stmt = $this->db->prepare(
            "INSERT INTO system_settings (key_name, value_json)
             VALUES (:key_name, :value_json)
             ON DUPLICATE KEY UPDATE value_json = :value_json_update"
        );

        $stmt->execute([
            ':key_name' => $key,
            ':value_json' => $valueJson,
            ':value_json_update' => $valueJson,
        ]);
    }

    /**
     * Cria ou atualiza um plano comercial com seus beneficios.
     *
     * @since 1.0.0
     */
    public function upsertPlan(
        string $name,
        ?string $description,
        $price,
        string $intervalUnit,
        int $intervalCount,
        int $tier,
        string $featuresJson
    ): void {
        $stmt = $this->db->prepare(
            "INSERT INTO plans (name, description, price, interval_unit, interval_count, tier, features)
             VALUES (:name, :description, :price, :interval_unit, :interval_count, :tier, :features)
             ON DUPLICATE KEY UPDATE
                description = :description_update,
                price = :price_update,
                interval_unit = :interval_unit_update,
                interval_count = :interval_count_update,
                tier = :tier_update,
                features = :features_update"
        );

        $stmt->execute([
            ':name' => $name,
            ':description' => $description,
            ':price' => $price,
            ':interval_unit' => $intervalUnit,
            ':interval_count' => $intervalCount,
            ':tier' => $tier,
            ':features' => $featuresJson,
            ':description_update' => $description,
            ':price_update' => $price,
            ':interval_unit_update' => $intervalUnit,
            ':interval_count_update' => $intervalCount,
            ':tier_update' => $tier,
            ':features_update' => $featuresJson,
        ]);
    }

    /**
     * Desativa uma linha comercial insegura sem remove-la do historico.
     *
     * @since 1.0.0
     */
    public function deactivatePlanByName(string $name): void
    {
        $columns = $this->db->query('DESCRIBE plans')->fetchAll(PDO::FETCH_COLUMN) ?: [];
        $setParts = [];

        if (in_array('active', $columns, true)) {
            $setParts[] = 'active = 0';
        }

        if (in_array('is_active', $columns, true)) {
            $setParts[] = 'is_active = 0';
        }

        if ($setParts === []) {
            return;
        }

        $stmt = $this->db->prepare(
            "UPDATE plans
             SET " . implode(', ', $setParts) . "
             WHERE name = :name"
        );
        $stmt->execute([':name' => $name]);
    }
}

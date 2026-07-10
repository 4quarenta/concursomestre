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
 * Repositorio do ledger first-party de eventos de lifecycle.
 *
 * @since 1.0.0
 */
class AnalyticsTrackingRepository
{
    private bool $schemaEnsured = false;

    public function __construct(private readonly PDO $db)
    {
    }

    public function insertEvent(array $payload): void
    {
        $this->ensureSchema();

        $stmt = $this->db->prepare(
            "INSERT INTO analytics_lifecycle_events (
                event_name,
                source,
                user_id,
                email,
                session_key,
                plan_id,
                cycle_label,
                origin_url,
                referrer_url,
                utm_source,
                utm_medium,
                utm_campaign,
                metadata_json,
                external_hooks_json
            ) VALUES (
                :event_name,
                :source,
                :user_id,
                :email,
                :session_key,
                :plan_id,
                :cycle_label,
                :origin_url,
                :referrer_url,
                :utm_source,
                :utm_medium,
                :utm_campaign,
                :metadata_json,
                :external_hooks_json
            )"
        );

        $stmt->execute([
            ':event_name' => $payload['event_name'],
            ':source' => $payload['source'],
            ':user_id' => $payload['user_id'],
            ':email' => $payload['email'],
            ':session_key' => $payload['session_key'],
            ':plan_id' => $payload['plan_id'],
            ':cycle_label' => $payload['cycle_label'],
            ':origin_url' => $payload['origin_url'],
            ':referrer_url' => $payload['referrer_url'],
            ':utm_source' => $payload['utm_source'],
            ':utm_medium' => $payload['utm_medium'],
            ':utm_campaign' => $payload['utm_campaign'],
            ':metadata_json' => $payload['metadata_json'],
            ':external_hooks_json' => $payload['external_hooks_json'],
        ]);
    }

    public function ensureSchema(): void
    {
        if ($this->schemaEnsured) {
            return;
        }

        $this->db->exec(
            "CREATE TABLE IF NOT EXISTS analytics_lifecycle_events (
                id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
                event_name VARCHAR(60) NOT NULL,
                source VARCHAR(40) NULL,
                user_id VARCHAR(80) NULL,
                email VARCHAR(190) NULL,
                session_key VARCHAR(120) NULL,
                plan_id INT NULL,
                cycle_label VARCHAR(30) NULL,
                origin_url VARCHAR(255) NULL,
                referrer_url VARCHAR(255) NULL,
                utm_source VARCHAR(120) NULL,
                utm_medium VARCHAR(120) NULL,
                utm_campaign VARCHAR(180) NULL,
                metadata_json LONGTEXT NULL,
                external_hooks_json LONGTEXT NULL,
                created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
                INDEX idx_analytics_event_name (event_name, created_at),
                INDEX idx_analytics_event_email (email, created_at),
                INDEX idx_analytics_event_user (user_id, created_at),
                INDEX idx_analytics_event_session (session_key, created_at)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4"
        );

        $this->schemaEnsured = true;
    }
}

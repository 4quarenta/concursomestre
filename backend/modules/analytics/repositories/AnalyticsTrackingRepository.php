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

        SchemaReadiness::assertTablesAndColumns($this->db, 'analytics de lifecycle', [
            'analytics_lifecycle_events' => ['id', 'event_name', 'source', 'user_id', 'email', 'session_key', 'plan_id', 'cycle_label', 'origin_url', 'referrer_url', 'utm_source', 'utm_medium', 'utm_campaign', 'metadata_json', 'external_hooks_json', 'created_at'],
        ]);

        $this->schemaEnsured = true;
    }
}

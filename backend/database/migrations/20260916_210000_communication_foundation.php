<?php

declare(strict_types=1);

/**
 * Fundação aditiva para intents, deliveries, preferencias e auditoria de comunicação.
 * Não faz backfill nem substitui o histórico legado. Rollback: remover as quatro
 * tabelas após congelar produtores e preservar a evidência de migração.
 */
return static function (PDO $db): void {
    $db->exec("CREATE TABLE IF NOT EXISTS communication_intents (
        id VARCHAR(64) NOT NULL PRIMARY KEY,
        event_type VARCHAR(160) NOT NULL,
        idempotency_key VARCHAR(191) NOT NULL,
        delivery_class VARCHAR(24) NOT NULL,
        recipient_user_id VARCHAR(191) NULL,
        recipient_email VARCHAR(320) NULL,
        payload_json JSON NOT NULL,
        status VARCHAR(24) NOT NULL DEFAULT 'pending',
        available_at DATETIME NOT NULL,
        locked_at DATETIME NULL,
        locked_by VARCHAR(191) NULL,
        attempts INT NOT NULL DEFAULT 0,
        max_attempts INT NOT NULL DEFAULT 8,
        last_error TEXT NULL,
        actor_type VARCHAR(64) NULL,
        actor_id VARCHAR(191) NULL,
        entity_type VARCHAR(96) NULL,
        entity_id VARCHAR(191) NULL,
        created_at DATETIME NOT NULL,
        processed_at DATETIME NULL,
        UNIQUE KEY uq_communication_intent_idempotency (idempotency_key),
        INDEX idx_communication_intent_claim (status, available_at, id),
        INDEX idx_communication_intent_recipient (recipient_user_id, created_at),
        INDEX idx_communication_intent_entity (entity_type, entity_id, created_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");

    $db->exec("CREATE TABLE IF NOT EXISTS communication_deliveries (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
        intent_id VARCHAR(64) NOT NULL,
        channel VARCHAR(24) NOT NULL,
        status VARCHAR(24) NOT NULL DEFAULT 'pending',
        attempts INT NOT NULL DEFAULT 0,
        provider_message_id VARCHAR(191) NULL,
        last_error TEXT NULL,
        created_at DATETIME NOT NULL,
        delivered_at DATETIME NULL,
        UNIQUE KEY uq_communication_delivery_channel (intent_id, channel),
        INDEX idx_communication_delivery_status (status, created_at)
        /* Intent ownership is validated by CommunicationRepository/Service;
           the migration principal intentionally has no REFERENCES grant. */
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");

    $db->exec("CREATE TABLE IF NOT EXISTS communication_preferences (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
        user_id VARCHAR(191) NOT NULL,
        delivery_class VARCHAR(24) NOT NULL,
        channel VARCHAR(24) NOT NULL,
        enabled TINYINT(1) NOT NULL DEFAULT 1,
        updated_by VARCHAR(191) NULL,
        created_at DATETIME NOT NULL,
        updated_at DATETIME NOT NULL,
        UNIQUE KEY uq_communication_preference (user_id, delivery_class, channel),
        INDEX idx_communication_preference_user (user_id, updated_at)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");

    $db->exec("CREATE TABLE IF NOT EXISTS communication_audit_events (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
        intent_id VARCHAR(64) NOT NULL,
        event_name VARCHAR(160) NOT NULL,
        result VARCHAR(32) NOT NULL,
        metadata_json JSON NOT NULL,
        created_at DATETIME NOT NULL,
        INDEX idx_communication_audit_intent (intent_id, created_at),
        INDEX idx_communication_audit_event (event_name, created_at)
        /* Intent ownership is validated by CommunicationRepository/Service;
           deletion is restricted to controlled retention/cleanup paths. */
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci");
};

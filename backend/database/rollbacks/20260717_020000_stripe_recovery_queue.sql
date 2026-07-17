-- Pare primeiro o worker Stripe e a reconciliacao de assinaturas.
DROP INDEX idx_transactions_collection_retry ON transactions;
ALTER TABLE transactions
    DROP COLUMN collection_retry_last_error,
    DROP COLUMN collection_retry_last_at,
    DROP COLUMN collection_retry_next_at,
    DROP COLUMN collection_retry_count;

DROP INDEX idx_provider_webhook_claim ON provider_webhook_events;
DROP INDEX idx_provider_webhook_queue ON provider_webhook_events;
ALTER TABLE provider_webhook_events
    DROP COLUMN last_error_code,
    DROP COLUMN dead_lettered_at,
    DROP COLUMN next_retry_at,
    DROP COLUMN delivery_count,
    DROP COLUMN last_received_at,
    DROP COLUMN first_received_at,
    DROP COLUMN claim_token,
    DROP COLUMN queued_at,
    DROP COLUMN signature_verified_at,
    DROP COLUMN payload_json;

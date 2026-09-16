-- Execute only after communication producers and the worker are stopped.
-- Preserve migration/audit evidence before using this rollback.
DROP TABLE IF EXISTS communication_audit_events;
DROP TABLE IF EXISTS communication_deliveries;
DROP TABLE IF EXISTS communication_preferences;
DROP TABLE IF EXISTS communication_intents;

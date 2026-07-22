-- O rollback estrutural nao recria taxonomias duplicadas consolidadas.
-- Restaure o backup pre-migration se for necessario desfazer o merge de IDs.
DROP INDEX uq_filters_type_acronym ON filters;
ALTER TABLE filters DROP COLUMN acronym;

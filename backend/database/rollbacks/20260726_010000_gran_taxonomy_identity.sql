-- Execute apenas se nenhum item importado depender da identidade externa Gran.
DROP INDEX uq_filters_source_identity ON filters;
DROP INDEX idx_filters_source_parent ON filters;
ALTER TABLE filters
    DROP COLUMN source_provider,
    DROP COLUMN source_entity_type,
    DROP COLUMN source_external_id,
    DROP COLUMN source_parent_external_id,
    DROP COLUMN source_root_external_id;

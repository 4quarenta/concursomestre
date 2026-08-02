DROP TABLE IF EXISTS filter_relationships;

ALTER TABLE filter_source_identities
    DROP COLUMN source_metadata_json;

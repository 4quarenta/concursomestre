DROP TABLE IF EXISTS material_aliases;
DROP INDEX idx_materials_updated ON materials;
DROP INDEX idx_materials_marketplace ON materials;
DROP INDEX idx_materials_public ON materials;
DROP INDEX uq_materials_slug ON materials;
ALTER TABLE materials
    DROP COLUMN updated_at,
    DROP COLUMN archived_at,
    DROP COLUMN published_at,
    DROP COLUMN scheduled_at,
    DROP COLUMN preview_is_public,
    DROP COLUMN cover_is_public,
    DROP COLUMN public_author_name,
    DROP COLUMN is_free,
    DROP COLUMN currency,
    DROP COLUMN availability_status,
    DROP COLUMN rights_status,
    DROP COLUMN visibility_status,
    DROP COLUMN publication_status,
    DROP COLUMN slug;

DROP INDEX idx_blog_tags_kind_name ON blog_tags;

ALTER TABLE blog_tags
    DROP COLUMN updated_at,
    DROP COLUMN created_by,
    DROP COLUMN seo_description,
    DROP COLUMN seo_title,
    DROP COLUMN image_url,
    DROP COLUMN description,
    DROP COLUMN kind;

DROP TABLE IF EXISTS blog_article_likes;
DROP TABLE IF EXISTS blog_article_tags;
DROP TABLE IF EXISTS blog_articles;
DROP TABLE IF EXISTS blog_tags;
DROP TABLE IF EXISTS blog_categories;

DROP INDEX idx_comments_target_moderation_created ON comments;

-- A conversao de comments.target_type para ENUM nao e automatizada porque
-- outros dominios podem ter sido adicionados depois desta migration.

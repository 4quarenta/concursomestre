-- Rollback manual da migration 20260722_020000_platform_scale_readiness.
-- Execute apenas depois de interromper os workers de ingestao.

DROP INDEX idx_analytics_lifecycle_keyset ON analytics_lifecycle_events;
DROP INDEX idx_admin_audit_keyset ON admin_audit_logs;
DROP INDEX idx_materials_public_keyset ON materials;
DROP INDEX idx_reports_target_status ON reports;
DROP INDEX idx_reports_moderation_queue ON reports;
DROP INDEX idx_reports_admin_keyset ON reports;
DROP INDEX idx_transactions_user_keyset ON transactions;
DROP INDEX idx_transactions_material_sales ON transactions;
DROP INDEX idx_comment_likes_comment_user ON comment_likes;
DROP INDEX idx_saved_questions_user_keyset ON user_saved_questions;
DROP INDEX idx_study_sessions_user_latest ON study_sessions;
DROP INDEX idx_simulations_user_latest ON simulations;
DROP INDEX idx_user_answers_simulation_batch ON user_answers;
DROP INDEX idx_legal_favorites_user_keyset ON legal_user_favorites;
DROP INDEX idx_legal_comments_user_keyset ON legal_user_comments;
DROP INDEX idx_legal_comments_article_keyset ON legal_user_comments;
DROP INDEX idx_legal_reactions_target_value ON legal_content_reactions;
DROP INDEX idx_notifications_unread_count ON notifications;
DROP INDEX idx_notifications_visible_keyset ON notifications;
DROP INDEX idx_comments_target_public_keyset ON comments;
DROP INDEX idx_comments_type_target_public_keyset ON comments;
DROP INDEX idx_private_ingestion_jobs_stale ON private_ingestion_jobs;
DROP INDEX idx_private_ingestion_jobs_available ON private_ingestion_jobs;

ALTER TABLE private_ingestion_jobs
    DROP COLUMN dead_lettered_at,
    DROP COLUMN last_error_at,
    DROP COLUMN locked_by,
    DROP COLUMN available_at;

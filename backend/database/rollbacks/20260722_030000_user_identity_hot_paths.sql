-- Rollback estrutural da migration 20260722_030000_user_identity_hot_paths.
-- O backup pre-migration continua sendo o rollback autoritativo dos registros
-- efemeros orfaos removidos de auth_sessions/email_verifications.

ALTER TABLE legal_user_reader_annotations DROP FOREIGN KEY fk_legal_reader_annotations_user_scale;
ALTER TABLE legal_user_progress DROP FOREIGN KEY fk_legal_user_progress_user_scale;
ALTER TABLE legal_user_notes DROP FOREIGN KEY fk_legal_user_notes_user_scale;
ALTER TABLE legal_user_favorites DROP FOREIGN KEY fk_legal_user_favorites_user_scale;
ALTER TABLE legal_user_comments DROP FOREIGN KEY fk_legal_user_comments_user_scale;
ALTER TABLE legal_content_reactions DROP FOREIGN KEY fk_legal_content_reactions_user_scale;
ALTER TABLE legal_comment_reports DROP FOREIGN KEY fk_legal_comment_reports_user_scale;
ALTER TABLE analytics_lifecycle_events DROP FOREIGN KEY fk_analytics_lifecycle_user_scale;
ALTER TABLE material_ratings DROP FOREIGN KEY fk_material_ratings_user_scale;
ALTER TABLE user_highlights DROP FOREIGN KEY fk_user_highlights_user_scale;
ALTER TABLE user_bookmarks DROP FOREIGN KEY fk_user_bookmarks_user_scale;
ALTER TABLE email_verifications DROP FOREIGN KEY fk_email_verifications_user_scale;
ALTER TABLE auth_sessions DROP FOREIGN KEY fk_auth_sessions_user_scale;

ALTER TABLE legal_user_reader_annotations MODIFY user_id VARCHAR(80) COLLATE utf8mb4_0900_ai_ci NOT NULL;
ALTER TABLE legal_user_progress MODIFY user_id VARCHAR(80) COLLATE utf8mb4_0900_ai_ci NOT NULL;
ALTER TABLE legal_user_notes MODIFY user_id VARCHAR(80) COLLATE utf8mb4_0900_ai_ci NOT NULL;
ALTER TABLE legal_user_favorites MODIFY user_id VARCHAR(80) COLLATE utf8mb4_0900_ai_ci NOT NULL;
ALTER TABLE legal_user_comments MODIFY user_id VARCHAR(80) COLLATE utf8mb4_0900_ai_ci NOT NULL;
ALTER TABLE legal_content_reactions MODIFY user_id VARCHAR(80) COLLATE utf8mb4_0900_ai_ci NOT NULL;
ALTER TABLE legal_comment_reports MODIFY user_id VARCHAR(80) COLLATE utf8mb4_0900_ai_ci NOT NULL;
ALTER TABLE analytics_lifecycle_events MODIFY user_id VARCHAR(80) COLLATE utf8mb4_0900_ai_ci NULL DEFAULT NULL;
ALTER TABLE questions_groups MODIFY created_by_user_id VARCHAR(64) COLLATE utf8mb4_0900_ai_ci NULL DEFAULT NULL,
    MODIFY updated_by_user_id VARCHAR(64) COLLATE utf8mb4_0900_ai_ci NULL DEFAULT NULL;
ALTER TABLE material_ratings MODIFY user_id VARCHAR(64) COLLATE utf8mb4_0900_ai_ci NOT NULL;
ALTER TABLE laws MODIFY created_by_user_id VARCHAR(64) COLLATE utf8mb4_0900_ai_ci NULL DEFAULT NULL,
    MODIFY updated_by_user_id VARCHAR(64) COLLATE utf8mb4_0900_ai_ci NULL DEFAULT NULL,
    MODIFY published_by_user_id VARCHAR(64) COLLATE utf8mb4_0900_ai_ci NULL DEFAULT NULL;
ALTER TABLE auth_sessions MODIFY user_id VARCHAR(64) COLLATE utf8mb4_0900_ai_ci NOT NULL;
ALTER TABLE admin_audit_logs MODIFY admin_user_id VARCHAR(64) COLLATE utf8mb4_0900_ai_ci NOT NULL;
ALTER TABLE user_highlights MODIFY user_id VARCHAR(36) COLLATE utf8mb4_0900_ai_ci NOT NULL;
ALTER TABLE user_bookmarks MODIFY user_id VARCHAR(36) COLLATE utf8mb4_0900_ai_ci NOT NULL;
ALTER TABLE email_verifications MODIFY user_id VARCHAR(36) COLLATE utf8mb4_0900_ai_ci NOT NULL;

UPDATE transactions
SET user_id = legacy_user_reference
WHERE user_id IS NULL AND legacy_user_reference IS NOT NULL;
ALTER TABLE transactions DROP COLUMN legacy_user_reference;

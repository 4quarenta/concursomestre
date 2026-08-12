-- Execute somente se a biblioteca de novidades criada por esta migration puder ser removida.
ALTER TABLE user_feedback DROP INDEX idx_feedback_suggestion_workflow;
ALTER TABLE user_feedback
    DROP COLUMN suggestion_reviewed_by,
    DROP COLUMN suggestion_reviewed_at,
    DROP COLUMN suggestion_changelog_id,
    DROP COLUMN suggestion_admin_note,
    DROP COLUMN suggestion_status;
DROP TABLE IF EXISTS changelogs;

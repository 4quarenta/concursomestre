-- Execute somente depois de desligar:
-- QUESTIONS_SCALE_COLUMNS_READY e QUESTIONS_SEARCH_DOCUMENTS_READY.
DROP TABLE IF EXISTS question_answer_idempotency;
DROP TABLE IF EXISTS question_search_documents;
DROP TABLE IF EXISTS filter_aliases;
ALTER TABLE filters
    DROP COLUMN keywords_json,
    DROP COLUMN icon_key,
    DROP COLUMN asset_url;
DROP TABLE IF EXISTS filter_types;

ALTER TABLE user_answers DROP FOREIGN KEY fk_user_answers_selected_option;
DROP INDEX idx_user_answers_selected_option ON user_answers;
DROP INDEX idx_user_answers_user_question_latest ON user_answers;
ALTER TABLE user_answers DROP COLUMN selected_option_id;

DROP INDEX idx_question_filters_filter_question ON question_filters;
DROP INDEX idx_filters_type_name_id ON filters;
DROP INDEX idx_questions_public_keyset_v2 ON questions;
ALTER TABLE questions
    DROP COLUMN has_detailed_comment,
    DROP COLUMN has_teacher_comment,
    DROP COLUMN has_image,
    DROP COLUMN published_sort_at;

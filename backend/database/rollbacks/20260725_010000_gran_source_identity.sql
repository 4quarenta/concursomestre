-- Execute somente depois de confirmar que nenhum codigo usa a identidade externa.
DROP INDEX uq_questions_source_identity ON questions;
DROP INDEX uq_provas_source_identity ON provas;
DROP INDEX uq_question_groups_source_identity ON questions_groups;
DROP INDEX uq_question_contexts_source_identity ON question_contexts;

ALTER TABLE questions DROP COLUMN source_provider, DROP COLUMN source_external_id;
ALTER TABLE provas DROP COLUMN source_provider, DROP COLUMN source_external_id;
ALTER TABLE questions_groups DROP COLUMN source_provider, DROP COLUMN source_external_id;
ALTER TABLE question_contexts DROP COLUMN source_provider, DROP COLUMN source_external_id;

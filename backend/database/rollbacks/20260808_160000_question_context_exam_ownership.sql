ALTER TABLE question_contexts DROP FOREIGN KEY fk_question_contexts_prova;
ALTER TABLE questions_groups DROP FOREIGN KEY fk_question_groups_prova;
ALTER TABLE question_contexts DROP INDEX idx_question_contexts_prova;
ALTER TABLE questions_groups DROP INDEX idx_questions_groups_prova;
ALTER TABLE question_contexts DROP COLUMN prova_id;
ALTER TABLE questions_groups DROP COLUMN prova_id;

-- Execute somente com os workers e o arquivador interrompidos.
-- Antes de remover o archive, restaure seus registros na tabela quente.

DROP INDEX idx_laws_admin_keyset ON laws;
DROP INDEX idx_provas_admin_keyset ON provas;
DROP INDEX idx_user_answers_archive_candidates ON user_answers;

DROP TABLE user_answers_archive;
DROP TABLE user_answer_counters;
DROP TABLE platform_event_outbox;

-- user_streaks, user_badges e user_gamification_events nao sao removidas:
-- podem preexistir a esta migration e conter historico de negocio. Reverter
-- essas tabelas exige restauracao de backup validado, nunca DROP automatico.

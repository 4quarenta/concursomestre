-- Performance Optimization: Add Database Indexes
-- This will significantly improve query performance for large datasets

-- Questions table indexes
CREATE INDEX IF NOT EXISTS idx_questions_difficulty ON questions(dificuldade);
CREATE INDEX IF NOT EXISTS idx_questions_tipo ON questions(tipo);
CREATE INDEX IF NOT EXISTS idx_questions_anulada ON questions(anulada);

-- Comments table indexes  
CREATE INDEX IF NOT EXISTS idx_comments_target ON comments(target_id, target_type);
CREATE INDEX IF NOT EXISTS idx_comments_user ON comments(user_id);
CREATE INDEX IF NOT EXISTS idx_comments_parent ON comments(parent_id);
CREATE INDEX IF NOT EXISTS idx_comments_created ON comments(created_at DESC);

-- Notifications table indexes
CREATE INDEX IF NOT EXISTS idx_notifications_user_read ON notifications(user_id, is_read);
CREATE INDEX IF NOT EXISTS idx_notifications_created ON notifications(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_category ON notifications(category);

-- User answers table indexes
CREATE INDEX IF NOT EXISTS idx_user_answers_user ON user_answers(user_id);
CREATE INDEX IF NOT EXISTS idx_user_answers_question ON user_answers(question_id);
CREATE INDEX IF NOT EXISTS idx_user_answers_user_question ON user_answers(user_id, question_id);

-- Question stats indexes
CREATE INDEX IF NOT EXISTS idx_question_stats_question ON question_stats(question_id);

-- Rankings indexes (if table exists)
CREATE INDEX IF NOT EXISTS idx_rankings_user ON rankings(user_id);
CREATE INDEX IF NOT EXISTS idx_rankings_score ON rankings(score DESC);
CREATE INDEX IF NOT EXISTS idx_rankings_created ON rankings(created_at DESC);

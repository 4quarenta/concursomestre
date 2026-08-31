-- Database Optimization Script
-- Run this to add indexes for better performance

-- Questions table indexes
ALTER TABLE questions ADD INDEX IF NOT EXISTS idx_subject (subject);
ALTER TABLE questions ADD INDEX IF NOT EXISTS idx_difficulty (difficulty);
ALTER TABLE questions ADD INDEX IF NOT EXISTS idx_created_at (created_at);
ALTER TABLE questions ADD INDEX IF NOT EXISTS idx_subject_difficulty (subject, difficulty);

-- User answers indexes
ALTER TABLE user_answers ADD INDEX IF NOT EXISTS idx_user_question (user_id, question_id);
ALTER TABLE user_answers ADD INDEX IF NOT EXISTS idx_user_id (user_id);
ALTER TABLE user_answers ADD INDEX IF NOT EXISTS idx_question_id (question_id);
ALTER TABLE user_answers ADD INDEX IF NOT EXISTS idx_created_at (created_at);

-- Comments indexes
ALTER TABLE comments ADD INDEX IF NOT EXISTS idx_question_id (question_id);
ALTER TABLE comments ADD INDEX IF NOT EXISTS idx_user_id (user_id);
ALTER TABLE comments ADD INDEX IF NOT EXISTS idx_parent_id (parent_id);
ALTER TABLE comments ADD INDEX IF NOT EXISTS idx_created_at (created_at);

-- Notifications indexes
ALTER TABLE notifications ADD INDEX IF NOT EXISTS idx_user_id (user_id);
ALTER TABLE notifications ADD INDEX IF NOT EXISTS idx_user_read (user_id, is_read);
ALTER TABLE notifications ADD INDEX IF NOT EXISTS idx_created_at (created_at);

-- Rankings indexes  
ALTER TABLE rankings ADD INDEX IF NOT EXISTS idx_user_id (user_id);
ALTER TABLE rankings ADD INDEX IF NOT EXISTS idx_score (score);
ALTER TABLE rankings ADD INDEX IF NOT EXISTS idx_created_at (created_at);

-- Materials indexes
ALTER TABLE materials ADD INDEX IF NOT EXISTS idx_subject (subject);
ALTER TABLE materials ADD INDEX IF NOT EXISTS idx_created_at (created_at);

-- Transactions indexes
ALTER TABLE transactions ADD INDEX IF NOT EXISTS idx_user_id (user_id);
ALTER TABLE transactions ADD INDEX IF NOT EXISTS idx_created_at (created_at);

-- Optimize tables
OPTIMIZE TABLE questions;
OPTIMIZE TABLE user_answers;
OPTIMIZE TABLE comments;
OPTIMIZE TABLE notifications;
OPTIMIZE TABLE rankings;
OPTIMIZE TABLE materials;
OPTIMIZE TABLE transactions;

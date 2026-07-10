-- Depoimentos aprovados para a home publica
ALTER TABLE user_feedback
    MODIFY COLUMN type ENUM('cancellation', 'support', 'report', 'suggestion', 'bug', 'other') DEFAULT 'support';

ALTER TABLE user_feedback ADD COLUMN IF NOT EXISTS public_rating TINYINT NULL AFTER status;
ALTER TABLE user_feedback ADD COLUMN IF NOT EXISTS public_display_name VARCHAR(120) NULL AFTER public_rating;
ALTER TABLE user_feedback ADD COLUMN IF NOT EXISTS public_headline VARCHAR(180) NULL AFTER public_display_name;
ALTER TABLE user_feedback ADD COLUMN IF NOT EXISTS public_photo_url VARCHAR(500) NULL AFTER public_headline;
ALTER TABLE user_feedback ADD COLUMN IF NOT EXISTS home_published_at DATETIME NULL AFTER public_photo_url;

CREATE INDEX IF NOT EXISTS idx_feedback_home_testimonials
    ON user_feedback (status, home_published_at, created_at);

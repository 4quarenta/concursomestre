ALTER TABLE questions
  ADD COLUMN IF NOT EXISTS publish_status ENUM('published', 'draft', 'scheduled') NOT NULL DEFAULT 'published' AFTER desatualizada,
  ADD COLUMN IF NOT EXISTS visibility_status ENUM('public', 'elite', 'internal') NOT NULL DEFAULT 'public' AFTER publish_status,
  ADD COLUMN IF NOT EXISTS scheduled_at DATETIME NULL AFTER visibility_status,
  ADD COLUMN IF NOT EXISTS published_at DATETIME NULL AFTER scheduled_at;

UPDATE questions
SET published_at = created_at
WHERE published_at IS NULL;

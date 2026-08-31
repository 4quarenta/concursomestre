ALTER TABLE questions
  ADD COLUMN IF NOT EXISTS reference_text TEXT NULL AFTER intro_text;

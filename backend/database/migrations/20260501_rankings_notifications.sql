ALTER TABLE rankings
    ADD COLUMN IF NOT EXISTS created_by_user_id VARCHAR(64) NULL AFTER status;


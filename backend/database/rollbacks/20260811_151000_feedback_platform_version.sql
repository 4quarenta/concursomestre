-- Remove apenas o snapshot editorial introduzido por esta migration.
ALTER TABLE user_feedback DROP COLUMN platform_version;

-- Final cleanup for user_notes
SET FOREIGN_KEY_CHECKS=0;

-- Drop foreign key just to be safe when messing with indexes
ALTER TABLE `user_notes` DROP FOREIGN KEY `user_notes_ibfk_1`;

-- Drop the old unique index
-- Note: The index name in the dump was 'user_id', checking if it exists
DROP INDEX `user_id` ON `user_notes`;

-- Add the new unique index including type
ALTER TABLE `user_notes` ADD UNIQUE KEY `user_item_unique` (`user_id`, `item_id`, `type`);

-- Add index for item_id if not exists
-- ALTER TABLE `user_notes` ADD INDEX `item_id` (`item_id`);
-- Check if exists first? simple ADD INDEX is fine, duplicates are allowed but wasteful.
-- The dump showed no index on item_id alone.
ALTER TABLE `user_notes` ADD INDEX `idx_item_id` (`item_id`);

-- Restore FK for user_id
ALTER TABLE `user_notes` ADD CONSTRAINT `user_notes_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE;

-- Drop redundant table
DROP TABLE IF EXISTS `user_material_notes`;

SET FOREIGN_KEY_CHECKS=1;

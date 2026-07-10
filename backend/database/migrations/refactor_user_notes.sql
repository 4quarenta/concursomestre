-- Refactoring user_notes to be generic
-- 1. Drop the foreign keys
ALTER TABLE `user_notes` DROP FOREIGN KEY `user_notes_ibfk_2`;
ALTER TABLE `user_notes` DROP FOREIGN KEY `user_notes_ibfk_1`;

-- 2. Rename question_id to item_id
ALTER TABLE `user_notes` CHANGE `question_id` `item_id` INT(11) NOT NULL;

-- 3. Add type column
ALTER TABLE `user_notes` ADD COLUMN `type` ENUM('question', 'material') NOT NULL DEFAULT 'question' AFTER `item_id`;

-- 4. Re-create the unique index
ALTER TABLE `user_notes` DROP INDEX `user_id`;
ALTER TABLE `user_notes` ADD UNIQUE KEY `user_item_unique` (`user_id`, `item_id`, `type`);

-- 5. Add index for item_id for performance
ALTER TABLE `user_notes` ADD INDEX `item_id` (`item_id`);

-- 6. Restore FK for user_id
ALTER TABLE `user_notes` ADD CONSTRAINT `user_notes_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE;

-- Drop user_material_notes if it exists (cleanup)
DROP TABLE IF EXISTS `user_material_notes`;

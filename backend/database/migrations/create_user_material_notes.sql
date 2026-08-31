SET FOREIGN_KEY_CHECKS=0;

DROP TABLE IF EXISTS `user_material_notes`;

CREATE TABLE `user_material_notes` (
  `id` varchar(36) NOT NULL,
  `user_id` varchar(36) NOT NULL,
  `material_id` int(11) NOT NULL,
  `note_text` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NOT NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `user_material_unique` (`user_id`, `material_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

SET FOREIGN_KEY_CHECKS=1;

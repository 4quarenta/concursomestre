-- Ajusta tabelas legadas do leitor de PDF para o modelo atual de IDs string.
-- Isso evita perda silenciosa de marcadores/destaques quando users/materials usam VARCHAR.

ALTER TABLE `user_bookmarks`
  MODIFY `user_id` VARCHAR(36) NOT NULL,
  MODIFY `material_id` VARCHAR(36) NOT NULL;

ALTER TABLE `user_highlights`
  MODIFY `user_id` VARCHAR(36) NOT NULL,
  MODIFY `material_id` VARCHAR(36) NOT NULL;

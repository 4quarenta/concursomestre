-- Adicionar coluna tier (nível hierárquico) à tabela plans
ALTER TABLE plans ADD COLUMN IF NOT EXISTS tier INT DEFAULT 1;

-- Atualizar tiers baseado no nome do plano
UPDATE plans SET tier = 1 WHERE LOWER(name) LIKE '%gratuito%' OR LOWER(name) LIKE '%free%';
UPDATE plans SET tier = 2 WHERE LOWER(name) LIKE '%essencial%' OR LOWER(name) LIKE '%basic%';
UPDATE plans SET tier = 3 WHERE LOWER(name) LIKE '%pro%';
UPDATE plans SET tier = 4 WHERE LOWER(name) LIKE '%elite%' OR LOWER(name) LIKE '%premium%';

-- Verificar dados atualizados
SELECT id, name, tier, price FROM plans ORDER BY tier, interval_unit;

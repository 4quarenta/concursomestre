-- Rollback parcial e deliberadamente manual.
-- A reducao do enum pode falhar se houver registros pending/approved/rejected.
-- Faca backup e normalize esses estados antes de executar.
ALTER TABLE rankings
    MODIFY COLUMN status ENUM('active', 'archived', 'draft') DEFAULT 'active';

ALTER TABLE ranking_entries
    MODIFY COLUMN score DECIMAL(5,2) NULL DEFAULT NULL;

-- As colunas adicionadas nao sao removidas automaticamente para evitar perda
-- de configuracoes, gabaritos, vagas e dados de participacao.

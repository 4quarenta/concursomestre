-- Rollback destrutivo e deliberadamente manual.
-- Antes de executar, exporte os dados OAuth/telefone e desligue os fluxos de
-- login social e perfil. Nao execute em producao apenas para trocar a release.
ALTER TABLE users
    DROP COLUMN apple_sub,
    DROP COLUMN facebook_id,
    DROP COLUMN google_sub,
    DROP COLUMN auth_provider,
    DROP COLUMN phone;

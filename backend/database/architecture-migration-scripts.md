# Arquitetura de migracoes de schema

## Regra

Scripts PHP de alteracao de schema, bootstrap de tabela e seed historica nao devem viver em `api/` nem ficar publicados livremente em `scripts/migrations`.

## Local oficial

- Migracoes SQL versionadas: `database/migrations/`.
- Migracao PHP operacional allowlisted: `scripts/migrations/migrate_marketplace_schema_compatibility.php`.

## Excecao atual

`migrate_marketplace_schema_compatibility.php` permanece porque ainda normaliza schema do marketplace/gamificacao em bancos antigos e e coberto por testes dedicados. Ele deve rodar apenas via CLI.

## Arquivo privado

Migracoes PHP legadas foram arquivadas fora de `htdocs` em:

- `C:\xampp\private-backups\questao-pro-backend\dev-scripts-archive\2026-05-18\scripts\migrations-legacy`

Qualquer nova alteracao estrutural deve nascer como SQL versionado em `database/migrations/` ou como tarefa CLI revisada, com teste e allowlist explicito.

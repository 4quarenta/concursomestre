# Arquitetura de migracoes de schema

## Regra

Scripts PHP de alteracao de schema, bootstrap de tabela e seed historica nao devem viver em `api/` nem ficar publicados livremente em `scripts/migrations`.

## Local oficial

- Migracoes SQL versionadas: `database/migrations/`.
- Migrations PHP versionadas, quando SQL puro nao for suficiente: `database/migrations/`.
- Runner exclusivo de CLI: `scripts/migrations/run_schema_migrations.php`.
- Diagnosticos somente leitura: `scripts/diagnostics/`.
- Backfills observaveis e com dry run: `scripts/backfills/`.

## Execucao controlada

1. Execute `php backend/scripts/migrations/run_schema_migrations.php --status`.
2. Revise o diagnostico de schema e o dump de backup.
3. Em banco legado, registre apenas o baseline com `MIGRATIONS_ALLOW_APPLY=true` e `--baseline-legacy`.
4. Rode `--dry-run` e aplique migrations novas com `MIGRATIONS_ALLOW_APPLY=true --apply`.
5. Em producao, a execucao tambem exige `MIGRATIONS_ALLOW_PRODUCTION=true`.

Nenhum endpoint HTTP, construtor de repository ou servico de dominio deve executar DDL. Caso o schema esteja ausente, a camada de dominio deve falhar com orientacao para o runner CLI.

## Excecao atual

`migrate_marketplace_schema_compatibility.php` permanece porque ainda normaliza schema do marketplace/gamificacao em bancos antigos e e coberto por testes dedicados. Ele deve rodar apenas via CLI.

## Arquivo privado

Migracoes PHP legadas foram arquivadas fora de `htdocs` em:

- `C:\xampp\private-backups\questao-pro-backend\dev-scripts-archive\2026-05-18\scripts\migrations-legacy`

Qualquer nova alteracao estrutural deve nascer como migration versionada em `database/migrations/` ou como tarefa CLI revisada, com teste e allowlist explicito. Nunca execute migrations em request HTTP.

# API Root Cleanup

## Objetivo

Reduzir a raiz de `api/` para runtime real e bridges HTTP, removendo scripts auxiliares, seeds e utilitarios de debug que nao pertencem a endpoints publicos.

## Reclassificacao desta rodada

### Movidos de `api/` para `scripts/checks/`

- `check_dupes.php` -> `check_duplicate_filters.php`
- `check_filters_schema.php`
- `check_materia_meta.php` -> `check_subject_meta.php`
- `check_questions_schema.php`
- `check_schema_v2.php` -> `check_questions_relations_schema.php`
- `check_structure_file.php` -> `export_system_settings_structure.php`
- `check_subs_db.php` -> `check_subscriptions_db.php`
- `check_table.php` -> `check_system_settings_schema.php`
- `debug_db.php` -> `inspect_system_settings_db.php`
- `debug_db_structure.php` -> `inspect_materials_reports_schema.php`
- `debug_materials_schema.php` -> `show_materials_schema.php`
- `debug_material_notes_schema.php` -> `show_user_material_notes_schema.php`
- `debug_schema.php` -> `show_user_notes_schema.php`
- `describe_feedback.php` -> `describe_feedback_table.php`
- `list_tables.php`
- `show_create.php` -> `show_settings_and_cache_table_create.php`

### Movidos para `scripts/manual-tests/`

- `cli_test_save.php` -> `test_settings_save_cli.php`
- `debug_data.php` -> `debug_user_profile_snapshot.php`
- `direct_db_test.php` -> `test_system_settings_insert.php`
- `list_plans.php`
- `test_full_payload.php` -> `test_settings_full_payload.php`
- `test_route.php` -> `test_settings_route.php`

### Movidos para `scripts/migrations/`

- `migrate.php` -> `legacy_bootstrap_migrate.php`
- `restore_fk.php` -> `restore_user_notes_fk.php`
- `run_cleanup_migration.php`
- `run_migration_notes.php` -> `run_create_user_material_notes.php`
- `run_refactor_notes.php`

### Movidos para seed oficial

- `api/seed.php` -> `scripts/seeds/seed_database.php`
- `api/seed.sql` -> `database/seeds/seed.sql`

## Removidos

- `api/manual_fix.php`
- `api/table_structure.txt`

## Impacto arquitetural

- `api/` fica mais proximo do papel oficial: endpoints e bridges.
- Scripts operacionais saem do caminho do runtime HTTP.
- O backend deixa de expor seed e utilitarios de banco como se fossem API publica.

## Estado apos a limpeza

A raiz direta de `api/` ficou reduzida a:

- `.htaccess`
- `settings.php`
- `upload.php`

Os dois arquivos PHP restantes continuam existindo apenas por compatibilidade de rota:

- `settings.php` como bridge/entry point legado oficial de configuracoes
- `upload.php` como bridge fino do upload agora centralizado em `modules/materials`

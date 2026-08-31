# Architecture: Backend Root

## Estrutura operacional esperada na raiz
- `api/`
- `config/`
- `database/`
- `modules/`
- `scripts/`
- `shared/`
- `storage/`
- `tests/`
- `uploads/`
- `vendor/`
- `.htaccess`, `index.php`, `router.php`, `composer.json`, `composer.lock`, `.env`, `.env.example`

## Regras
- migracoes antigas ficam em `database/migrations/legacy`
- backups de codigo ficam fora de `htdocs`
- dumps de banco devem usar `BACKUP_DIR` fora da raiz publica
- artefatos de desenvolvimento, debug, instalacao ou testes manuais ficam fora de `htdocs`
- nada novo deve nascer diretamente na raiz fora da lista operacional oficial
- `scripts/debug`, `scripts/manual-tests`, `scripts/setup`, `scripts/maintenance`, `scripts/seed`, `scripts/seeds` e checks temporarios (`temp_*.php`, `debug_*.php`, `test_*.php`) sao bloqueados pelo preflight de producao
- `scripts/migrations` nao aceita novas migracoes PHP livres; apenas `migrate_marketplace_schema_compatibility.php` esta allowlisted, e qualquer outro PHP nessa pasta bloqueia o preflight
- `storage/backups/legacy-code` nao deve existir em `htdocs`; `LEGACY_CODE_BACKUPS_OUTSIDE_PUBLIC_ROOT` reprova o preflight se o arquivo historico voltar
- `BACKUP_DIR_OUTSIDE_PUBLIC_ROOT` reprova producao quando `BACKUP_DIR` nao existe, nao e gravavel ou aponta para dentro da raiz publica

## Arquivo privado de legado

Os scripts manuais/debug/setup/maintenance/seed e migracoes PHP legadas removidos da arvore publica foram preservados em:

- `C:\xampp\private-backups\questao-pro-backend\dev-scripts-archive\2026-05-18`

O arquivo historico `storage/backups/legacy-code` foi movido para:

- `C:\xampp\private-backups\questao-pro-backend\storage-archive\2026-05-20\legacy-code`

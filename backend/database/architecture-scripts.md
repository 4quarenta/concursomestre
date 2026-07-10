# Arquitetura de Scripts Operacionais

## Papel

`scripts/` concentra utilitarios operacionais, validacoes de banco, seed, migracoes manuais e testes auxiliares de CLI.

## Subareas

### `scripts/checks/`

Guarda scripts de inspecao e verificacao de schema, tabelas e consistencia.

### Testes manuais e debug

Testes manuais, scripts de debug e instaladores nao devem ficar dentro de `htdocs`.
O pacote legado removido da raiz publica foi preservado em:

- `C:\xampp\private-backups\questao-pro-backend\dev-scripts-archive\2026-05-18`

Quando um diagnostico manual ainda for necessario, ele deve nascer como tarefa CLI revisada em `scripts/tasks/` ou como teste em `tests/`, nunca como endpoint web nem como pasta `scripts/manual-tests`, `scripts/debug`, `scripts/setup`, `scripts/maintenance`, `scripts/seed` ou `scripts/seeds`.

### `scripts/migrations/`

Nao e mais uma pasta livre para migracoes manuais.

Regra atual:

- migracoes SQL versionadas pertencem a `database/migrations/`;
- migracoes PHP legadas ou pontuais devem ser arquivadas fora de `htdocs`;
- a unica migracao PHP operacional allowlisted no momento e `scripts/migrations/migrate_marketplace_schema_compatibility.php`, usada para compatibilidade do marketplace/gamificacao e executavel somente via CLI.

O pacote legado de migracoes PHP foi preservado em:

- `C:\xampp\private-backups\questao-pro-backend\dev-scripts-archive\2026-05-18\scripts\migrations-legacy`

### Seeds locais

Os executores antigos de seed foram arquivados fora de `htdocs`. O seed SQL oficial continua em:

- `C:\xampp\htdocs\questao-pro-backend\database\seeds\seed.sql`

Qualquer carga de seed deve ser executada por tarefa CLI revisada e explicitamente bloqueada em producao.

## Regra consolidada

Scripts de banco, debug, seed ou manutencao nao devem mais nascer em `api/`.

Se o arquivo:

- nao representa endpoint publico
- nao e bridge de compatibilidade
- nao faz parte do runtime da aplicacao

ele deve ir para `scripts/`.

Arquivos temporarios como `temp_*.php`, `tmp_*.php`, `debug_*.php` e `test_*.php` dentro de `scripts/checks/` tambem sao bloqueados pelo preflight de producao.

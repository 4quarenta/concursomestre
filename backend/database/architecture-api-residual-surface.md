# Architecture - API Residual Surface

## Contexto
A migracao estrutural reduziu `api/` a uma camada de compatibilidade. Ainda restam alguns entrypoints publicos e bridges legados que precisam ser explicitamente permitidos e congelados.

## Superficie residual aceita
- `api/settings.php`
- `api/upload.php`
- `api/cache/manage.php`
- `api/system/logs.php`
- `api/tasks/ProcessRewards.php`
- `api/utils/*`

## Papel de cada grupo
- `settings.php`
  - bridge legado para o dominio administrativo.
- `upload.php`
  - bridge legado para o dominio `materials`.
- `cache/manage.php`
  - bridge legado para o endpoint oficial administrativo de cache.
- `system/logs.php`
  - bridge legado para o endpoint oficial administrativo de logs.
- `tasks/ProcessRewards.php`
  - bridge legado HTTP para o job oficial de recompensas de indicacao.
- `utils/*`
  - bridges de compatibilidade para `shared/*` ou para `modules/transactions` no fluxo de estorno.

## Regra arquitetural
Nao devem surgir novos entrypoints publicos em `api/` fora desse conjunto sem justificativa formal. O caminho oficial para logica, infraestrutura e operacao permanece em `modules/`, `shared/`, `scripts/` e `storage/`.
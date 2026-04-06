## API Residual Surface

### Objetivo
- Congelar a superfície pública residual que ainda pode existir em `backend/api`.
- Diferenciar claramente entrypoints aceitos de bridges legados mínimos.

### Superfície residual permitida
- `api/settings.php`
  - bridge legado de leitura/configuração administrativa.
- `api/upload.php`
  - bridge legado do upload agora pertencente ao domínio `materials`.
- `api/cache/manage.php`
  - bridge legado para `api/admin/cache.php`.
- `api/system/logs.php`
  - bridge legado para `api/admin/logs.php`.
- `api/tasks/ProcessRewards.php`
  - bridge legado para o cron de recompensas de indicação do módulo `users`.
- `api/utils/*`
  - bridges finos para `shared/*` ou, no caso do estorno, para `modules/transactions`.

### Regra
- Novos entrypoints não devem nascer em `api/`.
- Se uma URL legada ainda precisar existir, ela deve delegar de forma fina ao módulo ou à infraestrutura oficial.
- O runtime operacional preferencial continua em `modules/*`, `shared/*` e `scripts/*`.

### Garantia adicionada
- O teste [C:\xampp\htdocs\questão-pro-backend\tests\ApiResidualSurfaceWiringTest.php](C:\xampp\htdocs\questão-pro-backend\tests\ApiResidualSurfaceWiringTest.php) congela essa superfície residual.

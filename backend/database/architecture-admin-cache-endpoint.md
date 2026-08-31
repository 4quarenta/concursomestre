# Architecture: Admin Cache Endpoint

## Regra oficial
Operacoes de cache administrativo pertencem ao dominio `admin`.

## Endpoint oficial
- `api/admin/cache.php`

## Compatibilidade
- `api/cache/manage.php` permanece apenas como bridge legado para nao quebrar clientes antigos e aliases como `cacheManage`.

## Consumo frontend
O frontend oficial consome `admin/cache.php` via `src/services/api/endpoints.ts`.

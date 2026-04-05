# Admin Cache Endpoint Formalization

## Objetivo
Mover o endpoint oficial de gestao de cache para a area administrativa do backend e deixar `api/cache/manage.php` apenas como compatibilidade legada.

## Endpoint oficial
- `C:\xampp\htdocs\questao-pro-backend\api\admin\cache.php`

## Bridge legado
- `C:\xampp\htdocs\questao-pro-backend\api\cache\manage.php`

## Alinhamentos realizados
- frontend passou a usar `admin/cache.php`
- alias `cacheManage` no roteamento legado agora aponta para `api/admin/cache.php`
- `api/cache/manage.php` permanece vivo so como bridge

## Validacao executada
- php lint dos endpoints e teste de wiring
- `AdminCacheEndpointWiringTest.php`
- `src/services/admin/__tests__/adminService.test.ts`
- `npm run build`
- smoke `401` em `api/admin/cache.php?action=stats`
- smoke `401` em `api/cache/manage.php?action=stats`
- smoke `200` na home `http://localhost:3000/#/`

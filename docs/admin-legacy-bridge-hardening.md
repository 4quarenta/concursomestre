# Admin Legacy Bridge Hardening

## Objetivo
Consolidar `api/admin` como camada de compatibilidade fina para o modulo administrativo oficial.

## Formalizacoes desta rodada
- endpoint oficial de logs em `C:\xampp\htdocs\questão-pro-backend\api\admin\logs.php`
- bridge legado `C:\xampp\htdocs\questão-pro-backend\api\system\logs.php`
- alias legado `settingsUpdate` alinhado para `api/admin/settings.php` em `.htaccess` e `router.php`
- teste estrutural `C:\xampp\htdocs\questão-pro-backend\tests\AdminLegacyBridgesWiringTest.php`

## Estado atual de `api/admin`
Todos os arquivos da pasta delegam para `modules/admin/routes.php` e não concentram regra de negocio.

## Validação executada
- `AdminLogsEndpointWiringTest.php`
- `AdminSettingsWiringTest.php`
- `AdminLegacyBridgesWiringTest.php`
- vitest do admin
- smoke `401` em `api/admin/logs.php`
- smoke `401` em `api/system/logs.php`
- smoke `401` em `api/settingsUpdate`
- home `200`

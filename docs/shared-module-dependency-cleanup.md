# Shared Module Dependency Cleanup

## Objetivo
Fazer os modulos oficiais do backend consumirem `shared/*` diretamente, em vez de depender de bridges legados em `api/utils/*`.

## O que mudou
- Criado `C:\xampp\htdocs\questao-pro-backend\shared\security\AdminSecurity.php`
- Criado `C:\xampp\htdocs\questao-pro-backend\shared\responses\Response.php`
- `api/utils/AdminSecurity.php` virou bridge fino
- `api/utils/Response.php` virou bridge fino
- Todos os `modules/*` passaram a importar direto de `shared/auth`, `shared/security` e `shared/responses`

## Dependencias diretas removidas de modules
- `api/utils/request_auth.php`
- `api/utils/AuthSession.php`
- `api/utils/JWTAuth.php`
- `api/utils/GoogleAuthenticator.php`
- `api/utils/AdminSecurity.php`
- `api/utils/Response.php`

## Garantia arquitetural
Foi criado `C:\xampp\htdocs\questao-pro-backend\tests\SharedModuleDependenciesWiringTest.php`, que falha se qualquer arquivo em `modules/*` voltar a depender de `api/utils/`.

## Validacao executada
- php lint dos arquivos novos e bridges
- `SharedAuthInfrastructureWiringTest.php`
- `SharedHttpWiringTest.php`
- `SharedModuleDependenciesWiringTest.php`
- `AdminSecurityWiringTest.php`
- `AuthModuleWiringTest.php`
- `MaterialsModuleWiringTest.php`
- `RankingsModuleWiringTest.php`
- `npm run test:auth`
- `npm run test:admin`
- smoke `401` em `api/admin/stats.php`
- smoke `200` na home `http://localhost:3000/#/`

# Filters Module

## Objetivo

Consolidar o dominio de taxonomias e filtros como camada oficial do sistema e remover chamadas HTTP cruas do painel administrativo.

## Backend

O modulo oficial já estava concentrado em:

- `C:\xampp\htdocs\questão-pro-backend\modules\filters\routes.php`
- `C:\xampp\htdocs\questão-pro-backend\modules\filters\controllers\FiltersController.php`
- `C:\xampp\htdocs\questão-pro-backend\modules\filters\services\FiltersService.php`
- `C:\xampp\htdocs\questão-pro-backend\modules\filters\repositories\FiltersRepository.php`
- `C:\xampp\htdocs\questão-pro-backend\modules\filters\validators\FiltersValidator.php`

Nesta rodada, a validação arquitetural ficou congelada em:

- `C:\xampp\htdocs\questão-pro-backend\tests\FiltersModuleWiringTest.php`

## Frontend

### Admin

`C:\dev\concursomestre\src\app\admin\page.tsx` agora:

- usa `filtersService.listTaxonomies()` para recarregar taxonomias
- usa `filtersService.save(...)` para criar e editar filtros
- usa `filtersService.remove(...)` para exclusao
- usa `readApiErrorMessage(...)` para mensagens de erro padronizadas

### Service

`C:\dev\concursomestre\src\services\filters\index.ts` segue como fachada oficial do dominio:

- `list()`
- `listTaxonomies()`
- `save(...)`
- `remove(...)`

## Regras preservadas

- `list` continua público para carregar taxonomias do app
- `save` e `delete` continuam protegidos por sessão admin
- a normalizacao de `bancas`, `orgaos`, `assuntos`, `cargos`, `anos` e `carreiras` continua centralizada no service

## Validação

- `FiltersModuleWiringTest.php`
- `src/services/filters/__tests__/filters.test.ts`
- `src/services/admin/__tests__/adminService.test.ts`
- `npm run build`
- `npm run test:auth`
- `npm run test:admin`

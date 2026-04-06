# Modulo de Simulados

## Objetivo

Esta rodada move a persistencia de simulados para a arquitetura oficial do backend e remove a dependencia do `user_id` vindo da UI.

## Backend

Arquivos principais:

- `C:\xampp\htdocs\questão-pro-backend\modules\simulations\controllers\SimulationsController.php`
- `C:\xampp\htdocs\questão-pro-backend\modules\simulations\services\SimulationsService.php`
- `C:\xampp\htdocs\questão-pro-backend\modules\simulations\repositories\SimulationsRepository.php`
- `C:\xampp\htdocs\questão-pro-backend\modules\simulations\validators\SimulationsValidator.php`
- `C:\xampp\htdocs\questão-pro-backend\modules\simulations\routes.php`

Bridge legado:

- `C:\xampp\htdocs\questão-pro-backend\api\simulations\create.php`

## O que mudou

### `SimulationsService::saveSimulation(...)`

- usa a sessão autenticada como fonte de verdade do usuário
- valida tentativa de forjar `user_id` no payload
- persiste a sessão em `simulations`
- persiste as respostas em `user_answers`
- aceita o contrato legado de respostas simples ou enriquecidas

### `SimulationsValidator`

- valida `status`, `score`, `startTime`, `endTime`, `config` e `answers`
- gera um `id` automático quando necessario
- protege contra mismatch entre payload e sessão

### `SimulationsRepository`

- concentra o `upsert` da sessão
- concentra o `upsert` das respostas vinculadas

## Frontend

Arquivos principais:

- `C:\dev\concursomestre\src\services\simulations\simulationsService.ts`
- `C:\dev\concursomestre\src\providers\AuthProvider.tsx`

## Melhorias funcionais

- `simulationsService.saveSimulation(...)` não recebe mais `userId` da UI
- o provider de auth agora salva o simulado usando apenas o payload da sessão
- o backend continua devolvendo `id` e `message` no formato esperado pelo app

## Validação executada

- `php -l` no modulo `simulations` e no bridge legado
- `C:\xampp\htdocs\questão-pro-backend\tests\SimulationsModuleWiringTest.php`
- `npx vitest run src/services/simulations/__tests__/simulationsService.test.ts`
- `npm run build`
- `npm run test:auth`
- `npm run test:admin`
- smoke `401` coerente em `http://localhost/questão-pro-backend/api/simulations/create.php`

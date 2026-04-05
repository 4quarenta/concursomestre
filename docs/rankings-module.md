# Rankings Module

## Objetivo

Fechar o dominio `rankings` na arquitetura oficial, incluindo os scripts legados de `install` e `migrate`, e remover chamada HTTP crua restante do painel administrativo.

## Backend

O modulo oficial permanece em:

- `C:\xampp\htdocs\questao-pro-backend\modules\rankings\routes.php`
- `C:\xampp\htdocs\questao-pro-backend\modules\rankings\controllers\RankingsController.php`
- `C:\xampp\htdocs\questao-pro-backend\modules\rankings\services\RankingsService.php`
- `C:\xampp\htdocs\questao-pro-backend\modules\rankings\repositories\RankingsRepository.php`
- `C:\xampp\htdocs\questao-pro-backend\modules\rankings\validators\RankingsValidator.php`

### Rodada atual

Foram absorvidos para o modulo:

- `handleRankingsInstallRoute(PDO $db)`
- `handleRankingsMigrateRoute(PDO $db)`
- `RankingsController::install()`
- `RankingsController::migrate()`
- `RankingsService::install()`
- `RankingsService::migrate()`

O repository passou a concentrar:

- `ensureRankingsTable()`
- `ensureRankingEntriesTable()`
- `ensureRankingColumn(...)`
- `ensureRankingEntryColumn(...)`
- `ensureRankingScoreColumnShape()`
- `ensureRankingEntriesUniqueParticipationIndex()`

## Bridges legados

Agora todos os endpoints abaixo sao bridges finos:

- `api/rankings/list.php`
- `api/rankings/create.php`
- `api/rankings/join.php`
- `api/rankings/update.php`
- `api/rankings/moderate.php`
- `api/rankings/delete.php`
- `api/rankings/install.php`
- `api/rankings/migrate.php`

## Frontend

### Admin

`C:\dev\concursomestre\src\app\admin\page.tsx` parou de usar `rankingsCreate` cru para salvar edicao de ranking.

Agora o fluxo usa:

- `updateRanking(editingRanking)`
- `readApiErrorMessage(...)`

Isso evita dupla chamada e corrige o caso em que a tela tentava criar um ranking ao editar um existente.

## Validacao

- `RankingsModuleWiringTest.php`
- `src/services/rankings/__tests__/rankingsService.test.ts`
- `src/services/admin/__tests__/adminService.test.ts`
- `npm run build`
- `npm run test:auth`
- `npm run test:admin`

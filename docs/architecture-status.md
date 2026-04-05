# Architecture Status

## Current snapshot
- Date base: `2026-04-05`
- Frontend workspace: [C:\dev\concursomestre](C:\dev\concursomestre)
- Backend workspace: [C:\xampp\htdocs\questao-pro-backend](C:\xampp\htdocs\questao-pro-backend)
- Change log history lives in [C:\dev\concursomestre\docs\audit-report.md](C:\dev\concursomestre\docs\audit-report.md)
- Functional inventory lives in [C:\dev\concursomestre\docs\feature-report.md](C:\dev\concursomestre\docs\feature-report.md)
- Functional version baseline lives in [C:\dev\concursomestre\docs\feature-version-matrix.md](C:\dev\concursomestre\docs\feature-version-matrix.md)
- Baseline publica atual da plataforma: `v1.0.0`

## Phase progress
1. Fase 0: concluida
2. Fase 1: concluida
3. Fase 2: concluida
4. Fase 3: concluida
5. Fase 4: concluida
6. Fase 5: concluida
7. Fase 6: concluida

## Overall progress
- Progresso geral estimado: 100%
- Frentes ainda abertas: 0
- Checklist tecnico unificado: `npm run test:transition`
- Finalizador operacional: `npm run finalize:transition`

## Permanent engineering rules
- Regras permanentes de comentarios, estrutura e padrao de codigo vivem em [C:\dev\concursomestre\.agent\rules\engineering-standards.md](C:\dev\concursomestre\.agent\rules\engineering-standards.md)
- Comentarios tecnicos em **pt-BR** agora sao obrigatorios em funcoes, componentes, hooks, services e scripts novos ou alterados
- O comentario deve explicar finalidade, responsabilidade e como a unidade se conecta ao fluxo real do site
- Cada comentario funcional deve registrar `@since <versao>`; enquanto o mapeamento historico completo nao termina, a baseline obrigatoria e `@since v1.0.0`
- `page.tsx` deve permanecer como shell de composicao; regras de negocio e workflow devem ficar em hooks/controllers da feature
- O padrao estrutural oficial segue: `src/app` para telas e features, `src/services` para contratos de dominio, `src/router` para navegacao, `src/providers` para estado global, `modules` no backend para dominio e `api/*` apenas para bridges finos

## Frontend status

### Canonical frontend layers
- App shell and routes live in [C:\dev\concursomestre\src\app](C:\dev\concursomestre\src\app) and [C:\dev\concursomestre\src\router](C:\dev\concursomestre\src\router)
- Data and auth composition live in [C:\dev\concursomestre\src\providers](C:\dev\concursomestre\src\providers)
- Domain contracts live in [C:\dev\concursomestre\src\services](C:\dev\concursomestre\src\services)
- Shared helpers live in [C:\dev\concursomestre\src\utils](C:\dev\concursomestre\src\utils)

### Legacy frontend layers
- [C:\dev\concursomestre\src\features](C:\dev\concursomestre\src\features) no longer exists
- [C:\dev\concursomestre\src\core](C:\dev\concursomestre\src\core) no longer exists
- [C:\dev\concursomestre\src\components\admin](C:\dev\concursomestre\src\components\admin) has no active legacy runtime content

### Admin architecture
- Admin entry point lives in [C:\dev\concursomestre\src\app\admin\page.tsx](C:\dev\concursomestre\src\app\admin\page.tsx)
- Current role of `page.tsx`: final composition shell only
- Current size of `page.tsx`: 42 lines
- Database orchestration lives in [C:\dev\concursomestre\src\app\admin\components\database\AdminDatabaseManager.tsx](C:\dev\concursomestre\src\app\admin\components\database\AdminDatabaseManager.tsx)
- Current role of `AdminDatabaseManager.tsx`: final composition shell only
- Current size of `AdminDatabaseManager.tsx`: 21 lines

### Admin feature map
- Dashboard: [C:\dev\concursomestre\src\app\admin\components\dashboard](C:\dev\concursomestre\src\app\admin\components\dashboard)
- Database: [C:\dev\concursomestre\src\app\admin\components\database](C:\dev\concursomestre\src\app\admin\components\database)
- Finance: [C:\dev\concursomestre\src\app\admin\components\finance](C:\dev\concursomestre\src\app\admin\components\finance)
- Import: [C:\dev\concursomestre\src\app\admin\components\import](C:\dev\concursomestre\src\app\admin\components\import)
- Materials moderation: [C:\dev\concursomestre\src\app\admin\components\materials](C:\dev\concursomestre\src\app\admin\components\materials)
- Questions workbench: [C:\dev\concursomestre\src\app\admin\components\questions](C:\dev\concursomestre\src\app\admin\components\questions)
- Rankings: [C:\dev\concursomestre\src\app\admin\components\rankings](C:\dev\concursomestre\src\app\admin\components\rankings)
- Reports: [C:\dev\concursomestre\src\app\admin\components\reports](C:\dev\concursomestre\src\app\admin\components\reports)
- Settings: [C:\dev\concursomestre\src\app\admin\components\settings](C:\dev\concursomestre\src\app\admin\components\settings)
- Support: [C:\dev\concursomestre\src\app\admin\components\support](C:\dev\concursomestre\src\app\admin\components\support)
- Users: [C:\dev\concursomestre\src\app\admin\components\users](C:\dev\concursomestre\src\app\admin\components\users)

### Admin shared shell
- Shared admin shell files are intentionally limited to:
  - [C:\dev\concursomestre\src\app\admin\components\shared\AdminPageContent.tsx](C:\dev\concursomestre\src\app\admin\components\shared\AdminPageContent.tsx)
  - [C:\dev\concursomestre\src\app\admin\components\shared\AdminPageHeader.tsx](C:\dev\concursomestre\src\app\admin\components\shared\AdminPageHeader.tsx)
  - [C:\dev\concursomestre\src\app\admin\components\shared\AdminShellLayout.tsx](C:\dev\concursomestre\src\app\admin\components\shared\AdminShellLayout.tsx)
  - [C:\dev\concursomestre\src\app\admin\components\shared\AdminTopBar.tsx](C:\dev\concursomestre\src\app\admin\components\shared\AdminTopBar.tsx)
  - [C:\dev\concursomestre\src\app\admin\components\shared\NotificationDropdown.tsx](C:\dev\concursomestre\src\app\admin\components\shared\NotificationDropdown.tsx)
  - [C:\dev\concursomestre\src\app\admin\components\shared\useAdminPageController.tsx](C:\dev\concursomestre\src\app\admin\components\shared\useAdminPageController.tsx)
- Log viewer was moved to its owning domain in [C:\dev\concursomestre\src\app\admin\components\settings\LogViewer.tsx](C:\dev\concursomestre\src\app\admin\components\settings\LogViewer.tsx)

### Frontend residual exceptions
- [C:\dev\concursomestre\src\pages](C:\dev\concursomestre\src\pages) no longer exists
- The last operational lock cleared and the finalizer completed after the directory was removed
- Lock diagnostics live in [C:\dev\concursomestre\scripts\checks\find-locking-process.ps1](C:\dev\concursomestre\scripts\checks\find-locking-process.ps1) and [C:\dev\concursomestre\scripts\checks\remove-empty-pages-dir.ps1](C:\dev\concursomestre\scripts\checks\remove-empty-pages-dir.ps1)
- Final closure command lives in [C:\dev\concursomestre\scripts\checks\transition-finalize.ps1](C:\dev\concursomestre\scripts\checks\transition-finalize.ps1) and now closes cleanly with `TRANSITION_FINALIZE|OK`

### Frontend guardrails
- Admin architecture is frozen by [C:\dev\concursomestre\src\services\admin\__tests__\adminArchitecture.test.ts](C:\dev\concursomestre\src\services\admin\__tests__\adminArchitecture.test.ts)
- Route suspense fallback now lives in [C:\dev\concursomestre\src\router\RouteSuspenseFallback.tsx](C:\dev\concursomestre\src\router\RouteSuspenseFallback.tsx)
- Route transition skeletons now distinguish real platform shells:
  - marketing
  - app layout
  - auth
  - admin/partner dashboard
  - checkout
  - reader
  - legal/document pages
- Layout-based routes now keep the real sidebar and shell mounted while lazy pages resolve via local `React.Suspense` boundaries in [C:\dev\concursomestre\src\router\publicRoutes.tsx](C:\dev\concursomestre\src\router\publicRoutes.tsx) and [C:\dev\concursomestre\src\router\privateRoutes.tsx](C:\dev\concursomestre\src\router\privateRoutes.tsx)
- `npm run test:admin` now validates:
  - admin service contract
  - `page.tsx` line budget
  - `AdminDatabaseManager.tsx` line budget
  - `admin/shared` whitelist
  - `LogViewer` in `settings`
  - absence of legacy `src/components/admin`
  - empty `src/pages`
  - absence of `src/features` and `src/core`
  - absence of active imports to legacy frontend layers
  - shell budgets for `useAdminPageController`, `AdminShellLayout`, `AdminPageContent` and `AdminTopBar`
  - absence of the old `Carregando rota` fallback text
  - local suspense for layout routes so the sidebar does not disappear during transitions
  - absence of `src/pages_pending_delete` as an intermediate residual state
- Unified transition readiness check lives in [C:\dev\concursomestre\scripts\checks\transition-readiness.ps1](C:\dev\concursomestre\scripts\checks\transition-readiness.ps1)

## Backend status

### Canonical backend root
- [C:\xampp\htdocs\questao-pro-backend\api](C:\xampp\htdocs\questao-pro-backend\api)
- [C:\xampp\htdocs\questao-pro-backend\config](C:\xampp\htdocs\questao-pro-backend\config)
- [C:\xampp\htdocs\questao-pro-backend\database](C:\xampp\htdocs\questao-pro-backend\database)
- [C:\xampp\htdocs\questao-pro-backend\modules](C:\xampp\htdocs\questao-pro-backend\modules)
- [C:\xampp\htdocs\questao-pro-backend\scripts](C:\xampp\htdocs\questao-pro-backend\scripts)
- [C:\xampp\htdocs\questao-pro-backend\shared](C:\xampp\htdocs\questao-pro-backend\shared)
- [C:\xampp\htdocs\questao-pro-backend\storage](C:\xampp\htdocs\questao-pro-backend\storage)
- [C:\xampp\htdocs\questao-pro-backend\tests](C:\xampp\htdocs\questao-pro-backend\tests)
- [C:\xampp\htdocs\questao-pro-backend\uploads](C:\xampp\htdocs\questao-pro-backend\uploads)
- [C:\xampp\htdocs\questao-pro-backend\vendor](C:\xampp\htdocs\questao-pro-backend\vendor)

### Official backend modules
- `admin`
- `ai`
- `auth`
- `changelog`
- `comments`
- `feedback`
- `filters`
- `materials`
- `notifications`
- `payments`
- `plans`
- `questions`
- `rankings`
- `reports`
- `simulations`
- `settings`
- `statistics`
- `subscriptions`
- `transactions`
- `users`

### Backend residual exceptions
- Public residual surface in [C:\xampp\htdocs\questao-pro-backend\api](C:\xampp\htdocs\questao-pro-backend\api):
  - `settings.php`
  - `upload.php`
  - minimal legacy bridges in domain folders
  - minimal legacy bridges in `cache`, `system`, `tasks` and `utils`
- Operational checks, ad-hoc migrations and seed artifacts no longer belong under public `api/`
- Residual backend public surface is frozen by [C:\xampp\htdocs\questao-pro-backend\tests\ApiResidualSurfaceWiringTest.php](C:\xampp\htdocs\questao-pro-backend\tests\ApiResidualSurfaceWiringTest.php)
- Accepted public API inventory is frozen by [C:\xampp\htdocs\questao-pro-backend\tests\ApiBridgeInventoryWiringTest.php](C:\xampp\htdocs\questao-pro-backend\tests\ApiBridgeInventoryWiringTest.php)
- Thin bridge semantics are frozen by [C:\xampp\htdocs\questao-pro-backend\tests\ApiThinBridgesWiringTest.php](C:\xampp\htdocs\questao-pro-backend\tests\ApiThinBridgesWiringTest.php)
- Exceptional public bridges are frozen by [C:\xampp\htdocs\questao-pro-backend\tests\ApiExceptionalBridgesWiringTest.php](C:\xampp\htdocs\questao-pro-backend\tests\ApiExceptionalBridgesWiringTest.php)
- Accepted exception classes are frozen by [C:\xampp\htdocs\questao-pro-backend\tests\ApiAcceptedExceptionsWiringTest.php](C:\xampp\htdocs\questao-pro-backend\tests\ApiAcceptedExceptionsWiringTest.php)
- Public settings module wiring is frozen by [C:\xampp\htdocs\questao-pro-backend\tests\SettingsModuleWiringTest.php](C:\xampp\htdocs\questao-pro-backend\tests\SettingsModuleWiringTest.php)

## Closure criteria

### To close Fase 4
- Keep `src/features` and `src/core` absent
- Keep zero active imports to legacy frontend layers
- Keep [C:\dev\concursomestre\src\pages](C:\dev\concursomestre\src\pages) absent

### To close Fase 5
- Consolidate final backend inventory of accepted `api/*` bridges
- Confirm no new domain logic is introduced outside `modules`, `shared` or `scripts`
- Keep operational checks, migrations and seed files out of public `api/`
- Keep public `api/*.php` files thin, delegating and free of ad-hoc SQL/runtime logic

### To close Fase 6
- Keep admin shell and manager frozen under current line budgets
- Keep `admin/shared` limited to shell concerns
- Keep domain-specific components inside their owning admin feature folders
- Keep [C:\dev\concursomestre\src\pages](C:\dev\concursomestre\src\pages) absent and `npm run finalize:transition` green

## Next practical step
- Migration transition is formally closed
- Use `npm run test:transition` for ongoing regression checks and `npm run finalize:transition` if the final closure path needs to be revalidated

## Post-transition standardization
- Baseline version: `1.0.0`
- Standard file header applied and verified on active code files via `npm run test:headers`
- Permanent engineering rule frozen in [C:\dev\concursomestre\.agent\rules\engineering-standards.md](C:\dev\concursomestre\.agent\rules\engineering-standards.md)
- Current focus: comment all functions in pt-BR with `@since 1.0.0` to improve future debugging
- Current progress estimate for this stage: `49%`
- Next highest-value sweep: remaining frontend services/providers, then backend `modules/*`, `shared/*` and `scripts/*`

# Remocao de Arquivos e Codigo - Candidatos (Producao)

Data base: `2026-05-16`

## Ja removido nesta rodada

1. `src/app/admin/components/settings/AdminLandingContentSection.tsx`
   - Motivo: bloco duplicado de configuracao de homepage na aba `Geral`.
   - Evidencia: a tela de configuracoes agora usa fluxo unico, sem esse componente.
   - Risco: baixo.

2. Artefatos locais de execucao removidos da raiz:
   - `.codex-dev-3000.err.log`
   - `.codex-dev-3000.out.log`
   - `.codex-dev-3001.err.log`
   - `.codex-dev-3001.out.log`
   - `.codex-dev.log`
   - `tmp-next-start-3102.log`
   - Motivo: lixo operacional local, sem utilidade de runtime.
   - Risco: baixo.

3. Artefatos temporarios locais removidos em `2026-05-16`:
   - `.tmp-dev-err.log`
   - `.tmp-dev-out.log`
   - `.tmp-dev-webpack-err.log`
   - `.tmp-dev-webpack-out.log`
   - `.tmp-dev3000-err.log`
   - `.tmp-dev3000-out.log`
   - `.tmp-next-start.err.log`
   - `.tmp-next-start.log`
   - Motivo: logs de execucao local ignorados pelo Git e sem valor para runtime.
   - Risco: baixo.

4. `tmp-hard-refresh-baseline-latest.json`
   - Status: movido para `docs/reports/artifacts/hard-refresh-baseline-latest.json`.
   - Motivo: baseline tecnico deve ficar junto dos artefatos de auditoria, nao na raiz do projeto.
   - Evidencia: `scripts/checks/hard-refresh-budget.mjs` e `scripts/checks/hard-refresh-baseline.mjs` agora usam `docs/reports/artifacts/` por padrao; `npm run check:hard-refresh-budget` passou.
   - Risco: baixo.

5. `C:/xampp/htdocs/questao-pro-backend/backend.zip`
   - Status: movido para `C:/xampp/private-backups/questao-pro-backend/backend.zip`.
   - Motivo: backup grande (`177 MB`) estava dentro da raiz servida pelo Apache e poderia ser baixado diretamente se o servidor aceitasse arquivos estaticos.
   - Evidencia: raiz publica do backend ficou sem o arquivo; `.htaccess` passou a bloquear extensoes de backup/dump e diretorios internos; `BackendRootCleanupWiringTest.php`, `ProductionPreflightWiringTest.php`, `ProductionPreflightBehaviorTest.php` e `ApiResidualSurfaceWiringTest.php` passaram.
   - Risco: baixo; o arquivo foi preservado fora de `htdocs`.

6. Scripts de desenvolvimento/debug fora de `htdocs`
   - Status: movidos para `C:/xampp/private-backups/questao-pro-backend/dev-scripts-archive/2026-05-18`.
   - Itens:
     - `C:/xampp/htdocs/questao-pro-backend/scripts/debug`
     - `C:/xampp/htdocs/questao-pro-backend/scripts/manual-tests`
     - `C:/xampp/htdocs/questao-pro-backend/scripts/setup`
     - `C:/xampp/htdocs/questao-pro-backend/scripts/maintenance`
     - `C:/xampp/htdocs/questao-pro-backend/scripts/seed`
     - `C:/xampp/htdocs/questao-pro-backend/scripts/seeds`
     - `C:/xampp/htdocs/questao-pro-backend/scripts/checks/temp_check_plans.php`
     - `C:/xampp/htdocs/questao-pro-backend/scripts/checks/temp_check_transactions.php`
   - Motivo: scripts manuais, instaladores, diagnosticos, seeds executaveis e rotinas antigas de manutencao nao devem morar na arvore publica do Apache, mesmo com `.htaccess` bloqueando acesso. O recorte incluia scripts que resetavam senhas para `123456`/`password`, criavam admin padrao e apagavam/recriavam planos.
   - Evidencia: `BACKEND_DEV_SCRIPT_ARTIFACTS_CLEAN` adicionado ao preflight; `BackendRootCleanupWiringTest.php`, `ProductionPreflightWiringTest.php` e `ProductionPreflightBehaviorTest.php` passaram; smoke HTTP manteve `403` nesses caminhos e `200` no crawler Gran permitido.
   - Risco: baixo; os arquivos foram preservados em arquivo privado para consulta.

7. Migracoes PHP legadas em `scripts/migrations`
   - Status: arquivadas em `C:/xampp/private-backups/questao-pro-backend/dev-scripts-archive/2026-05-18/scripts/migrations-legacy`.
   - Mantido em `htdocs`: apenas `C:/xampp/htdocs/questao-pro-backend/scripts/migrations/migrate_marketplace_schema_compatibility.php`, por ainda ser referenciado pelo runbook e por testes de compatibilidade do marketplace/gamificacao.
   - Motivo: migracoes PHP ad hoc nao devem ficar publicadas em `htdocs`; novas alteracoes de schema devem ir para `database/migrations/`.
   - Evidencia: `BackendRootCleanupWiringTest.php`, `ProductionPreflightWiringTest.php`, `ProductionPreflightBehaviorTest.php`, `MarketplaceSchemaCompatibilityWiringTest.php` e `MarketplaceGamificationWiringTest.php` passaram; smoke HTTP confirmou `403` para `scripts/migrations/fix_migration.php` e para a migracao allowlisted via web.
   - Risco: baixo; a migracao ativa foi preservada e segue bloqueada para HTTP por `.htaccess`/guarda CLI.

8. `tsconfig.tsbuildinfo`
   - Status: removido do versionamento em `2026-05-20` e reforcado em `2026-05-22`.
   - Motivo: cache incremental do TypeScript, ja coberto por `*.tsbuildinfo` no `.gitignore`, mudava a cada `typecheck/build` e sujava o Git sem valor de runtime.
   - Ajuste adicional: `tsconfig.json` passou a gravar o cache incremental em `.next/tsconfig.tsbuildinfo`, e `npm run check:generated-artifacts` foi adicionado ao preflight local para reprovar retorno de artefatos gerados na raiz.
   - Evidencia: `npm run typecheck` recriou o cache dentro de `.next/`; `npm run check:generated-artifacts` e `npm run check:production-local` passaram.
   - Risco: baixo; cache gerado automaticamente pela ferramenta.

9. SDK legado do Mercado Pago em `vendor/`
   - Status: removido da arvore publica do backend em `2026-05-20` e preservado em `C:/xampp/private-backups/questao-pro-backend/vendor-archive/2026-05-20/mercadopago`.
   - Motivo: `composer.json` e `composer.lock` atuais nao exigem `mercadopago/dx-php`, mas o `vendor` local ainda anunciava `MercadoPago\\` no autoload gerado. Como o produto esta Stripe-only, isso mantinha codigo morto e superficie desnecessaria no deploy local.
   - Ajuste aplicado: pacote movido para arquivo privado e referencias removidas de `vendor/composer/autoload_psr4.php`, `vendor/composer/autoload_static.php`, `vendor/composer/installed.php` e `vendor/composer/installed.json`.
   - Evidencia: autoload carrega `Stripe\\StripeClient`, `PHPMailer\\PHPMailer\\PHPMailer` e `TCPDF`, enquanto `MercadoPago\\MercadoPagoConfig` fica ausente; `PAYMENT_LEGACY_MERCADOPAGO_SDK_REMOVED` foi adicionado ao preflight para reprovar retorno de `vendor/mercadopago`, `MercadoPago\\` ou `mercadopago/dx-php`; `PaymentsModuleWiringTest.php`, `SubscriptionsCheckoutWiringTest.php`, `ProductionPreflightWiringTest.php` e `ProductionPreflightBehaviorTest.php` passaram.
   - Risco: baixo no produto atual; se Mercado Pago voltar no futuro, deve entrar por decisao nova de produto e `composer require`, nao por vendor legado.

10. `C:/xampp/htdocs/questao-pro-backend/storage/backups/legacy-code`
   - Status: movido para `C:/xampp/private-backups/questao-pro-backend/storage-archive/2026-05-20/legacy-code`.
   - Motivo: backup historico de codigo dentro de `htdocs`, ainda que bloqueado por `.htaccess`, mistura evidencia antiga com runtime publico e amplia risco se o servidor final nao aplicar as mesmas regras Apache.
   - Evidencia: `LEGACY_CODE_BACKUPS_OUTSIDE_PUBLIC_ROOT` e `BACKUP_DIR_OUTSIDE_PUBLIC_ROOT` adicionados ao preflight; `BackendRootCleanupWiringTest.php`, `ProductionPreflightWiringTest.php` e `ProductionPreflightBehaviorTest.php` passaram.
   - Risco: baixo; os arquivos foram preservados fora de `htdocs`.

11. Arquivos temporarios webpack locais
   - `.tmp-dev3000-webpack-err.log`
   - `.tmp-dev3000-webpack-out.log`
   - Status: removidos em `2026-05-22` apos encerrar o processo local `next dev --webpack --port 3000` que mantinha lock nesses arquivos. O servidor local foi religado em background na porta `3000` sem recriar os logs.
   - Motivo: artefatos de execucao local, sem valor de runtime e ja cobertos pela politica de logs temporarios.
   - Evidencia: `Test-Path` retornou `False` para ambos os arquivos e `Get-NetTCPConnection -LocalPort 3000` voltou a mostrar listener apos reiniciar o dev server.
   - Risco: baixo.

## Candidatos seguros para limpeza imediata

- Nenhum candidato imediato pendente nesta data.

## Candidatos com validacao obrigatoria antes de remover

1. `docs/history/**`
   - Motivo: nao participa do runtime.
   - Risco: medio, por perda de contexto historico de decisoes/auditoria.
   - Acao recomendada: mover para repositorio de arquivo ou release attachment antes de excluir.

## Regra operacional para proximas limpezas

1. Somente remover arquivos de codigo quando:
   - nao houver importacao/referencia em runtime,
   - `npm run typecheck` passar,
   - smoke das rotas afetadas passar.
2. Arquivos de evidencia de auditoria/performance devem ser movidos para pasta de artefatos antes da exclusao.

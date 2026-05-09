# Auditoria de Producao - ConcursoMestre

Data: `2026-05-05`

Veredito: `Nao pronto`

## Atualizacao incremental (`2026-05-08`)

- `src/providers/AppConfigProvider.tsx`: bootstrap de `admin/settings.php` em `/admin/panel/*` foi adiado para uma janela posterior (`8s`), mantendo o hard refresh do painel sem essa leitura inicial.
- `src/app/admin/components/support/AdminCommentsModerationSection.tsx`: fila de moderacao foi migrada de loader manual para `React Query` com chave estavel, cache curto (`staleTime=12s`), invalidacao por mutacao e `refetchOnWindowFocus/reconnect` desligados para evitar rajadas.
- `src/app/admin/components/support/AdminSupportSection.tsx` + `src/app/admin/components/shared/AdminPageContent.tsx`: contagem de pendentes de comentarios foi isolada em query dedicada (desligada na aba ativa de comentarios) e o shell deixou de forcar remount desnecessario da secao de suporte.
- `scripts/checks/hard-refresh-budget.mjs` + `npm run check:hard-refresh-budget`: adicionada trava automatica para falhar quando rotas criticas tiverem requests duplicadas, requests com falha ou excederem budget de `xhr/fetch` e `load`.
- `src/components/shared/layout/Layout.tsx`: avatares globais agora usam `currentUser.photoUrl` (fallback por inicial), corrigindo inconsistencias apos upload de foto no perfil.
- Higiene de producao: removidos logs de diagnostico (`console.log`/`console.debug`) em `QuestionCard`, `ReaderPage`, `PdfViewer` e `AdBanner`; busca em `src` nao encontrou `quick-login`, `debugger` ou debug log residual.
- Baseline tecnico atualizado (`tmp-hard-refresh-baseline-latest.json`) sem duplicatas/falhas:
  - `/dashboard`: `DCL=323ms`, `load=587ms`, `xhr/fetch=3`
  - `/practice`: `DCL=285ms`, `load=512ms`, `xhr/fetch=4`
  - `/admin/panel/dashboard`: `DCL=348ms`, `load=689ms`, `xhr/fetch=3` (`admin/settings.php` fora do bootstrap imediato)
  - `/admin/support/comments`: `DCL=338ms`, `load=816ms`, `xhr/fetch=4` com `comments_moderation` chamado `1x`
- `src/app/practice/page.tsx` + `src/app/questions/components/QuestionCard.tsx`: carregamento de notas em `/practice` passou para modo lazy (sob demanda ao clicar em `Anotar`), com mini-loading no botao para feedback imediato.
- Zustand/TanStack: dependencias confirmadas em `package.json`, `QueryProvider` ativo no topo da arvore e stores por dominio em `src/state`; busca runtime nao encontrou `DataProvider`/`useData` ativo.
- `src/services/admin/__tests__/adminArchitecture.test.ts`: adicionada guarda automatica contra retorno de `DataProvider`, `useData`, `quick-login`, `debugger` e `console.log/debug` em runtime.
- `src/services/marketing/landingPages.ts`: politica de landing publica endurecida para manter payloads como texto puro, bloquear protocolo relativo (`//evil.test`), `javascript/data/blob/file` e caminhos sensiveis (`/admin`, `/api`, `/_next`, `/uploads`, `/storage`) em canonical.
- `src/services/marketing/__tests__/landingPages.test.ts`: adicionados casos de XSS/canonical sensivel para impedir vazamento futuro caso o editor de landing aceite HTML bruto.
- `src/app/question/QuestionPublicPage.tsx`: JSON-LD passou a usar serializacao segura (`<`, `>`, `&`, U+2028/U+2029 escapados) antes de entrar em `dangerouslySetInnerHTML`.
- `src/components/shared/math/MathRichText.tsx` + `adminArchitecture.test.ts`: renderer matematico deixa explicito o HTML saneado e a arquitetura agora falha se novo `dangerouslySetInnerHTML` nao passar por sanitizer conhecido.
- `src/services/admin/__tests__/adminArchitecture.test.ts`: adicionada guarda anti-regressao para impedir import direto de `ResponsiveContainer` do Recharts fora de `StableResponsiveContainer`, evitando retorno do warning `width(-1)/height(-1)`.
- `src/services/seo/sitemapData.ts` + `privateSeo.test.ts`: landings publicas com slugs reservados (`admin`, `api`, `auth`, `dashboard`, `practice`, etc.) ou prefixos reservados (`api-*`, `admin-*`) deixam de entrar no sitemap; robots e sitemap agora tem teste de alinhamento contra rotas privadas/aliases.
- `scripts/checks/production-readiness-local.mjs` + `npm run check:production-local`: criado preflight local consolidado para encoding, typecheck, budget de hard refresh e suites criticas de arquitetura/SEO/XSS/charts/Headers-CSP; `--with-build` inclui build completo antes de release.
- `src/config/securityHeaders.ts`: CSP do frontend manteve Google/reCAPTCHA/Stripe liberados, mas removeu `unsafe-eval` do modo `production`; origens locais continuam permitidas apenas fora de producao.
- `docs/PRODUCTION_RELEASE_RUNBOOK.md`: deploy passou a usar `npm run check:production-local -- --with-build` como preflight frontend consolidado antes do release.
- `src/app/profile/ProfilePage.tsx`: remocao de cartao, remocao de foto e cancelamento de solicitacao de reembolso deixaram de usar dialogos nativos do navegador e passaram para o modal oficial (`useConfirm`).
- `src/app/questions/components/QuestionCard.tsx`: envio de denuncia sem justificativa e fallback de compartilhar/copiar link deixaram de usar `alert()`, usando toast padronizado; warnings de memoizacao dos callbacks de comentarios foram removidos.
- `src/services/admin/__tests__/adminArchitecture.test.ts`: adicionada trava automatica para impedir retorno de `alert()` e dialogos nativos no runtime.
- `src/components/shared/feedback/AdBanner.tsx`: banners customizados do painel deixaram de executar scripts vindos do banco e agora passam pelo sanitizador de HTML rico antes de renderizar; o AdSense oficial continua carregando pelo fluxo dedicado.
- `src/services/admin/__tests__/adminArchitecture.test.ts`: adicionada trava para impedir que `AdBanner` volte a executar scripts arbitrarios em banners customizados.
- `src/components/shared/ui/RichTextEditor.tsx`: editor de comentarios agora saneia HTML antes de emitir `onChange`, aplica sanitizacao em `initialValue`, cola apenas texto puro e usa placeholder via `data-placeholder` em vez de interpolacao CSS.
- `src/services/admin/__tests__/adminArchitecture.test.ts`: adicionada trava para manter a saida do editor rico saneada e com paste controlado.
- `C:/xampp/htdocs/questao-pro-backend/config/production_preflight.php`: `API_PUBLIC_ARTIFACTS_CLEAN` foi ampliado para bloquear tambem `.env`, backups, compactados e nomes de dump/debug/temp/trace/phpinfo em `api/`.
- `C:/xampp/htdocs/questao-pro-backend/config/cors.php`: CORS ganhou ramificacao explicita de producao e nao resolve origem local quando `APP_ENV=production`.
- `C:/xampp/htdocs/questao-pro-backend/tests/ApiResidualSurfaceWiringTest.php`: superficie publica da API passou a bloquear a mesma classe ampliada de artefatos operacionais.
- `src/app/practice/page.tsx`: bootstrap de respostas do usuario em `/practice` passou para janela pos-primeiro-paint (`3.2s`), com carga imediata apenas quando o filtro `Excluir Respondidas` estiver ativo.
- `src/app/dashboard/DashboardPage.tsx`: bootstrap de respostas no dashboard passou para janela pos-primeiro-paint (`4s` + idle), removendo `users/answers.php` do hard refresh inicial de `/dashboard`.
- Baseline tecnico reexecutado (`tmp-hard-refresh-baseline-latest.json`) sem duplicatas/falhas, com reducao adicional no `/practice`:
  - `/dashboard`: `DCL=149ms`, `load=318ms`, `xhr/fetch=4`
  - `/practice`: `DCL=170ms`, `load=292ms`, `xhr/fetch=5` (antes `6`)
  - `/admin/panel/dashboard`: `DCL=175ms`, `load=400ms`, `xhr/fetch=4`
- Baseline mais recente apos defer inteligente de respostas (`dashboard` + `practice`):
  - `/dashboard`: `DCL=145ms`, `load=327ms`, `xhr/fetch=3`
  - `/practice`: `DCL=149ms`, `load=293ms`, `xhr/fetch=4`
  - `/admin/panel/dashboard`: `DCL=176ms`, `load=416ms`, `xhr/fetch=4`
- `C:/xampp/htdocs/questao-pro-backend/shared/auth/AuthLogger.php`: adicionada deduplicacao configuravel de logs de auth em janela curta para eventos ruidosos (`access_token_rejected`, `refresh_reuse_detected`, `refresh_reuse_recovered`), mantendo `AUTH_LOG_VERBOSE_EVENTS=true` como bypass total.
- Prova tecnica local da dedupe: 5 chamadas seguidas com token invalido em `api/auth/me.php` registraram 1 evento `access_token_rejected` no `error.log`.
- Validacoes desta rodada:
  - `npm run typecheck`: **ok**
  - `npm run build`: **ok**
  - `npx vitest run src/config/__tests__/securityHeaders.test.ts`: **ok**, 4 testes
  - `npx tsc --noEmit --pretty false --incremental false`: **ok**
  - `npm run check:text-encoding`: **ok**
  - `npm run check:hard-refresh-budget`: **ok**
  - `npx eslint src/app/profile/ProfilePage.tsx src/app/questions/components/QuestionCard.tsx --max-warnings=0`: **ok**
  - `npx vitest run src/services/admin/__tests__/adminArchitecture.test.ts`: **ok**
  - `npx eslint src/components/shared/feedback/AdBanner.tsx --max-warnings=0`: **ok**
  - `npx eslint src/components/shared/ui/RichTextEditor.tsx --max-warnings=0`: **ok**
  - `C:\xampp\php\php.exe -l config/cors.php`: **ok**
  - `ProductionPreflightWiringTest.php`: **ok**
  - `ProductionPreflightBehaviorTest.php`: **ok**
  - `ApiResidualSurfaceWiringTest.php`: **ok**
- `npm run check:production-local`: **ok**; cobre encoding, typecheck, hard-refresh budget e suites criticas (`adminArchitecture`, `privateSeo`, `landingPages`, `questionHtmlSanitizer`, `StableResponsiveContainer`, `securityHeaders`)
- `npm run check:production-local -- --with-build`: **ok**; preflight consolidado com build de producao completo.
- `C:\xampp\php\php.exe -l shared/auth/AuthLogger.php`: **ok**
- `tests/AuthModuleWiringTest.php`: **ok**
- `scripts/tasks/production_smoke.php`: **ok** (API/web/DB sem regressao apos ajustes de lazy bootstrap)
- `src/app/admin/components/support/AdminFeedback.tsx`: interface de feedback do admin foi migrada para list table no padrao WordPress (filtros + tabela + conversa expandida por linha), reduzindo UI card-heavy.
- `src/app/admin/components/settings/LogViewer.tsx`: logs agora explicam e alternam modo de exibicao (`Todas as linhas` vs `So repetidos`) sem perder categorizacao e destaque de frequencia.
- `src/app/auth/components/Auth.tsx` + `modules/auth/*`: Google login passou a tentar apenas autenticacao no primeiro passo; quando a conta nao existe, exige `nome + telefone` para concluir cadastro social. Backend valida e persiste telefone no cadastro Google.

## Atualizacao incremental (`2026-05-07`)

- `src/providers/NextAppProviders.tsx`: removido `Suspense fallback={null}` no topo da arvore para eliminar tela vazia inicial no `/auth` e reduzir mismatch de hidratacao observado em runtime.
- `scripts/checks/hard-refresh-baseline.mjs`: login tecnico ficou resiliente (candidatos de senha, seletor estrito do submit e tratamento de captcha/loading), estabilizando a coleta automatica do baseline.
- `src/app/admin/components/navigation/AdminNavigationSidebar.tsx`: link de retorno para home no sidebar admin passou a usar `prefetch={false}`, reduzindo requests antecipados desnecessarios no hard refresh.
- `src/app/admin/components/support/AdminCommentsModerationSection.tsx`: fila de moderacao ganhou cache curto + compartilhamento de request em voo + guarda por chave carregada, reduzindo rajadas de `comments_moderation.php`.
- `src/app/admin/components/dashboard/AdminDashboard.tsx`: snapshot cache + dedupe in-flight por periodo para `stats` e `analytics`, reduzindo re-fetch por remount/troca rapida de secao.
- `src/app/admin/components/shared/useAdminPageController.tsx` + `src/app/admin/components/dashboard/AdminDashboard.tsx`: o painel `dashboard` deixou de prefetchar `reportsList` no primeiro paint e passou a usar `dashboardAnalytics.counts.reports_count` para o contador de denuncias abertas; o preload de denuncias ficou restrito a `support/reports` e `panel/alerts`.
- `src/app/admin/components/shared/useAdminPageController.tsx`: o controller do admin passou a inicializar o estado da aba/secao pela rota real na primeira renderizacao, removendo montagem transitoria de `panel/dashboard` em paginas de suporte e evitando fetch desnecessario de `analytics_dashboard`.
- `scripts/checks/hard-refresh-baseline.mjs`: baseline passou a registrar `failedRequests` e `xhrFetchSummary` por rota (top endpoints XHR/fetch), deixando o diagnostico de carga inicial auditavel.
- `scripts/checks/hard-refresh-baseline.mjs`: baseline agora tambem salva automaticamente o ultimo snapshot em `tmp-hard-refresh-baseline-latest.json`, facilitando comparacao entre rodadas sem redirecionamento manual.
- `modules/auth/services/AuthService.php`, `modules/auth/controllers/AuthController.php`, `modules/auth/routes.php`, `src/services/auth/session.ts` e `src/services/auth/__tests__/session.test.ts`: bootstrap de autenticacao passou a reaproveitar o payload de usuario no `refresh.php` (quando solicitado), removendo a chamada extra de `auth/me.php` no hard refresh logado.
- `src/providers/NotificationsProvider.tsx`: o primeiro fetch de notificacoes saiu do bootstrap imediato e passou para janela pos-primeiro-paint (delay controlado), reduzindo carga inicial em hard refresh sem perder polling/foco.
- `src/app/admin/components/dashboard/AdminDashboard.tsx`: o card "Feedback recente" passou a carregar apos o primeiro paint; `admin/feedback.php` saiu do bootstrap imediato do `panel/dashboard`.
- `src/app/admin/components/import/useAdminImportWorkflow.ts`, `src/app/admin/components/questions/AdminQuestionEditorPage.tsx`, `src/app/admin/components/questions/ManualQuestionModal.tsx`, `src/app/practice/page.tsx` e `docs/reports/production-fix-backlog-latest.md`: textos com mojibake foram normalizados, e `npm run check:text-encoding` voltou a passar.
- `src/app/practice/page.tsx`: removida duplicidade de alias textual (`descricao`/`descricao com acento`) e callbacks sensiveis foram estabilizados com chaves primitivas (`currentUserId`/`currentUserName`), preservando typecheck/lint/build no recorte.
- `scripts/tasks/production_preflight.php`: reexecutado em ambiente local de desenvolvimento; resultado esperado `fail` para requisitos de deploy publico (APP_ENV=production, APP_URL HTTPS publico, CORS sem localhost, credenciais/segredos de producao e usuario DB dedicado).
- `scripts/tasks/production_log_audit.php`: reexecutado; sem bloqueio operacional nesta rodada (`fail_on=none`), mas com alta repeticao de logs informativos de auth (`refresh_rotated`/`auth_session_created`) e ausencia esperada do arquivo legado `api/subscriptions/subscription_cron.log`.
- `scripts/tasks/production_smoke.php`: reexecutado com sucesso apos as mudancas, cobrindo API/web/DB localmente sem regressao funcional.
- Baseline tecnico (`tmp-hard-refresh-baseline-latest.json`) confirmou ausencia de duplicatas e falhas em `GET`/`POST` XHR/fetch nas rotas criticas:
  - `/dashboard`
  - `/practice`
  - `/admin/panel/dashboard`
- Metricas locais desta rodada:
  - `/dashboard`: `DCL=250ms`, `load=492ms`, `xhr/fetch=7`
  - `/practice`: `DCL=266ms`, `load=545ms`, `xhr/fetch=10`
  - `/admin/panel/dashboard`: `DCL=2070ms`, `load=2371ms`, `xhr/fetch=8`
- Metricas locais apos o corte de `reportsList` no primeiro paint do painel:
  - `/dashboard`: `DCL=291ms`, `load=507ms`, `xhr/fetch=6`
  - `/practice`: `DCL=296ms`, `load=497ms`, `xhr/fetch=10`
  - `/admin/panel/dashboard`: `DCL=346ms`, `load=584ms`, `xhr/fetch=7`
- Metricas locais mais recentes (apos escopo de `user-progress` e sincronizacao de estatisticas por rota):
  - `/dashboard`: `DCL=230ms`, `load=455ms`, `xhr/fetch=6`
  - `/practice`: `DCL=247ms`, `load=456ms`, `xhr/fetch=8`
  - `/admin/panel/dashboard`: `DCL=317ms`, `load=645ms`, `xhr/fetch=7`
- Metricas locais apos otimizar bootstrap de auth (sem `auth/me` no hard refresh logado):
  - `/dashboard`: `DCL=144ms`, `load=310ms`, `xhr/fetch=5`
  - `/practice`: `DCL=140ms`, `load=283ms`, `xhr/fetch=7`
  - `/admin/panel/dashboard`: `DCL=176ms`, `load=399ms`, `xhr/fetch=6`
- Metricas locais apos defer inteligente do bootstrap de notificacoes:
  - `/dashboard`: `DCL=135ms`, `load=296ms`, `xhr/fetch=4`
  - `/practice`: `DCL=174ms`, `load=302ms`, `xhr/fetch=6`
  - `/admin/panel/dashboard`: `DCL=175ms`, `load=395ms`, `xhr/fetch=5`
  - `/admin/support/comments`: `DCL=167ms`, `load=371ms`, `xhr/fetch=4`
- Metricas de validacao consolidada da rodada (mesma execucao com 4 rotas):
  - `/dashboard`: `DCL=127ms`, `load=297ms`, `xhr/fetch=4`
  - `/practice`: `DCL=126ms`, `load=272ms`, `xhr/fetch=6`
  - `/admin/panel/dashboard`: `DCL=184ms`, `load=436ms`, `xhr/fetch=4`
  - `/admin/support/comments`: `DCL=232ms`, `load=465ms`, `xhr/fetch=4`
- O endpoint `GET /questao-pro-backend/api/reportsList` deixou de aparecer no baseline de hard refresh do `panel/dashboard`.
- Rota de risco revalidada: `/admin/support/comments` ficou com `DCL=177ms`, `load=374ms`, `xhr/fetch=5`, sem duplicatas e sem falhas (`comments_moderation` chamado 1x no reload).
- `production_smoke.php` repetido em duas rodadas:
  - rodada fria (logo apos mudancas): `/questions` e `/question/[id]` altos por compilacao inicial do dev server;
  - rodada aquecida: `/questions` ~`200ms`, `/question/[id]` ~`530ms`, sem falhas HTTP.

## Atualizacao incremental (`2026-05-05`)

- Moderacao de comentarios no admin recebeu guarda contra reload redundante por mesma chave de filtro/pagina (`force` apenas em refresh manual e acoes de moderacao), reduzindo risco de rajada em `comments_moderation.php`.
- Fluxo de suporte deixou de depender da identidade instavel de callback para prefetch de contagem pendente, evitando relaunch involuntario de leitura quando o estado do pai muda.
- Link legado `#/auth` da area de comentarios foi normalizado para `/auth`, reduzindo chance de cair no caminho hash-legado que pode disparar bootstrap desnecessario.
- `marketplaceService` agora aplica coalescencia curta em listagens de materiais/transacoes, reduzindo chamadas repetidas por remount em hard refresh.
- Polling de notificacoes ignora eventos de foco/visibilidade quando a aba nao esta visivel, reduzindo refetch redundante.
- `AppConfigProvider` agora segura fetch publico de settings enquanto existe token em memoria sem usuario resolvido, evitando dupla leitura `settings` (public/admin) em janelas de hidratacao.
- `question-bank` e `user-progress` passaram a aguardar `authIsLoading=false` antes de qualquer fetch, reduzindo bootstrap em contexto de sessao ainda em resolucao.
- `StudyTrackerBridge` ganhou chave de sincronizacao por usuario/escopo para evitar round-trip duplicado de `statistics/user` em remounts curtos.
- `notificationService.sendNotification` nao dispara request quando o access token esta ausente/vencido, reduzindo 401 ruidosos em fluxos de notificacao best-effort.
- `shared/security/Recaptcha.php` recebeu bypass controlado apenas para localhost + credenciais oficiais de teste do Google, evitando falso bloqueio no desenvolvimento sem afrouxar producao.
- `AppConfigProvider` passou a buscar configuracoes admin somente em rotas `/admin`, mantendo `settings` publicas no shell de estudo mesmo para usuarios admin e reduzindo payload inicial fora do painel.
- `StudyTrackerBridge` ganhou janela de TTL na sincronizacao persistida de `statistics/user` por usuario, evitando novo fetch a cada troca curta entre dashboard e paginas de estudo.
- `MarketplaceProvider` deixou de depender do objeto `currentUser` inteiro para recarregar transacoes e passou a usar chaves estaveis (`userId` + privilegio), reduzindo refetch por mudancas nao relacionadas.
- `MarketplaceProvider` restringiu preload de materiais/transacoes do admin para rotas de dominio (`/admin/marketplace` e `/admin/finance`), reduzindo carga no hard refresh das demais abas.
- `useAdminPageController` trocou preload global de datasets por preload condicional por aba/secao (users/taxonomias/rankings/reports) e consolidou contadores de suporte (`feedback`, `pending_comments`, `refund_requests`) em uma unica chamada `adminService.getStats`.
- `adminService.getReports` recebeu coalescencia curta para amortecer remounts no shell admin.
- Confirmacoes criticas do admin deixaram de usar dialogo nativo do navegador (`window.confirm`) e passaram para o modal padrao da plataforma em Lei Comentada, Visualizador de Logs e exclusao de Prova.
- `NavigationProgressProvider` e `NextRouteFrame` receberam documentacao tecnica inline para o fluxo de navegacao (`progress` + compatibilidade de hash legado) e a suite de arquitetura foi atualizada para refletir o roteamento real em Next.
- Validacao local desta rodada: `eslint` direcionado (support), `npm run typecheck` e `npm run build` passaram.

## Resumo executivo

A plataforma esta em bom estado para uma rodada de staging controlado, mas ainda nao deve ser aberta em producao publica. O build Next passa, o typecheck passa, o lint raiz retorna sucesso com avisos e a suite PHP local selecionada passa, mas ainda existem bloqueios de operacao e prova real que impedem um "go live" seguro.

O principal motivo do veredito e a soma destes pontos:

- Pagamentos Stripe tem boa cobertura local, mas ainda falta prova real de checkout, webhook publico, renovacao, cancelamento e reembolso em sandbox com dominio/tunel controlado.
- O historico local ja mostrou `Too many connections`; a camada de banco agora le `.env` e os crons criticos tem trava local, mas ainda falta prova de carga em ambiente parecido com a VPS.
- Notificacoes e gamificacao tinham lacunas funcionais. Comentarios moderados, feedback/suporte, denuncias, curtidas sociais, rankings com recompensas basicas, campanhas automaticas, compras/reembolsos de materiais, gamificacao de marketplace, streaks e badges basicos foram corrigidos localmente, mas a matriz completa ainda precisa provar os eventos financeiros em gateway real.
- O lint raiz foi estabilizado, mas ainda existem muitos avisos de tipagem e regras React que precisam ser reduzidos por dominio.

## Correcoes aplicadas nesta auditoria

Backend PHP em `C:/xampp/htdocs/questao-pro-backend`:

- `config/database.php`: passou a ler `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASS` e `DB_PASSWORD` do `.env`, mantendo fallback local.
- `.env.example`: documenta variaveis de banco, cron, app URL/timezone e Stripe.
- `modules/users/services/UsersCardsStripeSupport.php`: aceita PaymentMethod Stripe com formato usado pelo SDK/testes e evita duplicar o mesmo cartao local quando o identificador remoto muda.
- `scripts/tasks/sync_mercadopago_preapproval_plans.php`: adiciona entrypoint CLI explicito para cron legado do Mercado Pago, retornando erro operacional claro porque o provider foi removido.
- `modules/notifications/repositories/NotificationsRepository.php`: garante schema atual de notificacoes, amplia `id` para 64 chars, cria colunas `category`, `evidence_url`, `deleted_at` e esconde notificacoes apagadas logicamente.
- `database/schema.sql`: atualiza a tabela `notifications` para o contrato atual.
- `config/notification_helper.php`: cria notificacoes para admins e garante o schema de notificacoes quando usado por fluxos auxiliares.
- `modules/comments/*`, `modules/reports/*`, `modules/feedback/*`, `modules/materials/services/MaterialsService.php`: eventos que entram em suporte/moderacao agora notificam admins.
- `config/cron_lock.php`: adiciona trava exclusiva nao bloqueante para jobs de cron e validacao do `CRON_SECRET` antes de abrir conexao MySQL nos crons criticos.
- `api/subscriptions/cron_stripe_reconciliation.php` e `api/tasks/ProcessRewards.php`: validam segredo e adquirem lock antes da conexao de banco.
- `api/subscriptions/automation_helper.php` e `modules/subscriptions/routes.php`: a acao administrativa `run_now` da reconciliacao Stripe passou a carregar o helper de lock e reutilizar `subscriptions_stripe_reconciliation`, evitando execucao paralela por clique duplo, abas simultaneas ou operador concorrente.
- `api/subscriptions/cron_recurring.php` e `api/subscriptions/cron_scheduled_payments.php`: deixam de abrir MySQL para bridges removidas do Mercado Pago.
- `modules/admin/repositories/AdminCommentsModerationRepository.php`: status de moderacao agora notifica o autor e, ao aprovar, dispara notificacoes sociais de resposta/material.
- `modules/subscriptions/services/SubscriptionsService.php`: falha de cobranca Stripe (`past_due`) notifica admins, e reembolso pendente de assinatura passa a notificar todos os admins ativos no app.
- `modules/questions/services/QuestionsRewardService.php` e `modules/questions/repositories/QuestionsRepository.php`: respostas passam a atualizar streak diario e badges idempotentes (`user_streaks`, `user_badges`).
- `scripts/tasks/backup_mysql.php`: cria dump MySQL com `mysqldump`, credenciais temporarias fora da linha de comando, flags seguras para producao, checksum SHA-256 e retencao.
- `scripts/tasks/verify_mysql_backup.php`: valida existencia, tamanho, checksum e marcadores de dump MySQL/MariaDB antes de qualquer ensaio de restore.
- `scripts/tasks/restore_mysql_backup.php`: adiciona restore operacional com dry-run por padrao, bloqueio contra restore acidental no banco atual, validacao de checksum/dump e recusa de dumps com `DROP DATABASE`, `CREATE DATABASE` ou `USE` de schemas de sistema.
- `scripts/tasks/production_smoke.php`: valida endpoints publicos criticos da API e do frontend (`/`, `/auth`, `/practice`, `/questions`, `/question/[id]`), JSON de resposta e uma prova leve de conexoes MySQL com `Threads_connected`/`max_connections`.
- `modules/admin/services/AdminSystemLogAnalyzer.php`: classifica logs por severidade/categoria e calcula repeticoes para o painel admin.
- `scripts/tasks/production_log_audit.php`: permite auditoria CLI dos logs com janela configuravel, limiar de repeticao e falha em evento critico.
- `src/config/securityHeaders.ts` e `next.config.ts`: aplicam headers de seguranca no frontend, incluindo CSP, bloqueio de framing, `nosniff`, referrer e permissions policy.
- `src/services/system/useRecaptchaV3.ts`, `src/app/auth/components/Auth.tsx`, `src/app/reset-password/page.tsx`, `src/app/checkout/CheckoutPage.tsx`, `src/config/securityHeaders.ts`, `src/config/__tests__/securityHeaders.test.ts`, `modules/auth/routes.php`, `modules/auth/validators/AuthValidator.php` e `shared/security/Recaptcha.php`: login, cadastro e reset migraram para reCAPTCHA v3 invisivel, com validacao por `action` e `score`, carregamento do script liberado na CSP e loading visual no botao de autenticacao do checkout para evitar multiplos cliques.
- `src/providers/ThemeProvider.tsx` e `modules/admin/services/AdminSettingsService.php`: a hidratacao inicial do tema ficou estavel entre SSR/cliente, reduzindo o reload apos a pagina pronta, e as settings publicas passaram a zerar `recaptchaSiteKey` quando o reCAPTCHA estiver desativado/incompleto para nao reativar o fluxo de captcha por engano no frontend.
- `src/components/shared/layout/Layout.tsx`, `src/app/practice/page.tsx` e `src/providers/DataProvider.tsx`: o layout principal deixou de ler `window.location.hash` durante a renderizacao e a pagina de pratica ganhou bootstrap proprio de questoes; mesmo se o preload global atrasar, `/practice` agora busca a primeira pagina e atualiza `totalQuestions`, evitando tela vazia.
- `src/providers\DataProvider.tsx`, `src/providers\MarketplaceProvider.tsx`, `src/app/dashboard/DashboardPage.tsx`, `src/app/performance-subjects/PerformanceSubjectsPage.tsx`, `src/app/profile/ProfilePage.tsx`, `src/app/cronograma/page.tsx`, `src/app/simulation/page.tsx` e `src/app/practice/page.tsx`: o bootstrap de questoes deixou de ser reflexo global da aplicacao e passou a carregar por rota/necessidade, enquanto o provider de marketplace passou a buscar materiais/transacoes somente nas areas que realmente usam esse dominio. Isso corta requests desnecessarias em hard refresh de landing, auth e home logada.
- `src/app/page.tsx` e `src/app/HomePageClient.tsx`: a rota raiz passou a detectar cookies de sessao no servidor. Com isso, hard refresh de usuario logado nao serve mais HTML de landing antes do bootstrap da auth; a home entra direto em shell leve e conclui para dashboard ou landing no cliente apos a sessao estabilizar.
- `src/services/api/requestCoalescer.ts`, `src/services/admin/adminService.ts`, `src/services/plans/planService.ts`, `src/services/marketing/homeTestimonials.ts`, `src/services/progress/userProgressService.ts`, `src/services/comments/commentsService.ts`, `src/services/questions/questionService.ts` e `src/providers/DataProvider.tsx`: leituras quentes ganharam coalescencia de request e o bootstrap do `DataProvider` passou a esperar a auth terminar, reduzindo a rajada de hard refresh que fazia settings/questoes/progresso repetirem sem necessidade.
- `src/services/statistics/statisticsService.ts`, `src/services/dashboard/dailyMotivationContentService.ts`, `src/services/statistics/studyTrackerStore.ts`, `src/providers/StudyTrackerProvider.tsx`, `src/services/dashboard/dashboardInsightsService.ts` e `src/app/dashboard/DashboardPage.tsx`: o dashboard deixou de depender de `questionsList` no primeiro paint, passou a reaproveitar `subjectBreakdown` vindo de `statistics/user`, deduplicou `statistics/user` e `motivacoes-diarias.md`, e moveu respostas/motivacao diaria para carga em baixa prioridade. Isso elimina o `questionsList?user_id=...` do hard refresh de `/dashboard` e reduz o peso inicial sem perder os cards principais.
- `package.json`, `src/providers/QueryProvider.tsx`, `src/providers/AppConfigProvider.tsx`, `src/state/query/queryClient.ts`, `src/state/app-config/*`, `src/providers/AppProviders.tsx` e `src/providers/DataProvider.tsx`: a plataforma ganhou a fundacao da nova arquitetura com `@tanstack/react-query` + `zustand`, e o primeiro dominio migrado foi `systemSettings`. O fetch das configuracoes globais saiu do bootstrap interno do `DataProvider` e passou a hidratar um store dedicado, mantendo compatibilidade com `useData()` enquanto o monolito e desmontado por partes.
- `src/state/question-bank/*` e `src/providers/DataProvider.tsx`: o banco de questoes saiu do reducer central e foi migrado para store dedicado com `zustand` + cache de query. Bootstrap inicial, paginacao progressiva, salvar questao, comentarios e atualizacao local de estatisticas agora usam esse dominio especializado, reduzindo duplicacao de estado e removendo mais um bloco legado do `DataProvider`.
- `src/state/admin-data/*` e `src/providers/DataProvider.tsx`: usuarios, denuncias e rankings tambem sairam do reducer central. O provider agora usa store dedicado + cache de query para carga preguicosa (`ensureUsersLoaded`, `ensureReportsLoaded`, `ensureRankingsLoaded`) e para mutacoes locais de admin/social, reduzindo ainda mais o tamanho do monolito e separando melhor o dominio administrativo do dominio de estudo.
- `src/providers/DataProvider.tsx`: o restante do shell de `useReducer` foi desmontado, `dispatch` saiu do contexto, taxonomias passaram a usar flag local dedicada e os callbacks deixaram de capturar `currentUser` inteiro, migrando para derivacoes estaveis como `currentUserId`, `currentUserName` e `currentUserIsAdmin`. O dominio continua passando em `tsc` e `build`; a rodada atual fechou os 2 warnings de memoizacao do React Compiler nos fluxos de atualizar/excluir questao (`npx eslint src/providers/DataProvider.tsx --max-warnings=0`).
- `src/app/auth/components/Auth.tsx`, `src/app/bank-analysis/BankAnalysisPage.tsx`, `src/app/checkout/CheckoutPage.tsx`, `src/app/concursos/page.tsx`, `src/app/dashboard/DashboardPage.tsx`, `src/app/flashcards/page.tsx`, `src/app/lei-comentada/page.tsx`, `src/app/promo/PromoPage.tsx`, `src/app/reset-password/page.tsx`, `src/app/support/page.tsx`, `src/components/shared/feedback/AdBanner.tsx`, `src/components/shared/feedback/DevModeBanner.tsx`, `src/components/shared/feedback/PromoBanner.tsx`, `src/components/shared/layout/PublicBrandLink.tsx`, `src/components/shared/overlays/UpgradeModal.tsx`, `src/providers/NextRouteFrame.tsx`, `src/app/planos/hooks/useMarketingPlansLanding.ts`, `src/app/plans/page.tsx` e `src/app/landing/components/LandingCommercialPage.tsx`: consumidores que liam apenas `systemSettings` deixaram de depender de `useData()` e passaram a ler `useAppConfigStore` direto. A contagem de arquivos com `useData()` caiu de 40 para 21 sem quebrar `typecheck`/`build`.
- `src/state/notifications/useNotificationsActions.ts`, `src/app/notifications/page.tsx`, `src/app/partner-dashboard/page.tsx` e `src/components/shared/layout/Layout.tsx`: o dominio de notificacoes ganhou hook dedicado de mutacoes (store + service) e essas superficies deixaram de depender de `useData()` para leitura/acao de notificacoes. A contagem de arquivos de runtime com `useData()` caiu de 21 para 17 mantendo `eslint` direcionado, `typecheck` e `build` verdes.
- `src/state/admin-data/useAdminDataActions.ts`, `src/state/app-config/useTaxonomyActions.ts`, `src/app/ranking/page.tsx`, `src/app/admin/operation/users/[userId]/edit/page.tsx`, `src/app/admin/components/finance/AdminFinance.tsx`, `src/app/admin/components/shared/AdminStandaloneShell.tsx`, `src/app/admin/components/database/useAdminTaxonomyWorkflow.ts` e `src/app/admin/components/shared/useAdminPageController.tsx`: a camada admin ganhou hooks dedicados para `rankings`, `users` e `taxonomies`; `Ranking` e `user edit standalone` deixaram de depender de `useData()`, o shell standalone admin passou a ler notificacoes/settings dos stores dedicados e `AdminFinance` passou a receber `saveSystemSettingsNow` por props em vez de acoplar direto no provider. A contagem de arquivos de runtime com `useData()` caiu de 17 para 12, com `typecheck` e `build` verdes.
- `src/state/app-config/useSystemSettingsActions.ts`, `src/state/question-bank/useQuestionBankActions.ts`, `src/state/user-progress/useUserProgressActions.ts`, `src/app/admin/operation/marketing/landing-pages/[landingId]/edit/page.tsx`, `src/app/marketplace/page.tsx`, `src/app/cronograma/page.tsx`, `src/app/simulation/page.tsx` e `src/app/performance-subjects/PerformanceSubjectsPage.tsx`: os dominios de settings, banco de questoes e progresso de usuario ganharam actions hooks dedicados. Com isso, `marketplace`, `cronograma`, `simulation`, `performance-subjects` e o editor standalone de landing pages admin sairam de `useData()`. A contagem de arquivos de runtime com `useData()` caiu de 12 para 7 mantendo `typecheck` e `build` verdes.
- `src/app/profile/ProfilePage.tsx`: o perfil passou a consumir `systemSettings`, banco de questoes e progresso via stores/hooks dedicados (`useAppConfigStore`, `useQuestionBankActions`, `useUserProgressActions`), removendo mais uma dependencia direta do `DataProvider`. A contagem de arquivos de runtime com `useData()` caiu de 7 para 6, ainda com `typecheck` e `build` verdes.
- `src/state/admin-data/useAdminDataActions.ts`, `src/app/admin/operation/questions/[questionId]/edit/page.tsx`, `src/app/admin/operation/exams/[examId]/edit/page.tsx`, `src/app/questions/components/QuestionCard.tsx`, `src/providers/MarketplaceProvider.tsx`, `src/app/admin/components/shared/useAdminPageController.tsx` e `src/app/practice/page.tsx`: edit pages admin, card de questao, provider de marketplace, controller admin e a pagina de pratica migraram para stores/actions dedicados, sem depender do `DataProvider` para reports, taxonomias, settings, notificacoes, usuarios, respostas, comentarios e denuncias. A contagem de arquivos de runtime com `useData()` caiu de 6 para 0, com `typecheck` e `build` verdes.
- `src/app/auth/page.tsx`, `src/components/shared/charts/StableResponsiveContainer.tsx`, `src/services/filters/index.ts` e `src/services/admin/adminService.ts`: o smoke real levou a uma rodada de estabilizacao de runtime. O `/auth` deixou de depender de estado de hidratacao artificial, os graficos passaram a montar com dimensoes numericas em vez de `ResponsiveContainer` cego, `filtersList` ganhou coalescencia e chamadas quentes do admin (`stats`, `analytics_dashboard`, `feedback`, `comments_moderation`) passaram a compartilhar request em janela curta.
- `src/services/statistics/statisticsService.ts` e `src/services/progress/userProgressService.ts`: leituras quentes de `statistics/user`, respostas e notas ganharam janela maior de coalescencia para amortecer remounts/strict mode durante hard refresh e smoke local.
- `config/env.php`, `config/cors.php` e `modules/materials/routes.php`: a politica de CORS foi centralizada. Em producao continua exigindo origens explicitas e sem localhost; fora de producao, loopback local (`localhost`, `127.0.0.1`, `::1`) passou a ser aceito em qualquer porta, e o dominio de materiais deixou de refletir `Origin` arbitrario em respostas binarias. Isso destravou smoke de `next start` local em `:3101`, aproximando a validacao de staging sem abrir brecha em producao.
- `src/components/shared/layout/Layout.tsx`, `src/components/shared/layout/DashboardSidebar.tsx` e `src/components/shared/layout/PublicBrandLink.tsx`: o prefetch automatico do Next foi desligado na navegacao global do shell logado. Antes, o hard refresh disparava uma tempestade de requests `_rsc` para quase todas as rotas visiveis do menu; depois do ajuste, o smoke em `next start` local caiu para `31` requests em `/dashboard`, `33` em `/practice` e `44` em `/admin`, sem falhas HTTP e sem duplicatas relevantes alem de favicon.
- `src/app/profile/ProfilePage.tsx` e `src/services/billing/cardsService.ts`: o perfil deixou de carregar o banco de questoes completo na aba pessoal e passou a lazy-load esse dominio apenas em `notebook`/`saved-questions`; alem disso, a listagem de cartoes salvos ganhou coalescencia e o formulario Stripe virou import dinamico, evitando bootstrap do SDK logo ao entrar no perfil. No smoke de `next start` local, `/profile` caiu para `37` requests e ~`4,6s`, sem duplicatas relevantes alem de favicon.
- `modules/comments/services/CommentsService.php` e `src/providers/DataProvider.tsx`: comentarios voltaram a ser publicados aprovados por padrao, sem cair automaticamente na fila de moderacao e sem toast de sucesso redundante no frontend.
- `modules/notifications/services/NotificationsService.php`, `modules/notifications/repositories/NotificationsRepository.php` e `src/providers/DataProvider.tsx`: envio para pseudo-destinatarios `admin` e `all` agora faz fan-out para IDs reais, removendo o erro de FK em `notifications.user_id`; o frontend tambem parou de espelhar localmente notificacoes que falharam no backend.
- `src/app/admin/components/support/AdminCommentsModerationSection.tsx` e `src/app/admin/components/support/AdminSupportSection.tsx`: a fila de moderacao de comentarios deixou de recarregar em loop por callback recriado no pai.
- `src/app/questions/components/QuestionCard.tsx`: `Leis Relacionadas` agora so aparece para questoes com materia juridica, e o fetch de leis passou a depender do escopo juridico da questao, nao de qualquer mudanca irrelevante no objeto da questao.
- `src/components/shared/layout/Layout.tsx`: o dropdown de notificacoes saiu da criacao inline durante render, o preview de evidencia passou para `next/image`, a revalidacao de e-mail ficou tipada e o recorte agora passa em `eslint` e `tsc`, reduzindo risco no shell global.
- `config/security_headers.php` e `config/cors.php`: aplicam headers equivalentes na API; HSTS fica condicionado a `APP_ENV=production`.
- `config/production_preflight.php`: passou a validar que os headers criticos da API continuam configurados, que `APP_ENV=production`, que `APP_URL` nao aponta para localhost e que CORS de producao usa origens validas, HTTPS e sem wildcard.
- `modules/admin/services/AdminDatabaseMaintenanceService.php`: reset administrativo de banco agora usa `APP_ENV=production` como guarda autoritativo, fica bloqueado por padrao em producao e exige `ADMIN_DATABASE_RESET_ENABLED` + confirmacao operacional quando habilitado.
- `config/production_preflight.php`: falha se `ADMIN_DATABASE_RESET_ENABLED` estiver ativo durante release/producao publica.
- `shared/security/UploadSecurity.php`: centraliza validacao de uploads por MIME real, tamanho, erro, conteudo basico e extensoes perigosas no nome original.
- `modules/materials/validators/MaterialsValidator.php`, `modules/questions/validators/QuestionsValidator.php`, `modules/users/validators/UsersValidator.php`: uploads passam pelo helper central.
- `uploads/.htaccess`: bloqueia listagem, CGI e acesso a extensoes executaveis/script em Apache.
- `shared/middleware/RateLimiter.php`: endurece rate limiting com perfis por rota, armazenamento bloqueado por lock, identificadores hash e proxy headers confiaveis somente por opt-in.
- `modules/auth/routes.php`: limita login, cadastro, Google login, refresh, recuperacao/reset/confirmacao de senha e 2FA por IP e por assunto sensivel quando aplicavel.
- `modules/comments/routes.php`, `modules/feedback/routes.php`, `modules/reports/routes.php`, `modules/materials/routes.php`, `modules/questions/routes.php`, `modules/users/routes.php`: aplicam limites nos pontos de escrita social/suporte/denuncia e uploads.
- `modules/analytics/routes.php`, `modules/analytics/services/AnalyticsTrackingService.php` e `modules/analytics/validators/AnalyticsTrackingValidator.php`: tracking passa por rate limit proprio, ignora `userId` enviado pelo cliente, usa o usuario autenticado da sessao quando existir e limita `metadata`/`externalHooks` por tamanho.
- `modules/legal_commentary/routes.php` e bridges admin em `api/legal-commentary/admin/*`: rotas administrativas da Lei Comentada ficam amarradas a `requireAdminSessionContext($db)`.
- `config/production_preflight.php`: valida que o runtime de rate limiting existe e e gravavel antes do release.
- `modules/study_schedule/*`, `api/study-schedule/*`, `database/migrations/20260501_user_study_schedules.sql` e `database/schema.sql`: cronograma Elite passa a persistir no backend por usuario, com validacao de payload, modulo ativavel e bloqueio server-side para Elite/admin.
- `src/app/cronograma/page.tsx`, `src/services/study-schedule/*` e `src/services/api/endpoints.ts`: tela de cronograma carrega/salva na conta, migra snapshot local antigo e usa localStorage apenas como fallback offline.
- `api/subscriptions/subscription_cron.log`: artefato operacional removido da superficie publica da API.
- `modules/subscriptions/services/SubscriptionsService.php`: log interno do cron de assinaturas passa a ser gravado em `storage/logs/subscriptions/subscription_cron.log`, fora da pasta publica `api/`.
- `config/production_preflight.php`: agora falha se logs, dumps SQL ou textos operacionais aparecerem dentro de `api/`.
- `modules/settings/routes.php`, `modules/admin/routes.php` e `modules/admin/services/AdminSettingsService.php`: leitura publica de settings deixou de usar auth opcional, leitura admin agora exige admin/staff tambem no GET e a projecao publica oculta `stripeKey` legado.
- `config/stripe.php`, `config/production_preflight.php` e `modules/admin/validators/AdminSettingsValidator.php`: chaves Stripe agora precisam ter formato real (`pk_*`, `sk_*`, `whsec_*`), o runtime nao aceita secret key fake como configurada, o painel barra valores invalidos e o preflight detecta mistura test/live.
- `api/subscriptions/webhook_stripe.php`: alias compativel criado para apontar ao endpoint canonico `stripe_webhook.php`, evitando configuracao errada no Stripe por divergencia de nomenclatura.
- `modules/payments/services/PaymentsService.php`: configuracao publica de pagamentos so expoe `publishableKey` Stripe valida e so marca `stripeConfigured` quando publishable e secret key estao validas.
- `modules/payments/routes.php`, `controllers/PaymentsController.php` e `services/PaymentsService.php`: verificacao tardia de PaymentIntent (`verify-payment.php`) agora exige usuario autenticado e confirma que o pagamento pertence a esse usuario antes de liberar acesso.
- `modules/payments/validators/PaymentsValidator.php`: URLs de retorno do Stripe Connect ficam restritas a `APP_URL`/`CORS_ALLOWED_ORIGINS` e exigem HTTPS quando `APP_ENV=production`.
- `src/config/siteUrl.ts`: canonicals, robots e sitemap passam a respeitar `NEXT_PUBLIC_CANONICAL_URL`, que ja estava nos exemplos de ambiente.
- `modules/auth/services/AuthService.php`: Google OAuth valida o formato do Client ID backend antes de aceitar tokens e continua exigindo `aud` compativel com o aplicativo configurado.
- `src/config/googleAuth.ts` e `src/app/auth/components/Auth.tsx`: Google OAuth usa apenas Client ID valido no formato `*.apps.googleusercontent.com`, evita carregar script com valor vazio/placeholder e mostra fallback indisponivel se o script externo falhar.
- `src/app/auth/*`, `src/providers/AuthProvider.tsx`, `src/app/question/questionSeo.ts` e `src/app/question/[id]/[[...slug]]/page.tsx`: textos mojibake de login e SEO publico foram normalizados.
- `src/app/cronograma/layout.tsx` e `src/services/seo/sitemapData.ts`: cronograma Elite deixou de ter canonical publico, passou a usar `noindex` e entrou no `robots` disallow.
- `src/services/questions/questionPublication.ts`: visibilidade `elite`/`internal` agora tambem bloqueia a exposicao publica da questao, inclusive na pagina SEO e nas listas publicas.
- `src/services/seo/sitemapData.ts`: sitemap dinamico filtra questoes nao publicas, materiais pendentes/rejeitados, rankings pendentes/rejeitados e inclui landings publicadas em `/l/[slug]` sem duplicar `/planos`/`/elite`.
- `src/components/__tests__/PageTransition.test.tsx`: cobre render server-side estavel do `PageTransition`, sem `opacity:0`/`scale(0.98)` no HTML inicial.
- `src/providers/NextRouteFrame.tsx`: textos de aviso financeiro/hidratacao revisados em UTF-8, removendo mojibake visivel.
- `src/components/shared/charts/StableResponsiveContainer.tsx`: adiciona casca estavel para graficos Recharts, montando `ResponsiveContainer` apenas quando o elemento tem largura/altura reais.
- `src/app/dashboard/DashboardPage.tsx`, `src/app/bank-analysis/BankAnalysisPage.tsx`, `src/app/partner-dashboard/page.tsx` e `src/app/profile/ProfilePage.tsx`: graficos criticos migrados para o wrapper estavel para evitar warnings `width(-1)`/`height(-1)` em containers ainda ocultos ou sem medida.
- `src/services/questions/questionHtmlSanitizer.ts`: remove scripts, handlers `on*`, URLs perigosas e estilos inseguros em HTML de questoes/comentarios.
- `src/components/shared/feedback/CommentsSection.tsx`: comentarios renderizados no frontend passam pelo sanitizador central.
- `src/services/questions/questionFlags.ts`: centraliza flags de questao anulada/inedita, evitando falso positivo quando a API retorna `"0"` ou `"false"` como string.
- `src/app/questions/components/QuestionCard.tsx` e `src/app/question/QuestionPublicPage.tsx`: usam a mesma regra de anulada/inedita para borda vermelha, badge e bloqueio de resposta.
- `src/app/questions/components/QuestionCard.tsx`: o card deixou de resetar o estado local quando apenas `question.stats` muda apos responder; o reset agora ocorre somente na troca real de `question.id`, preservando feedback e selecao no submit.
- `src/services/questions/__tests__/questionHtmlSanitizer.test.ts`: cobre payload XSS basico no render de HTML rico.
- `src/services/marketing/landingPages.ts`: remove markup/script de campos textuais de landing pages e bloqueia canonical customizado fora de `http(s)`/caminho relativo.
- `src/services/marketing/landingPageSeo.ts` e `src/app/l/[slug]/page.tsx`: landings publicadas passam a ter metadata server-side; landings em rascunho/inexistentes retornam metadata `noindex`.
- `src/services/marketing/promotionCampaign.ts`, `src/services/marketing/promotionSeo.ts`, `src/app/promo/[slug]/page.tsx`, `src/app/promo/PromoPage.tsx` e `src/components/shared/feedback/PromoBanner.tsx`: promocoes publicas passam a respeitar o slug ativo, com metadata server-side e `noindex` quando o slug nao corresponde, a campanha esta inativa ou o modulo esta desligado.
- `src/services/marketing/promotionCampaign.ts`, `src/providers/DataProvider.tsx` e `src/app/admin/components/finance/AdminMarketing.tsx`: URLs configuraveis de campanhas, notificacoes e banners passam por normalizacao segura; `javascript:`, `data:`, protocolo relativo e caminhos sensiveis como `/admin` e `/api` caem em fallback seguro.
- `src/app/admin/config/adminPageNavigationConfig.ts` e `src/app/admin/components/shared/useAdminPageController.tsx`: badge principal de Suporte passa a abrir a primeira fila acionavel com pendencia (`Comentarios`, `Denuncias`, `Feedback` ou `Reembolsos`), evitando cair em uma subarea vazia.
- `modules/feedback/*`, `modules/admin/repositories/AdminFeedbackRepository.php`, `api/feedback/testimonials.php`, `src/services/marketing/homeTestimonials.ts`, `src/app/landing/components/LandingCommercialPage.tsx`, `src/services/profile/profileService.ts` e `src/app/profile/ProfilePage.tsx`: avaliacoes da plataforma agora exigem nome publico/contexto, ficam fora da home ate aprovacao administrativa (`resolved` + `home_published_at`) e a homepage usa depoimentos aprovados com fallback para mocks quando nao houver nenhum.
- `modules/admin/repositories/AdminFeedbackRepository.php` e `modules/admin/services/AdminFeedbackService.php`: resposta administrativa em feedback/suporte agora tambem cria notificacao in-app para o dono da conversa, com link direto para `/support?threadId=...`.
- `src/app/support/page.tsx`: ao abrir uma notificacao de suporte com `threadId`, a tela carrega e expande automaticamente a conversa correta.
- `tests/ReportsModuleWiringTest.php`: denuncia resolvida continua coberta como notificacao in-app para o denunciante, evitando regressao no fluxo de moderacao.
- `modules/rankings/routes.php`, `modules/rankings/services/RankingsService.php`, `modules/rankings/repositories/RankingsRepository.php`, `database/migrations/20260501_rankings_notifications.sql` e `database/schema.sql`: rankings passam a exigir usuario autenticado para criacao/envio de gabarito, ignoram `userId` cliente no envio, preservam o criador e criam notificacoes para ranking pendente, moderacao, primeira participacao e gabarito oficial.
- `modules/rankings/services/RankingsService.php`, `modules/rankings/repositories/RankingsRepository.php` e `tests/RankingsModuleWiringTest.php`: rankings agora tambem concedem XP/reputacao/badges por ranking aprovado, primeira participacao e resultado oficial consolidado.
- `modules/marketing_automation/*`, `scripts/tasks/process_marketing_automations.php`, `database/migrations/20260501_marketing_automation_events.sql` e `database/schema.sql`: campanhas automaticas agora possuem executor CLI com dry-run, lock, idempotencia por usuario/regra/campanha, condicoes (`recent_signup`, `near_subscription`, `inactive_7_days`, `trial_ending`, `saved_questions`, `elite_upgrade`) e envio por notificacao/e-mail; CTAs configuraveis aceitam caminhos internos ou URLs absolutas HTTPS, rejeitando `http://` e caminhos sensiveis como `/admin` e `/api`.
- `modules/transactions/*` e `modules/payments/services/PaymentsService.php`: compra de material preserva `material_id` textual, notifica comprador/vendedor/admin quando a venda e confirmada e reembolso passa a avisar admin/vendedor/usuario conforme solicitacao e conclusao.
- `database/schema.sql`, `config/payment_provider.php`, `modules/materials/repositories/MaterialsRepository.php` e `scripts/migrations/migrate_marketplace_schema_compatibility.php`: bootstrap e guard de schema do marketplace agora usam `transactions.user_id`, `transactions.id` auto-incremento e IDs textuais em `material_ratings`/notas/leitor.
- `config/gamification_helper.php`, `modules/transactions/services/TransactionsService.php`, `modules/payments/services/PaymentsService.php`, `modules/materials/services/MaterialsService.php`, `database/schema.sql` e `scripts/migrations/migrate_marketplace_schema_compatibility.php`: vendas, aprovacoes e reembolsos de materiais agora registram XP/reputacao/badges em `user_gamification_events` sem duplicar em retry/webhook.
- `modules/comments/*`, `modules/admin/repositories/AdminCommentsModerationRepository.php` e `modules/admin/services/AdminReportModerationService.php`: aprovacao/spam de comentario, curtidas recebidas e denuncias aceitas agora afetam XP/reputacao/badges via `user_gamification_events`, com notificacoes de badge.
- `src/services/admin/adminService.ts` e `src/providers/DataProvider.tsx`: frontend separa `getPublicSystemSettings()` de `getSystemSettings()` e usa o endpoint admin apenas para admin/staff.
- `src/services/marketing/__tests__/landingPages.test.ts`: cobre payload admin malicioso em texto/SEO das landings.
- `eslint.config.mjs`: separa o app mobile do lint web da raiz, ignora logs locais e converte dividas massivas de migracao em avisos rastreaveis.
- `src/app/partner-dashboard/page.tsx`: corrige chamadas condicionais de hooks que eram erro real de lint.
- `src/components/PageTransition.tsx`: primeiro render agora entrega um shell SSR estavel antes de ativar a animacao no cliente, evitando mismatch de hidratacao nas rotas com transicao.
- `src/app/admin/components/dashboard/AdminDashboard.tsx`: loading dos indicadores passou a ser acionado pelos controles do periodo/refresh, evitando `setState` sincrono dentro do efeito de busca.
- `src/app/practice/page.tsx`: filtros auxiliares foram movidos para componentes estaveis fora do render, `Date.now()` saiu do estado inicial, e o carregamento automatico no modo foco foi adiado para o proximo frame.
- `src/app/admin/components/database/useAdminDatabaseNavigationState.ts`: aba inicial do banco/admin agora e resolvida antes do estado e sincronizacoes de URL sao agendadas no proximo frame, removendo render em cascata.
- `src/app/admin/components/database/useAdminTaxonomyWorkflow.ts`: carregamento de taxonomias usa callback estavel, slug automatico e atualizado no handler do campo, e o efeito de espelho de estado foi removido.
- `src/services/offers/useLimitedOfferCountdown.ts`: contador de oferta nao usa mais `Date.now()` durante render e atualiza tempo restante apenas em frame/intervalo no cliente.
- `src/app/admin/components/finance/AdminMarketing.tsx`: rascunhos de campanha, cupons e tema sincronizam com settings no proximo frame e o arquivo passa eslint sem avisos.
- `src/app/profile/ProfilePage.tsx`: perfil deixou de usar `Date.now()` no render para liberar download de material e efeitos de abas, questoes salvas, foto, depoimento e notas foram adiados para frame/fluxo assincrono.
- `src/app/admin/components/finance/AdminFinance.tsx`: sincronizacao de settings, secao ativa, projecao de receita, evidencias Stripe e paginacao passaram a rodar fora do corpo direto do efeito; datas da tabela usam relogio estavel do componente.
- `src/components/shared/layout/Layout.tsx`: modal de verificacao e fechamento automatico de menus em troca de rota passaram a ser agendados no proximo frame.
- `src/app/question/QuestionPublicPage.tsx`: carregamento client-side e estado de erro da questao publica agora sao disparados no proximo frame, reduzindo risco de cascata em rota SEO.
- `src/providers/StudyTrackerProvider.tsx`: rastreador de tempo nao usa mais `Date.now()` durante render, passa eslint sem avisos e preserva o simulado pelo registro autoritativo ao finalizar.
- `src/app/notifications/page.tsx`: lixeira de notificacoes deixou de usar `Date.now()` no render, o seletor de abas saiu do corpo do componente e o preview de evidencia usa `next/image`.
- `src/app/admin/components/support/AdminFeedback.tsx`: contagem de pendencias e SLA do suporte usam relogio estabilizado apos o carregamento, sem calculo temporal impuro no render.
- `src/app/admin/components/shared/useAdminPageController.tsx`: controller do painel admin tipado para notificacoes, feedback, relatorios e reembolsos; sincronizacoes de rota e contadores pendentes rodam em frame cancelavel.
- `src/app/admin/components/shared/AdminPublishStateBadge.tsx`: badge de publicacao passou a aceitar metadados desconhecidos com `unknown` e validacao explicita de datas.
- `src/app/admin/components/settings/StripePaymentMethodsSettings.tsx`: IDs de metodos locais deixaram de depender de `Date.now()` e usam sufixo deterministico.
- `src/app/partner-dashboard/page.tsx`: dashboard de parceiro passa ESLint sem avisos, remove tempo impuro do render, componente de notificacoes criado no render, mutacao direta de `newMaterial`, imports/estado mortos e troca previews para `next/image`.
- `src/app/questions/components/QuestionCard.tsx`: card de questao passa ESLint sem avisos, remove imports mortos, `any`, relogio impuro no render, setState sincrono em efeitos de reset, imagens `<img>` e mutacoes/ordem insegura de hooks; o submit nao perde mais o feedback por causa de refresh de estatisticas.
- `src/app/marketplace/page.tsx`: marketplace passa ESLint sem avisos, deixou de usar relogio impuro nos pontos criticos de render/acesso, removeu mutacao direta de `currentUser` apos checkout, estabilizou efeitos de deep link/paginacao, tipou comentarios/rating e trocou imagens principais para `next/image`.
- `src/app/simulation/page.tsx`: simulados passam ESLint sem avisos e typecheck; filtros/taxonomias reduziram `any`, revisao reaproveita helper tipado de resposta, o timer finaliza pelo tick sem cascata de estado no efeito e o `QuestionCard` nao recebe mais `Date.now()` no render.
- `src/app/landing/components/ThemeOrnaments.tsx` e `src/app/landing/components/__tests__/ThemeOrnaments.test.tsx`: ornamentos sazonais das paginas publicas deixaram de usar `Math.random()` no render e passaram a usar distribuicao deterministica, reduzindo risco de hydration mismatch em paginas SSR.
- `src/providers/AuthProvider.tsx`: provider de autenticacao passa ESLint sem avisos; milestones de nivel sairam do corpo do componente e o callback de XP deixou de depender de constante recriada a cada render.
- `src/app/auth/components/Auth.tsx`: tela de login/cadastro reaproveita `authFlowService`, normaliza mensagens com `readApiErrorMessage` e separa falha de autenticacao da falha ao concluir a sessao local, evitando mascarar erro real como "Erro de conexao com o servidor.".
- `src/app/profile/ProfilePage.tsx`: perfil passa ESLint sem avisos no recorte completo auditado; handlers de cobranca/foto/depoimento sairam de `any`, callbacks dependem de referencias estaveis e os previews restantes usam `next/image` ou fallback textual.
- `src/app/admin/components/dashboard/AdminDashboard.tsx`, `src/app/admin/components/database/useAdminDatabaseDatasets.ts`, `src/app/admin/components/database/useAdminTableSorting.ts`, `src/app/admin/components/database/SmartTagSelector.tsx`, `src/app/admin/components/database/TaxonomyModal.tsx`, `src/app/admin/components/database/useAdminDatabaseManagerController.tsx`, `src/app/admin/components/database/AdminDatabaseModals.tsx`, `src/app/admin/components/database/AdminDatabaseSections.tsx` e `src/app/admin/components/database/FiltersManagementSection.tsx`: dashboard e base de dados do admin agora usam tipagem explicita no recorte auditado, removendo `any` do lint direcionado e estabilizando as bordas de taxonomias, tabelas, secoes e modais sem quebrar o build.
- `src/app/admin/components/users/AdminUsersSection.tsx` e `src/app/admin/components/rankings/AdminRankingsSection.tsx`: tabelas operacionais de usuarios e rankings agora usam `UserProfile`/`Ranking` reais, removendo `any` no lint direcionado e corrigindo a leitura de vagas do ranking para o contrato atual.
- `src/app/admin/components/materials/MaterialModerationModal.tsx`, `src/app/admin/components/questions/AdminQuestionGroupsSection.tsx` e `src/app/admin/components/marketing/AdminLandingPagesManager.tsx`: modais/telas auxiliares do admin ficaram sem warning de `img`, aspas soltas e codigo morto no recorte auditado, usando `next/image` nos previews e limpando helpers nao usados.
- `src/app/admin/components/users/UserProfileAdminModal.tsx`: modal detalhado de usuario agora usa tipos locais para perfil/assinatura/transacao/comentario, remove `set-state-in-effect` no seletor de plano, troca foto de perfil para `next/image` e fica sem `any` no lint direcionado.
- `.gitignore` e remocao de `tsconfig.tsbuildinfo`: cache incremental do TypeScript deixou de ficar versionado.
- Logs locais ignorados (`web-root-dev*.log` e `mobile/expo-live*.log`) foram removidos do workspace.

## Status por etapa

| Etapa | Status local | Status producao | Evidencia |
| --- | --- | --- | --- |
| Auditoria e backlog | Pronto | Pronto para orientar correcao | Documentos em `docs/reports/*` e runbook criados |
| Banco e cron | Pronto local parcial | Nao pronto ate teste de carga/staging | `CronLockWiringTest`, `CronSecretHardeningWiringTest`, `SubscriptionsCronWiringTest`, `SubscriptionsCheckoutWiringTest`, `MarketplaceSchemaCompatibilityWiringTest`, `MarketplaceGamificationWiringTest` e `ProductionSmokeWiringTest` passaram; cron HTTP e execucao manual admin da reconciliacao Stripe compartilham lock; smoke local abriu 3 conexoes e uso ficou em 3/151; schema do marketplace/gamificacao foi normalizado localmente |
| Notificacoes/gamificacao | Pronto local parcial | Nao pronto total | Comentarios moderados, curtidas sociais, feedback/suporte, denuncias aceitas, rankings com XP/reputacao/badges basicos, campanhas automaticas, compras/reembolsos de materiais com XP/reputacao/badges, streaks, badges basicos, `past_due` Stripe e reembolso pendente cobertos; UI de notificacoes passa ESLint sem avisos; falta prova gateway real e smoke de deep links |
| Sanitizacao HTML | Pronto local | Nao pronto ate smoke/staging | Questoes, comentarios e textos/SEO de landings saneados; landing publica bloqueia HTML executavel e canonical sensivel por teste; JSON-LD publico usa serializacao segura; teste de arquitetura bloqueia `dangerouslySetInnerHTML` sem sanitizer conhecido. Se futuramente houver bloco de HTML bruto, deve nascer como feature separada com sandbox/review server-side |
| Pagamentos/webhooks | Pronto local parcial | Nao pronto | Suite operacional de webhook Stripe passou, alias/canonico estao cobertos, config publica exige chaves validas, verify-payment exige dono autenticado e Stripe Connect bloqueia redirect externo; falta sandbox com webhook publico/tunel |
| Deploy VPS/backup/rollback | Pronto local parcial | Nao pronto | Backup, verificador e restore dry-run seguro passaram; falta executar restore real em banco temporario da VPS e rollback completo |
| Logs/observabilidade | Pronto local parcial | Nao pronto | Scanner de logs e analise no endpoint admin prontos; falta rotacao/alerta real na VPS |
| Headers de seguranca | Pronto local parcial | Nao pronto ate validar proxy HTTPS | Frontend/API com CSP, clickjacking e nosniff; frontend remove `unsafe-eval` em producao e API local confirmou headers; preflight exige `APP_ENV=production`, `APP_URL` publico, CORS HTTPS sem wildcard e reset DB desativado |
| Uploads | Pronto local parcial | Nao pronto ate validar servidor final | Helper central e `.htaccess` prontos; falta regra equivalente em Nginx se aplicavel |
| Rate limiting | Pronto local parcial | Nao pronto ate calibrar na VPS/proxy | Perfis aplicados em auth, suporte, comentarios, denuncias, uploads e analytics; falta medir falsos positivos e limites reais em staging |
| Analytics tracking | Pronto local parcial | Nao pronto ate observar trafego em staging | Endpoint limita volume, nao confia em `userId` do cliente e limita payloads grandes; falta monitorar volume real e 429 |
| Cronograma Elite | Pronto local parcial | Nao pronto ate smoke com usuario Elite real | Backend persiste por usuario e UI sincroniza com fallback local; falta teste ponta a ponta em staging |
| Superficie publica da API | Pronto local | Nao pronto ate preflight passar na VPS | Log operacional removido de `api/`; cron grava em `storage/logs/subscriptions`; preflight e teste residual bloqueiam novos artefatos |
| Google login | Pronto local parcial | Nao pronto ate OAuth real em staging | Frontend valida Client ID, nao carrega script invalido e trata falha do script Google; falta Client ID real autorizado no Google Cloud e backend com mesmo ID |
| SEO publico | Pronto local parcial | Nao pronto ate dominio/Search Console | `NEXT_PUBLIC_CANONICAL_URL` alimenta metadata/sitemap/robots; sitemap filtra landings reservadas/privadas e tem testes de alinhamento com robots; falta validacao no dominio final |
| SEO privado | Pronto local | Nao pronto ate validar deploy | Rotas privadas principais tem `noindex`; cronograma Elite corrigido; sitemap dinamico filtra drafts, elite/internal, itens pendentes e slugs de landing reservados |
| Landings publicas | Pronto local parcial | Nao pronto ate smoke no dominio final | `/l/[slug]` tem metadata server-side para publicadas, `noindex` para rascunhos/inexistentes e sitemap inclui landings publicadas customizadas; falta validar OG/canonical externo |
| Promocoes publicas | Pronto local parcial | Nao pronto ate smoke no dominio final | `/promo/[slug]` so exibe a promocao quando o slug ativo confere e gera `noindex` para slug invalido/inativo; falta validar campanha real publicada |
| URLs de campanhas | Pronto local parcial | Nao pronto ate smoke admin no dominio final | CTAs de banners/notificacoes bloqueiam URLs perigosas e fallback antigo `/pricing` foi trocado por `/planos` |
| Automacoes de campanha | Pronto local parcial | Nao pronto ate smoke com campanha ativa | Executor CLI faz dry-run, usa lock, seleciona usuarios por condicao, registra envios idempotentes e bloqueia CTAs absolutos sem HTTPS; falta teste real de envio com SMTP/notificacao em staging |
| Suporte/admin badges | Pronto local parcial | Nao pronto ate smoke admin no painel real | Clique no item principal Suporte abre a primeira fila com pendencia; resposta admin notifica o usuario e `/support?threadId=...` abre a conversa; falta validar visualmente com dados reais |
| Depoimentos da home | Pronto local parcial | Nao pronto ate smoke admin no painel real | Avaliacao exige nome publico/contexto; endpoint publico lista apenas aprovadas completas; home usa fallback mock quando a lista vem vazia |
| Settings publicas/admin | Pronto local parcial | Nao pronto ate smoke autenticado na VPS | `api/settings.php` sempre retorna a projecao publica saneada; `api/admin/settings.php` exige admin/staff tambem no GET; frontend usa endpoint admin apenas para admin/staff |
| Hydration/transicoes | Pronto local parcial | Nao pronto ate smoke no browser do build | `PageTransition` nao troca mais a arvore apos mount e nao injeta `opacity:0` no HTML inicial; `ThemeProvider` e ornamentos sazonais ficaram deterministicos no SSR. Falta validar sem warnings no navegador em staging |
| Graficos responsivos | Pronto local parcial | Nao pronto ate smoke no browser do build | `ResponsiveContainer` direto foi removido dos graficos criticos; wrapper SSR estavel coberto por teste; arquitetura agora bloqueia import direto de `ResponsiveContainer` fora do wrapper |
| Pratica/modo foco | Pronto local parcial | Nao pronto ate smoke com usuario real | Filtros auxiliares agora sao componentes estaveis, sem recriacao a cada render; carregamento automatico no modo foco nao dispara setState sincrono no efeito |
| Admin database/navegacao | Pronto local parcial | Nao pronto ate smoke no painel real | Estado de aba/categoria nao sincroniza mais com setState sincrono no efeito; falta validar clique/URL/hash nas tabelas WordPress |
| Admin taxonomias/filtros | Pronto local parcial | Nao pronto ate smoke CRUD real | Workflow passa eslint sem avisos, slug automatico nao depende de efeito espelho e fetch inicial tem dependencia estavel; falta criar/editar/excluir materia, topico, assunto e cargo no painel |
| Ofertas/campanhas publicas | Pronto local parcial | Nao pronto ate smoke visual | Countdown de oferta evita render impuro e hidratacao instavel; falta validar banners/oferta ativa em home/checkout/planos |
| Marketing admin | Pronto local parcial | Nao pronto ate smoke CRUD real | `AdminMarketing.tsx` passa eslint sem avisos; rascunhos locais nao sincronizam mais com setState sincrono no efeito; falta salvar campanha, cupom e tema com backend real |
| Perfil/abas do usuario | Pronto local parcial | Nao pronto ate smoke com usuario real | Perfil sem avisos criticos de render impuro/render em cascata no recorte; questoes salvas, notas, foto, avaliacao e materiais ainda precisam smoke |
| Financeiro admin | Pronto local parcial | Nao pronto ate smoke gateway real | `AdminFinance.tsx` sem avisos criticos de `set-state-in-effect`/render impuro no recorte; ainda falta Stripe sandbox/staging, reembolso real, automacao e conciliacao |
| Layout global | Pronto local parcial | Nao pronto ate smoke browser | Modal de verificacao e menus nao fazem setState sincrono em efeitos; falta validar navegacao, menu mobile e perfil no browser |
| Hard refresh/fluxo inteligente | Pronto local parcial | Nao pronto ate validar em staging/VPS | Baseline local sem duplicatas/falhas em `/dashboard`, `/practice` e `/admin/panel/dashboard`; `questionsList` nao aparece mais no hard refresh do dashboard e `motivacoes-diarias.md` ficou em leitura unica por rota. Falta validar com build de producao + proxy real |
| Questao publica SEO | Pronto local parcial | Nao pronto ate smoke anonimo/logado | Carregamento client-side sem setState sincrono em efeito; ainda falta validar CTA/login e redirecionamento para pratica |
| Tempo de estudo | Pronto local parcial | Nao pronto ate smoke pratica/leitura/simulado | Provider sem render impuro; pratica/leitura contam em rotas ativas e simulado segue por registro autoritativo ao finalizar |
| Questao anulada/inedita | Pronto local parcial | Nao pronto ate smoke com fixtures reais | Flags centralizadas evitam falso bloqueio por `"0"`/`"false"` e mantem badge/bloqueio consistentes |
| Rankings | Pronto local parcial | Nao pronto ate smoke com usuario/admin reais | Create/join exigem auth; join usa usuario da sessao; notificacoes e recompensas basicas de ranking pendente, moderacao, participacao e gabarito oficial cobertas por wiring |
| Marketplace financeiro | Pronto local parcial | Nao pronto ate smoke Stripe/refund real | Compra direta preserva IDs textuais, venda confirmada notifica comprador/vendedor/admin e gera XP/reputacao/badges idempotentes; reembolso solicitado/concluido notifica admin/vendedor/usuario e ajusta reputacao do vendedor; falta gateway real |

## Evidencias locais

Frontend:

| Comando | Resultado |
| --- | --- |
| `npm run typecheck` | Passou |
| `npm run build` | Passou em 2026-05-04; Next 16.2.4/Turbopack gerou rotas publicas, privadas e dinamicas |
| `npm run check:text-encoding` | Passou |
| `npm run lint` | Passou com avisos |
| `npm run lint -- --quiet` | Passou sem erros |
| `npx eslint src/components/PageTransition.tsx --max-warnings=0` | Passou |
| `npx eslint src/providers/DataProvider.tsx --max-warnings=0` | Passou; warnings de memoizacao pendentes foram fechados |
| `npx eslint src/app/practice/page.tsx` | Passou com avisos remanescentes de tipagem/memoizacao; avisos de componente criado no render, `Date.now()` inicial e `setState` sincrono no modo foco foram removidos |
| `npx eslint src/app/admin/components/dashboard/AdminDashboard.tsx` | Passou com avisos remanescentes de `any`; aviso de `setState` sincrono no efeito de stats foi removido |
| `npx eslint src/app/admin/components/dashboard/AdminDashboard.tsx src/app/admin/components/database/useAdminDatabaseDatasets.ts src/app/admin/components/database/useAdminTableSorting.ts src/app/admin/components/database/SmartTagSelector.tsx src/app/admin/components/database/TaxonomyModal.tsx src/app/admin/components/database/useAdminDatabaseManagerController.tsx src/app/admin/components/database/AdminDatabaseModals.tsx --max-warnings=0` | Passou |
| `npx eslint src/app/admin/components/database/AdminDatabaseSections.tsx src/app/admin/components/database/FiltersManagementSection.tsx src/app/admin/components/database/useAdminDatabaseManagerController.tsx --max-warnings=0` | Passou |
| `npx eslint src/app/admin/components/users/AdminUsersSection.tsx src/app/admin/components/rankings/AdminRankingsSection.tsx --max-warnings=0` | Passou |
| `npx eslint src/app/admin/components/materials/MaterialModerationModal.tsx src/app/admin/components/questions/AdminQuestionGroupsSection.tsx src/app/admin/components/marketing/AdminLandingPagesManager.tsx --max-warnings=0` | Passou |
| `npx eslint src/app/admin/components/users/UserProfileAdminModal.tsx --max-warnings=0` | Passou |
| `npx eslint src/app/admin/components/database/useAdminDatabaseNavigationState.ts --max-warnings=0` | Passou |
| `npx eslint src/app/admin/components/database/useAdminTaxonomyWorkflow.ts --max-warnings=0` | Passou |
| `npx eslint src/services/offers/useLimitedOfferCountdown.ts --max-warnings=0` | Passou |
| `npx eslint src/app/admin/components/finance/AdminMarketing.tsx --max-warnings=0` | Passou |
| `npx eslint src/app/profile/ProfilePage.tsx` | Passou com avisos herdados de tipagem/imports; sem avisos de `set-state-in-effect`/`purity` no recorte corrigido |
| `npx eslint src/app/admin/components/finance/AdminFinance.tsx` | Passou com avisos herdados de tipagem/imports; sem avisos de `set-state-in-effect`/`purity` no recorte corrigido |
| `npx eslint src/components/shared/layout/Layout.tsx` | Passou com avisos herdados; sem avisos de `set-state-in-effect`/`purity` no recorte corrigido |
| `npx eslint src/app/question/QuestionPublicPage.tsx` | Passou com avisos herdados de tipagem/memoizacao; sem avisos de `set-state-in-effect`/`purity` no recorte corrigido |
| `npx eslint src/providers/StudyTrackerProvider.tsx --max-warnings=0` | Passou |
| `npx eslint src/app/support/page.tsx` | Passou sem avisos apos ajuste do deep link de suporte |
| `npx vitest run src/services/questions/__tests__/questionHtmlSanitizer.test.ts src/services/marketing/__tests__/landingPages.test.ts` | Passou, 5 testes |
| `src/services/marketing/__tests__/landingPageSeo.test.ts` | Passou, 3 testes cobrindo metadata SSR para publicada, rascunho `noindex` e fallback de defaults |
| `src/services/marketing/__tests__/promotionCampaign.test.ts` | Passou, 5 testes cobrindo slug canonico, match por slug, path de promocao e sanitizacao de URLs de campanha |
| `src/services/marketing/__tests__/promotionSeo.test.ts` | Passou, 3 testes cobrindo metadata SSR, slug invalido `noindex` e modulo de promocao desligado |
| `src/services/admin/__tests__/adminService.test.ts` | Passou, 26 testes incluindo separacao entre settings publicas e endpoint admin protegido |
| `src/services/admin/__tests__/adminRouting.test.ts` | Passou, 5 testes incluindo direcionamento do badge de Suporte para a primeira fila acionavel |
| `src/services/marketing/__tests__/homeTestimonials.test.ts` e `src/services/profile/__tests__/profileService.test.ts` | Passou, 8 testes cobrindo fallback mock, normalizacao de depoimentos aprovados e envio de campos publicos da avaliacao |

Backend:

| Validacao | Resultado |
| --- | --- |
| Sintaxe PHP dos arquivos alterados | Passou |
| Suite PHP selecionada de auth, security, notifications, questions, comments, simulations, rankings, payments, subscriptions, refunds, users, admin, feedback, reports, materials e filters | Passou |
| Suite PHP incremental de cron, auth, security, notifications, questions, comments, payments, subscriptions e refunds | Passou |
| `BackupMysqlWiringTest.php` | Passou; cobre backup, verificador e restore seguro com token explicito |
| `restore_mysql_backup.php` dry-run local | Passou com dump minimo, checksum valido e destino `concursomestre_restore_test`; bloqueou restore no banco atual |
| `restore_mysql_backup.php` dump destrutivo | Passou bloqueando `DROP DATABASE` |
| `ProductionSmokeWiringTest.php` | Passou |
| `production_smoke.php --api-base-url=http://localhost/questao-pro-backend/api --web-base-url=http://localhost:3000 --timeout=12` | Passou: API (`plans`, `questions_list`, `settings`) e web (`/`, `/auth`, `/practice`, `/questions`, `/question/48`) responderam sem `NEXT_REDIRECT`; MySQL `Threads_connected=3`, `max_connections=151` |
| `ProductionLogAuditWiringTest.php` | Passou |
| `production_log_audit.php --tail=500 --repeat-threshold=3 --fail-on=none` | Passou nos logs locais inspecionados; sem criticos, com repeticoes informativas em settings/Stripe |
| `SecurityHeadersWiringTest.php` | Passou |
| `src/config/__tests__/securityHeaders.test.ts` | Passou, 4 testes; cobre Google/reCAPTCHA/Stripe, origem da API, origens locais apenas fora de producao e ausencia de `unsafe-eval` em producao |
| Smoke HTTP `api/settings.php` headers | `200`, com `X-Frame-Options=DENY`, `X-Content-Type-Options=nosniff`, CSP restritiva |
| `UploadSecurityWiringTest.php` | Passou |
| `RateLimiterHardeningWiringTest.php` | Passou |
| `AnalyticsTrackingSecurityTest.php` | Passou; tracking autenticado usa usuario da sessao, anonimo ignora `userId` do cliente e metadata grande e rejeitada |
| `LegalCommentaryAdminWiringTest.php` | Passou; handlers admin exigem `requireAdminSessionContext($db)` e bridges delegam para as rotas protegidas |
| `ProductionPreflightWiringTest.php` | Passou com checks `GOOGLE_CLIENT_ID_FORMAT`, `STRIPE_*_FORMAT`, `STRIPE_KEY_MODE_MATCH`, `RATE_LIMIT_RUNTIME_WRITABLE` e `API_PUBLIC_ARTIFACTS_CLEAN` |
| `ProductionPreflightBehaviorTest.php` | Passou; prova `APP_ENV=production`, `APP_URL` publico, CORS valido/HTTPS/sem wildcard e reprova `development`, localhost, HTTP e wildcard |
| `AdminDatabaseResetProductionGuardTest.php` | Passou; reset DB em producao fica bloqueado por padrao e exige confirmacao operacional |
| `StripeConfigurationWiringTest.php` | Passou; runtime valida formato de secret, publishable e webhook secret Stripe |
| `AdminSettingsValidatorStripeTest.php` | Passou; painel rejeita chaves Stripe invalidas e mistura `test`/`live` no mesmo save |
| `SubscriptionsNotificationsWiringTest.php` | Passou; cobre notificacao admin para `past_due` Stripe e reembolso pendente para todos os admins |
| `SubscriptionsCheckoutWiringTest.php` | Passou; cobre endpoint canonico Stripe e alias `webhook_stripe.php` |
| `PaymentsModuleWiringTest.php` | Passou; config publica so anuncia Stripe quando publishable e secret sao validas, e verify-payment exige usuario autenticado/dono |
| `MarketplaceNotificationsWiringTest.php` | Passou; cobre `material_id` textual, notificacoes de venda confirmada e notificacoes de reembolso para marketplace |
| `MarketplaceGamificationWiringTest.php` | Passou; cobre ledger `user_gamification_events`, XP/reputacao/badges de venda/aprovacao e ajuste de reputacao em reembolso |
| `MarketplaceSchemaCompatibilityWiringTest.php` | Passou; cobre bootstrap de `transactions`, guard de schema em pagamentos e reparo de `material_ratings` legado |
| `SocialGamificationWiringTest.php` | Passou; cobre XP/reputacao/badges em comentario aprovado, spam/trash, curtida recebida e denuncia aceita |
| `PaymentsReturnUrlValidatorTest.php` | Passou; URLs externas e HTTP em producao sao rejeitadas no Stripe Connect |
| `ApiBridgeInventoryWiringTest.php` | Passou apos atualizar baseline da superficie publica real da API |
| `StudyScheduleModuleWiringTest.php` | Passou |
| `ApiThinBridgesWiringTest.php` | Passou apos incluir endpoints de cronograma |
| `SubscriptionsCronWiringTest.php` | Passou; cron Stripe usa bridge oficial, lock antes do MySQL e log privado em `storage/logs/subscriptions` |
| `SubscriptionsCheckoutWiringTest.php` | Passou; helper administrativo de automacao carrega `cron_lock.php` e `run_now` reutiliza o lock da reconciliacao Stripe |
| `ApiResidualSurfaceWiringTest.php` | Passou apos remover log publico de cron |
| `src/config/__tests__/siteUrl.test.ts` | Passou, cobrindo `NEXT_PUBLIC_CANONICAL_URL` para sitemap/canonical |
| `src/config/__tests__/googleAuth.test.ts` | Passou, 3 testes cobrindo Client ID valido, placeholders invalidos e configuracao ausente |
| `GoogleAuthWiringTest.php` | Passou; backend valida formato do Client ID Google e audiencia do token |
| `src/services/seo/__tests__/privateSeo.test.ts` | Passou, 6 testes cobrindo disallow/noindex, cronograma, filtros de sitemap dinamico e landings publicadas |
| `src/components/__tests__/PageTransition.test.tsx` | Passou, cobrindo HTML SSR estavel para transicao de pagina |
| `src/components/shared/charts/__tests__/StableResponsiveContainer.test.tsx` | Passou, 2 testes cobrindo shell SSR com dimensao fixa e fallback antes de medir |
| `src/services/questions/__tests__/questionFlags.test.ts` | Passou, 4 testes cobrindo anulada/inedita com `0`, `1`, `false`, `true`, `sim` e `nao` |
| `AdminSettingsWiringTest.php` | Passou; GET admin de settings exige `requireAdminSessionContext` e nao usa autenticacao opcional |
| `SettingsModuleWiringTest.php` | Passou; settings publicas usam `show(null)`, nao variam por bearer token e ocultam `stripeKey` legado |
| `FeedbackValidatorTest.php`, `FeedbackTestimonialsWiringTest.php`, `FeedbackModuleWiringTest.php` | Passou; avaliacao exige campos publicos, endpoint publico de depoimentos existe, admin publica na home somente quando status fica `resolved` com dados completos e resposta admin gera notificacao in-app ao usuario |
| `ReportsModuleWiringTest.php` | Passou; denuncia resolvida notifica o denunciante e mantem evidencias de moderacao |
| `RankingsModuleWiringTest.php` | Passou; ranking create/join exigem auth, join ignora `userId` cliente e hooks de notificacao/gamificacao estao ligados no service/repository |
| `MarketingAutomationWiringTest.php` | Passou; executor de campanha possui dry-run, lock, idempotencia, condicoes oficiais, notificacao, e-mail, schema proprio e CTAs absolutos apenas em HTTPS |
| `npx eslint src/app/admin/components/panel/AdminPanelSection.tsx --max-warnings=0` | Passou; abas do painel nao sincronizam estado durante o efeito inicial e alertas/billing estao tipados sem `any` |
| `npx eslint src/app/admin/components/marketing/AdminMarketingSection.tsx --max-warnings=0` | Passou; navegacao de marketing nao dispara estado sincrono em efeito |
| `npx eslint src/app/admin/components/marketing/AdminSocialLinksManager.tsx --max-warnings=0` | Passou; redes sociais da homepage sincronizam rascunho no frame seguinte e import morto foi removido |
| `npx eslint src/components/shared/overlays/PdfViewer.tsx --max-warnings=0` | Passou; leitor PDF sem avisos de efeito/deps, sem `any` no fluxo de comentarios/text layer e sem imports mortos |
| `npx eslint src/app/admin/components/legal-commentary/AdminLegalCommentarySection.tsx --max-warnings=0` | Passou; admin de lei comentada sem efeito inicial sincrono, sem import morto e sem `any` nos erros de sincronizacao |
| `npx eslint src/app/admin/components/materials/AdminMaterialsSection.tsx --max-warnings=0` | Passou; moderacao de materiais sem `any` no preview autenticado e no badge de publicacao |
| `npx eslint src/app/admin/components/import/AdminImportSection.tsx --max-warnings=0` | Passou; importador admin sem imports mortos, sem `any` em previews extraidos e com campo legado de cargo normalizado para identificador valido |
| `npx eslint src/app/admin/components/import/useAdminImportWorkflow.ts src/app/admin/components/import/useAdminImportSettingsBridge.ts --max-warnings=0` | Passou; workflow de importacao agora usa tipos explicitos para PDF/retorno da IA/publicacao, remove prop morta de settings, melhora o tratamento de erro e fecha o dominio de importacao sem `any` explicito no recorte auditado |
| `npx eslint src/app/admin/components/support/AdminSupportSection.tsx src/app/admin/components/shared/AdminTopBar.tsx src/app/admin/components/shared/NotificationDropdown.tsx src/app/admin/components/rankings/RankingEditorModal.tsx src/app/admin/components/rankings/useRankingEditorWorkflow.ts --max-warnings=0` | Passou; suporte saiu do `set-state-in-effect` na troca de subsecao, topbar/admin notifications passaram a usar contrato tipado compartilhado e o editor de rankings foi alinhado ao modelo real (`vacanciesAc`, `vacanciesAfro`, `vacanciesPcd`) sem `any` explicito |
| `npx eslint src/app/admin/components/settings/AdminLandingContentSection.tsx src/app/admin/components/settings/AdminSeoSettingsSection.tsx src/app/admin/components/shared/AdminStandaloneShell.tsx src/app/admin/components/shared/AdminShellLayout.tsx src/app/admin/components/support/AdminCommentsModerationSection.tsx src/app/admin/components/reports/reportModeration.ts --max-warnings=0` | Passou; landing/SEO settings ficaram sem texto JSX bruto e sem efeito inicial sincrono, as shells auxiliares passaram a reaproveitar contratos tipados do admin/notificacoes e a fila de comentarios saiu do `set-state-in-effect` ao carregar |
| `npx eslint src/app/admin/components --max-warnings=0` | Passou; o diretorio principal de componentes do painel admin ficou sem warnings no lint direcionado |
| `npx eslint src/services/admin/adminService.ts src/app/practice/page.tsx "src/app/admin/operation/users/[userId]/edit/page.tsx" --max-warnings=0` | Passou; `adminService` saiu de `as any`/payloads frouxos, `/practice` ganhou filtros e taxonomias tipados sem `any` explicito e o editor standalone de usuario saiu de papel legado inseguro e de `set-state-in-effect` no carregamento |
| `npx eslint src/services/billing/cardsService.ts src/services/profile/profileService.ts --max-warnings=0` | Passou; camada de cartoes/perfil saiu de `any` explicito, com resultados tipados para cofre Stripe/local, referral stats e envio de avaliacao no perfil |
| `npx eslint src/app/admin/components/questions/useManualQuestionReferenceData.ts --max-warnings=0` | Passou; referencias do formulario de questao usam taxonomias tipadas e memoizacao com dependencias estaveis |
| `npx eslint src/app/admin/components/questions/AdminQuestionEditorPage.tsx` filtrando `set-state-in-effect`, deps e render impuro | Passou sem ocorrencias; editor de questao nao sincroniza mais grupos/prova/contexto diretamente no efeito |
| `npx eslint src/app/admin/components/questions/ManualQuestionModal.tsx src/app/admin/components/questions/AdminQuestionEditorPage.tsx src/app/admin/components/questions/questionEditorShared.ts --max-warnings=0` | Passou; modal/editor de questoes agora compartilham tipagem do formulario, sairam de `any` explicito, o preview de contexto usa `next/image` e a sincronizacao de busca de prova nao chama mais `setState` direto no efeito |
| `npx eslint src/app/admin/components/questions/useAdminQuestionsWorkflow.ts src/app/admin/components/questions/useAdminManualQuestionEditor.ts src/app/admin/components/questions/useAdminQuestionWorkbench.ts --max-warnings=0` | Passou; workflow admin de questoes saiu de `any` explicito nas bordas, a ordenacao editorial ficou tipada e o carregamento inicial nao dispara mais `loadQuestions` diretamente dentro do efeito |
| `npx eslint src/app/admin/components/questions/useManualQuestionWorkflow.ts --max-warnings=0` | Passou; workflow manual de questoes foi reestruturado com estado tipado, heranca de taxonomias sem `any` explicito, sincronizacoes de cargo/assunto com `requestAnimationFrame` e parsing de campos legados via `Record<string, unknown>` |
| `npx eslint src/app/admin/components/questions/AdminQuestionsSection.tsx --max-warnings=0` | Passou; listagem principal do admin de questoes saiu de `any` explicito no recorte auditado, o payload de geracao IA e as taxonomias foram protegidos por guardas reais, o link SEO da questao passou a exigir ID numerico valido e o build/typecheck voltaram a fechar com o arquivo limpo |
| `npx eslint src/providers/MarketplaceProvider.tsx` filtrando `set-state-in-effect`, deps e render impuro | Passou sem ocorrencias; carregamento de transacoes respeita frame/cancelamento e dependencia de usuario atual |
| `npx eslint src/app/admin/components/settings/AdminCacheManagement.tsx --max-warnings=0` | Passou; gestao de cache tipada e carregamento inicial sem estado sincrono no efeito |
| `npx eslint src/app/admin/components/finance/AdminFinanceAnalyticsPanel.tsx --max-warnings=0` | Passou; analytics financeiro carrega dados em frame cancelavel sem estado sincrono no efeito |
| `npx eslint src/app/admin/components/support/AdminFeedback.tsx --max-warnings=0` | Passou; suporte/admin feedback sem avisos de efeito, tempo impuro ou tipagem explicita pendente |
| `npx eslint src/app/admin/components/shared/useAdminPageController.tsx --max-warnings=0` | Passou; controller admin tipado e sincronizacoes de contadores/rota fora do efeito sincrono |
| `npx eslint src/app/admin/components/shared/AdminPublishStateBadge.tsx --max-warnings=0` | Passou; badge de publicacao sem `any` e com leitura segura de data |
| `npx eslint src/app/admin/components/settings/StripePaymentMethodsSettings.tsx --max-warnings=0` | Passou; metodos Stripe locais sem ID temporal gerado por render |
| `npx eslint src/app/admin/components/settings/AdminSettings.tsx --max-warnings=0` | Passou; settings admin sem `set-state-in-effect`, sem helpers mortos, com QR do 2FA em `next/image` e checks de integracoes tipados |
| `npx eslint src/app/admin/components/users/AdminUserEditorPage.tsx src/app/admin/components/users/useAdminUserProfileWorkflow.ts src/app/admin/components/users/UserProfileAdminModal.tsx --max-warnings=0` | Passou; edicao detalhada de usuario sem `set-state-in-effect` no plano/perfil, sem `<img>` direta e com bordas de tipagem localmente saneadas |
| `npx eslint src/app/admin/components/exams/AdminExamBankSection.tsx src/app/admin/components/exams/AdminExamEditorPage.tsx src/app/admin/components/exams/examBankUtils.ts src/app/admin/components/exams/useAdminExamBankWorkflow.ts --max-warnings=0` | Passou; banco/editor de provas sem `any` explicito no recorte auditado, com normalizacao de prova tipada e workflow de sincronizacao mais estrito |
| `npx eslint src/app/notifications/page.tsx --max-warnings=0` | Passou; pagina de notificacoes sem `Date.now()` no render e sem `<img>` nao otimizada |
| `npx eslint src/app/partner-dashboard/page.tsx --max-warnings=0` | Passou; dashboard de parceiro sem imports mortos, sem componente criado no render, sem relogio impuro e sem `<img>` direto |
| `npx eslint src/app/questions/components/QuestionCard.tsx --max-warnings=0` | Passou; card central de questao sem avisos de hook, tempo impuro, `any`, imports mortos ou imagens diretas, e o feedback de resposta nao e mais perdido quando chegam novas estatisticas |
| `src/app/landing/components/__tests__/ThemeOrnaments.test.tsx` | Passou; ornamentos sazonais renderizam o mesmo HTML em renders SSR repetidos |
| `npx eslint src/app/marketplace/page.tsx --max-warnings=0` | Passou; marketplace sem avisos de hook, tempo impuro, `any`, imports mortos, mutacao indevida ou imagens diretas |
| `npx eslint src/app/checkout/CheckoutPage.tsx --max-warnings=0` | Passou; checkout Stripe sem helpers duplicados, sem `catch any`, sem `window.location.href`, sem efeitos sincronos problematicos e com requisitos de perfil/pagamento estabilizados |
| `npx eslint src/services/api/interceptors.ts --max-warnings=0` | Passou; camada HTTP agora faz pre-refresh antes de enviar request com access token vencido, reduzindo 401/`token_expired` em cascata |
| `npx eslint src/app/simulation/page.tsx --max-warnings=0` | Passou; fluxo de simulado sem avisos de `any`, render impuro, cronometro com cascata de estado, deps inseguras ou review inconsistente |
| `npx eslint src/providers/AuthProvider.tsx --max-warnings=0` | Passou; provider de auth sem dependencia faltante no callback de XP/level up |
| `npx eslint src/services/api/response.ts src/services/api/types.ts src/services/payments/paymentsService.ts src/services/subscriptions/subscriptionsService.ts src/services/transactions/transactionsService.ts src/services/simulations/simulationsService.ts src/services/rankings/rankingsService.ts src/services/marketplace/marketplaceService.ts src/services/questions/questionService.ts src/services/filters/index.ts src/app/admin/components/finance/AdminFinance.tsx src/app/admin/components/navigation/AdminNavigationSidebar.tsx src/services/materials/readerService.ts --max-warnings=0` | Passou; camada HTTP, servicos criticos, dominio financeiro do admin, sidebar de navegacao admin e reader de materiais ficaram sem `any`/efeitos problematicos no recorte auditado |
| `npx tsc --noEmit --pretty false` + `npm run build` apos a migracao de `notifications` | Passou; notificacoes sairam do reducer central para store dedicado com cache de query, o polling deixou de escrever no estado legado, os logs de debug de fetch foram removidos e o `notificationService` deixou de duplicar o caminho `getNotifications/getUserNotifications` |
| `npx eslint src/components/GlobalLoader.tsx src/providers/NavigationProgressProvider.tsx src/providers/NextAppProviders.tsx src/providers/NextRouteFrame.tsx src/state/navigation-progress/navigationProgressStore.ts --max-warnings=0` + `npm run build` | Passou; o loader de topo agora dispara no clique da navegacao (Link/router.push/replace e fallback para `<a>` interna), em vez de aparecer apenas quando a rota de destino ja montou, mantendo o modo forcado para estados de auth/redirecionamento |
| `npx tsc --noEmit --pretty false` + `npm run build` apos a migracao de `userProgress` | Passou; respostas, comentarios e notas do usuario sairam do reducer central para store dedicado com cache de query, o fluxo de taxonomias voltou a atualizar o store real de configuracao e actions legadas (`SET_USER_*`, `RESET_PROGRESS`, `SET_TAXONOMIES`) foram removidas do provider |
| `npx tsc --noEmit --pretty false` | Passou apos os ajustes do painel/marketing, leitor PDF, lei comentada admin, materiais, importador, formulario de questao, modal/editor de questoes, workflows centrais/manual de questoes, marketplace provider, cache admin, analytics financeiro, suporte admin, controller admin, badges, metodos Stripe, settings admin, usuarios admin, provas admin, notificacoes, dashboard de parceiro, card de questao, marketplace, simulados, auth provider, servicos criticos de pagamentos, rankings, questoes, filtros, `AdminFinance.tsx`, `AdminDashboard.tsx` e a camada principal de database modals/sorting/datasets/sections |
| `npm run check:text-encoding` | Passou apos limpar mojibake em importador admin e gestao de cache |
| `npm run build` | Passou com Next 16.2.4, 32 paginas estaticas geradas e rotas dinamicas preservadas, incluindo `/simulation`, `/cronograma`, `/checkout/[planId]`, `/marketplace` e rotas administrativas |
| `process_marketing_automations.php --dry-run=true --limit=5` | Passou; sem campanha ativa, retornou sucesso sem envios |
| `ProductionSmokeWiringTest.php` | Passou apos reforco para falhar quando `api/settings.php` expuser chaves sensiveis |
| `AuthClientIpBehaviorTest.php` | Passou; captura IP agora prioriza `CF-Connecting-IP`, `True-Client-IP`, `X-Real-IP`, `X-Forwarded-For` e `Forwarded`, com normalizacao de loopback/IPv6 |
| `BillingStripeOperationalValidationTest.php --scenario=webhook --json` | Passou com veredito `GO` para duplicidade, evento fora de ordem e recuperacao |
| Smoke HTTP `api/plans/list.php` | `200` |
| Smoke HTTP `api/questionsList?page=1&limit=1` | `200` |
| Smoke HTTP `api/settings.php` | `200` |

Observacao: os testes PHP exibem o aviso conhecido `Module "openssl" is already loaded`; isso nao quebrou os testes, mas deve ser limpo na configuracao PHP da VPS.

- `src/providers/AppProviders.tsx`, `src/providers/NotificationsProvider.tsx`, `src/providers/NextRouteFrame.tsx`, `src/app/admin/components/support/AdminCommentsModerationSection.tsx` e `src/providers/DataProvider.tsx`: o `DataProvider` legado foi removido do runtime e do codigo-fonte; notificacoes agora rodam em bootstrap dedicado (query cache + polling controlado), a restauracao forcada de rota via `sessionStorage` foi removida (evita flash da landing em hard refresh) e a moderacao de comentarios ganhou trava de request em voo para bloquear rajadas de chamadas repetidas com os mesmos filtros.
- `src/state/query/queryClient.ts`, `src/providers/QueryProvider.tsx` e `src/app/admin/components/support/AdminSupportSection.tsx`: o Query Client virou singleton no browser para sobreviver a remount de desenvolvimento e evitar segunda rodada de fetch no hard refresh (settings/plans/testimonials/notificacoes); no suporte admin, a pre-carga de contagem de comentarios pendentes deixou de rodar junto da aba de moderacao, reduzindo chamadas duplicadas para `comments_moderation`.
- `src/services/admin/adminService.ts` e `src/services/plans/planService.ts`: removido cache-buster `?_=${Date.now()}` das leituras de settings e planos, evitando URLs unicas por chamada e permitindo coalescencia/cache efetivos no bootstrap.

## Atualizacao incremental (`2026-05-09`)

- `src/app/admin/components/finance/AdminFinanceAnalyticsPanel.tsx`: adicionado bloco operacional `Cobrança em risco (quem e por quê)` com detalhamento por usuário/e-mail/sinal/último evento, cobrindo explicitamente os segmentos `payment_failed` e `subscriber_at_risk`.
- `src/app/admin/components/questions/AdminQuestionsSection.tsx`: ajustes de copy/acentuação em rótulos críticos (Questões, Comentário, Análise detalhada, Publicação, Página/Próxima) e mensagens de ação em massa para reduzir inconsistências linguísticas no painel.
- `src/app/notifications/page.tsx`: validado uso do modal padronizado (`useConfirm`) para limpeza e exclusão permanente na lixeira de notificações, sem `window.confirm`.
- `C:/xampp/htdocs/questao-pro-backend/modules/admin/repositories/AdminUserActionsRepository.php`: verificado que upgrade manual do admin grava assinatura `manual_admin` sem renovação automática (`auto_renew=0`), reduzindo risco de cobrança indevida; falta prova E2E do fluxo completo.

## Bloqueios para producao

### P0

- Prova real de pagamentos ausente: antes de vender, precisa validar checkout Stripe, webhook publico, cron de reconciliacao, renovacao, `past_due`, cancelamento e reembolso com sandbox real.
- Banco/operacao sem prova de carga: houve historico de `Too many connections`; as travas de cron foram implementadas, mas ainda precisa provar limites de conexao e queries principais em ambiente parecido com a VPS.
- Checklist de segredos e ambiente ainda precisa ser validado no ambiente final: o preflight agora barra `APP_ENV` incorreto, `APP_URL` local, CORS inseguro, Stripe/Google malformados e segredos fracos, mas ele precisa ser executado na VPS antes do go live.
- Backup/restore ainda sem ensaio real na VPS: scripts de backup, verificacao e restore seguro existem, mas o restore precisa ser executado em banco temporario e seguido de smoke antes do go live.

### P1

- Lint raiz esta verde, mas ainda ha volume de avisos de tipagem/React que deve ser reduzido por dominio antes de escalar o time. O recorte recente deixou painel principal, marketing e redes sociais da homepage sem avisos no ESLint direcionado.
- Notificacoes e gamificacao ainda nao possuem motor unico geral de regras nem testes E2E evento-a-evento para ranking real e todos os webhooks financeiros reais; marketplace/social/rankings ja possuem ledger idempotente local para XP/reputacao/badges.
- Landing pages/campanhas com textos e SEO administraveis ja saneiam markup/URLs perigosas, incluindo canonical sensivel e protocolo relativo. Se o editor passar a aceitar codigo HTML bruto, ainda sera obrigatorio aplicar sandbox/sanitizador dedicado antes de publicar.
- Logs agora possuem scanner local e analise no endpoint admin, mas ainda faltam rotacao/retencao/alerta real configurados na VPS.
- SEO publico esta bem encaminhado, mas ainda precisa Search Console, dominio real, sitemap publicado e auditoria de canonical/OG em deploy.
- Rate limiting esta aplicado localmente nos fluxos sensiveis e em analytics, mas os limites finais precisam ser calibrados em staging para evitar falso positivo em turmas, NAT corporativo e campanhas.

## Conclusao

Nao recomendo producao publica hoje. Recomendo subir uma VPS de staging com dominio temporario, executar a matriz de pagamentos e notificacoes, reduzir os avisos mais criticos por dominio, provar banco/cron por carga moderada e so entao mudar o veredito para `Pronto com ressalvas` ou `Pronto`.

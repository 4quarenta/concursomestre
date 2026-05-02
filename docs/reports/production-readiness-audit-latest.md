# Auditoria de Producao - ConcursoMestre

Data: `2026-05-01`

Veredito: `Nao pronto`

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
- `api/subscriptions/cron_recurring.php` e `api/subscriptions/cron_scheduled_payments.php`: deixam de abrir MySQL para bridges removidas do Mercado Pago.
- `modules/admin/repositories/AdminCommentsModerationRepository.php`: status de moderacao agora notifica o autor e, ao aprovar, dispara notificacoes sociais de resposta/material.
- `modules/subscriptions/services/SubscriptionsService.php`: falha de cobranca Stripe (`past_due`) notifica admins, e reembolso pendente de assinatura passa a notificar todos os admins ativos no app.
- `modules/questions/services/QuestionsRewardService.php` e `modules/questions/repositories/QuestionsRepository.php`: respostas passam a atualizar streak diario e badges idempotentes (`user_streaks`, `user_badges`).
- `scripts/tasks/backup_mysql.php`: cria dump MySQL com `mysqldump`, credenciais temporarias fora da linha de comando, flags seguras para producao, checksum SHA-256 e retencao.
- `scripts/tasks/verify_mysql_backup.php`: valida existencia, tamanho, checksum e marcadores de dump MySQL/MariaDB antes de qualquer ensaio de restore.
- `scripts/tasks/restore_mysql_backup.php`: adiciona restore operacional com dry-run por padrao, bloqueio contra restore acidental no banco atual, validacao de checksum/dump e recusa de dumps com `DROP DATABASE`, `CREATE DATABASE` ou `USE` de schemas de sistema.
- `scripts/tasks/production_smoke.php`: valida endpoints publicos criticos, JSON de resposta e uma prova leve de conexoes MySQL com `Threads_connected`/`max_connections`.
- `modules/admin/services/AdminSystemLogAnalyzer.php`: classifica logs por severidade/categoria e calcula repeticoes para o painel admin.
- `scripts/tasks/production_log_audit.php`: permite auditoria CLI dos logs com janela configuravel, limiar de repeticao e falha em evento critico.
- `src/config/securityHeaders.ts` e `next.config.ts`: aplicam headers de seguranca no frontend, incluindo CSP, bloqueio de framing, `nosniff`, referrer e permissions policy.
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
- `src/providers/NextRouteFrame.tsx`: textos de aviso financeiro/hidratação revisados em UTF-8, removendo mojibake visivel.
- `src/components/shared/charts/StableResponsiveContainer.tsx`: adiciona casca estavel para graficos Recharts, montando `ResponsiveContainer` apenas quando o elemento tem largura/altura reais.
- `src/app/dashboard/DashboardPage.tsx`, `src/app/bank-analysis/BankAnalysisPage.tsx`, `src/app/partner-dashboard/page.tsx` e `src/app/profile/ProfilePage.tsx`: graficos criticos migrados para o wrapper estavel para evitar warnings `width(-1)`/`height(-1)` em containers ainda ocultos ou sem medida.
- `src/services/questions/questionHtmlSanitizer.ts`: remove scripts, handlers `on*`, URLs perigosas e estilos inseguros em HTML de questoes/comentarios.
- `src/components/shared/feedback/CommentsSection.tsx`: comentarios renderizados no frontend passam pelo sanitizador central.
- `src/services/questions/questionFlags.ts`: centraliza flags de questao anulada/inedita, evitando falso positivo quando a API retorna `"0"` ou `"false"` como string.
- `src/app/questions/components/QuestionCard.tsx` e `src/app/question/QuestionPublicPage.tsx`: usam a mesma regra de anulada/inedita para borda vermelha, badge e bloqueio de resposta.
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
- `modules/marketing_automation/*`, `scripts/tasks/process_marketing_automations.php`, `database/migrations/20260501_marketing_automation_events.sql` e `database/schema.sql`: campanhas automaticas agora possuem executor CLI com dry-run, lock, idempotencia por usuario/regra/campanha, condicoes (`recent_signup`, `near_subscription`, `inactive_7_days`, `trial_ending`, `saved_questions`, `elite_upgrade`) e envio por notificacao/e-mail.
- `modules/transactions/*` e `modules/payments/services/PaymentsService.php`: compra de material preserva `material_id` textual, notifica comprador/vendedor/admin quando a venda e confirmada e reembolso passa a avisar admin/vendedor/usuario conforme solicitacao e conclusao.
- `database/schema.sql`, `config/payment_provider.php`, `modules/materials/repositories/MaterialsRepository.php` e `scripts/migrations/migrate_marketplace_schema_compatibility.php`: bootstrap e guard de schema do marketplace agora usam `transactions.user_id`, `transactions.id` auto-incremento e IDs textuais em `material_ratings`/notas/leitor.
- `config/gamification_helper.php`, `modules/transactions/services/TransactionsService.php`, `modules/payments/services/PaymentsService.php`, `modules/materials/services/MaterialsService.php`, `database/schema.sql` e `scripts/migrations/migrate_marketplace_schema_compatibility.php`: vendas, aprovacoes e reembolsos de materiais agora registram XP/reputacao/badges em `user_gamification_events` sem duplicar em retry/webhook.
- `modules/comments/*`, `modules/admin/repositories/AdminCommentsModerationRepository.php` e `modules/admin/services/AdminReportModerationService.php`: aprovacao/spam de comentario, curtidas recebidas e denuncias aceitas agora afetam XP/reputacao/badges via `user_gamification_events`, com notificacoes de badge.
- `src/services/admin/adminService.ts` e `src/providers/DataProvider.tsx`: frontend separa `getPublicSystemSettings()` de `getSystemSettings()` e usa o endpoint admin apenas para admin/staff.
- `src/services/marketing/__tests__/landingPages.test.ts`: cobre payload admin malicioso em texto/SEO das landings.
- `eslint.config.mjs`: separa o app mobile do lint web da raiz, ignora logs locais e converte dividas massivas de migracao em avisos rastreaveis.
- `src/app/partner-dashboard/page.tsx`: corrige chamadas condicionais de hooks que eram erro real de lint.
- `src/components/PageTransition.tsx`: remove troca pos-montagem baseada em estado e usa `initial={false}` no Framer Motion para manter HTML inicial estavel.
- `src/app/admin/components/dashboard/AdminDashboard.tsx`: loading dos indicadores passou a ser acionado pelos controles do periodo/refresh, evitando `setState` sincrono dentro do efeito de busca.
- `src/app/practice/page.tsx`: filtros auxiliares foram movidos para componentes estaveis fora do render, `Date.now()` saiu do estado inicial, e o carregamento automatico no modo foco foi adiado para o proximo frame.
- `src/app/admin/components/database/useAdminDatabaseNavigationState.ts`: aba inicial do banco/admin agora e resolvida antes do estado e sincronizacoes de URL sao agendadas no proximo frame, removendo render em cascata.
- `src/app/admin/components/database/useAdminTaxonomyWorkflow.ts`: carregamento de taxonomias usa callback estavel, slug automatico e atualizado no handler do campo, e o efeito de espelho de estado foi removido.
- `src/services/offers/useLimitedOfferCountdown.ts`: contador de oferta nao usa mais `Date.now()` durante render e atualiza tempo restante apenas em frame/intervalo no cliente.
- `src/app/admin/components/finance/AdminMarketing.tsx`: rascunhos de campanha, cupons e tema sincronizam com settings no proximo frame e o arquivo passa eslint sem avisos.
- `src/app/profile/ProfilePage.tsx`: perfil deixou de usar `Date.now()` no render para liberar download de material e efeitos de abas, questoes salvas, foto, depoimento e notas foram adiados para frame/fluxo assíncrono.
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
- `src/app/questions/components/QuestionCard.tsx`: card de questao passa ESLint sem avisos, remove imports mortos, `any`, relogio impuro no render, setState sincrono em efeitos de reset, imagens `<img>` e mutacoes/ordem insegura de hooks.
- `src/app/marketplace/page.tsx`: marketplace passa ESLint sem avisos, deixou de usar relogio impuro nos pontos criticos de render/acesso, removeu mutacao direta de `currentUser` apos checkout, estabilizou efeitos de deep link/paginacao, tipou comentarios/rating e trocou imagens principais para `next/image`.
- `src/app/simulation/page.tsx`: simulados passam ESLint sem avisos e typecheck; filtros/taxonomias reduziram `any`, revisao reaproveita helper tipado de resposta, o timer finaliza pelo tick sem cascata de estado no efeito e o `QuestionCard` nao recebe mais `Date.now()` no render.
- `src/providers/AuthProvider.tsx`: provider de autenticacao passa ESLint sem avisos; milestones de nivel sairam do corpo do componente e o callback de XP deixou de depender de constante recriada a cada render.
- `.gitignore` e remocao de `tsconfig.tsbuildinfo`: cache incremental do TypeScript deixou de ficar versionado.
- Logs locais ignorados (`web-root-dev*.log` e `mobile/expo-live*.log`) foram removidos do workspace.

## Status por etapa

| Etapa | Status local | Status producao | Evidencia |
| --- | --- | --- | --- |
| Auditoria e backlog | Pronto | Pronto para orientar correcao | Documentos em `docs/reports/*` e runbook criados |
| Banco e cron | Pronto local parcial | Nao pronto ate teste de carga/staging | `CronLockWiringTest`, `CronSecretHardeningWiringTest`, `SubscriptionsCronWiringTest`, `MarketplaceSchemaCompatibilityWiringTest`, `MarketplaceGamificationWiringTest` e `ProductionSmokeWiringTest` passaram; smoke local abriu 3 conexoes e uso ficou em 3/151; schema do marketplace/gamificacao foi normalizado localmente |
| Notificacoes/gamificacao | Pronto local parcial | Nao pronto total | Comentarios moderados, curtidas sociais, feedback/suporte, denuncias aceitas, rankings com XP/reputacao/badges basicos, campanhas automaticas, compras/reembolsos de materiais com XP/reputacao/badges, streaks, badges basicos, `past_due` Stripe e reembolso pendente cobertos; UI de notificacoes passa ESLint sem avisos; falta prova gateway real e smoke de deep links |
| Sanitizacao HTML | Pronto local parcial | Nao pronto total | Questoes, comentarios e textos/SEO de landings saneados; HTML bruto futuro ainda precisa politica/sandbox antes de ser liberado |
| Pagamentos/webhooks | Pronto local parcial | Nao pronto | Suite operacional de webhook Stripe passou, alias/canonico estao cobertos, config publica exige chaves validas, verify-payment exige dono autenticado e Stripe Connect bloqueia redirect externo; falta sandbox com webhook publico/tunel |
| Deploy VPS/backup/rollback | Pronto local parcial | Nao pronto | Backup, verificador e restore dry-run seguro passaram; falta executar restore real em banco temporario da VPS e rollback completo |
| Logs/observabilidade | Pronto local parcial | Nao pronto | Scanner de logs e analise no endpoint admin prontos; falta rotacao/alerta real na VPS |
| Headers de seguranca | Pronto local | Nao pronto ate validar proxy HTTPS | Frontend/API com CSP, clickjacking e nosniff; API local confirmou headers; preflight exige `APP_ENV=production`, `APP_URL` publico, CORS HTTPS sem wildcard e reset DB desativado |
| Uploads | Pronto local parcial | Nao pronto ate validar servidor final | Helper central e `.htaccess` prontos; falta regra equivalente em Nginx se aplicavel |
| Rate limiting | Pronto local parcial | Nao pronto ate calibrar na VPS/proxy | Perfis aplicados em auth, suporte, comentarios, denuncias, uploads e analytics; falta medir falsos positivos e limites reais em staging |
| Analytics tracking | Pronto local parcial | Nao pronto ate observar trafego em staging | Endpoint limita volume, nao confia em `userId` do cliente e limita payloads grandes; falta monitorar volume real e 429 |
| Cronograma Elite | Pronto local parcial | Nao pronto ate smoke com usuario Elite real | Backend persiste por usuario e UI sincroniza com fallback local; falta teste ponta a ponta em staging |
| Superficie publica da API | Pronto local | Nao pronto ate preflight passar na VPS | Log operacional removido de `api/`; cron grava em `storage/logs/subscriptions`; preflight e teste residual bloqueiam novos artefatos |
| Google login | Pronto local parcial | Nao pronto ate OAuth real em staging | Frontend valida Client ID, nao carrega script invalido e trata falha do script Google; falta Client ID real autorizado no Google Cloud e backend com mesmo ID |
| SEO publico | Pronto local parcial | Nao pronto ate dominio/Search Console | `NEXT_PUBLIC_CANONICAL_URL` agora alimenta metadata/sitemap/robots; falta validacao no dominio final |
| SEO privado | Pronto local | Nao pronto ate validar deploy | Rotas privadas principais tem `noindex`; cronograma Elite corrigido; sitemap dinamico filtra drafts, elite/internal e itens pendentes |
| Landings publicas | Pronto local parcial | Nao pronto ate smoke no dominio final | `/l/[slug]` tem metadata server-side para publicadas, `noindex` para rascunhos/inexistentes e sitemap inclui landings publicadas customizadas; falta validar OG/canonical externo |
| Promocoes publicas | Pronto local parcial | Nao pronto ate smoke no dominio final | `/promo/[slug]` so exibe a promocao quando o slug ativo confere e gera `noindex` para slug invalido/inativo; falta validar campanha real publicada |
| URLs de campanhas | Pronto local parcial | Nao pronto ate smoke admin no dominio final | CTAs de banners/notificacoes bloqueiam URLs perigosas e fallback antigo `/pricing` foi trocado por `/planos` |
| Automacoes de campanha | Pronto local parcial | Nao pronto ate smoke com campanha ativa | Executor CLI faz dry-run, usa lock, seleciona usuarios por condicao e registra envios idempotentes; falta teste real de envio com SMTP/notificacao em staging |
| Suporte/admin badges | Pronto local parcial | Nao pronto ate smoke admin no painel real | Clique no item principal Suporte abre a primeira fila com pendencia; resposta admin notifica o usuario e `/support?threadId=...` abre a conversa; falta validar visualmente com dados reais |
| Depoimentos da home | Pronto local parcial | Nao pronto ate smoke admin no painel real | Avaliacao exige nome publico/contexto; endpoint publico lista apenas aprovadas completas; home usa fallback mock quando a lista vem vazia |
| Settings publicas/admin | Pronto local parcial | Nao pronto ate smoke autenticado na VPS | `api/settings.php` sempre retorna a projecao publica saneada; `api/admin/settings.php` exige admin/staff tambem no GET; frontend usa endpoint admin apenas para admin/staff |
| Hydration/transicoes | Pronto local parcial | Nao pronto ate smoke no browser do build | `PageTransition` nao troca mais a arvore apos mount e nao injeta `opacity:0` no HTML inicial; falta validar sem warnings no navegador em staging |
| Graficos responsivos | Pronto local parcial | Nao pronto ate smoke no browser do build | `ResponsiveContainer` direto foi removido dos graficos criticos; wrapper SSR estavel coberto por teste |
| Pratica/modo foco | Pronto local parcial | Nao pronto ate smoke com usuario real | Filtros auxiliares agora sao componentes estaveis, sem recriacao a cada render; carregamento automatico no modo foco nao dispara setState sincrono no efeito |
| Admin database/navegacao | Pronto local parcial | Nao pronto ate smoke no painel real | Estado de aba/categoria nao sincroniza mais com setState sincrono no efeito; falta validar clique/URL/hash nas tabelas WordPress |
| Admin taxonomias/filtros | Pronto local parcial | Nao pronto ate smoke CRUD real | Workflow passa eslint sem avisos, slug automatico nao depende de efeito espelho e fetch inicial tem dependencia estavel; falta criar/editar/excluir materia, topico, assunto e cargo no painel |
| Ofertas/campanhas publicas | Pronto local parcial | Nao pronto ate smoke visual | Countdown de oferta evita render impuro e hidratacao instavel; falta validar banners/oferta ativa em home/checkout/planos |
| Marketing admin | Pronto local parcial | Nao pronto ate smoke CRUD real | `AdminMarketing.tsx` passa eslint sem avisos; rascunhos locais nao sincronizam mais com setState sincrono no efeito; falta salvar campanha, cupom e tema com backend real |
| Perfil/abas do usuario | Pronto local parcial | Nao pronto ate smoke com usuario real | Perfil sem avisos criticos de render impuro/render em cascata no recorte; questoes salvas, notas, foto, avaliacao e materiais ainda precisam smoke |
| Financeiro admin | Pronto local parcial | Nao pronto ate smoke gateway real | `AdminFinance.tsx` sem avisos criticos de `set-state-in-effect`/render impuro no recorte; ainda falta Stripe sandbox/staging, reembolso real, automacao e conciliacao |
| Layout global | Pronto local parcial | Nao pronto ate smoke browser | Modal de verificacao e menus nao fazem setState sincrono em efeitos; falta validar navegacao, menu mobile e perfil no browser |
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
| `npm run build` | Passou em 2026-05-02; Next 16.2.4/Turbopack gerou rotas publicas, privadas e dinamicas |
| `npm run check:text-encoding` | Passou |
| `npm run lint` | Passou com avisos |
| `npm run lint -- --quiet` | Passou sem erros |
| `npx eslint src/components/PageTransition.tsx --max-warnings=0` | Passou |
| `npx eslint src/app/practice/page.tsx` | Passou com avisos remanescentes de tipagem/memoizacao; avisos de componente criado no render, `Date.now()` inicial e `setState` sincrono no modo foco foram removidos |
| `npx eslint src/app/admin/components/dashboard/AdminDashboard.tsx` | Passou com avisos remanescentes de `any`; aviso de `setState` sincrono no efeito de stats foi removido |
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
| `production_smoke.php --db-connections=3 --timeout=8` | Passou: planos, questoes e settings retornaram `200`; settings publico sem chaves sensiveis proibidas; MySQL `Threads_connected=3`, `max_connections=151` |
| `ProductionLogAuditWiringTest.php` | Passou |
| `production_log_audit.php --tail=500 --repeat-threshold=3 --fail-on=none` | Passou nos logs locais inspecionados; sem criticos, com repeticoes informativas em settings/Stripe |
| `SecurityHeadersWiringTest.php` | Passou |
| `src/config/__tests__/securityHeaders.test.ts` | Passou, 2 testes |
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
| `MarketingAutomationWiringTest.php` | Passou; executor de campanha possui dry-run, lock, idempotencia, condicoes oficiais, notificacao, e-mail e schema proprio |
| `npx eslint src/app/admin/components/panel/AdminPanelSection.tsx --max-warnings=0` | Passou; abas do painel nao sincronizam estado durante o efeito inicial e alertas/billing estao tipados sem `any` |
| `npx eslint src/app/admin/components/marketing/AdminMarketingSection.tsx --max-warnings=0` | Passou; navegacao de marketing nao dispara estado sincrono em efeito |
| `npx eslint src/app/admin/components/marketing/AdminSocialLinksManager.tsx --max-warnings=0` | Passou; redes sociais da homepage sincronizam rascunho no frame seguinte e import morto foi removido |
| `npx eslint src/components/shared/overlays/PdfViewer.tsx --max-warnings=0` | Passou; leitor PDF sem avisos de efeito/deps, sem `any` no fluxo de comentarios/text layer e sem imports mortos |
| `npx eslint src/app/admin/components/legal-commentary/AdminLegalCommentarySection.tsx --max-warnings=0` | Passou; admin de lei comentada sem efeito inicial sincrono, sem import morto e sem `any` nos erros de sincronizacao |
| `npx eslint src/app/admin/components/materials/AdminMaterialsSection.tsx --max-warnings=0` | Passou; moderacao de materiais sem `any` no preview autenticado e no badge de publicacao |
| `npx eslint src/app/admin/components/import/AdminImportSection.tsx --max-warnings=0` | Passou; importador admin sem imports mortos, sem `any` em previews extraidos e com campo legado de cargo normalizado para identificador valido |
| `npx eslint src/app/admin/components/questions/useManualQuestionReferenceData.ts --max-warnings=0` | Passou; referencias do formulario de questao usam taxonomias tipadas e memoizacao com dependencias estaveis |
| `npx eslint src/app/admin/components/questions/AdminQuestionEditorPage.tsx` filtrando `set-state-in-effect`, deps e render impuro | Passou sem ocorrencias; editor de questao nao sincroniza mais grupos/prova/contexto diretamente no efeito |
| `npx eslint src/providers/MarketplaceProvider.tsx` filtrando `set-state-in-effect`, deps e render impuro | Passou sem ocorrencias; carregamento de transacoes respeita frame/cancelamento e dependencia de usuario atual |
| `npx eslint src/app/admin/components/settings/AdminCacheManagement.tsx --max-warnings=0` | Passou; gestao de cache tipada e carregamento inicial sem estado sincrono no efeito |
| `npx eslint src/app/admin/components/finance/AdminFinanceAnalyticsPanel.tsx --max-warnings=0` | Passou; analytics financeiro carrega dados em frame cancelavel sem estado sincrono no efeito |
| `npx eslint src/app/admin/components/support/AdminFeedback.tsx --max-warnings=0` | Passou; suporte/admin feedback sem avisos de efeito, tempo impuro ou tipagem explicita pendente |
| `npx eslint src/app/admin/components/shared/useAdminPageController.tsx --max-warnings=0` | Passou; controller admin tipado e sincronizacoes de contadores/rota fora do efeito sincrono |
| `npx eslint src/app/admin/components/shared/AdminPublishStateBadge.tsx --max-warnings=0` | Passou; badge de publicacao sem `any` e com leitura segura de data |
| `npx eslint src/app/admin/components/settings/StripePaymentMethodsSettings.tsx --max-warnings=0` | Passou; metodos Stripe locais sem ID temporal gerado por render |
| `npx eslint src/app/notifications/page.tsx --max-warnings=0` | Passou; pagina de notificacoes sem `Date.now()` no render e sem `<img>` nao otimizada |
| `npx eslint src/app/partner-dashboard/page.tsx --max-warnings=0` | Passou; dashboard de parceiro sem imports mortos, sem componente criado no render, sem relogio impuro e sem `<img>` direto |
| `npx eslint src/app/questions/components/QuestionCard.tsx --max-warnings=0` | Passou; card central de questao sem avisos de hook, tempo impuro, `any`, imports mortos ou imagens diretas |
| `npx eslint src/app/marketplace/page.tsx --max-warnings=0` | Passou; marketplace sem avisos de hook, tempo impuro, `any`, imports mortos, mutacao indevida ou imagens diretas |
| `npx eslint src/app/simulation/page.tsx --max-warnings=0` | Passou; fluxo de simulado sem avisos de `any`, render impuro, cronometro com cascata de estado, deps inseguras ou review inconsistente |
| `npx eslint src/providers/AuthProvider.tsx --max-warnings=0` | Passou; provider de auth sem dependencia faltante no callback de XP/level up |
| `npx eslint src/services/api/response.ts src/services/api/types.ts src/services/payments/paymentsService.ts src/services/subscriptions/subscriptionsService.ts src/services/transactions/transactionsService.ts src/services/simulations/simulationsService.ts src/services/rankings/rankingsService.ts src/services/marketplace/marketplaceService.ts src/services/questions/questionService.ts src/services/filters/index.ts --max-warnings=0` | Passou; camada HTTP e servicos criticos de pagamentos, simulados, rankings, marketplace, questoes e filtros ficaram tipados e sem `any` explicito no recorte auditado |
| `npx tsc --noEmit --pretty false` | Passou apos os ajustes do painel/marketing, leitor PDF, lei comentada admin, materiais, importador, formulario de questao, marketplace provider, cache admin, analytics financeiro, suporte admin, controller admin, badges, metodos Stripe, notificacoes, dashboard de parceiro, card de questao, marketplace, simulados, auth provider e servicos criticos de pagamentos, rankings, questoes e filtros |
| `npm run check:text-encoding` | Passou apos limpar mojibake em importador admin e gestao de cache |
| `npm run build` | Passou com Next 16.2.4, 32 paginas estaticas geradas e rotas dinamicas preservadas, incluindo `/simulation`, `/cronograma`, `/checkout/[planId]`, `/marketplace` e rotas administrativas |
| `process_marketing_automations.php --dry-run=true --limit=5` | Passou; sem campanha ativa, retornou sucesso sem envios |
| `ProductionSmokeWiringTest.php` | Passou apos reforco para falhar quando `api/settings.php` expuser chaves sensiveis |
| `BillingStripeOperationalValidationTest.php --scenario=webhook --json` | Passou com veredito `GO` para duplicidade, evento fora de ordem e recuperacao |
| Smoke HTTP `api/plans/list.php` | `200` |
| Smoke HTTP `api/questionsList?page=1&limit=1` | `200` |
| Smoke HTTP `api/settings.php` | `200` |

Observacao: os testes PHP exibem o aviso conhecido `Module "openssl" is already loaded`; isso nao quebrou os testes, mas deve ser limpo na configuracao PHP da VPS.

## Bloqueios para producao

### P0

- Prova real de pagamentos ausente: antes de vender, precisa validar checkout Stripe, webhook publico, cron de reconciliacao, renovacao, `past_due`, cancelamento e reembolso com sandbox real.
- Banco/operacao sem prova de carga: houve historico de `Too many connections`; as travas de cron foram implementadas, mas ainda precisa provar limites de conexao e queries principais em ambiente parecido com a VPS.
- Checklist de segredos e ambiente ainda precisa ser validado no ambiente final: o preflight agora barra `APP_ENV` incorreto, `APP_URL` local, CORS inseguro, Stripe/Google malformados e segredos fracos, mas ele precisa ser executado na VPS antes do go live.
- Backup/restore ainda sem ensaio real na VPS: scripts de backup, verificacao e restore seguro existem, mas o restore precisa ser executado em banco temporario e seguido de smoke antes do go live.

### P1

- Lint raiz esta verde, mas ainda ha volume de avisos de tipagem/React que deve ser reduzido por dominio antes de escalar o time. O recorte recente deixou painel principal, marketing e redes sociais da homepage sem avisos no ESLint direcionado.
- Notificacoes e gamificacao ainda nao possuem motor unico geral de regras nem testes E2E evento-a-evento para ranking real e todos os webhooks financeiros reais; marketplace/social/rankings ja possuem ledger idempotente local para XP/reputacao/badges.
- Landing pages/campanhas com textos e SEO administraveis ja saneiam markup/URLs perigosas. Se o editor passar a aceitar codigo HTML bruto, ainda sera obrigatorio aplicar sandbox/sanitizador dedicado antes de publicar.
- Logs agora possuem scanner local e analise no endpoint admin, mas ainda faltam rotacao/retencao/alerta real configurados na VPS.
- SEO publico esta bem encaminhado, mas ainda precisa Search Console, dominio real, sitemap publicado e auditoria de canonical/OG em deploy.
- Rate limiting esta aplicado localmente nos fluxos sensiveis e em analytics, mas os limites finais precisam ser calibrados em staging para evitar falso positivo em turmas, NAT corporativo e campanhas.

## Conclusao

Nao recomendo producao publica hoje. Recomendo subir uma VPS de staging com dominio temporario, executar a matriz de pagamentos e notificacoes, reduzir os avisos mais criticos por dominio, provar banco/cron por carga moderada e so entao mudar o veredito para `Pronto com ressalvas` ou `Pronto`.

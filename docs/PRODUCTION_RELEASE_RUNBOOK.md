# Runbook de Release em VPS

Data: `2026-05-01`

## Release versionada 1.0.0

O fluxo preferencial usa um pacote-fonte verificavel e diretorios imutaveis em
`CM_RELEASES_DIR`. O deploy troca os links do frontend e backend somente depois
do build, preflight e validacao de migrations do candidato.

Preparacao do artefato:

```bash
npm ci
npm run typecheck
npm test
npm run build
npm run release:manifest -- --revision=selective-r6.1
npm run release:verify
npm run release:package -- --output=.tmp/release-package --archive=.tmp/concursomestre-1.0.0.zip --commit=<commit> --revision=<revision>
```

O builder usa somente arquivos rastreados e exclui `.git`, `.next`, `.tmp`,
`.codex-tmp`, `.deploy`, backups, quarentena, ambientes reais, logs, dumps,
chaves e arquivos compactados legados. Os downloads publicos em
`public/downloads/*.zip` sao a unica excecao de arquivo compactado. Depois de
extrair o pacote em um diretorio limpo, o builder executa
`npm run check:release-package` automaticamente.

Validacao do host e plano de deploy, sem alteracoes:

```bash
scripts/deploy/verify-host.sh --config=/etc/concursomestre/deploy.env --archive=/tmp/concursomestre-1.0.0.zip --sha256=<sha256>
scripts/deploy/deploy-release.sh --config=/etc/concursomestre/deploy.env --archive=/tmp/concursomestre-1.0.0.zip --sha256=<sha256>
```

A execucao real exige `--execute=DEPLOY_STAGING` ou
`--execute=DEPLOY_PRODUCTION`. Migrations nao sao aplicadas por padrao; quando
aditivas e homologadas, exigem `--apply-migrations=true` e
`--migration-token=APPLY_ADDITIVE_MIGRATIONS`.

Rollback de codigo:

```bash
scripts/deploy/rollback-release.sh --config=/etc/concursomestre/deploy.env --release=<release-id>
scripts/deploy/rollback-release.sh --config=/etc/concursomestre/deploy.env --release=<release-id> --execute=ROLLBACK_STAGING
```

O rollback nunca restaura banco automaticamente. Migrations publicadas devem
ser forward-compatible; qualquer reversao de dados exige plano, backup e janela
operacional separados.

## Arquitetura alvo

- Frontend: Next.js na raiz `C:/dev/concursomestre`, build com `npm run build`, processo com `npm run start` ou PM2.
- Backend: PHP em `C:/xampp/htdocs/questao-pro-backend` no desenvolvimento; em VPS, publicar como app PHP separado atras de Apache/Nginx.
- Banco: MySQL/MariaDB com usuario proprio, sem `root`, backup diario e charset `utf8mb4`.
- Pagamentos: Stripe como único provider ativo. Não há superfície Mercado Pago publicada.

## Variaveis obrigatorias

Frontend:

- `NEXT_PUBLIC_API_BASE_URL=https://api.seu-dominio.com/api/`
- `NEXT_PUBLIC_CANONICAL_URL=https://www.seu-dominio.com/`
- `NEXT_PUBLIC_SITE_URL=https://www.seu-dominio.com/` opcional; se ausente, `NEXT_PUBLIC_CANONICAL_URL` alimenta metadata, sitemap e robots.
- `NEXT_PUBLIC_GOOGLE_CLIENT_ID=...apps.googleusercontent.com`

Backend:

- `APP_ENV=production`
- `APP_DEBUG=false`
- `APP_URL=https://www.seu-dominio.com`
- Use `C:/xampp/htdocs/questao-pro-backend/.env.production.example` como base do `.env` da VPS e troque todos os `CHANGE_ME`.
- `APP_TIMEZONE=America/Sao_Paulo`
- `ADMIN_DATABASE_RESET_ENABLED=false`
- `ADMIN_DATABASE_RESET_CONFIRMATION=` vazio em release normal
- `DB_HOST=...`
- `DB_PORT=3306`
- `DB_NAME=...`
- `DB_USER=...`
- `DB_PASSWORD=...`
- `DB_TIMEOUT_SECONDS=5`
- `DB_PERSISTENT=false`
- `JWT_SECRET=...`
- `API_KEY=...`
- `CRON_SECRET=...`
- `CRON_LOCK_DIR=/var/lock/concursomestre`
- `CORS_ALLOWED_ORIGINS=https://www.seu-dominio.com,https://seu-dominio.com`
- `GOOGLE_CLIENT_ID=...apps.googleusercontent.com`
- `STRIPE_PUBLISHABLE_KEY=pk_live_or_test`
- `STRIPE_SECRET_KEY=sk_live_or_test`
- `STRIPE_WEBHOOK_SECRET=whsec_...`
- `STRIPE_WEBHOOK_HEALTH_PATH=/var/www/questao-pro-backend/storage/logs/subscriptions/stripe_webhook_health.json` opcional
- `STRIPE_WEBHOOK_HEALTH_MAX_AGE_MINUTES=1440` opcional; ajuste menor em staging se quiser exigir teste recente
- `SMTP_HOST=smtp.seu-provedor.com`
- `SMTP_PORT=587`
- `SMTP_SECURE=tls` ou `ssl`
- `SMTP_USER=mailer@seu-dominio.com`
- `SMTP_PASS=...`
- `MAIL_FROM_ADDRESS=no-reply@seu-dominio.com`
- `MAIL_FROM_NAME=ConcursoMestre`
- `MYSQLDUMP_PATH=/usr/bin/mysqldump`
- `MYSQL_PATH=/usr/bin/mysql`
- `BACKUP_DIR=/var/backups/concursomestre/mysql`
- `BACKUP_RETENTION_DAYS=14`
- `MYSQL_BACKUP_HEALTH_PATH=/var/www/questao-pro-backend/storage/logs/backups/mysql_backup_health.json`
- `MYSQL_BACKUP_HEALTH_MAX_AGE_MINUTES=1560`
- `SMOKE_API_BASE_URL=https://api.seu-dominio.com/api`
- `SMOKE_WEB_BASE_URL=https://app.seu-dominio.com`
- `SMOKE_TIMEOUT_SECONDS=8`
- `SMOKE_DB_CONNECTIONS=3`
- `SMOKE_AUTH_EMAIL=admin@seu-dominio.com`
- `SMOKE_AUTH_PASSWORD=...`
- `SMOKE_AUTH_CAPTCHA_TOKEN=...` (quando reCAPTCHA estiver exigindo token real no login)
- `SMOKE_AUTH_REQUIRED=true`
- `SMOKE_ADMIN_REQUIRED=true`
- `CM_BASE_URL=https://app.seu-dominio.com`
- `CM_STUDENT_EMAIL=aluno-smoke@seu-dominio.com`
- `CM_STUDENT_PASSWORD=...`
- `CM_ADMIN_EMAIL=admin-smoke@seu-dominio.com`
- `CM_ADMIN_PASSWORD=...`
- `CM_VISUAL_SMOKE_REPORT_FILE=/var/www/concursomestre/.tmp/visual-auth-smoke-latest.json`
- `CM_VISUAL_SMOKE_SCREENSHOT_DIR=/var/www/concursomestre/.tmp/visual-auth-smoke`
- `READINESS_PROFILE=production`
- `READINESS_REPORT_FILE=/var/www/questao-pro-backend/storage/logs/readiness/production_readiness_latest.json`
- `HOMOLOGATION_PROFILE=staging` em staging ou `production` no go-live final
- `HOMOLOGATION_REPORT_FILE=/var/www/questao-pro-backend/storage/logs/readiness/staging_homologation_latest.json`
- `LOG_AUDIT_FILES=/var/log/nginx/error.log,/var/log/php/error.log,/var/log/concursomestre/stripe-cron.log,/var/log/concursomestre/mysql-backup.log,/var/www/questao-pro-backend/storage/logs/subscriptions/subscription_cron.log`
- `LOG_AUDIT_TAIL_LINES=5000`
- `LOG_AUDIT_SINCE_MINUTES=60`
- `LOG_AUDIT_REPEAT_THRESHOLD=5`
- `LOG_AUDIT_FAIL_ON=critical`
- `LOG_ALERT_ON=critical`
- `LOG_ALERT_SINCE_MINUTES=60`
- `LOG_ALERT_DEDUPE_MINUTES=360`
- `LOG_ALERT_NOTIFY_ADMINS=true`
- `LOG_ALERT_HEALTH_PATH=/var/www/questao-pro-backend/storage/logs/operations/log_alert_health.json`
- `LOG_ALERT_LEDGER_PATH=/var/www/questao-pro-backend/storage/logs/operations/log_alerts.ndjson`
- `LOG_MAINTENANCE_FILES=/var/www/questao-pro-backend/storage/logs/settings.log,/var/www/questao-pro-backend/storage/logs/subscriptions/subscription_cron.log`
- `LOG_ROTATE_MAX_BYTES=10485760`
- `LOG_RETENTION_DAYS=30`
- `LOG_ROTATE_ARCHIVE_DIR=/var/www/questao-pro-backend/storage/logs/archive`
- `LOG_MAINTENANCE_HEALTH_PATH=/var/www/questao-pro-backend/storage/logs/operations/log_maintenance_health.json`
- `LOG_MAINTENANCE_HEALTH_MAX_AGE_MINUTES=1560`
- `RATE_LIMIT_DIR=/var/lib/concursomestre/rate-limits`
- `AUTH_TRUST_PROXY_HEADERS=false`
- `AUTH_TRUSTED_PROXY_CIDRS=`
- `RATE_LIMIT_AUTH_LOGIN_MAX=10`
- `RATE_LIMIT_AUTH_LOGIN_WINDOW=300`
- `RATE_LIMIT_AUTH_LOGIN_SUBJECT_MAX=5`
- `RATE_LIMIT_AUTH_LOGIN_SUBJECT_WINDOW=900`
- `RATE_LIMIT_AUTH_REGISTER_MAX=5`
- `RATE_LIMIT_AUTH_REGISTER_WINDOW=600`
- `RATE_LIMIT_AUTH_PASSWORD_MAX=5`
- `RATE_LIMIT_AUTH_PASSWORD_WINDOW=900`
- `RATE_LIMIT_SUPPORT_WRITE_MAX=20`
- `RATE_LIMIT_COMMENT_WRITE_MAX=30`
- `RATE_LIMIT_REPORT_WRITE_MAX=10`
- `RATE_LIMIT_UPLOAD_MAX=20`
- `RATE_LIMIT_ANALYTICS_TRACK_MAX=120`
- `RATE_LIMIT_ANALYTICS_TRACK_WINDOW=60`

## Deploy

1. Criar backup do banco atual.
2. Publicar backend PHP e rodar migrations/schema incremental.
   - Incluir `database/migrations/20260501_user_study_schedules.sql` para persistencia do cronograma Elite.
   - Incluir `database/migrations/20260501_platform_testimonials.sql` para depoimentos publicos aprovados na home.
   - Incluir `database/migrations/20260501_rankings_notifications.sql` para preservar o criador do ranking e permitir notificacoes de moderacao.
   - Incluir `database/migrations/20260501_marketing_automation_events.sql` para idempotencia e auditoria de campanhas automaticas.
   - Executar via CLI a unica migracao PHP operacional allowlisted, `C:/xampp/htdocs/questao-pro-backend/scripts/migrations/migrate_marketplace_schema_compatibility.php`, apos o deploy do backend para normalizar `transactions`, `material_ratings`, IDs textuais do marketplace e tabelas de gamificacao (`user_badges`, `user_gamification_events`).
   - Nao publicar migracoes PHP ad hoc em `scripts/migrations`; novas alteracoes de schema devem entrar em `database/migrations/`.
3. Conferir `.env` backend com valores de producao.
4. Instalar dependencias frontend com `npm ci`.
5. Rodar o preflight frontend consolidado:

```bash
npm run check:production-local -- --with-build
npm run lint
```

O preflight consolidado executa encoding, typecheck, orcamento de hard refresh, suites criticas de arquitetura/SEO/XSS/charts e build quando `--with-build` for informado.
Quando encontra o backend local, tambem executa suites PHP criticas de billing e readiness wiring: checkout/webhook Stripe, cron, sync de planos, saldo de termo parcelado e contrato da suite operacional. Configure `PHP_BIN` e `BACKEND_ROOT` para caminhos diferentes; use `--skip-backend` somente quando o backend nao estiver disponivel naquele host.
O atalho equivalente para a preparacao local completa e:

```bash
npm run check:release-local
```

Esse atalho tambem grava a evidencia operacional do backend em `.tmp/backend-readiness-suite-latest.json`, caminho local ignorado pelo Git e proprio para anexar a uma homologacao. Para incluir o ensaio de restore do backup no mesmo comando local, use:

```bash
npm run check:production-local -- --with-build --with-backend-readiness --with-backup-rehearsal --backend-readiness-report=.tmp/backend-readiness-suite-latest.json
```

Antes do readiness, o atalho executa `npm run check:release-repos` e grava `.tmp/release-repos-status-latest.json`, confirmando que frontend e backend sao repositorios separados, possuem `origin` e nao rastreiam `.env`, logs ou dumps operacionais.

Esse modo chama `production_readiness_suite.php` com `profile=local`. Em staging/producao, prefira rodar a suite diretamente com `--profile=staging` ou `--profile=production` e dominios reais.
Para anexar uma evidencia JSON a uma homologacao local, informe:

```bash
npm run check:production-local -- --with-backend-readiness --backend-readiness-report=.tmp/backend-readiness-suite-latest.json
```

Se as credenciais de admin mudarem no ambiente local, exporte antes:

```bash
set CM_LOGIN_EMAIL=admin@seu-dominio.com
set CM_LOGIN_PASSWORD=SuaSenhaAtual
set CM_LOGIN_PASSWORD_CANDIDATES=SuaSenhaAtual,OutraSenhaFallback
```

CI dos repositorios:

- Frontend: `.github/workflows/frontend-ci.yml` roda `npm ci` e `npm run check:production-local -- --skip-backend --with-build` em push/PR.
- Backend: `.github/workflows/backend-ci.yml` roda `composer install` e `php scripts/tasks/ci_wiring_checks.php`, que executa lint PHP e os testes criticos de wiring.
- Antes de release, rode `npm run check:release-repos -- --strict` depois de commitar/pushar frontend e backend para bloquear worktree suja, branch sem upstream ou divergencia com o remoto.

6. Subir frontend com PM2/systemd. Use `config/deploy/systemd.concursomestre-web.service.example` como base do servico Next.js.
7. Configurar reverse proxy HTTPS. Use `config/deploy/nginx.concursomestre.conf.example` como base para Nginx + PHP-FPM, e `config/deploy/cron.concursomestre.example`/`config/deploy/logrotate.concursomestre.example` como base para crons e logs.
8. Configurar CORS somente para dominios finais HTTPS, sem localhost, sem HTTP e sem wildcard.
9. Executar smoke publico anonimo e logado:

```bash
/usr/bin/php /var/www/questao-pro-backend/scripts/tasks/production_preflight.php
/usr/bin/php /var/www/questao-pro-backend/scripts/tasks/production_smoke.php --api-base-url=https://api.seu-dominio.com/api --web-base-url=https://app.seu-dominio.com --db-connections=3 --auth-required=true --admin-required=true
/usr/bin/php /var/www/questao-pro-backend/scripts/tasks/production_readiness_suite.php --profile=production --api-base-url=https://api.seu-dominio.com/api --web-base-url=https://app.seu-dominio.com --with-backup-rehearsal=true
/usr/bin/php /var/www/questao-pro-backend/scripts/tasks/staging_homologation_gate.php --profile=staging --api-base-url=https://api-staging.seu-dominio.com/api --web-base-url=https://staging.seu-dominio.com
/usr/bin/php /var/www/questao-pro-backend/scripts/tasks/vps_operations_gate.php --profile=production --restore-target-db=concursomestre_restore_test --notify-admins=true
cd /var/www/concursomestre && npm run check:visual-smoke -- --strict=true --base-url=https://staging.seu-dominio.com
```

O preflight precisa retornar `success=true`. Ele deve reprovar `APP_ENV` diferente de `production`, `APP_URL` local, CORS invalido/HTTP/wildcard, reset administrativo de banco habilitado, usuario MySQL `root`, conexao persistente (`DB_PERSISTENT=true`), timeout de banco fora de 1-10s, segredos fracos, Stripe/Google malformados, SMTP transacional ausente, remetente invalido, modelos essenciais de e-mail desativados/incompletos, SDK/autoload legado de Mercado Pago, `BACKUP_DIR` dentro da raiz publica, `MYSQLDUMP_PATH`/`MYSQL_PATH` ausentes ou invalidos, heartbeat ausente/antigo do backup MySQL, backups historicos em `storage/backups/legacy-code`, artefatos operacionais publicados em `api/`, backups/dumps na raiz do backend, scripts de desenvolvimento dentro da arvore publica, heartbeat ausente/antigo da reconciliacao Stripe e heartbeat ausente/antigo do webhook Stripe.
O smoke precisa retornar `success=true`. Ele valida endpoints publicos (`plans`, `questionsList`, `settings`), rotas web principais, login real via `/auth/login.php`, perfil autenticado via `/auth/me.php`, notificacoes autenticadas, conexoes MySQL, HTTPS em hosts publicos e headers minimos de seguranca (`Content-Security-Policy`, `X-Frame-Options`, `X-Content-Type-Options`). Com credencial `admin`/`staff`, tambem valida `/admin/stats.php?period=today`, `/admin/settings.php` e `/admin/comments_moderation.php` para pegar cedo quebra de permissao/401 no painel. Se `SMOKE_AUTH_REQUIRED=true`, a falta de credenciais ou falha de login derruba o smoke; se `SMOKE_ADMIN_REQUIRED=true`, a credencial precisa ser admin/staff e os endpoints administrativos tambem precisam passar.
O `production_readiness_suite.php` consolida preflight, smoke, auditoria de logs recentes e ensaio de restore em um unico JSON. Use `--profile=local` durante desenvolvimento; use `--profile=staging` ou `--profile=production` para tornar os checks de ambiente, auth/admin e backup bloqueantes.
Quando `READINESS_REPORT_FILE` ou `--report-file=...` estiver configurado, a suite grava o mesmo payload JSON em arquivo privado para auditoria/homologacao. Em producao, mantenha esse caminho em `storage/logs/readiness` ou outro diretorio privado fora da raiz publica.
O `staging_homologation_gate.php` e o portao final da macroetapa de staging: ele rejeita URLs locais/HTTP, exige HTTPS publico, chama a suite com auth/admin obrigatorios, preflight, auditoria de logs, ensaio de restore e ainda roda `operational_log_alerts.php` em modo bloqueante. Use `--dry-run=true` apenas para conferir o plano antes de apontar para a VPS real.
O `vps_operations_gate.php` e o portao operacional final da VPS. Ele nao substitui os crons permanentes, mas prova que o servidor esta operacionalmente pronto: roda `production_preflight.php`, executa manutencao de logs privados, audita logs recentes em modo bloqueante, dispara alertas deduplicados para erros criticos e ensaia restore do ultimo backup. Use `--dry-run=true` antes do go-live para conferir o plano sem executar passos; a execucao real deve gravar `OPERATIONS_GATE_REPORT_FILE` em `storage/logs/readiness` ou outro caminho privado fora de `api/`.

O smoke visual logado fica no frontend em `scripts/checks/visual-auth-smoke.mjs` e deve ser executado depois que o build estiver publicado. Ele autentica como aluno e admin, abre rotas criticas, captura screenshots, falhas de request, erros de console, `pageerror`, redirecionamento indevido para `/auth` e textos que indicam loader preso. Em staging/producao, rode com `--strict=true` para exigir HTTPS publico e credenciais dos dois perfis.

10. Executar teste de carga moderada em janela controlada e acompanhar MySQL/PHP logs.
11. Conferir headers de seguranca no frontend e na API: CSP, `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy` e HSTS em HTTPS.
12. Conferir hardening de uploads: `file_uploads=On`, `upload_max_filesize`/`post_max_size` coerentes com a plataforma, sem execucao de scripts em `/uploads`.
13. Conferir `RATE_LIMIT_DIR` criado e gravavel pelo usuario do PHP; ajustar limites em staging antes de abrir trafego publico.
14. Confirmar que `api/` nao contem logs, dumps SQL, arquivos `.txt` operacionais ou artefatos temporarios. O preflight falha em `API_PUBLIC_ARTIFACTS_CLEAN` se encontrar algo.
15. Confirmar que `scripts/debug`, `scripts/manual-tests`, `scripts/setup`, `scripts/maintenance`, `scripts/seed`, `scripts/seeds`, checks temporarios e migracoes PHP fora do allowlist nao existem na arvore publica. O preflight falha em `BACKEND_DEV_SCRIPT_ARTIFACTS_CLEAN` se algum deles voltar. Em `scripts/migrations`, apenas `migrate_marketplace_schema_compatibility.php` pode existir.
16. Confirmar que `vendor/mercadopago`, `MercadoPago\\` e `mercadopago/dx-php` nao existem no deploy. O produto esta Stripe-only; o preflight falha em `PAYMENT_LEGACY_MERCADOPAGO_SDK_REMOVED` se o SDK/autoload legado voltar.
17. Confirmar `BACKUP_DIR` fora da raiz publica, existente e gravavel. O preflight falha em `BACKUP_DIR_OUTSIDE_PUBLIC_ROOT` se o backup apontar para `htdocs`, nao existir ou nao permitir escrita.
18. Confirmar que `MYSQLDUMP_PATH` aponta para `mysqldump` e `MYSQL_PATH` aponta para o cliente `mysql`. O preflight falha em `MYSQLDUMP_AVAILABLE` ou `MYSQL_RESTORE_CLIENT_AVAILABLE` se o servidor nao conseguir fazer dump/restore.
19. Executar um backup real antes do go-live. O script grava `MYSQL_BACKUP_HEALTH_PATH`; o preflight falha em `MYSQL_BACKUP_HEALTH_RECENT` se o ultimo backup estiver ausente, antigo, com erro ou apontando para dump/checksum inexistente.
20. Confirmar que `storage/backups/legacy-code` nao existe no deploy. Backups historicos de codigo devem ficar em arquivo privado fora de `htdocs`; o preflight falha em `LEGACY_CODE_BACKUPS_OUTSIDE_PUBLIC_ROOT` se essa pasta voltar.
16. Validar depoimentos da home: com zero aprovados, a home deve exibir os mocks; depois, enviar uma avaliacao no perfil com nome publico/contexto, marcar como `resolved` no suporte/admin e confirmar que ela aparece na home; ao tirar de `resolved`, ela deve sair da home.
17. Validar notificacoes de suporte/moderacao: usuario envia feedback, admin responde, usuario recebe notificacao in-app e o link `/support?threadId=<id>` abre a conversa correta; usuario cria denuncia, admin resolve e denunciante recebe notificacao de resultado.
18. Validar rankings: usuario autenticado cria ranking, admin aprova/rejeita e o criador recebe notificacao; participante envia gabarito e recebe confirmacao; admin publica gabarito oficial e participantes recebem notificacao apontando para `/ranking/<id>`.
19. Validar campanhas automaticas: executar primeiro `process_marketing_automations.php --dry-run=true --limit=20`, conferir elegiveis; depois executar em campanha controlada com `--execute=PROCESS_MARKETING_AUTOMATIONS --limit=20`, confirmar notificacao/e-mail e que uma segunda execucao nao duplica envios.
20. Validar e-mail transacional: no painel admin, executar `Testar SMTP`; em `Modelos de e-mail`, abrir pelo menos um modelo de cada familia (auth, suporte, denuncia, transacao e assinatura) e usar `Enviar teste` no modal para validar assunto, HTML/texto e placeholders. Depois disparar cadastro/confirmacao, reset de senha, recibo de assinatura, falha de pagamento, lembrete de renovacao, resposta de suporte e reembolso controlado. O envio real precisa chegar na caixa de entrada, sem cair em `mail()` local.
21. Validar webhook Stripe no dominio final: enviar evento real pelo painel da Stripe ou pelo Stripe CLI apontando para `api/subscriptions/stripe_webhook.php`; confirmar que `storage/logs/subscriptions/stripe_webhook_health.json` foi atualizado, que `Painel > Saude do billing > Ultimo webhook` mostra o evento e que `production_preflight.php` passa no check `STRIPE_WEBHOOK_HEALTH_RECENT`.
22. Ensaiar backup/rollback antes do go-live:

```bash
/usr/bin/php /var/www/questao-pro-backend/scripts/tasks/backup_mysql.php
/usr/bin/php /var/www/questao-pro-backend/scripts/tasks/backup_restore_rehearsal.php --target-db=concursomestre_restore_test
```

O ensaio valida checksum/formato do ultimo backup e executa `restore_mysql_backup.php` em dry-run. Para a prova real de rollback, restaure em um banco temporario com `--execute=RESTORE_BACKUP`, aponte o app/smoke para esse banco temporario e rode `production_smoke.php`; nunca restaure sobre o banco atual sem janela fechada, backup validado e token explicito `--allow-current-db=RESTORE_CURRENT_DATABASE`.

## Crons

Ativo:

```bash
*/15 * * * * /usr/bin/php /var/www/questao-pro-backend/scripts/tasks/reconcile_stripe_subscriptions.php >> /var/log/concursomestre/stripe-cron.log 2>&1
0 3 * * * /usr/bin/php /var/www/questao-pro-backend/scripts/tasks/backup_mysql.php >> /var/log/concursomestre/mysql-backup.log 2>&1
*/15 * * * * /usr/bin/php /var/www/questao-pro-backend/scripts/tasks/production_log_audit.php --since-minutes=60 >> /var/log/concursomestre/log-audit.log 2>&1
*/15 * * * * /usr/bin/php /var/www/questao-pro-backend/scripts/tasks/operational_log_alerts.php --since-minutes=60 --notify-admins=true >> /var/log/concursomestre/log-alerts.log 2>&1
20 0 * * * /usr/bin/php /var/www/questao-pro-backend/scripts/tasks/operational_log_maintenance.php >> /var/log/concursomestre/log-maintenance.log 2>&1
*/30 * * * * /usr/bin/php /var/www/questao-pro-backend/scripts/tasks/process_marketing_automations.php --execute=PROCESS_MARKETING_AUTOMATIONS --limit=100 >> /var/log/concursomestre/marketing-automation.log 2>&1
0 8 * * * /usr/bin/php /var/www/questao-pro-backend/scripts/tasks/check_subscription_card_expiry.php >> /var/log/concursomestre/card-expiry.log 2>&1
```

Remover/desativar:

- Qualquer artefato ou cron de provider financeiro não suportado.

Regras:

- O backend ja usa lock exclusivo por job em `config/cron_lock.php`; ainda assim, mantenha apenas um agendamento por job na VPS.
- A reconciliacao Stripe deve rodar por CLI para nao depender de usuario logado, navegador, sessao ou disponibilidade HTTP local. O endpoint `cron_stripe_reconciliation.php` permanece como compatibilidade protegida por `CRON_SECRET`, mas o cron recomendado e `scripts/tasks/reconcile_stripe_subscriptions.php`.
- A execucao manual admin da reconciliacao Stripe (`automation_helper.php?action=run_now`) usa o mesmo lock `subscriptions_stripe_reconciliation`; se retornar conflito, aguarde o cron atual finalizar em vez de reexecutar.
- A cada execucao, a reconciliacao Stripe grava o heartbeat privado `storage/logs/subscriptions/subscription_cron_health.json`; no painel, conferir `Painel > Saude do billing > Ultima reconciliacao`. Se ficar `stale` por mais de 30 minutos, tratar como incidente operacional antes de liberar venda.
- O preflight tambem confere esse heartbeat pelo check `SUBSCRIPTIONS_STRIPE_CRON_HEALTH_RECENT`. Em staging/producao, rode o cron uma vez antes do go-live e confirme que o arquivo esta recente.
- `CRON_LOCK_DIR` precisa existir e ser gravavel pelo usuario do PHP/cron.
- Nunca expor `CRON_SECRET` em painel publico.
- Logar status e duracao da execucao.
- Campanhas automaticas usam `marketing_automation_events` para impedir duplicidade por campanha/regra/usuario. Sempre rode dry-run antes de ativar nova campanha em massa.
- CTAs de campanhas automaticas devem ser caminhos internos (`/promo/...`, `/planos`) ou URLs absolutas HTTPS; `http://`, `/admin` e `/api` devem cair para o fallback seguro.

## Webhooks

Stripe:

- URL canonica: `https://api.seu-dominio.com/api/subscriptions/stripe_webhook.php`
- Alias compativel/documentado: `https://api.seu-dominio.com/api/subscriptions/webhook_stripe.php`
- Eventos minimos: assinatura criada/atualizada/cancelada, invoice paid/failed, payment intent succeeded/failed, refund updated.
- Validar assinatura com `STRIPE_WEBHOOK_SECRET`.
- Testar replay/idempotencia.
- O endpoint grava heartbeat privado em `storage/logs/subscriptions/stripe_webhook_health.json`; antes do go-live, confirme no admin e no preflight que o ultimo evento e recente. Esse indicador nao substitui os testes de checkout/renovacao, mas impede deploy sem evidencia minima de recebimento do webhook.

Google:

- Autorizar dominio final no Google Cloud Console.
- Usar o mesmo Client ID no frontend e backend.
- O Client ID precisa ser do tipo aplicativo Web e terminar com `.apps.googleusercontent.com`.
- Testar login novo, login existente e email ja cadastrado.

## Logs

Arquivos a acompanhar:

- Apache/Nginx access/error.
- PHP error log.
- MySQL slow/error log.
- Backend `storage/logs/subscriptions/subscription_cron.log`.
- Logs do processo Next/PM2.

Operacao minima:

- Rotacao diaria.
- Retencao de 14 a 30 dias.
- Logs privados da aplicacao devem ser mantidos pelo cron `scripts/tasks/operational_log_maintenance.php`, com `LOG_ROTATE_MAX_BYTES`, `LOG_RETENTION_DAYS`, `LOG_ROTATE_ARCHIVE_DIR` e `LOG_MAINTENANCE_HEALTH_PATH`.
- Logs do Apache/Nginx/PHP-FPM/MySQL devem usar `logrotate`/rotacao do sistema operacional; nao use o script da aplicacao para truncar arquivos gerenciados pelo servidor.
- Alerta para `Too many connections`, `Fatal error`, `401 Unauthorized` repetido, falha de webhook e falha de cron.
- Exportacao/limpeza pelo painel admin deve ser restrita a admin.
- Nunca gravar logs dentro de `api/`; o preflight `API_PUBLIC_ARTIFACTS_CLEAN` deve reprovar qualquer `.log`, `.sql` ou `.txt` operacional publicado.
- Smoke operacional apos deploy e apos rollback com `scripts/tasks/production_smoke.php`.
- Auditoria de logs com `scripts/tasks/production_log_audit.php`; em producao, manter `LOG_AUDIT_FAIL_ON=critical`.
- Alertas operacionais com `scripts/tasks/operational_log_alerts.php`; em producao, manter `LOG_ALERT_NOTIFY_ADMINS=true` para criar notificacao administrativa deduplicada quando houver erro critico recente. O ledger privado `LOG_ALERT_LEDGER_PATH` impede alerta repetido para a mesma assinatura de erro dentro de `LOG_ALERT_DEDUPE_MINUTES`.
- Manutencao de logs com `scripts/tasks/operational_log_maintenance.php`; em producao, confirme que `storage/logs/operations/log_maintenance_health.json` fica recente e com `status=ok`.
- `--dry-run=true` serve apenas para ensaio; o preflight de producao nao aceita heartbeat de manutencao gerado em dry-run.
- O endpoint admin de logs retorna tambem `analysis` com severidade, categoria e repeticoes para destacar incidentes recorrentes no painel.

## Headers de seguranca

Frontend Next:

- `Content-Security-Policy` permite apenas origens necessarias para app, Stripe, Google e analytics.
- `X-Frame-Options=DENY` e `frame-ancestors 'none'` bloqueiam clickjacking.
- `X-Content-Type-Options=nosniff`.
- `Referrer-Policy=strict-origin-when-cross-origin`.
- `Permissions-Policy` desativa camera, microfone e geolocalizacao por padrao.

Backend API:

- `config/security_headers.php` aplica CSP restritiva para respostas de API.
- HSTS e ativado somente quando `APP_ENV=production`.
- `production_preflight.php` verifica se os headers criticos continuam configurados.

## Uploads

- O backend valida uploads com `shared/security/UploadSecurity.php`.
- Materiais aceitam PDF e capas JPG/PNG/WEBP dentro dos limites definidos nos validators.
- Contextos de questoes aceitam imagens JPG/PNG/WEBP/GIF ate 5 MB.
- Perfil aceita JPG/PNG/WEBP ate 5 MB.
- Nomes originais com extensoes perigosas ou duplas como `.php`, `.phtml`, `.html`, `.svg`, `.js`, `.sh` sao rejeitados.
- Em Apache, `uploads/.htaccess` bloqueia listagem, CGI e acesso a extensoes executaveis. Em Nginx, reproduzir regra equivalente no bloco do site.

## Rate limiting

- O backend usa `shared/middleware/RateLimiter.php` para limitar abusos por IP e, em login/cadastro/recuperacao, tambem por assunto sensivel como email.
- Perfis aplicados: login, cadastro, Google login, refresh token, recuperacao/reset/confirmacao de senha, 2FA, comentarios/likes, feedback/suporte, denuncias, uploads e analytics.
- `RATE_LIMIT_DIR` deve ficar fora da pasta publica e ser gravavel pelo usuario do PHP.
- `AUTH_TRUST_PROXY_HEADERS` deve permanecer `false` por padrao. Ao ativar, `AUTH_TRUSTED_PROXY_CIDRS` precisa conter somente IPs/CIDRs dos proxies que sobrescrevem/removem `X-Forwarded-For` enviado pelo cliente.
- Em staging, simular tentativas repetidas de login, cadastro, upload, comentarios, denuncias e `api/analytics/track.php`; confirmar HTTP 429 com `Retry-After` e sem bloquear fluxo normal.
- Revisar os limites apos a primeira semana de uso real, olhando logs de 429, suporte e conversao de cadastro.

## Analytics first-party

- `api/analytics/track.php` nao deve confiar em `userId` enviado pelo cliente.
- Quando houver sessao autenticada, o backend substitui o usuario do evento pelo usuario autenticado.
- Quando o evento for anonimo, qualquer `userId` do payload deve ser descartado.
- `metadata` e `externalHooks` tem limite de tamanho para evitar payload abusivo.
- Monitorar em staging a taxa de 429, eventos por origem e divergencia entre funil de landing/campanha e registros no banco.

## Settings publicas e admin

- `api/settings.php` e exclusivamente publico: deve retornar somente a projecao saneada, sem depender de bearer token.
- `api/admin/settings.php` e a rota oficial de leitura/escrita administrativa: GET e POST exigem admin/staff.
- O frontend deve usar `getPublicSystemSettings()` no bootstrap de visitantes/alunos e `getSystemSettings()` apenas quando `currentUser.role` for `admin` ou `staff`.
- Smoke obrigatorio antes do go live:
  - Sem token: `api/settings.php` deve retornar `200` sem `stripeKey`, segredos SMTP, segredos Stripe, `appMode`, `seo` e flags privadas como `hasStripeSecretConfigured`.
  - Token de aluno: `api/settings.php` deve retornar a mesma projecao publica.
  - Token admin: `api/settings.php` continua publico/saneado; `api/admin/settings.php` retorna a projecao administrativa mascarada.
  - Token de aluno em `api/admin/settings.php` deve retornar `401` ou `403`.
- `scripts/tasks/production_smoke.php` ja falha se `api/settings.php` expuser chaves sensiveis conhecidas; rode esse smoke apos deploy e rollback.

## Google OAuth

- O mesmo Web Client ID do Google Cloud deve estar em `GOOGLE_CLIENT_ID` no backend e exposto via settings/admin para o frontend.
- O backend rejeita Client ID fora do formato `000000000000-xxxxxxxx.apps.googleusercontent.com` e rejeita token cujo `aud` nao bata com o Client ID configurado.
- O preflight possui o check `GOOGLE_CLIENT_ID_FORMAT`; ele deve estar `pass` antes de qualquer release.
- No Google Cloud Console, autorizar as origens JavaScript do dominio final e do staging; localhost deve ficar fora de producao.
- Smoke obrigatorio: login novo com Google, login de conta existente, tentativa com token de outro Client ID em ambiente controlado e logout/refresh apos login social.

## Stripe

- `STRIPE_PUBLISHABLE_KEY` deve usar `pk_test_*` no staging/sandbox e `pk_live_*` na producao publica.
- `STRIPE_SECRET_KEY` deve usar `sk_test_*` no staging/sandbox e `sk_live_*` na producao publica.
- `STRIPE_WEBHOOK_SECRET` deve usar `whsec_*` gerado no endpoint webhook correto.
- O backend nao considera Stripe configurado quando `STRIPE_SECRET_KEY` esta vazia ou fora do formato `sk_test_*`/`sk_live_*`.
- O painel admin barra chaves Stripe invalidas ao salvar e o preflight possui checks `STRIPE_PUBLISHABLE_KEY_FORMAT`, `STRIPE_SECRET_KEY_FORMAT`, `STRIPE_WEBHOOK_SECRET_FORMAT` e `STRIPE_KEY_MODE_MATCH`.
- Nao misturar chaves `test` e `live` no mesmo ambiente. Rode `scripts/checks/check_stripe_connection.php` e a matriz Stripe antes do go live.

## Backup e rollback

Antes do deploy:

- Dump MySQL completo com checksum:

```bash
/usr/bin/php /var/www/questao-pro-backend/scripts/tasks/backup_mysql.php
/usr/bin/php /var/www/questao-pro-backend/scripts/tasks/verify_mysql_backup.php --file=/var/backups/concursomestre/mysql/concursomestre-YYYYmmdd-HHMMSS.sql
/usr/bin/php /var/www/questao-pro-backend/scripts/tasks/restore_mysql_backup.php --file=/var/backups/concursomestre/mysql/concursomestre-YYYYmmdd-HHMMSS.sql --target-db=concursomestre_restore_test
```

- Snapshot dos uploads.
- Tag/commit do frontend.
- Copia do backend PHP publicado.

Ensaio obrigatorio de restore antes do go live:

1. Executar dry-run do restore com `restore_mysql_backup.php --file=... --target-db=concursomestre_restore_test`.
2. Restaurar o dump validado no banco temporario:

```bash
/usr/bin/php /var/www/questao-pro-backend/scripts/tasks/restore_mysql_backup.php --file=/var/backups/concursomestre/mysql/concursomestre-YYYYmmdd-HHMMSS.sql --target-db=concursomestre_restore_test --execute=RESTORE_BACKUP
```

3. Conferir tabelas criticas: `users`, `questions`, `subscriptions`, `transactions`, `notifications`, `comments`, `user_streaks` e `user_badges`.
4. Apontar uma copia do backend para o banco temporario e executar smoke de leitura.
5. Apagar o banco temporario apenas depois do smoke.

Guardrails do restore:

- O script bloqueia restore no banco configurado em `DB_NAME`, salvo com `--allow-current-db=RESTORE_CURRENT_DATABASE`.
- O script nao executa restore sem `--execute=RESTORE_BACKUP`.
- Para recriar um banco temporario do zero, use `--drop-target-db=DROP_TARGET_DATABASE` somente apos confirmar o nome do destino.
- Dumps com `DROP DATABASE`, `CREATE DATABASE` ou `USE` de schemas de sistema sao recusados.

Reset administrativo pelo painel:

- `api/admin/reset_db.php` existe para ambiente controlado, mas em producao fica bloqueado por padrao.
- Em release/producao publica, manter `ADMIN_DATABASE_RESET_ENABLED=false`; o preflight falha se estiver ativo.
- So habilitar temporariamente em janela operacional fechada, com `ADMIN_DATABASE_RESET_CONFIRMATION` forte, 2FA ativo no admin e backup validado antes.

Rollback:

1. Parar frontend.
2. Restaurar artefato frontend anterior.
3. Restaurar backend PHP anterior.
4. Se houve migration destrutiva, restaurar dump em banco temporario e promover.
5. Reexecutar smoke de auth, questoes, checkout e admin.

## Validacao local mais recente (`2026-05-22`)

- `npm run check:production-local -- --with-build`: OK, incluindo build Next/Turbopack completo.
- Suite PHP critica local: OK para preflight, auth social, catalogo de e-mails, campanhas, checkout/cron/notificacoes/sync de assinaturas e politica de lembretes de renovacao.
- `git diff --check`: OK; apenas avisos LF/CRLF do Git no Windows.
- Observacao: se o servidor final emitir `Module "openssl" is already loaded`, remover a duplicidade de carregamento da extensao no `php.ini`/conf.d antes do go-live para manter logs limpos.

## Checklist final

- `npm run check:production-local -- --with-build`: OK.
- `npm run lint`: OK.
- Suite PHP local critica: OK.
- `production_preflight.php`: OK.
- `production_smoke.php`: OK.
- `production_log_audit.php`: OK.
- `API_PUBLIC_ARTIFACTS_CLEAN`: OK.
- Payload XSS em questoes/comentarios/landings textuais: OK.
- Headers de seguranca frontend/API: OK.
- Uploads seguros e pasta sem execucao de scripts: OK.
- Rate limiting ativo em auth, escrita social/suporte e uploads: OK.
- Analytics tracking sem forja de `userId`, com payload limitado e rate limit ativo: OK.
- Stripe checkout sandbox: OK.
- Stripe webhook sandbox: OK.
- Cron Stripe: OK.
- Google login: OK.
- CORS sem localhost: OK.
- Backup e restore testado: OK.
- Logs com rotacao e alerta: OK.
- Admin consegue ver pendencias de suporte/moderacao: OK.
- Resposta admin em suporte notifica o usuario e `/support?threadId=<id>` expande a conversa correta: OK.
- Denuncia resolvida pelo admin notifica o denunciante: OK.
- Ranking exige auth para criar/enviar, ignora `userId` cliente e notifica criador/participantes/admin nos eventos principais: OK.
- Questao anulada nao pode ser respondida e questao inedita exibe badge em `/question` e `/practice`: OK.
- Cronograma Elite salva, recarrega e apaga em outro navegador/dispositivo: OK.
- Cronograma e rotas privadas retornam `noindex` e nao entram no sitemap publico: OK.
- Sitemap dinamico nao lista questoes draft/elite/internal, materiais pendentes/rejeitados ou rankings pendentes/rejeitados: OK.
- Landings publicadas em `/l/[slug]` possuem metadata server-side e rascunhos/inexistentes retornam `noindex`: OK.
- Sitemap inclui landings customizadas publicadas em `/l/[slug]` e nao duplica `/planos`/`/elite`: OK.
- Promocao publica em `/promo/[slug]` abre somente no slug ativo e usa `noindex` para slug invalido/inativo/modulo desligado: OK.
- URLs de campanhas, banners e notificacoes nao aceitam `javascript:`, `data:`, protocolo relativo ou caminhos sensiveis como `/admin` e `/api`: OK.
- Automacoes de campanha rodam em dry-run, enviam campanha controlada e nao duplicam em segunda execucao: OK.
- Rotas `/`, `/auth` e `/question/[id]` sem `Hydration failed` no console do browser: OK.
- Dashboards com Recharts sem warning `width(-1)`/`height(-1)` no console do browser: OK.
- Sitemap e robots publicados no dominio final: OK.

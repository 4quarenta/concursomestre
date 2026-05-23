# Runbook de Release em VPS

Data: `2026-05-01`

## Arquitetura alvo

- Frontend: Next.js na raiz `C:/dev/concursomestre`, build com `npm run build`, processo com `npm run start` ou PM2.
- Backend: PHP em `C:/xampp/htdocs/questao-pro-backend` no desenvolvimento; em VPS, publicar como app PHP separado atras de Apache/Nginx.
- Banco: MySQL/MariaDB com usuario proprio, sem `root`, backup diario e charset `utf8mb4`.
- Pagamentos: Stripe como provider ativo. Mercado Pago deve permanecer sem cron/webhook ativo.

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
- `BACKUP_DIR=/var/backups/concursomestre/mysql`
- `BACKUP_RETENTION_DAYS=14`
- `SMOKE_API_BASE_URL=https://api.seu-dominio.com/api`
- `SMOKE_WEB_BASE_URL=https://app.seu-dominio.com`
- `SMOKE_TIMEOUT_SECONDS=8`
- `SMOKE_DB_CONNECTIONS=3`
- `LOG_AUDIT_FILES=/var/log/nginx/error.log,/var/log/php/error.log,/var/log/concursomestre/stripe-cron.log,/var/log/concursomestre/mysql-backup.log,/var/www/questao-pro-backend/storage/logs/subscriptions/subscription_cron.log`
- `LOG_AUDIT_TAIL_LINES=5000`
- `LOG_AUDIT_REPEAT_THRESHOLD=5`
- `LOG_AUDIT_FAIL_ON=critical`
- `RATE_LIMIT_DIR=/var/lib/concursomestre/rate-limits`
- `RATE_LIMIT_TRUST_PROXY_HEADERS=false`
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
Quando encontra o backend local, tambem executa suites PHP criticas de billing: checkout/webhook Stripe, cron, sync de planos e saldo de termo parcelado. Configure `PHP_BIN` e `BACKEND_ROOT` para caminhos diferentes; use `--skip-backend` somente quando o backend nao estiver disponivel naquele host.
Se as credenciais de admin mudarem no ambiente local, exporte antes:

```bash
set CM_LOGIN_EMAIL=admin@seu-dominio.com
set CM_LOGIN_PASSWORD=SuaSenhaAtual
set CM_LOGIN_PASSWORD_CANDIDATES=SuaSenhaAtual,OutraSenhaFallback
```
6. Subir frontend com PM2/systemd.
7. Configurar reverse proxy HTTPS.
8. Configurar CORS somente para dominios finais HTTPS, sem localhost, sem HTTP e sem wildcard.
9. Executar smoke publico anonimo e logado:

```bash
/usr/bin/php /var/www/questao-pro-backend/scripts/tasks/production_preflight.php
/usr/bin/php /var/www/questao-pro-backend/scripts/tasks/production_smoke.php --api-base-url=https://api.seu-dominio.com/api --web-base-url=https://app.seu-dominio.com --db-connections=3
```

O preflight precisa retornar `success=true`. Ele deve reprovar `APP_ENV` diferente de `production`, `APP_URL` local, CORS invalido/HTTP/wildcard, reset administrativo de banco habilitado, usuario MySQL `root`, conexao persistente (`DB_PERSISTENT=true`), timeout de banco fora de 1-10s, segredos fracos, Stripe/Google malformados, SMTP transacional ausente, remetente invalido, modelos essenciais de e-mail desativados/incompletos, SDK/autoload legado de Mercado Pago, `BACKUP_DIR` dentro da raiz publica, backups historicos em `storage/backups/legacy-code`, artefatos operacionais publicados em `api/`, backups/dumps na raiz do backend, scripts de desenvolvimento dentro da arvore publica, heartbeat ausente/antigo da reconciliacao Stripe e heartbeat ausente/antigo do webhook Stripe.
O smoke precisa retornar `success=true`. Ele valida endpoints publicos (`plans`, `questionsList`, `settings`), rotas web principais, conexoes MySQL, HTTPS em hosts publicos e headers minimos de seguranca (`Content-Security-Policy`, `X-Frame-Options`, `X-Content-Type-Options`).

10. Executar teste de carga moderada em janela controlada e acompanhar MySQL/PHP logs.
11. Conferir headers de seguranca no frontend e na API: CSP, `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy` e HSTS em HTTPS.
12. Conferir hardening de uploads: `file_uploads=On`, `upload_max_filesize`/`post_max_size` coerentes com a plataforma, sem execucao de scripts em `/uploads`.
13. Conferir `RATE_LIMIT_DIR` criado e gravavel pelo usuario do PHP; ajustar limites em staging antes de abrir trafego publico.
14. Confirmar que `api/` nao contem logs, dumps SQL, arquivos `.txt` operacionais ou artefatos temporarios. O preflight falha em `API_PUBLIC_ARTIFACTS_CLEAN` se encontrar algo.
15. Confirmar que `scripts/debug`, `scripts/manual-tests`, `scripts/setup`, `scripts/maintenance`, `scripts/seed`, `scripts/seeds`, checks temporarios e migracoes PHP fora do allowlist nao existem na arvore publica. O preflight falha em `BACKEND_DEV_SCRIPT_ARTIFACTS_CLEAN` se algum deles voltar. Em `scripts/migrations`, apenas `migrate_marketplace_schema_compatibility.php` pode existir.
16. Confirmar que `vendor/mercadopago`, `MercadoPago\\` e `mercadopago/dx-php` nao existem no deploy. O produto esta Stripe-only; o preflight falha em `PAYMENT_LEGACY_MERCADOPAGO_SDK_REMOVED` se o SDK/autoload legado voltar.
17. Confirmar `BACKUP_DIR` fora da raiz publica, existente e gravavel. O preflight falha em `BACKUP_DIR_OUTSIDE_PUBLIC_ROOT` se o backup apontar para `htdocs`, nao existir ou nao permitir escrita.
18. Confirmar que `storage/backups/legacy-code` nao existe no deploy. Backups historicos de codigo devem ficar em arquivo privado fora de `htdocs`; o preflight falha em `LEGACY_CODE_BACKUPS_OUTSIDE_PUBLIC_ROOT` se essa pasta voltar.
16. Validar depoimentos da home: com zero aprovados, a home deve exibir os mocks; depois, enviar uma avaliacao no perfil com nome publico/contexto, marcar como `resolved` no suporte/admin e confirmar que ela aparece na home; ao tirar de `resolved`, ela deve sair da home.
17. Validar notificacoes de suporte/moderacao: usuario envia feedback, admin responde, usuario recebe notificacao in-app e o link `/support?threadId=<id>` abre a conversa correta; usuario cria denuncia, admin resolve e denunciante recebe notificacao de resultado.
18. Validar rankings: usuario autenticado cria ranking, admin aprova/rejeita e o criador recebe notificacao; participante envia gabarito e recebe confirmacao; admin publica gabarito oficial e participantes recebem notificacao apontando para `/ranking/<id>`.
19. Validar campanhas automaticas: executar primeiro `process_marketing_automations.php --dry-run=true --limit=20`, conferir elegiveis; depois executar em campanha controlada com `--execute=PROCESS_MARKETING_AUTOMATIONS --limit=20`, confirmar notificacao/e-mail e que uma segunda execucao nao duplica envios.
20. Validar e-mail transacional: no painel admin, executar `Testar SMTP`; em `Modelos de e-mail`, abrir pelo menos um modelo de cada familia (auth, suporte, denuncia, transacao e assinatura) e usar `Enviar teste` no modal para validar assunto, HTML/texto e placeholders. Depois disparar cadastro/confirmacao, reset de senha, recibo de assinatura, falha de pagamento, lembrete de renovacao, resposta de suporte e reembolso controlado. O envio real precisa chegar na caixa de entrada, sem cair em `mail()` local.
21. Validar webhook Stripe no dominio final: enviar evento real pelo painel da Stripe ou pelo Stripe CLI apontando para `api/subscriptions/stripe_webhook.php`; confirmar que `storage/logs/subscriptions/stripe_webhook_health.json` foi atualizado, que `Painel > Saude do billing > Ultimo webhook` mostra o evento e que `production_preflight.php` passa no check `STRIPE_WEBHOOK_HEALTH_RECENT`.

## Crons

Ativo:

```bash
*/15 * * * * /usr/bin/php /var/www/questao-pro-backend/scripts/tasks/reconcile_stripe_subscriptions.php >> /var/log/concursomestre/stripe-cron.log 2>&1
0 3 * * * /usr/bin/php /var/www/questao-pro-backend/scripts/tasks/backup_mysql.php >> /var/log/concursomestre/mysql-backup.log 2>&1
*/15 * * * * /usr/bin/php /var/www/questao-pro-backend/scripts/tasks/production_log_audit.php >> /var/log/concursomestre/log-audit.log 2>&1
*/30 * * * * /usr/bin/php /var/www/questao-pro-backend/scripts/tasks/process_marketing_automations.php --execute=PROCESS_MARKETING_AUTOMATIONS --limit=100 >> /var/log/concursomestre/marketing-automation.log 2>&1
0 8 * * * /usr/bin/php /var/www/questao-pro-backend/scripts/tasks/check_subscription_card_expiry.php >> /var/log/concursomestre/card-expiry.log 2>&1
```

Remover/desativar:

- Qualquer cron de Mercado Pago.
- `sync_mercadopago_preapproval_plans.php`, exceto como guarda temporaria para detectar configuracao legada.

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
- Alerta para `Too many connections`, `Fatal error`, `401 Unauthorized` repetido, falha de webhook e falha de cron.
- Exportacao/limpeza pelo painel admin deve ser restrita a admin.
- Nunca gravar logs dentro de `api/`; o preflight `API_PUBLIC_ARTIFACTS_CLEAN` deve reprovar qualquer `.log`, `.sql` ou `.txt` operacional publicado.
- Smoke operacional apos deploy e apos rollback com `scripts/tasks/production_smoke.php`.
- Auditoria de logs com `scripts/tasks/production_log_audit.php`; em producao, manter `LOG_AUDIT_FAIL_ON=critical`.
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
- `RATE_LIMIT_TRUST_PROXY_HEADERS` deve permanecer `false` por padrao. Ative `true` somente atras de proxy confiavel que sobrescreve/remove `X-Forwarded-For` enviado pelo cliente.
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

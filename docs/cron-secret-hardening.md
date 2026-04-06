## Cron Secret Hardening

### Objetivo
- Remover o fallback inseguro de `CRON_SECRET` que ainda existia nos bridges HTTP de tarefas legadas.
- Fazer os crons falharem de forma fechada quando o ambiente não estiver configurado.
- Preservar os scripts CLI oficiais como caminho operacional preferencial.

### Mudancas
- `modules/users/routes.php`
  - `getUsersCronSecret()` deixou de usar `SECURE_CRON_KEY_123`.
  - `requireUsersCronSecret()` passou a exigir configuração valida antes do bridge HTTP aceitar execucao.
  - `handleUsersProcessReferralRewardsCronRoute()` agora retorna erro de configuração quando `CRON_SECRET` estiver ausente.
- `modules/subscriptions/routes.php`
  - `getSubscriptionsCronSecret()` deixou de usar fallback hardcoded.
  - `requireSubscriptionsCronSecret()` centraliza a validação da configuração.
  - `cron_scheduled_payments`, `cron_recurring` e `cron_stripe_reconciliation` agora carregam o segredo antes de validar a chave recebida.
  - `handleSubscriptionsAutomationHelperRoute()` deixou de gerar URL operacional com segredo vazio.

### Garantias novas
- Não existe mais segredo padrao embutido no código vivo de `users` e `subscriptions`.
- Os bridges HTTP continuam existindo por compatibilidade, mas sem configuração explicita eles não executam trabalho sensivel.
- O caminho oficial para execucao operacional continua sendo:
  - `scripts/tasks/process_referral_rewards.php`
  - os scripts/task runners já formalizados em `subscriptions`

### Validação
- `php -l` em `modules/users/routes.php`
- `php -l` em `modules/subscriptions/routes.php`
- `php -l` em `tests/CronSecretHardeningWiringTest.php`
- `php tests/CronSecretHardeningWiringTest.php`
- `php tests/UsersModuleWiringTest.php`
- `php tests/SubscriptionsCheckoutWiringTest.php`
- `php tests/SubscriptionsPlanSyncWiringTest.php`
- `npm run test:auth`
- `npm run test:admin`
- smoke `500` em `api/tasks/ProcessRewards.php` sem `CRON_SECRET`
- smoke `500` em `api/subscriptions/cron_recurring.php` sem `CRON_SECRET`
- smoke `401` em `api/subscriptions/automation_helper.php` sem sessão
- home `200` em `http://localhost:3000/#/`

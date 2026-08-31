# Architecture - Cron Secret Hardening

## Contexto
Os bridges HTTP legados de tarefas ainda aceitavam um fallback hardcoded de `CRON_SECRET`.
Isso mantinha uma superficie publica desnecessariamente permissiva para jobs que ja possuem caminhos operacionais oficiais em `scripts/tasks`.

## Decisao
- `modules/users/routes.php` e `modules/subscriptions/routes.php` passam a exigir `CRON_SECRET` explicito.
- O segredo padrao `SECURE_CRON_KEY_123` deixa de existir no codigo vivo.
- Os bridges HTTP continuam apenas por compatibilidade, mas sem configuracao valida retornam erro de configuracao em vez de executar trabalho sensivel.
- Os scripts CLI continuam sendo o caminho preferencial para automacao.

## Impacto
- `api/tasks/ProcessRewards.php` agora depende de ambiente corretamente configurado.
- `api/subscriptions/cron_stripe_reconciliation.php` falha fechada sem `CRON_SECRET`.
- `api/subscriptions/automation_helper.php` nao deve mais gerar URL administrativa com segredo vazio.

## Arquivos principais
- `modules/users/routes.php`
- `modules/subscriptions/routes.php`
- `tests/CronSecretHardeningWiringTest.php`
- `scripts/tasks/process_referral_rewards.php`

## Validacao
- php lint dos arquivos alterados
- `CronSecretHardeningWiringTest.php`
- `UsersModuleWiringTest.php`
- `SubscriptionsCheckoutWiringTest.php`

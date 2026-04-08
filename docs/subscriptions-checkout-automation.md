/*
* ----------------------------------------------------
* @author: 4quarenta
* @author URI: https://github.com/4quarenta
* @copyright: (c) 2026 ConcursoMestre. All rights reserved
* ----------------------------------------------------
*
* @since 1.0.0
*
*/

# Subscriptions Checkout Automation

## Estado atual

O dominio `subscriptions` opera apenas com Stripe.
O helper de automacao continua ativo.
O checkout legado de Mercado Pago foi removido.

## Endpoints ativos

- `api/subscriptions/create_stripe_session.php`
- `api/subscriptions/create_stripe_subscription.php`
- `api/subscriptions/finalize_stripe_subscription.php`
- `api/subscriptions/stripe_webhook.php`
- `api/subscriptions/automation_helper.php`
- `api/subscriptions/cron_stripe_reconciliation.php`

## Endpoints descontinuados

- `api/subscriptions/create.php`
- `api/subscriptions/process_payment.php`
- `api/subscriptions/webhook.php`
- `api/subscriptions/webhook_mp.php`
- `api/subscriptions/cron_recurring.php`
- `api/subscriptions/cron_scheduled_payments.php`
- `api/subscriptions/sync_plans_mp.php`

Todos os endpoints descontinuados respondem `410`.

## Fonte operacional

O material operacional mostrado ao admin e gerado por:

- `C:\xampp\htdocs\questao-pro-backend\modules\subscriptions\services\SubscriptionsAutomationService.php`

Esse service:

- monta a URL real do cron Stripe com `CRON_SECRET`
- expoe o comando Linux oficial
- gera o helper `.bat` para Windows

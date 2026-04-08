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

# REMOCAO_MERCADO_PAGO

## Escopo removido

- SDK PHP `mercadopago/dx-php` removida de `composer.json`
- lock da dependencia removido de `composer.lock`
- services dedicados de subscriptions removidos:
  - `MercadoPagoPaymentBootstrap.php`
  - `MercadoPagoPaymentPreparation.php`
  - `SubscriptionsMercadoPagoCheckoutService.php`
  - `SubscriptionsMercadoPagoPlanSyncService.php`
- config dedicada removida:
  - `config/mercadopago.php`
- task legada removida:
  - `scripts/tasks/sync_mercadopago_preapproval_plans.php`
- settings admin ativos migrados para Stripe-only
- checkout frontend consolidado em Stripe-only

## Arquivos alterados

### Frontend

- `C:\dev\concursomestre\src\app\checkout\page.tsx`
- `C:\dev\concursomestre\src\app\profile\page.tsx`
- `C:\dev\concursomestre\src\app\admin\components\settings\AdminSettings.tsx`
- `C:\dev\concursomestre\src\app\admin\components\finance\AdminFinance.tsx`
- `C:\dev\concursomestre\src\providers\DataProvider.tsx`
- `C:\dev\concursomestre\src\types\global.ts`
- `C:\dev\concursomestre\README.md`

### Backend

- `C:\xampp\htdocs\questao-pro-backend\config\payment_provider.php`
- `C:\xampp\htdocs\questao-pro-backend\modules\admin\services\AdminSettingsService.php`
- `C:\xampp\htdocs\questao-pro-backend\modules\payments\routes.php`
- `C:\xampp\htdocs\questao-pro-backend\modules\payments\controllers\PaymentsController.php`
- `C:\xampp\htdocs\questao-pro-backend\modules\payments\services\PaymentsService.php`
- `C:\xampp\htdocs\questao-pro-backend\modules\payments\validators\PaymentsValidator.php`
- `C:\xampp\htdocs\questao-pro-backend\modules\subscriptions\routes.php`
- `C:\xampp\htdocs\questao-pro-backend\modules\subscriptions\controllers\SubscriptionsController.php`
- `C:\xampp\htdocs\questao-pro-backend\modules\subscriptions\services\SubscriptionsService.php`
- `C:\xampp\htdocs\questao-pro-backend\modules\subscriptions\repositories\SubscriptionsRepository.php`
- `C:\xampp\htdocs\questao-pro-backend\modules\subscriptions\validators\SubscriptionsValidator.php`
- `C:\xampp\htdocs\questao-pro-backend\modules\transactions\services\TransactionsRefundSupport.php`
- `C:\xampp\htdocs\questao-pro-backend\modules\transactions\services\TransactionsService.php`
- `C:\xampp\htdocs\questao-pro-backend\modules\users\routes.php`
- `C:\xampp\htdocs\questao-pro-backend\modules\users\repositories\UsersRepository.php`
- `C:\xampp\htdocs\questao-pro-backend\modules\users\services\UsersCardsService.php`
- `C:\xampp\htdocs\questao-pro-backend\modules\users\services\UsersService.php`
- `C:\xampp\htdocs\questao-pro-backend\scripts\manual-tests\test_settings_save_cli.php`

## Rotas removidas ou neutralizadas

### Subscriptions

- `api/subscriptions/create.php`
- `api/subscriptions/process_payment.php`
- `api/subscriptions/webhook.php`
- `api/subscriptions/webhook_mp.php`
- `api/subscriptions/cron_recurring.php`
- `api/subscriptions/cron_scheduled_payments.php`
- `api/subscriptions/sync_plans_mp.php`

### Payments

- `api/payments/create-preference.php`
- `api/payments/webhook.php`

### Users

- `api/users/save_card.php`

Todas respondem `410`.

## Services removidos

- checkout Mercado Pago de assinaturas
- webhook Mercado Pago de assinaturas
- cron Mercado Pago de assinaturas
- refund helper Mercado Pago
- sync de planos Mercado Pago
- save card legado Mercado Pago

## Settings removidos

- `paymentProvider` agora e sempre `stripe`
- `cardVaultProvider` agora e sempre `stripe`
- chaves ativas de Mercado Pago sairam do save oficial do admin

## UI removida

- textos operacionais do admin que sugeriam gateway multiplo
- CTA fake de disparo em marketing
- defaults locais de cofre/cartao fora da Stripe
- checkout documentado como Stripe-only

## Riscos mitigados

- escolha incorreta de gateway no admin
- retorno falso de suporte a Mercado Pago
- bifurcacao de regra de negocio entre Stripe e Mercado Pago
- manutencao de services mortos no fluxo de producao

## Pontos que exigem atencao pos-remocao

- rotas legadas ainda existem como tombstones `410`
- colunas historicas como `mp_card_id` e `mercadopago_customer_id` permanecem no schema por compatibilidade de dados
- documentos historicos antigos ainda citam Mercado Pago; os novos markdowns desta rodada sao a referencia operacional atual
- `composer.lock` foi ajustado manualmente e deve ser regenerado na proxima rodada de composer

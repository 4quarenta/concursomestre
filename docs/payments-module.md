# Payments Module

## Escopo desta rodada

Esta passada abriu o modulo oficial `payments` para a fatia mais usada pelo frontend:

- `api/payments/config.php`
- `api/payments/create-connect-account.php`
- `api/payments/get-installments.php`
- `api/payments/process-payment.php`
- `api/payments/create-preference.php`
- `api/payments/verify-payment.php`
- `api/payments/webhook.php`

Os dois endpoints agora sao bridges finos para:

- `C:\xampp\htdocs\questão-pro-backend\modules\payments\controllers\PaymentsController.php`
- `C:\xampp\htdocs\questão-pro-backend\modules\payments\services\PaymentsService.php`
- `C:\xampp\htdocs\questão-pro-backend\modules\payments\repositories\PaymentsRepository.php`
- `C:\xampp\htdocs\questão-pro-backend\modules\payments\validators\PaymentsValidator.php`
- `C:\xampp\htdocs\questão-pro-backend\modules\payments\routes.php`

## Regras aplicadas

- `controller` fino: apenas encaminha para o service.
- `validator` centraliza entrada de parcelamento e pagamento.
- `repository` concentra leitura de `materials`, `users` e persistencia de `transactions`.
- `service` concentra:
  - configuração pública do checkout
  - onboarding Stripe Connect do vendedor
  - consulta de parcelamento no Mercado Pago
  - fallback local por BIN/bandeira
  - cobrança avulsa de material
  - criacao de preferencia hospedada do Mercado Pago
  - tratamento do webhook do Mercado Pago
  - verificacao tardia de PaymentIntent do Stripe
  - normalizacao de status do gateway
  - persistencia idempotente da transação local

## Endurecimento de segurança

- o backend não confia mais em `user_id` vindo do cliente para compra de material
- o backend não confia mais em `userId` vindo do cliente para criar preferencia hospedada
- o backend não confia mais em `userId` vindo do cliente para abrir onboarding Stripe Connect
- a sessão autenticada passou a ser a fonte de verdade do comprador
- a sessão autenticada passou a ser a fonte de verdade do vendedor no onboarding
- `transaction_amount`, `description` e `seller_id` deixam de ser aceitos como verdade do cliente
- o valor cobrado vem do material salvo no banco
- a compra já aprovada do mesmo material eh bloqueada antes de chamar o gateway
- o webhook do Mercado Pago agora valida assinatura quando `MP_WEBHOOK_SECRET` estiver configurado
- o webhook aceita tanto o `external_reference` histórico em JSON quanto o formato novo em string
- `config.php`, que estava quebrado por depender de `StripeConfig`, passa a responder pelo modulo oficial

## Contrato preservado no frontend

Os consumers ativos continuaram usando:

- `paymentsService.getInstallments(...)`
- `paymentsService.processMaterialPayment(...)`

O ajuste visivel foi apenas remover `user_id` do payload do modal de compra do marketplace, porque o backend agora resolve isso pela sessão.

## Fluxos absorvidos agora

- `get-installments`: consulta pública do parcelamento
- `config`: chave pública Stripe e taxa da plataforma para consumers legados
- `create-connect-account`: onboarding Stripe Connect do vendedor autenticado
- `process-payment`: compra avulsa de material via token do Mercado Pago
- `create-preference`: checkout hospedado do Mercado Pago
- `webhook`: sincronizacao assina do pagamento Mercado Pago
- `verify-payment`: fallback de verificacao de PaymentIntent do Stripe

## Pendencias do dominio payments

Os endpoints de runtime do diretorio `api/payments` agora estão absorvidos pelo modulo oficial.

Restam apenas artefatos operacionais/legados para classificar em rodada futura:

- `scripts/checks/check_payments_schema.php`
- `scripts/checks/check_stripe_connection.php`

Artefatos removidos nesta passada por risco ou obsolescencia:

- `api/payments/check_schema.php`
- `api/payments/test_stripe.php`
- `api/payments/payment_debug.log`
- `api/payments/migrate_mercadopago.php`

Observacao importante:

- o onboarding Stripe Connect foi mantido no fluxo legado de conta `express` para preservar compatibilidade do produto atual
- uma evolução futura pode migrar essa parte para o modelo mais novo do Stripe (`Accounts v2`) sem misturar isso com a refatoracao arquitetural atual

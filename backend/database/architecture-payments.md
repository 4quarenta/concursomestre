# Arquitetura do Modulo de Payments

## Estado atual (`2026-05-20`)

O modulo opera em modo **Stripe-only**. As rotas historicas de Mercado Pago
foram mantidas apenas como tombstones `410` para evitar erro obscuro em
clientes, webhooks ou crons antigos. Esses endpoints nao carregam mais
`config/database.php` e nao abrem conexao MySQL.

## Objetivo

Centralizar no modulo `payments` a infraestrutura de cobranca avulsa e apoio ao checkout, sem misturar:

- validacao no controller
- SQL dentro de endpoint legado
- regra do gateway dentro de bridge `api/*`

## Estrutura oficial

```text
modules/payments/
  controllers/
    PaymentsController.php
  services/
    PaymentsService.php
  repositories/
    PaymentsRepository.php
  validators/
    PaymentsValidator.php
  routes.php
```

## Tabelas tocadas nesta fatia

### `materials`

Usada para obter:

- `id`
- `title`
- `price`
- `type`
- `author_id`
- `status`

### `users`

Usada para obter:

- `id`
- `name`
- `email`
- `cpf`
- `stripe_account_id`

Tambem passa a ser atualizada para persistir a conta conectada Stripe do vendedor.

### `transactions`

Usada para:

- verificar recompra aprovada do mesmo material
- localizar pagamento local por `external_id`
- inserir a transacao local
- atualizar a transacao local quando o mesmo `external_id` volta do gateway

Campos preenchidos nesta fatia:

- `external_id`
- `user_id`
- `material_id`
- `seller_id`
- `amount`
- `platform_fee`
- `status`
- `payment_method`
- `payment_provider`
- `installments`
- `payer_email`
- `type`
- `created_at`

## Novos fluxos absorvidos

### `config`

1. O consumer legado chama `api/payments/config.php`
2. O bridge delega para `handlePaymentsClientConfigRoute()`
3. O modulo le `STRIPE_PUBLISHABLE_KEY`
4. A taxa da plataforma vem da configuracao persistida em `system_settings`
5. A resposta sai padronizada em envelope JSON

### `create-connect-account`

1. O frontend ou legado chama `api/payments/create-connect-account.php`
2. O bridge delega para `handlePaymentsCreateConnectAccountRoute()`
3. O backend usa a sessao autenticada como fonte de verdade do vendedor
4. O usuario e sua `stripe_account_id` sao lidos do banco
5. Se ainda nao existir conta, o modulo cria a conta conectada Stripe e salva o id em `users`
6. O modulo cria um `account_onboarding` link com `refresh_url` e `return_url`
7. O retorno padroniza `accountId` e `onboardingUrl`

### `create-preference`

1. O frontend ou legado chama `api/payments/create-preference.php`
2. O bridge delega para `handlePaymentsCreatePreferenceRoute()`
3. O backend usa a sessao autenticada como comprador real
4. Material e usuario sao lidos do banco
5. A preferencia hospedada eh criada no Mercado Pago por API oficial
6. O retorno padroniza `preferenceId`, `initPoint` e `sandboxInitPoint`

### `webhook`

1. O Mercado Pago chama `api/payments/webhook.php`
2. O bridge delega para `handlePaymentsMercadoPagoWebhookRoute()`
3. A assinatura eh validada quando `MP_WEBHOOK_SECRET` estiver ativo
4. O pagamento eh consultado na API do Mercado Pago
5. `external_reference` e `metadata` sao usados para identificar usuario/material
6. A transacao local eh criada ou atualizada por `external_id`
7. `sales_count` so sobe uma vez quando a aprovacao entra pela primeira vez

### `verify-payment`

1. O fallback Stripe chama `api/payments/verify-payment.php`
2. O bridge delega para `handlePaymentsVerifyStripePaymentRoute()`
3. O backend consulta o `PaymentIntent` no Stripe
4. Se o status for `succeeded`, a compra local e refletida em `transactions`
5. A venda do material eh contabilizada apenas na primeira aprovacao

## Fluxo de parcelamento

1. O frontend consulta `api/payments/get-installments.php`
2. O bridge delega para `handlePaymentsInstallmentsRoute()`
3. O `PaymentsService` consulta a API publica do Mercado Pago
4. Se a consulta falhar, tenta fallback local por BIN/bandeira
5. A resposta sai padronizada em envelope JSON

## Fluxo de compra avulsa de material

1. O frontend envia `token`, `material_id`, `installments`, `payment_method_id` e `payer.identification`
2. O backend resolve o usuario pela sessao autenticada
3. O service busca material e usuario no banco
4. O valor e a descricao sao resolvidos pelo backend
5. O pagamento eh enviado ao Mercado Pago com idempotency key
6. O resultado do gateway eh normalizado
7. A transacao local eh criada ou atualizada por `external_id`
8. Se a compra entrou como aprovada, `sales_count` do material eh incrementado uma unica vez

## Beneficio arquitetural

Com essa fatia, `api/payments/get-installments.php` e `api/payments/process-payment.php` deixam de ser pontos cinzentos e passam a cumprir o blueprint:

- controller fino
- service com regra
- repository com SQL
- validator com entrada
- responses padronizadas

Agora o mesmo vale para:

- `api/payments/config.php`
- `api/payments/create-connect-account.php`
- `api/payments/create-preference.php`
- `api/payments/verify-payment.php`
- `api/payments/webhook.php`

## Scripts operacionais reclassificados

Os checks que ainda fazem sentido para manutencao foram retirados de `api/payments` e movidos para `scripts/checks`:

- `scripts/checks/check_payments_schema.php`
- `scripts/checks/check_stripe_connection.php`

Os artefatos abaixo foram removidos porque eram perigosos, obsoletos ou expunham detalhes sensiveis:

- `api/payments/check_schema.php`
- `api/payments/test_stripe.php`
- `api/payments/payment_debug.log`
- `api/payments/migrate_mercadopago.php`

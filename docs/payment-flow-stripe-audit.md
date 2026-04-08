<!--
* ----------------------------------------------------
* @author: 4quarenta
* @author URI: https://github.com/4quarenta
* @copyright: (c) 2026 ConcursoMestre. All rights reserved
* ----------------------------------------------------
*
* @since 1.0.0
*
-->

# Fluxo atual de pagamentos e assinaturas

## Escopo

Este documento descreve o fluxo real hoje encontrado no frontend `C:\dev\concursomestre` e no backend `C:\xampp\htdocs\questao-pro-backend`.

O foco aqui e:

- planos;
- checkout Stripe;
- upgrade com credito proporcional;
- cupons;
- renovacao automatica;
- billing portal;
- cancelamento;
- reembolso;
- webhooks;
- reconciliacao;
- residuos legados de Mercado Pago.

## Componentes principais

### Frontend

- `C:\dev\concursomestre\src\app\checkout\page.tsx`
- `C:\dev\concursomestre\src\app\profile\page.tsx`
- `C:\dev\concursomestre\src\services\subscriptions\subscriptionsService.ts`
- `C:\dev\concursomestre\src\services\plans\planService.ts`

### Backend

- `C:\xampp\htdocs\questao-pro-backend\modules\subscriptions\services\SubscriptionsService.php`
- `C:\xampp\htdocs\questao-pro-backend\modules\subscriptions\repositories\SubscriptionsRepository.php`
- `C:\xampp\htdocs\questao-pro-backend\modules\subscriptions\services\SubscriptionsBillingSupport.php`
- `C:\xampp\htdocs\questao-pro-backend\modules\transactions\services\TransactionsRefundSupport.php`
- `C:\xampp\htdocs\questao-pro-backend\modules\transactions\services\TransactionsService.php`
- `C:\xampp\htdocs\questao-pro-backend\modules\subscriptions\routes.php`
- `C:\xampp\htdocs\questao-pro-backend\api\subscriptions\stripe_webhook.php`
- `C:\xampp\htdocs\questao-pro-backend\api\subscriptions\cron_stripe_reconciliation.php`

## Vinculo Stripe x plataforma

### Fonte de verdade desejada

- Stripe = cobranca, faturamento, renovacao e cancelamento remoto.
- Plataforma = acesso, plano atual, experiencia do usuario e espelho operacional.

### Identificadores minimos

- `stripe_customer_id`
- `provider_subscription_id`
- `user_id`

### Regra de sincronizacao segura

- criacao: cria no Stripe e salva ids locais;
- webhook: fonte principal de sincronizacao;
- reconciliacao: camada secundaria de correcao;
- frontend: nunca decide estado financeiro final.

### Eventos Stripe que devem sustentar o vinculo

- `invoice.paid`
- `invoice.payment_failed`
- `customer.subscription.updated`
- `customer.subscription.deleted`
- `charge.refunded`

### Estado atual encontrado

- ids locais existem: parcial;
- webhook existe: sim;
- idempotencia de webhook: nao;
- reconciliacao periodica: sim;
- reconciliacao suficiente para recuperar periodo local: nao;
- frontend como fonte de verdade financeira: nao;
- banco local dependente de calculo proprio de periodo: sim.

### Consequencia operacional

Sem webhook confiavel, idempotencia forte e reconciliacao capaz de corrigir `current_period_start`, `current_period_end` e `paid_installments`, o vinculo Stripe x plataforma continua inseguro.

## Fluxo de compra

### 1. Escolha do plano

O usuario escolhe um plano em `plans`.

No checkout, o frontend envia:

- `plan_id`
- `auto_renew`
- `coupon_code`
- `billing_mode`
- `installment_count`

### 2. Recalculo no backend

O backend recalcula tudo em `buildStripeCreationContext`.

Formula real hoje:

`discountBase = max(0, basePrice - creditAmount)`

`finalPrice = max(0, discountBase - discountAmount)`

Logo:

- o frontend nao e a fonte final do valor;
- existe piso zero;
- cupom incide sobre base menos credito.

### 3. Checkout Stripe hospedado

`createStripeCheckoutSession` cria `Checkout Session` Stripe em modo `subscription`.

O backend envia:

- `subscription_data.cancel_at_period_end`
- `subscription_data.metadata`
- `line_items`
- `discounts` quando existe cupom tecnico de ajuste da primeira fatura

### 4. Checkout Stripe interno

`createStripeInlineSubscription` cria assinatura Stripe em modo interno.

Hoje usa:

- `payment_behavior = default_incomplete`
- `default_payment_method`
- `payment_settings.save_default_payment_method = on_subscription`
- `cancel_at_period_end`

Nao foi encontrado `proration_behavior = always_invoice` nessa criacao.

### 5. Finalizacao

`finalizeStripeSubscription` valida:

- cliente Stripe;
- invoice;
- payment intent;
- snapshot antifraude;

Depois:

- atualiza plano local;
- grava transacao local;
- espelha cartao local;
- trava cartao recorrente quando necessario.

## Fluxo de renovacao

### 1. Toggle de renovacao

Perfil chama `updateRenewal(auto_renew)`.

No backend:

- busca assinatura ativa local;
- calcula `cancel_at_period_end`;
- se provider for Stripe e houver `provider_subscription_id`, chama `subscriptions->update(...)`.

Hoje a chamada remota envia:

- `cancel_at_period_end`
- `metadata.auto_renew`

### 2. Regra local de termo

Hoje a decisao de `cancel_at_period_end` usa:

- `total_installments`
- `paid_installments`
- `auto_renew`

Regra atual:

- se `auto_renew = true`, retorna `false`;
- se `auto_renew = false` e ainda existe termo restante, retorna `false`;
- se `auto_renew = false` e nao existe termo restante, retorna `true`.

Isso significa:

- durante termo restante, desligar renovacao nao agenda cancelamento imediato no Stripe;
- o cancelamento e empurrado para o ciclo final do termo.

### 3. Fonte de verdade da renovacao

Hoje a base local e atualizada por:

- `customer.subscription.updated`
- `invoice.paid`
- `customer.subscription.deleted`
- reconciliacao `cron_stripe_reconciliation.php`

Mas o periodo local nao usa diretamente timestamps remotos do Stripe em todos os pontos.

Em varios trechos, o backend recalcula `current_period_start` e `current_period_end` por funcao local de calendario.

## Webhooks Stripe

Eventos tratados hoje:

- `checkout.session.completed`
- `invoice.paid`
- `invoice.payment_failed`
- `customer.subscription.updated`
- `customer.subscription.deleted`
- `charge.refunded`

### `checkout.session.completed`

- faz upsert local da assinatura;
- se metadata pedir sem renovacao e termo simples, tenta marcar `cancel_at_period_end = true`.

### `invoice.paid`

- sincroniza assinatura;
- valida aprovacao;
- grava transacao local se ainda nao existir;
- avanca `paid_installments`;
- atualiza acesso do usuario.

### `invoice.payment_failed`

- marca assinatura local como `past_due`;
- registra transacao rejeitada;
- envia notificacao.

Nao foi encontrado grace period explicito.

### `customer.subscription.updated`

- faz upsert local;
- se status local for `active` ou `trialing`, atualiza acesso.

### `customer.subscription.deleted`

- marca local como `canceled`;
- desliga renovacao;
- remove acesso do usuario.

### `charge.refunded`

- marca transacao como `refunded`;
- persiste `provider_refund_id`;
- envia email.

## Cancelamento e reembolso

### Regra atual de 7 dias

`cancelSubscription` usa `current_period_start` local como base.

Se mais de 7 dias:

- bloqueia cancelamento com reembolso;
- informa que a assinatura fica ativa ate o fim do compromisso.

Se dentro de 7 dias:

- marca transacao como `refund_requested`;
- revoga acesso imediatamente;
- comita;
- tenta cancelar remotamente;
- tenta reembolsar no gateway.

Se o gateway falhar:

- a transacao continua `refund_requested`;
- o acesso ja foi removido.

### Cancelar pedido de reembolso

`cancelRefundRequest`:

- restaura transacao para `approved`;
- chama `reenableActiveSubscriptionRenewal`.

Hoje isso nao restaura a assinatura cancelada se ela ja foi marcada como `canceled`.

## Estados relevantes

### Assinatura local

Estados encontrados:

- `active`
- `trialing`
- `past_due`
- `incomplete`
- `canceled`

### Transacao local

Estados encontrados:

- `approved`
- `completed`
- `pending`
- `pre-approved`
- `refund_requested`
- `refunded`
- `rejected`
- `cancelled`

Nao existe prova de uma maquina de estados unica e centralizada.

## Reconciliacao

Existe cron de reconciliacao Stripe:

- `C:\xampp\htdocs\questao-pro-backend\api\subscriptions\cron_stripe_reconciliation.php`

Ele:

- busca assinaturas Stripe locais;
- consulta assinatura remota;
- corrige status;
- corrige valor recorrente;
- corrige total de parcelas;
- tenta detectar `amount_mismatch`;
- tenta detectar `overdue_without_confirmed_payment`.

Ele nao corrige de forma clara:

- todos os periodos locais;
- todos os acessos expirados;
- todos os cenarios de webhook perdido.

## Residuos de Mercado Pago

Mesmo com o frontend principal migrado para Stripe, o sistema ainda possui legado de Mercado Pago no backend:

- rotas;
- webhooks;
- cron;
- refunds;
- services de assinatura;
- services de pagamentos avulsos.

Logo o sistema hoje ainda e hibrido no backend.

## Riscos operacionais atuais

### Risco 1

O periodo local de acesso ainda depende de calculo local em varios fluxos, nao apenas do periodo remoto Stripe.

### Risco 2

Nao foi encontrada persistencia de `event.id` do webhook Stripe para idempotencia forte.

### Risco 3

Nao foi encontrada validacao forte no backend para exigir cartao salvo antes de religar `auto_renew` no Stripe.

### Risco 4

Cancelamento dentro de 7 dias revoga acesso antes da confirmacao final do estorno.

### Risco 5

`cancelRefundRequest` nao recompõe a assinatura que ja foi cancelada localmente.

### Risco 6

Nao foi encontrado `proration_behavior = always_invoice` na criacao Stripe analisada.

### Risco 7

Mercado Pago ainda existe em rotas e codigo de producao no backend.

## Leitura rapida

Hoje o frontend principal de assinatura esta orientado a Stripe.

Hoje o backend de assinatura ainda mistura:

- Stripe;
- Mercado Pago;
- regras locais de periodo;
- reconciliacao por cron.

Antes de operar cobranca real sem risco elevado, o recomendado e:

- fechar a remocao do legado Mercado Pago;
- centralizar estados;
- tratar idempotencia;
- confiar no periodo remoto Stripe;
- revisar cancelamento/reembolso;
- endurecer a reativacao de `auto_renew`;
- criar testes de renovacao real ponta a ponta.

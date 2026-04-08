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

# CORRECAO_BILLING_STRIPE

## Source of truth final

- Stripe: cobranca, invoice, subscription, cancelamento remoto
- Plataforma: acesso local, UI, trilha operacional
- O acesso local deve espelhar o estado remoto valido da Stripe

## Vinculo Stripe x plataforma

Persistencias usadas:

- `stripe_customer_id`
- `provider_subscription_id`
- `provider_current_period_start`
- `provider_current_period_end`
- `provider_last_webhook_event_at`
- `auto_renew`

## Webhook e idempotencia

- idempotencia forte por `provider + event_id`
- evento duplicado nao reprocessa
- evento falho pode ser reaberto
- eventos fora de ordem passam por corte por timestamp

Eventos tratados:

- `checkout.session.completed`
- `invoice.paid`
- `invoice.payment_failed`
- `customer.subscription.updated`
- `customer.subscription.deleted`
- `charge.refunded`

## Reconciliacao

- cron Stripe segue ativo
- revisa subscriptions locais com `provider_subscription_id`
- tenta recuperar invoices e renovacoes perdidas
- sincroniza status, valores recorrentes e dados remotos de periodo

## Auto renew

- `updateRenewal(auto_renew)` agora trabalha Stripe-first
- religar renovacao exige payment method valido no backend
- desligar renovacao sincroniza `cancel_at_period_end`
- cancelamento apos 7 dias nao bloqueia mais o desligamento da renovacao

## Upgrade, pro-rata e cupom

- backend segue como fonte final do calculo
- piso zero mantido
- arredondamento monetario mantido no backend
- preview local continua apenas visual
- `proration_behavior` nativo da Stripe: NAO COMPROVADO
- o fluxo atual segue por credito proporcional local + cobranca Stripe ajustada

## Refund e cancelamento

- fluxo nao corta acesso prematuramente no pedido inicial quando o refund ainda nao fechou
- webhook `charge.refunded` fecha acesso e sincroniza o plano
- `cancelRefundRequest` volta a religar `auto_renew` quando aplicavel
- recomposicao completa de todos os estados intermediarios: NAO COMPROVADO

## Riscos remanescentes

- renovacao ponta a ponta com atraso real de webhook: NAO COMPROVADO
- reconciliação total de todos os cenarios de falha de cobranca: NAO COMPROVADO
- `proration_behavior` nativo da Stripe ainda nao foi adotado
- checkout avulso de materiais Stripe ainda permanece pausado

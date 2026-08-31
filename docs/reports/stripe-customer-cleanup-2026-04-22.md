# Stripe Customer Cleanup - 2026-04-22

## Escopo

Limpeza dos customers Stripe duplicados do usuario:

- usuario local: `u-admin`
- email: `admin@concursomestre.com`

## Customer canônico preservado

- `cus_UK3GETFbhVPLCS`

Motivo:

- é o customer referenciado por `users.stripe_customer_id`
- é o customer referenciado por `user_subscriptions.provider_customer_id`
- contém a assinatura ativa `sub_1TLRuiHTtB22su0xtZrAgAKs`
- contém o cofre de cartões válido do usuário

## Customers antigos removidos

- `cus_UNa8U7O0DjJsau`
- `cus_UNa8wXhR5t4OHC`

## Critérios usados para remoção

### `cus_UNa8U7O0DjJsau`

- não era mais referenciado localmente por:
  - `users`
  - `user_subscriptions`
  - `transactions`
  - `user_cards`
- não possuía assinatura Stripe
- não possuía invoices
- continha apenas um payment method redundante em relação ao customer canônico

### `cus_UNa8wXhR5t4OHC`

- não era mais referenciado localmente
- não possuía cartões
- não possuía assinatura Stripe
- não possuía invoices

## Customer antigo já encerrado antes da limpeza

- `cus_UJqjLxBXaXhAL7`

Esse customer já retornava como deletado na Stripe antes desta operação.

## Validação pós-limpeza

Após a operação, a consulta por customers da Stripe para o email do usuário
retornou apenas:

- `cus_UK3GETFbhVPLCS`

## Resultado

- customer canônico preservado
- customers duplicados recentes removidos
- vínculo local mantido estável no mesmo `customer_id`
- cofre de cartões e assinatura passaram a apontar para a mesma entidade Stripe


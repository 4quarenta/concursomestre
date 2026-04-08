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

# Payments Module

## Estado atual

O modulo `payments` opera em modo Stripe-only.
Todo fluxo ativo de Mercado Pago foi removido do produto.

## Endpoints vivos

- `api/payments/config.php`
- `api/payments/create-connect-account.php`
- `api/payments/get-installments.php`
- `api/payments/process-payment.php`
- `api/payments/verify-payment.php`

## Endpoints descontinuados

- `api/payments/create-preference.php`
- `api/payments/webhook.php`

Os endpoints descontinuados respondem `410`.

## Regras atuais

- `controller` segue fino
- `validator` centraliza payloads oficiais
- `repository` persiste `transactions`
- `service` concentra:
  - configuracao publica do checkout
  - onboarding Stripe Connect
  - parcelamento local exibido ao checkout Stripe
  - verificacao tardia de `PaymentIntent`
  - persistencia idempotente da transacao local

## Observacao

O checkout avulso de materiais permanece pausado ate a entrada do fluxo Stripe oficial.

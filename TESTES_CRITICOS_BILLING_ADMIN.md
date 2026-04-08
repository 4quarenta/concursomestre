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

# TESTES CRITICOS BILLING ADMIN

## Testes manuais

- Compra nova Stripe via checkout redirect
- Compra nova Stripe via fluxo inline
- Upgrade com credito proporcional
- Cupom valido
- Cupom invalido
- Cupom + credito
- Total zerado por credito
- Auto renew off sem termo
- Auto renew off com termo
- Auto renew on com cartao salvo
- Cancelamento dentro de 7 dias
- Cancelamento fora de 7 dias
- Cancelar refund request
- Reembolsar pelo admin
- Rejeitar refund pelo admin

## Testes automatizados

- Webhook Stripe duplicado
- Webhook Stripe atrasado
- Webhook Stripe fora de ordem
- Reconciliacao Stripe com invoice pago
- `auto_renew` on sem payment method
- `auto_renew` off com `cancel_at_period_end`
- `local_credit` sem cobranca externa
- Refund aprovado atualiza subscription e transacao
- Refund rejeitado restaura estado correto

## Cenarios de concorrencia

- 5 cliques no checkout
- 2 abas comprando o mesmo plano
- 2 cliques no toggle de auto renew
- 2 admins aprovando o mesmo refund
- 2 execucoes do cron ao mesmo tempo

## Cenarios de webhook

- `checkout.session.completed`
- `invoice.paid`
- `invoice.payment_failed`
- `customer.subscription.updated`
- `customer.subscription.deleted`
- `charge.refunded`

## Cenarios de cron

- cron com invoice pago perdido pelo webhook
- cron com subscription cancelada remotamente
- cron sem credencial valida
- cron com execucao duplicada

## Cenarios de refund

- refund aprovado em compra de material
- refund aprovado em assinatura
- refund rejeitado
- refund ja resolvido
- refund sem transacao elegivel

## Cenarios de upgrade / cupom / pro-rata

- upgrade com ciclo restante alto
- upgrade com ciclo restante baixo
- cupom percentual
- cupom esgotado
- cupom com valor final zero
- downgrade bloqueado

## Cenarios de acoes administrativas criticas

- salvar settings e recarregar
- limpar cache
- reset controlado de base
- moderar denuncia
- moderar material
- editar ranking
- editar usuario
- responder feedback

## Criterio final

- Nenhuma divergencia entre Stripe, banco local e UI
- Nenhuma acao critica sem persistencia confirmada
- Nenhum webhook duplicado altera estado duas vezes
- Nenhum refund deixa estado fantasma

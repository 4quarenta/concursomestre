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

# AUDITORIA BILLING ADMIN

## Resumo executivo

- Status geral: NO-GO
- Risco financeiro: CRITICO
- Risco operacional: ALTO
- Billing Stripe: parcialmente endurecido, ainda nao comprovado ponta a ponta
- Admin: funcional por nucleos, ainda parcial no fechamento arquitetural

## Riscos criticos

1. Renovacao ainda depende de webhook + reconciliacao para manter periodo local coerente.
2. Backend ainda mantem superficie Mercado Pago ativa.
3. Estado de subscriptions, transactions e acesso ainda convive com heranca local/legada.
4. Finance/admin ainda mistura service oficial com providers globais e parte do estado em memoria.
5. Nao ha comprovacao automatizada real de webhook atrasado, duplicado e fora de ordem em producao.

## Estado do upgrade / pro-rata / desconto entre planos

- Status: FUNCIONA PARCIALMENTE
- Backend recalcula credito proporcional por `calculateSafeProratedCredit(...)`.
- Backend recalcula cupom por `validateCouponForAmount(...)`.
- Backend aplica piso zero em `finalPrice = max(0, round(..., 2))`.
- Backend gera desconto do primeiro invoice Stripe via coupon interno do Stripe.
- Frontend ainda calcula preview local de `proRatedCredit`, `discountAmount` e `totalDue`.
- Fonte real para cobranca deve ser o backend.

### Regras reais encontradas

- `discountBase = max(0, round(basePrice - creditAmount, 2))`
- `discountAmount` vem do backend na validacao do cupom
- `finalPrice = max(0, round(discountBase - discountAmount, 2))`
- Quando `finalPrice <= 0`, o sistema ativa assinatura local de credito

### Riscos residuais

- Preview do checkout continua local
- Nao ha prova de bloqueio canonico de downgrade por regra unica
- Assinatura `local_credit` precisa ser observada com muito cuidado em auditoria

## Estado da renovacao Stripe

- Status: PARCIAL
- Source of truth financeira: Stripe
- Source of truth de acesso: plataforma local
- Webhook Stripe agora tem idempotencia por `event_id`
- `provider_current_period_start/end` passaram a ser persistidos
- `auto_renew` on valida payment method no backend Stripe
- Cancelamento apos 7 dias passou a desligar renovacao, em vez de bloquear o usuario
- Reconciliacao Stripe passou a tentar recuperar renovacao perdida por `latest_invoice`

### Lacunas

- Nao ha comprovacao E2E de renovacao em ambiente real
- Nao ha suite automatizada cobrindo atraso e reordem de eventos
- Ainda existe dependencia relevante de `invoice.paid` para fechamento do ciclo local

## Estado do Mercado Pago

- Status: ATIVO NO BACKEND / REMOVIDO SO DO FRONTEND PRINCIPAL
- Frontend principal: SDK removido, CSP limpa, chunking removido
- Backend: rotas, services, cron e refunds do Mercado Pago ainda existem
- Conclusao: remocao total NAO esta concluida

## Inconsistencias encontradas

### Documentacao vs codigo

- Documentacao antiga ainda descreve checkout Mercado Pago como fluxo valido
- Frontend principal ja esta concentrado em Stripe para assinaturas
- Backend continua hibrido

### Frontend vs backend

- Checkout exibe preview local de desconto/pro-rata
- Backend recalcula e deve prevalecer
- Admin settings tinha botao com toast de sucesso antes da persistencia real
- Finance tinha confirmacao via `window.confirm` e mock de `paymentDay`

### Estado exibido vs estado persistido

- Refund admin atualizava estado local sem recarga robusta
- Save de settings podia parecer concluido antes da resposta final
- Sidebar admin nao refletia dominios reais do painel

## Source of truth real

- Pagamento e subscription remota: Stripe
- Persistencia interna de acesso: `user_subscriptions` + `transactions`
- Idempotencia de eventos Stripe: `provider_webhook_events`
- Operacoes administrativas: backend oficial + services frontend

## Webhook / cron / idempotencia

### Ja corrigido

- Idempotencia forte por `provider + event_id`
- Persistencia de `provider_last_webhook_event_at`
- Ignore de evento Stripe fora de ordem por timestamp
- Reconciliacao Stripe tenta recuperar invoice pago

### Ainda pendente

- Teste automatizado real de duplicidade
- Teste automatizado real de atraso
- Monitoramento ativo de cron
- Reconstrucao completa de incidente por trilha unica

## Status por area do admin

- Dashboard executivo: FUNCIONAL
- Usuarios: PARCIAL
- Financeiro: PARCIAL
- Transacoes: PARCIAL
- Reembolsos: PARCIAL
- Planos e cupons: PARCIAL
- Automacao / cron: PARCIAL
- Configuracoes do sistema: PARCIAL
- Denuncias: PARCIAL
- Feedback / suporte: FUNCIONAL
- Materiais: PARCIAL
- Filtros / taxonomias: PARCIAL
- Rankings: PARCIAL
- Importador / questoes: FUNCIONAL

## Correcoes aplicadas nesta rodada

### Billing

- Idempotencia Stripe por evento
- Persistencia do periodo remoto do provider
- Validacao backend de `auto_renew` com payment method
- Cancelamento apos 7 dias virou desligamento de renovacao
- Refund nao corta acesso antes da confirmacao indevida
- Reconciliacao Stripe tenta recuperar renovacao perdida

### Admin

- Sidebar reorganizada por dominio
- Navegacao admin passou a refletir operacao, moderacao, financeiro, suporte e configuracoes
- Confirmacoes destrutivas migradas para modal padrao
- Finance removeu mock funcional de `paymentDay`
- Refund admin agora passa por confirmacao explicita
- Refund admin passou a recarregar transacoes pelo service oficial
- Settings passou a usar save explicito com persistencia confirmada

## Conclusao GO / NO-GO

- STATUS: NO-GO
- Motivo principal: ainda existe superficie legada Mercado Pago, renovacao ainda nao esta comprovada ponta a ponta e o admin continua parcialmente dependente de providers globais misturados a services oficiais.

# Billing e Validacao

- Consolida Stripe-only, auditorias financeiras, planos de correcao, validacoes e testes criticos.
- O fluxo oficial continua como credito proporcional local no backend, nao prorata nativo Stripe.
- Relatorios executaveis atuais ficam em `docs/reports/` e `scripts/checks/output/`.

## Status atual (`2026-05-16`)

- Billing/Stripe: **GO local**.
- `npm run check:billing-e2e`: `7 OK`, `0 RISCO`, `0 CRITICO`, `0 NAO_COMPROVADO`.
- `billing-renewal-check.mjs`: `22 OK`, `0 RISCO`, `0 CRITICO`, `0 NAO_COMPROVADO`.
- A renovacao usa o preco vigente do plano na plataforma e nao reaplica cupons/descontos de checkout automaticamente.
- A sincronizacao com Stripe recebeu o `price` do plano no contexto de finalizacao, evitando item de assinatura com valor `0` e renovacao sem cobranca.
- Renovacao, webhooks e reconciliacao sao fluxos servidor-servidor. Eles nao dependem de usuario logado, access token, sessao admin ou tela de perfil aberta.
- Antes do go-live, repetir o mesmo fluxo com webhook publico/tunel na VPS/staging.

## Origem dos cartoes salvos

- A fonte de verdade dos cartoes salvos e a Stripe. O checkout e o perfil devem listar cartoes pelo service oficial `cardsService.listSavedCards()` sem enviar `user_id` manualmente; o backend resolve o usuario autenticado pela sessao.
- A rota `api/users/list_cards.php` passa pelo modulo oficial `modules/users`, chama `UsersCardsService::listSavedCards()` e sincroniza o espelho local a partir da Stripe por `UsersCardsStripeSupport::syncStripeCardsForUser()`.
- O campo interno `users.has_saved_card` e apenas um indicativo operacional para evitar chamadas desnecessarias. Ele nao substitui a listagem real de payment methods da Stripe.
- O `users.stripe_customer_id` deve permanecer estável. A resolucao do customer canônico prioriza: `provider_customer_id` da assinatura ativa, `stripe_customer_id` salvo no usuario, histórico local Stripe (`user_subscriptions` / `transactions`) e, só em último caso, busca remota por `metadata.user_id` / email antes de criar um novo customer.
- A criacao/resolucao do customer Stripe usa trava por usuario para evitar que requisicoes concorrentes gerem customers duplicados para a mesma conta.
- A estrategia completa de consolidacao do customer canônico esta documentada em `docs/STRIPE_CUSTOMER_CANONICALIZATION.md`.
- Se a sincronizacao com a Stripe falhar, a UI deve exibir erro de sincronizacao em vez de mostrar `0` cartoes como se fosse estado real.
- O cartao associado a renovacao de assinatura fica marcado no espelho local por `locked_by_recurring = 1`. Ele nao pode ser removido enquanto for o unico cartao da assinatura; o usuario deve adicionar outro cartao e defini-lo como padrao para mover o vinculo.
- A verificacao de validade do cartao preferencial ocorre no payload autenticado do perfil e tambem pode ser executada periodicamente por `C:\xampp\htdocs\questao-pro-backend\scripts\checks\check_subscription_card_expiry.php`. Cartao vencido ou proximo do vencimento gera `paymentIssue` e uma notificacao deduplicada para orientar o usuario a atualizar o metodo de pagamento.

## Renovacao, recibos e inadimplencia

- A regra oficial de renovacao e:
  - contrato atual congelado no valor aceito;
  - proxima renovacao pelo preco vigente do plano na plataforma;
  - cupons/descontos de checkout nao sao reaplicados automaticamente em renovacao, salvo regra recorrente explicita futura.
- A proxima renovacao da assinatura e projetada localmente e sincronizada no Stripe. Quando o intervalo nao muda, o backend atualiza o `subscription_item`; quando a estrutura do ciclo exigir, usa mecanismo remoto equivalente sem prorratear o ciclo atual.
- Toda cobranca aprovada envia:
  - email com recibo/comprovante;
  - notificacao in-app.
- Toda falha de cobranca envia:
  - email com orientacao de regularizacao;
  - notificacao in-app;
  - bloqueio real de acesso premium.
- O lembrete preventivo de renovacao e enviado 5 dias antes da cobranca.
- A documentacao operacional completa dessa camada esta em `docs/STRIPE_RENEWAL_PRICING_AND_COLLECTIONS.md`.

## Arquivos absorvidos

- `C:\dev\concursomestre\ATUALIZACAO_CHECKLIST_RENOVACAO.md`
- `C:\dev\concursomestre\AUDITORIA_BILLING_ADMIN.md`
- `C:\dev\concursomestre\BILLING_PENDENCIAS_FECHADAS.md`
- `C:\dev\concursomestre\CHECKLIST_AUTOMATICO_RENOVACAO.md`
- `C:\dev\concursomestre\CORRECAO_BILLING_STRIPE.md`
- `C:\dev\concursomestre\PLANO_CORRECAO_ADMIN_BILLING.md`
- `C:\dev\concursomestre\PLANO_VALIDACAO_E2E_BILLING.md`
- `C:\dev\concursomestre\REMOCAO_MERCADO_PAGO.md`
- `C:\dev\concursomestre\RESULTADO_VALIDACAO_E2E_BILLING.md`
- `C:\dev\concursomestre\TESTES_CRITICOS_BILLING_ADMIN.md`
- `C:\dev\concursomestre\VALIDACAO_FINAL.md`
- `C:\dev\concursomestre\VALIDACAO_FINAL_RODADA.md`
- `C:\dev\concursomestre\docs\payment-flow-stripe-audit.md`
- `C:\dev\concursomestre\docs\payments-module.md`
- `C:\dev\concursomestre\docs\STRIPE_CARD_VAULT_OPERATIONS.md`
- `C:\dev\concursomestre\docs\STRIPE_TESTING_MATRIX_ADMIN.md`
- `C:\dev\concursomestre\docs\subscriptions-checkout-automation.md`
- `C:\dev\concursomestre\docs\subscriptions-plan-sync.md`
- `C:\dev\concursomestre\docs\transactions-refund-support-extraction.md`

---

## Fonte absorvida: `C:\dev\concursomestre\ATUALIZACAO_CHECKLIST_RENOVACAO.md`

> Conteudo historico absorvido. Em caso de conflito, valem o resumo inicial e os caminhos atuais desta consolidacao.

# Atualizacao Checklist Renovacao

## Integracao com o checklist existente

- `billing-renewal-check.mjs` continua consumindo:
  - `C:/dev/concursomestre/scripts/checks/billing-e2e-report.json`
- a integracao agora promove os antigos `NAO_COMPROVADO` quando a suite E2E fecha com evidencia real

## O que mudou

- antes:
  - o checklist era majoritariamente estrutural
  - itens de renovacao, atraso, refund concorrente e estrategia canonica ainda ficavam sem prova suficiente
- agora:
  - o checklist estrutural foi enriquecido por evidencia operacional real
  - os 3 bloqueadores do backend foram fechados
  - o checklist agregado saiu de `NO-GO` para `GO`

## Contagem antes/depois

### Antes da rodada final

- `OK`: 18
- `RISCO`: 0
- `CRITICO`: 0
- `NAO_COMPROVADO`: 4
- resultado: `NO-GO`

### Depois da rodada final

- `OK`: 21
- `RISCO`: 1
- `CRITICO`: 0
- `NAO_COMPROVADO`: 0
- resultado: `GO`

## O que deixou de ser NAO_COMPROVADO

- webhook atrasado e fora de ordem no checklist agregado
- renovacao Stripe ponta a ponta no checklist agregado
- estrategia canonica de pro-rata no checklist agregado
- refund concorrente no checklist agregado

## Risco remanescente

- `D2 - Reconciliacao tenta recuperar renovacao perdida`: `RISCO`

Motivo:

- a reconciliacao agora materializa a ultima invoice paga e corrige periodo local
- porem continua sendo um mecanismo de recuperacao dependente de execucao periodica do cron
- ou seja:
  - o fluxo esta provado
  - mas a saude operacional do cron segue sensivel e deve permanecer monitorada

## Leitura final

- a infraestrutura de prova agora existe
- a prova operacional agora passa
- o checklist agregado agora fecha em `GO`
- o risco residual restante e operacional, nao um bloqueador financeiro aberto

---

## Fonte absorvida: `C:\dev\concursomestre\AUDITORIA_BILLING_ADMIN.md`

> Conteudo historico absorvido. Em caso de conflito, valem o resumo inicial e os caminhos atuais desta consolidacao.

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

---

## Fonte absorvida: `C:\dev\concursomestre\BILLING_PENDENCIAS_FECHADAS.md`

> Conteudo historico absorvido. Em caso de conflito, valem o resumo inicial e os caminhos atuais desta consolidacao.

# Billing Pendencias Fechadas

## Resumo

- rodada final executada com Stripe real em modo teste
- billing saiu de `NO-GO` para `GO` na validacao automatizada
- os 3 bloqueadores reais foram fechados
- a estrategia canonica continua:
  - `credito proporcional local no backend`
  - nao `prorata nativo Stripe`

## O que foi corrigido

- `SubscriptionsService.php`
  - helper para extrair periodo remoto da subscription e da invoice
  - helper para resolver `latest_invoice` paga com seguranca
  - reconciliacao autoritaria que:
    - atualiza periodo local com dados remotos Stripe
    - materializa invoice paga em subscription + transaction + acesso local
  - `handleStripeInvoicePaid` passou a aceitar fallback seguro da subscription remota
  - `cancelRefundRequest` e `undoCancellationRequest` passaram a ressincronizar com Stripe de forma mais forte
  - branch explicito `finalPrice <= 0` com `local_credit` real
- `SubscriptionsRepository.php`
  - contador oficial de transactions do plano para auditoria da reconciliacao
- `BillingStripeValidationSupport.php`
  - helpers de validacao remota de periodo e invoices
- `BillingStripeOperationalValidationTest.php`
  - suite passou a provar renovacao, atraso, duplicidade, reorder, refund concorrente e `local_credit`

## O que foi comprovado

- renovacao ponta a ponta com Stripe real em modo teste
- reconciliacao atualizando `provider_current_period_end`
- webhook atrasado recuperado pela reconciliacao antes do replay tardio
- webhook duplicado nao duplica efeito
- webhook fora de ordem fica `ignored`
- `auto_renew` off/on usa backend como fonte final
- `payment method` e exigido no backend ao religar
- `local_credit` materializa:
  - `term_total_amount = 0`
  - transaction zero-value auditavel
  - contrato coerente sem cobranca Stripe
- refund concorrente termina coerente entre transaction, subscription e acesso local
- ausencia de Mercado Pago no fluxo ativo
- build do frontend e testes do admin continuam verdes

## O que ainda nao virou bloqueador

- reconciliacao Stripe continua com `RISCO` operacional no checklist agregado

Observacao:

- isso nao e mais `CRITICO`
- isso nao e mais `NAO_COMPROVADO`
- o risco remanescente existe porque a recuperacao depende de cron periodico saudavel e monitorado

## Impacto por item

- renovacao: mitigado
- reconciliacao: mitigado, com risco operacional residual
- webhook atrasado: mitigado
- webhook duplicado: mitigado
- webhook fora de ordem: mitigado
- auto renew: mitigado
- refund concorrente: mitigado
- `local_credit`: mitigado
- Mercado Pago: fora do fluxo ativo

## Riscos remanescentes

- risco financeiro: `MEDIO`
- risco operacional: `MEDIO`
- veredito da validacao automatizada: `GO`

## Evidencias finais

- `C:/dev/concursomestre/scripts/checks/billing-e2e-report.json`
- `C:/dev/concursomestre/scripts/checks/billing-e2e-report.md`
- `C:/dev/concursomestre/billing-renewal-check.json`
- `C:/dev/concursomestre/billing-renewal-check.md`

---

## Fonte absorvida: `C:\dev\concursomestre\CHECKLIST_AUTOMATICO_RENOVACAO.md`

> Conteudo historico absorvido. Em caso de conflito, valem o resumo inicial e os caminhos atuais desta consolidacao.

# Checklist Automatico Renovacao

## O que e

- runner estrutural do billing:
  - `C:/dev/concursomestre/scripts/checks/billing-renewal-check.mjs`
- saidas:
  - `C:/dev/concursomestre/billing-renewal-check.json`
  - `C:/dev/concursomestre/billing-renewal-check.md`

## Como funciona

- valida estrutura Stripe-only.
- valida persistencia critica.
- valida webhook, reconciliacao, auto renew, refund e estrategia de cobranca.
- consome `billing-e2e-report.json` quando existir.
- transforma prova operacional em status do checklist agregado.

## Como executar

```bash
npm run check:billing-renewal
```

Para atualizar com a rodada E2E antes:

```bash
npm run check:billing-e2e
npm run check:billing-renewal
```

## Status possiveis

- `OK`
- `RISCO`
- `CRITICO`
- `NAO_COMPROVADO`

Regra final:

- `GO` = zero `CRITICO` e zero `NAO_COMPROVADO`
- `NO-GO` = qualquer `CRITICO` ou `NAO_COMPROVADO`

## Resultado atual

- `OK`: 18
- `RISCO`: 0
- `CRITICO`: 0
- `NAO_COMPROVADO`: 4
- veredito: `NO-GO`

## O que mudou nesta rodada

- passou a ler `scripts/checks/billing-e2e-report.json`
- usa evidencia E2E para:
  - renovacao
  - webhook atrasado/fora de ordem
  - estrategia de pro-rata
  - refund concorrente

## Limite atual

- se a suite E2E falhar em item critico, o checklist agregado nao mascara.
- por isso os 4 itens acima seguem `NAO_COMPROVADO` no checklist agregado.

---

## Fonte absorvida: `C:\dev\concursomestre\CORRECAO_BILLING_STRIPE.md`

> Conteudo historico absorvido. Em caso de conflito, valem o resumo inicial e os caminhos atuais desta consolidacao.

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

---

## Fonte absorvida: `C:\dev\concursomestre\PLANO_CORRECAO_ADMIN_BILLING.md`

> Conteudo historico absorvido. Em caso de conflito, valem o resumo inicial e os caminhos atuais desta consolidacao.

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

# PLANO CORRECAO ADMIN BILLING

## P0

### Tecnico

- Remover Mercado Pago do backend ou assumir suporte integral com testes e observabilidade.
- Fechar reconciliacao Stripe para ciclo, expiracao e acesso.
- Criar testes automatizados de webhook duplicado, atrasado e fora de ordem.
- Criar testes reais de renovacao automatica e falha de cobranca.
- Garantir trilha unica para refund, cancelamento e reativacao.

### Funcional

- Provar renovacao ponta a ponta.
- Provar cancelamento dentro e fora de 7 dias.
- Provar religamento de `auto_renew`.
- Provar `local_credit` sem gerar acesso indevido.

### UI/UX

- Remover qualquer CTA fake do admin.
- Exibir estado de persistencia por item.
- Mostrar origem do erro em refund, settings e automacao.

## P1

### Tecnico

- Separar finance admin em submodulos menores.
- Migrar operacoes criticas do admin para services por dominio dedicados.
- Centralizar loaders, confirms e erros criticos em componentes compartilhados.
- Adicionar auditoria server-side para mais acoes administrativas.

### Funcional

- Fechar painel de automacao com status real de cron.
- Expor health de webhook e reconciliacao no admin.
- Adicionar leitura oficial de feedback pendente no dashboard admin.

### UI/UX

- Quebrar finance em `saldo`, `transacoes`, `refunds`, `planos`, `cupons`, `automacao`.
- Quebrar settings em secoes persistentes e deep links.
- Destacar risco financeiro, disputa e falha de cobranca.

## P2

### Tecnico

- Refatorar providers globais para consumo mais fino de services oficiais.
- Adicionar telemetria e audit trail estruturado por `subscription_id`, `invoice_id`, `refund_id`.
- Criar suite de regressao visual do admin.

### Funcional

- Dashboard executivo com health cards de webhook, cron e receita liquida.
- Moderacao com historico completo por item.

### UI/UX

- Consolidar tabelas, filtros, drawers e modais em kit admin unico.
- Criar padrao de danger zone e pending states.

## Backlog tecnico

- Remover bridges com logica residual
- Unificar source of truth local
- Fortalecer rollback e idempotencia
- Cobrir cron e reconciliacao

## Backlog funcional

- Renovacao Stripe comprovada
- Refund reversivel sem estado fantasma
- Auto renew on/off totalmente auditavel
- Admin financeiro sem ambiguidades

## Backlog UI UX

- Navegacao secundaria por dominio
- Cards executivos mais claros
- Formularios com save explicito
- Confirmacoes padrao

## Ordem recomendada

1. Billing critico
2. Webhook e cron
3. Refund e cancelamento
4. Finance admin
5. Settings admin
6. Demais dominios do admin
7. Hardening visual e observabilidade

## Criterios de aceite

- Nenhuma cobranca duplicada em testes
- Nenhum evento Stripe reaplicado gera efeito duplo
- Renovacao comprovada com periodo local correto
- Refund aprovado e rejeitado ficam consistentes
- Admin salva, recarrega e audita acao critica
- Nao existe CTA fake em producao

---

## Fonte absorvida: `C:\dev\concursomestre\PLANO_VALIDACAO_E2E_BILLING.md`

> Conteudo historico absorvido. Em caso de conflito, valem o resumo inicial e os caminhos atuais desta consolidacao.

# Plano Validacao E2E Billing

## Cenarios cobertos

1. renovacao Stripe ponta a ponta
2. webhook duplicado
3. webhook fora de ordem
4. webhook atrasado + reconciliacao
5. auto renew off/on
6. refund concorrente
7. upgrade/pro-rata

## Estrategia usada

- Stripe real em modo teste.
- Stripe Test Clock para renovacao.
- fixtures JSON para webhooks.
- runner PHP no backend oficial.
- orquestrador Node no frontend.
- checklist agregado consumindo o report E2E.

## Limites

- nao substitui validacao em ambiente produtivo real.
- eventos atrasados e fora de ordem sao simulados.
- quando o backend falha de verdade, o runner marca `CRITICO`.

## Como rodar

```bash
npm run check:billing-e2e
```

Saidas:

- `C:/dev/concursomestre/scripts/checks/billing-e2e-report.json`
- `C:/dev/concursomestre/scripts/checks/billing-e2e-report.md`
- `C:/dev/concursomestre/billing-renewal-check.json`
- `C:/dev/concursomestre/billing-renewal-check.md`

## Interpretacao

- `OK`: prova real ou semi-E2E concluida
- `RISCO`: fragilidade encontrada, sem quebra imediata
- `CRITICO`: bloqueador real
- `NAO_COMPROVADO`: sem evidencia suficiente

Regra:

- `GO` = zero `CRITICO` e zero `NAO_COMPROVADO`
- `NO-GO` = qualquer `CRITICO` ou `NAO_COMPROVADO`

---

## Fonte absorvida: `C:\dev\concursomestre\REMOCAO_MERCADO_PAGO.md`

> Conteudo historico absorvido. Em caso de conflito, valem o resumo inicial e os caminhos atuais desta consolidacao.

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
- `C:\dev\concursomestre\src\state\app-config\systemSettings.ts`
- `C:\dev\concursomestre\src\state\app-config\useSystemSettingsActions.ts`
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

---

## Fonte absorvida: `C:\dev\concursomestre\RESULTADO_VALIDACAO_E2E_BILLING.md`

> Conteudo historico absorvido. Em caso de conflito, valem o resumo inicial e os caminhos atuais desta consolidacao.

# Resultado Validacao E2E Billing

## Resumo executivo

- status: `GO`
- Stripe-only: confirmado no fluxo ativo
- suite operacional: criada, executada e aprovada
- evidencias reais obtidas: sim
- bloqueadores fechados nesta rodada:
  - reconciliacao Stripe agora materializa renovacao e atualiza `provider_current_period_end`
  - webhook atrasado agora e recuperavel pela reconciliacao antes do replay tardio
  - `local_credit` agora materializa contrato zero-value consistente

## Resultados por cenario

### OK

- renovacao Stripe ponta a ponta
  - a renovacao remota materializou nova transaction local
  - a reconciliacao atualizou `provider_current_period_end`
  - o acesso local permaneceu coerente
- webhook duplicado
  - a segunda entrega do mesmo `event_id` ficou `duplicate`
  - nenhuma transaction extra foi criada
- webhook fora de ordem
  - evento antigo ficou `ignored`
  - assinatura local permaneceu ativa
- webhook atrasado + reconciliacao
  - a reconciliacao recuperou a renovacao antes do replay tardio
  - o replay tardio nao duplicou efeitos
- auto renew off/on
  - desligamento sincronizou `cancel_at_period_end`
  - religamento sem cartao falhou no backend
  - religamento com cartao valido funcionou
- refund concorrente
  - request, approve, duplicate approve e `charge.refunded` terminaram coerentes
- upgrade / pro-rata canonico
  - a estrategia oficial permaneceu `credito proporcional local no backend`
  - `local_credit` ficou persistido e auditavel

## Evidencias

- report JSON:
  - `C:/dev/concursomestre/scripts/checks/billing-e2e-report.json`
- report Markdown:
  - `C:/dev/concursomestre/scripts/checks/billing-e2e-report.md`

## Contagem final

- `OK`: 7
- `RISCO`: 0
- `CRITICO`: 0
- `NAO_COMPROVADO`: 0

## GO / NO-GO

- `GO`

## Observacao operacional

- a suite prova o fluxo em Stripe modo teste com Test Clock e fixtures controladas
- isso reduz os `NAO_COMPROVADO` anteriores
- ainda assim, operacao real continua exigindo cron ativo, logs e monitoramento de webhook

---

## Fonte absorvida: `C:\dev\concursomestre\TESTES_CRITICOS_BILLING_ADMIN.md`

> Conteudo historico absorvido. Em caso de conflito, valem o resumo inicial e os caminhos atuais desta consolidacao.

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

---

## Fonte absorvida: `C:\dev\concursomestre\VALIDACAO_FINAL.md`

> Conteudo historico absorvido. Em caso de conflito, valem o resumo inicial e os caminhos atuais desta consolidacao.

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

# VALIDACAO_FINAL

## Testes executados

### Frontend

- `npm run build`
- `npx vitest run src/services/admin/__tests__/adminService.test.ts`

### Backend

- `php -l` em:
  - `modules/payments/controllers/PaymentsController.php`
  - `modules/subscriptions/controllers/SubscriptionsController.php`
  - `modules/users/services/UsersCardsService.php`
  - `modules/users/repositories/UsersRepository.php`
  - `modules/payments/services/PaymentsService.php`
  - `modules/subscriptions/services/SubscriptionsService.php`
  - `modules/subscriptions/repositories/SubscriptionsRepository.php`
- `tests/SubscriptionsCronWiringTest.php`
- `tests/SubscriptionsCheckoutWiringTest.php`
- `tests/StripeSubscriptionBillingTermTest.php`

## Status

- build frontend: OK
- teste vitest admin: OK
- lint PHP dos arquivos validados: OK
- wiring subscriptions: OK
- billing term stripe: OK

## Cenarios criticos cobertos

- bridges legados continuam finos
- routes legadas respondem `410`
- Stripe reconciliation wiring preservado
- controller/service/repository alterados seguem com sintaxe valida
- settings admin Stripe-only seguem cobertos por teste

## Limitacoes

- renovacao real ponta a ponta contra Stripe em ambiente externo: NAO COMPROVADO
- webhook atrasado e fora de ordem em ambiente real: NAO COMPROVADO
- cancelRefundRequest em todos os cenarios de concorrencia: NAO COMPROVADO
- composer lock nao foi regenerado via composer install/update
- warnings `openssl already loaded` continuam no PHP local

## Veredito final

- billing: NO-GO para escala financeira plena
- motivo: ainda faltam provas E2E de renovacao/webhook/reconciliacao
- produto: mais seguro e mais simples que antes
- Mercado Pago: removido do fluxo ativo

---

## Fonte absorvida: `C:\dev\concursomestre\VALIDACAO_FINAL_RODADA.md`

> Conteudo historico absorvido. Em caso de conflito, valem o resumo inicial e os caminhos atuais desta consolidacao.

# Validacao Final Rodada

## Testes executados

- `npm run test:admin`
- `npm run build`
- `npm run check:billing-e2e`
- `npm run check:billing-renewal`
- `php -l` em:
  - `SubscriptionsService.php`
  - `SubscriptionsRepository.php`
  - `BillingStripeValidationSupport.php`
  - `BillingStripeOperationalValidationTest.php`

## Status

- build frontend: `OK`
- testes admin: `OK`
- suite E2E billing: `GO`
- checklist agregado: `GO`

## Resultado da suite E2E

- `OK`: 7
- `RISCO`: 0
- `CRITICO`: 0
- `NAO_COMPROVADO`: 0

Itens cobertos:

- renovacao Stripe ponta a ponta
- auto renew off/on com backend como fonte final
- upgrade / pro-rata canonico
- refund concorrente
- webhook duplicado
- webhook fora de ordem
- webhook atrasado + reconciliacao

## Resultado do checklist agregado

- `OK`: 21
- `RISCO`: 1
- `CRITICO`: 0
- `NAO_COMPROVADO`: 0

Risco residual:

- `D2 - Reconciliacao tenta recuperar renovacao perdida`

Leitura:

- o fluxo esta provado
- o item segue como `RISCO` porque depende de cron periodico saudavel, e nao porque haja falha aberta no codigo validado

## Limitacoes

- os cenarios com Stripe real usam modo teste
- a suite nao prova ambiente produtivo da Stripe
- a operacao continua dependendo de:
  - cron ativo
  - logs
  - monitoramento de webhook

## Veredito final

- `GO`

Motivo:

- os 3 bloqueadores reais do backend foram fechados
- os antigos `NAO_COMPROVADO` foram cobertos por evidencia operacional
- nao restou `CRITICO`
- nao restou `NAO_COMPROVADO`

---

## Fonte absorvida: `C:\dev\concursomestre\docs\payment-flow-stripe-audit.md`

> Conteudo historico absorvido. Em caso de conflito, valem o resumo inicial e os caminhos atuais desta consolidacao.

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

---

## Fonte absorvida: `C:\dev\concursomestre\docs\payments-module.md`

> Conteudo historico absorvido. Em caso de conflito, valem o resumo inicial e os caminhos atuais desta consolidacao.

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

---

## Fonte absorvida: `C:\dev\concursomestre\docs\subscriptions-checkout-automation.md`

> Conteudo historico absorvido. Em caso de conflito, valem o resumo inicial e os caminhos atuais desta consolidacao.

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

---

## Fonte absorvida: `C:\dev\concursomestre\docs\subscriptions-plan-sync.md`

> Conteudo historico absorvido. Em caso de conflito, valem o resumo inicial e os caminhos atuais desta consolidacao.

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

# Subscriptions Plan Sync

## Estado atual

O sync legado de planos do Mercado Pago foi encerrado.
O endpoint `api/subscriptions/sync_plans_mp.php` responde `410`.

## Regra atual

- o produto nao sincroniza mais planos em Mercado Pago
- `external_plan_id` permanece apenas como campo canonico para identificador remoto
- qualquer sincronizacao futura deve seguir Stripe-only e entrar no modulo oficial `subscriptions`

---

## Fonte absorvida: `C:\dev\concursomestre\docs\transactions-refund-support-extraction.md`

> Conteudo historico absorvido. Em caso de conflito, valem o resumo inicial e os caminhos atuais desta consolidacao.

# Transactions Refund Support Extraction

## Objetivo
Remover a regra de estorno do legado `api/utils/payment_refund_helper.php` e oficializar esse comportamento dentro do dominio `transactions`.

## Implementacao oficial
- `C:\xampp\htdocs\questão-pro-backend\modules\transactions\services\TransactionsRefundSupport.php`

## Bridges legados
- `C:\xampp\htdocs\questão-pro-backend\api\utils\payment_refund_helper.php`

## Modulos consumidores alinhados
- `modules/transactions/services/TransactionsService.php`
- `modules/subscriptions/services/SubscriptionsService.php`
- `modules/admin/services/AdminUserActionsService.php`

## Regras consolidadas
- processamento de estorno por gateway
- resolucao de `PaymentIntent` Stripe para reembolso
- persistencia do estado local de transação reembolsada
- montagem de detalhes de reembolso para e-mail
- selecao da ultima transação de plano elegivel para reembolso

## Validação executada
- `C:\xampp\php\php.exe -l` nos arquivos alterados
- `C:\xampp\php\php.exe C:\xampp\htdocs\questão-pro-backend\tests\TransactionsRefundSupportWiringTest.php`
- `C:\xampp\php\php.exe C:\xampp\htdocs\questão-pro-backend\tests\SubscriptionsCheckoutWiringTest.php`
- `C:\xampp\php\php.exe C:\xampp\htdocs\questão-pro-backend\tests\AdminSecurityWiringTest.php`
- `npx vitest run src/services/transactions/__tests__/transactionsService.test.ts src/services/admin/__tests__/adminService.test.ts src/services/subscriptions/__tests__/subscriptionsService.test.ts`
- `npm run build`
- smoke `401` em `api/transactions/approve_refund.php`
- smoke `200` na home `http://localhost:3000/#/`

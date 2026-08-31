# Matriz de Auditoria de Pagamentos

Data: `2026-04-19`

## Atualizacao de billing (`2026-05-23`)

- **Pronto local parcial:** renovacao automatica em perfil preserva a decisao local (`auto_renew`) mesmo quando ha assinatura Stripe ativa com parcelas futuras; isso evita religar renovacao automaticamente apos o usuario desligar em plano anual/trimestral.
- **Pronto local parcial:** tela de assinatura voltou a usar o termo contratado completo para planos trimestrais/anuais parcelados, exibindo progresso como `63/365` em vez de reiniciar por parcela mensal.
- **Pronto local parcial:** janela de reembolso usa a primeira transacao paga real e so aparece nos 7 primeiros dias da primeira assinatura.
- **Pronto local parcial:** projecao financeira admin inclui renovacoes automaticas ativas e descarta contratos `past_due` da lista de pre-aprovadas para evitar acumulacao depois de falha de pagamento.
- **Pronto local parcial:** lista/projecao de transacoes Stripe parceladas agora tambem evita projetar novas pre-aprovadas em assinaturas `past_due/incomplete` e avanca a data projetada quando ja existe uma fatura futura/rejeitada ocupando o slot.
- **Pronto local parcial:** cancelamento fora da garantia legal, em termo parcelado com faturas pre-aprovadas pendentes, exige confirmacao do usuario, quita o saldo via PaymentIntent off-session, marca o termo como quitado, cancela a recorrencia remota e preserva acesso local ate o fim contratado.
- **Cobertura local:** Vitest cobre `confirmDebtCharge` no service e progresso anual parcelado em `subscriptionDateUtils`; `SubscriptionsCheckoutWiringTest.php` cobre o contrato backend de confirmacao/quitacao/preservacao de acesso; `SubscriptionsTermDebtBehaviorTest.php` cobre calculo de saldo pendente e preservacao de acesso do termo quitado.
- **Pendente staging:** smoke com Stripe real/test clock para confirmar webhook publico, invoice seguinte, e-mail/notificacao de renovacao e consistencia do portal Stripe.

## Escopo

Esta matriz registra o estado atual dos fluxos de pagamento encontrados na base Next consolidada.

O objetivo aqui e separar tres coisas:

- o que ja existe no codigo
- o que ja tem teste automatizado de fachada
- o que ainda precisa de prova operacional antes de producao

## Mapa funcional atual

| Fluxo | Frontend principal | Servico | Endpoint backend | Cobertura atual | Status |
| --- | --- | --- | --- | --- | --- |
| Checkout Stripe hospedado | `src/app/checkout/CheckoutPage.tsx` | `createStripeCheckoutSession` | `subscriptions/create_stripe_checkout.php` | teste unitario de fachada | implementado, pendente smoke real |
| Checkout Stripe interno com novo cartao | `src/app/checkout/CheckoutPage.tsx` | `createStripeSubscription` + `finalizeStripeSubscription` | `subscriptions/create_stripe_subscription.php` + `subscriptions/finalize_stripe_subscription.php` | teste unitario de fachada | implementado, pendente smoke real |
| Checkout Stripe com cartao salvo | `src/app/checkout/CheckoutPage.tsx` | `createStripeSubscription` + `finalizeStripeSubscription` | `subscriptions/create_stripe_subscription.php` + `subscriptions/finalize_stripe_subscription.php` | teste unitario de fachada | implementado, pendente smoke real |
| Cupom automatico/manual | `src/app/checkout/CheckoutPage.tsx` | `validateCoupon` | `subscriptions/validate_coupon.php` | teste unitario de fachada | implementado, pendente smoke real |
| Capability PIX Stripe | `src/app/checkout/CheckoutPage.tsx` | `getStripePixCapability` | `subscriptions/stripe_pix_capability.php` | teste unitario de fachada | implementado, pendente prova com conta Stripe |
| Portal Stripe | `src/app/profile/ProfilePage.tsx` | `createStripePortalSession` | `subscriptions/create_stripe_portal.php` | teste unitario de fachada | implementado, pendente smoke real |
| Renovacao automatica | `src/app/profile/ProfilePage.tsx` | `updateRenewal` | `subscriptions/update_renewal.php` | teste unitario de fachada | implementado, pendente smoke real |
| Cancelamento de assinatura | `src/app/profile/ProfilePage.tsx` | `cancelSubscription` | `subscriptions/cancel.php` | teste unitario de fachada | implementado, pendente smoke real |
| Cancelar pedido de reembolso | `src/app/profile/ProfilePage.tsx` | `cancelRefundRequest` | `subscriptions/cancel_refund.php` | teste unitario de fachada | implementado, pendente smoke real |
| Reverter cancelamento | `src/app/profile/ProfilePage.tsx` | `undoCancellationRequest` | `subscriptions/undo_cancel.php` | teste unitario de fachada | implementado no servico, precisa confirmar UI |
| Matriz de teste Stripe no admin | admin financeiro | `getStripeTestingMatrix` + `createStripeTestingRun` | `subscriptions/stripe_testing_matrix.php` + runs | teste unitario de fachada | implementado, precisa prova operacional |
| Automacao/cron financeiro | admin financeiro | `getAutomationHelperInfo` | `subscriptions/automation_helper.php` | teste unitario de fachada | implementado, pendente prova no ambiente final |

## Riscos antes de producao

1. Testes unitarios cobrem a fachada de assinatura, mas ainda nao substituem smoke real no checkout.
2. Cartao salvo ainda precisa de prova real com `saved_card_id`, confirmacao de setup/payment intent e refresh do perfil.
3. Cupom ainda precisa de prova real para cupom valido, invalido, automatico, expirado e restrito por plano.
4. Cancelamento, reembolso e renovacao ainda precisam de provas com estados reais de assinatura.
5. PIX depende da capability real da conta Stripe e deve ser validado com a configuracao final.
6. Webhook e cron precisam de evidencias no ambiente de deploy, pois localhost nao prova entrega publica.

## Auditoria backend 4.5

Arquivos conferidos no backend local:

- `C:/xampp/htdocs/questao-pro-backend/modules/subscriptions/routes.php`
- `C:/xampp/htdocs/questao-pro-backend/modules/subscriptions/services/SubscriptionsService.php`
- `C:/xampp/htdocs/questao-pro-backend/modules/subscriptions/repositories/SubscriptionsRepository.php`
- `C:/xampp/htdocs/questao-pro-backend/modules/subscriptions/validators/SubscriptionsValidator.php`
- `C:/xampp/htdocs/questao-pro-backend/config/payment_provider.php`
- `C:/xampp/htdocs/questao-pro-backend/tests/BillingStripeOperationalValidationTest.php`

Confirmacoes:

- checkout hospedado, checkout interno, portal, renovacao, cancelamento, reembolso, reversao de cancelamento e capability PIX exigem usuario autenticado
- matriz Stripe, execucao guiada da matriz, helper de automacao e POST de capability PIX exigem administrador
- cron de reconciliacao Stripe exige `CRON_SECRET`
- webhook Stripe valida assinatura com `STRIPE_WEBHOOK_SECRET`
- idempotencia de webhook usa `provider_webhook_events` com chave unica por `provider` e `event_id`
- registros de invoice usam guarda por `provider_invoice_id` e `external_id` antes de criar transacao local
- eventos fora de ordem de assinatura sao filtrados por `provider_last_webhook_event_at`
- estados `active`, `trialing`, `past_due`, `incomplete`, `canceled` e refund possuem fluxo local de assinatura/transacao/acesso

Correcao aplicada:

- `claimProviderWebhookEvent()` agora libera reprocessamento de evento que ficou em `processing` por mais de 15 minutos, com `UPDATE` condicional para evitar dupla execucao concorrente, evitando bloqueio permanente quando o processo PHP cai antes de marcar `processed`, `failed` ou `ignored`

Cobertura operacional encontrada:

- `BillingStripeOperationalValidationTest.php` cobre ciclo real com Stripe Test Clock, duplicidade de webhook, evento fora de ordem, recuperacao atrasada, upgrade com credito proporcional e concorrencia de refund
- a suite operacional nao foi executada nesta rodada porque depende de configuracao Stripe real, banco local preparado e efeitos externos controlados

Validacao desta auditoria backend:

- `C:\xampp\php\php.exe -l C:\xampp\htdocs\questao-pro-backend\modules\subscriptions\repositories\SubscriptionsRepository.php`: sem erros de sintaxe; permanece apenas o aviso conhecido de `openssl` ja carregado
- `npm run check:text-encoding`: ok

## Cobertura adicionada nesta rodada

Arquivo:

- `src/services/subscriptions/__tests__/subscriptionsService.test.ts`

Cenarios adicionados:

- matriz oficial de testes Stripe
- registro de execucao guiada da matriz Stripe
- checkout interno com cartao salvo
- solicitacao de capability PIX
- validacao de cupom com alvo de plano
- atualizacao de renovacao automatica
- cancelamento de assinatura com motivo, detalhe e captcha
- cancelamento de pedido de reembolso
- reversao de cancelamento pendente

Validacao:

- `npx vitest run src/services/subscriptions/__tests__/subscriptionsService.test.ts`: 15 testes ok
- `npm run typecheck`: ok
- `npm run check:text-encoding`: ok

## Checklist de prova operacional

- criar assinatura por checkout hospedado
- criar assinatura por checkout interno com novo cartao
- criar assinatura por cartao salvo
- aplicar cupom valido e recusar cupom invalido
- finalizar upgrade com credito proporcional
- bloquear downgrade indevido quando aplicavel
- abrir portal Stripe
- alternar renovacao automatica
- solicitar cancelamento e reembolso
- cancelar pedido de reembolso quando permitido
- receber webhook de assinatura paga
- receber webhook de assinatura `past_due`
- validar cron de recorrencia
- registrar evidencias na matriz Stripe do admin

## Proxima acao recomendada

Executar a matriz real com Stripe em modo teste quando o ambiente tiver dominio/VPS ou uma URL publica temporaria.

Enquanto ainda estivermos em localhost, a proxima frente tecnica segura e revisar o backend dos endpoints de assinatura para confirmar:

- validacao de permissao/autenticacao por rota
- idempotencia de webhooks
- tratamento de estados `past_due`, `incomplete`, `canceled` e refund
- consistencia entre transacoes locais e objetos Stripe

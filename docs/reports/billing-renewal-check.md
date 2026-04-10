# Billing Renewal Check

Resultado final: **GO**

OK: 21
RISCO: 1
CRITICO: 0
NAO_COMPROVADO: 0

| ID | Item | Status | Evidencia |
| --- | --- | --- | --- |
| A1 | Endpoints Stripe-only ativos | OK | `C:/xampp/htdocs/questao-pro-backend/api/subscriptions/stripe_webhook.php`<br>`C:/xampp/htdocs/questao-pro-backend/api/subscriptions/cron_stripe_reconciliation.php`<br>`C:/dev/concursomestre/src/services/api/endpoints.ts` |
| A2 | Endpoints legados respondem 410 | OK | `C:/xampp/htdocs/questao-pro-backend/modules/subscriptions/routes.php`<br>`C:/xampp/htdocs/questao-pro-backend/modules/payments/routes.php` |
| A3 | Ausencia de Mercado Pago no fluxo ativo | OK | `C:/dev/concursomestre/src/services/subscriptions/subscriptionsService.ts`<br>`C:/dev/concursomestre/src/app/checkout/page.tsx`<br>`C:/dev/concursomestre/src/app/profile/page.tsx` |
| B1 | Persistencia critica Stripe | OK | `C:/xampp/htdocs/questao-pro-backend/modules/subscriptions/services/SubscriptionsService.php`<br>`C:/xampp/htdocs/questao-pro-backend/modules/subscriptions/repositories/SubscriptionsRepository.php` |
| C1 | Webhook com idempotencia forte | OK | `C:/xampp/htdocs/questao-pro-backend/modules/subscriptions/services/SubscriptionsService.php`<br>`C:/xampp/htdocs/questao-pro-backend/modules/subscriptions/repositories/SubscriptionsRepository.php` |
| C2 | Webhook corta eventos fora de ordem | OK | `C:/xampp/htdocs/questao-pro-backend/modules/subscriptions/services/SubscriptionsService.php` |
| C3 | Webhook cobre eventos essenciais | OK | `C:/xampp/htdocs/questao-pro-backend/modules/subscriptions/services/SubscriptionsService.php` |
| C4 | Webhook atrasado e fora de ordem validados pela suite | OK | `C:/dev/concursomestre/scripts/checks/output/billing-e2e-report.json`<br>`C:/xampp/htdocs/questao-pro-backend/modules/subscriptions/services/SubscriptionsService.php`<br>`C:/xampp/htdocs/questao-pro-backend/api/subscriptions/stripe_webhook.php` |
| D1 | Reconciliação Stripe ativa | OK | `C:/xampp/htdocs/questao-pro-backend/api/subscriptions/cron_stripe_reconciliation.php`<br>`C:/xampp/htdocs/questao-pro-backend/modules/subscriptions/services/SubscriptionsService.php` |
| D2 | Reconciliação tenta recuperar renovacao perdida | RISCO | `C:/xampp/htdocs/questao-pro-backend/modules/subscriptions/services/SubscriptionsService.php` |
| E1 | Auto renew on exige payment method no backend | OK | `C:/xampp/htdocs/questao-pro-backend/modules/subscriptions/services/SubscriptionsService.php` |
| E2 | Auto renew off sincroniza cancel_at_period_end | OK | `C:/xampp/htdocs/questao-pro-backend/modules/subscriptions/services/SubscriptionsService.php` |
| E3 | Cancelamento apos 7 dias nao bloqueia desligamento da renovacao | OK | `C:/xampp/htdocs/questao-pro-backend/modules/subscriptions/services/SubscriptionsService.php` |
| E4 | Periodo local usa timestamps remotos quando existem | OK | `C:/xampp/htdocs/questao-pro-backend/modules/subscriptions/services/SubscriptionsService.php` |
| E5 | Renovacao Stripe ponta a ponta com Stripe real | OK | `C:/dev/concursomestre/scripts/checks/output/billing-e2e-report.json`<br>`C:/xampp/htdocs/questao-pro-backend/modules/subscriptions/services/SubscriptionsService.php`<br>`C:/dev/concursomestre/src/app/profile/page.tsx` |
| F1 | Backend recalcula credito, cupom e piso zero | OK | `C:/xampp/htdocs/questao-pro-backend/modules/subscriptions/services/SubscriptionsService.php`<br>`C:/xampp/htdocs/questao-pro-backend/modules/subscriptions/services/SubscriptionsBillingSupport.php` |
| F2 | Fluxo de local_credit tratado explicitamente | OK | `C:/xampp/htdocs/questao-pro-backend/modules/subscriptions/services/SubscriptionsService.php` |
| F3 | Estrategia canonica de pro-rata definida | OK | `C:/dev/concursomestre/scripts/checks/output/billing-e2e-report.json`<br>`C:/xampp/htdocs/questao-pro-backend/modules/subscriptions/services/SubscriptionsService.php` |
| G1 | Refund pendente nao corta acesso prematuramente | OK | `C:/xampp/htdocs/questao-pro-backend/modules/subscriptions/services/SubscriptionsService.php` |
| G2 | charge.refunded sincroniza estado local | OK | `C:/xampp/htdocs/questao-pro-backend/modules/subscriptions/services/SubscriptionsService.php` |
| G3 | cancelRefundRequest tenta recompor a assinatura | OK | `C:/xampp/htdocs/questao-pro-backend/modules/subscriptions/services/SubscriptionsService.php` |
| G4 | Refund concorrente coberto pela suite | OK | `C:/dev/concursomestre/scripts/checks/output/billing-e2e-report.json`<br>`C:/xampp/htdocs/questao-pro-backend/modules/subscriptions/services/SubscriptionsService.php` |

## Observacoes

- **A1**: Confere presenca dos endpoints ativos da Stripe no backend e na camada oficial do frontend.
- **A2**: As rotas legadas devem permanecer apenas como tombstone explicita.
- **A3**: Ignora tombstones e valida apenas o fluxo ativo do produto.
- **B1**: Campos obrigatorios para vinculo Stripe x plataforma.
- **C1**: Processamento duplicado deve ser bloqueado por provider + event_id, incluindo trilha de ignored.
- **C2**: Verifica se o backend ignora eventos mais antigos do que o ultimo evento salvo.
- **C3**: Eventos essenciais de ciclo, falha, cancelamento e refund.
- **C4**: Depende da suite operacional com Stripe real em modo teste e simulacao controlada de entrega.
- **D1**: Confere a ponte oficial do cron e o loop de reconciliacao.
- **D2**: Se o webhook falhar, o cron precisa tentar reaproveitar a ultima fatura paga.
- **E1**: Nao basta a UI esconder o toggle.
- **E2**: O backend precisa propagar o desligamento da renovacao para a Stripe.
- **E3**: Depois de 7 dias a regra esperada e encerrar apenas a renovacao futura.
- **E4**: Evita recalc local indevido quando o dado oficial remoto esta disponivel.
- **E5**: Depende da suite operacional com Test Clock, invoice real e reconciliacao posterior.
- **F1**: Mantem o backend como fonte final do valor devido.
- **F2**: Quando o total zera, o produto precisa evitar cobranca duplicada e acesso fantasma.
- **F3**: Hoje a estrategia oficial aceita credito proporcional local no backend. Prorata nativo Stripe nao e obrigatorio se o fluxo estiver provado.
- **G1**: Evita perda de acesso antes do estorno definitivo.
- **G2**: O corte final do acesso precisa acompanhar o estorno real.
- **G3**: A recomposicao agora depende de uma ressincronizacao explicita com a Stripe.
- **G4**: Depende da suite operacional com requestRefund, approveRefund, cancelRefundRequest e webhook charge.refunded.

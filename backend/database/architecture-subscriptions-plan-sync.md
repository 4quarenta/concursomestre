# Architecture: Subscriptions Plan Sync

## Estado atual (`2026-05-20`)

A sincronizacao de planos recorrentes do Mercado Pago foi encerrada. O produto
opera em modo **Stripe-only** e `api/subscriptions/sync_plans_mp.php` responde
`410` diretamente, sem abrir conexao MySQL. O arquivo CLI legado tambem existe
apenas como guarda operacional para ambientes antigos removerem o cron.

## Objetivo

Documentar a migracao da sincronizacao de planos recorrentes do Mercado Pago para a camada oficial `modules/subscriptions`.

## Endpoint legado mantido como bridge

- `C:\xampp\htdocs\questao-pro-backend\api\subscriptions\sync_plans_mp.php`

Esse arquivo agora apenas responde `410` via `respondRemovedMercadoPagoSubscriptionsRoute()`.

## Camadas oficiais

### Controller

- `C:\xampp\htdocs\questao-pro-backend\modules\subscriptions\controllers\SubscriptionsPlanSyncController.php`

Responsabilidade:

- disparar a sincronizacao sem carregar regra de negocio ou SQL

### Service

- `C:\xampp\htdocs\questao-pro-backend\modules\subscriptions\services\SubscriptionsMercadoPagoPlanSyncService.php`

Responsabilidades:

- carregar os planos locais usados na recorrencia
- ignorar planos gratuitos
- criar `PreApprovalPlan` somente quando o plano ainda nao possui `external_plan_id`
- registrar o resultado operacional por item
- consolidar resumo final com criados, pulados, ja existentes e erros

### Repository

- `C:\xampp\htdocs\questao-pro-backend\modules\subscriptions\repositories\SubscriptionsRepository.php`

Metodos adicionados:

- `findPlansForMercadoPagoSync()`
- `updatePlanExternalPlanId(int $planId, string $externalPlanId)`

## Segurança e operação

A rota HTTP agora exige contexto admin via sessao.

O fluxo tambem ganhou uma entrada CLI oficial:

- `C:\xampp\htdocs\questao-pro-backend\scripts\tasks\sync_mercadopago_preapproval_plans.php`

Isso reduz a dependencia de um endpoint publico para uma operacao que e administrativa e eventual.

## Auditoria

A execucao HTTP registra auditoria administrativa com a acao:

- `subscriptions.sync_mp_plans`

Os detalhes gravados usam o `summary` retornado pelo service.

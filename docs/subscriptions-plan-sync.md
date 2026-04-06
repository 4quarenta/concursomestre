# Subscriptions Plan Sync

## Escopo

Esta rodada absorveu a sincronização legada de planos recorrentes do Mercado Pago:

- `C:\xampp\htdocs\questão-pro-backend\api\subscriptions\sync_plans_mp.php`

O endpoint legado deixou de conter SQL e integração direta com a SDK do Mercado Pago.

## Arquitetura nova

### Controller

- [SubscriptionsPlanSyncController.php](/C:/xampp/htdocs/questão-pro-backend/modules/subscriptions/controllers/SubscriptionsPlanSyncController.php)

Responsabilidade:

- expor um controller fino para disparar a sincronização administrativa

### Service

- [SubscriptionsMercadoPagoPlanSyncService.php](/C:/xampp/htdocs/questão-pro-backend/modules/subscriptions/services/SubscriptionsMercadoPagoPlanSyncService.php)

Responsabilidades:

- listar os planos locais elegíveis
- ignorar planos gratuitos
- criar `PreApprovalPlan` apenas quando `external_plan_id` ainda não existe
- traduzir erros da SDK para um retorno operacional legível
- devolver `items` e `summary` para auditoria/admin

### Repository

- [SubscriptionsRepository.php](/C:/xampp/htdocs/questão-pro-backend/modules/subscriptions/repositories/SubscriptionsRepository.php)

Novas operações:

- buscar planos para sincronização
- persistir `external_plan_id`

### Route

- [routes.php](/C:/xampp/htdocs/questão-pro-backend/modules/subscriptions/routes.php)

Handler novo:

- `handleSubscriptionsMercadoPagoPlanSyncRoute(PDO $db)`

Regras aplicadas:

- aceita `GET` e `POST` por compatibilidade operacional
- exige sessão admin
- registra auditoria com `subscriptions.sync_mp_plans`

## Compatibilidade

O bridge legado continua existindo em:

- [sync_plans_mp.php](/C:/xampp/htdocs/questão-pro-backend/api/subscriptions/sync_plans_mp.php)

Agora ele apenas inicializa infraestrutura mínima e delega para o módulo oficial.

## Operação via CLI

Também foi criada a entrada operacional:

- [sync_mercadopago_preapproval_plans.php](/C:/xampp/htdocs/questão-pro-backend/scripts/tasks/sync_mercadopago_preapproval_plans.php)

Objetivo:

- permitir execução controlada por terminal/rotina operacional sem depender de endpoint HTTP público

## Validação

Esta rodada foi validada com:

- `php -l` nos arquivos alterados
- [SubscriptionsPlanSyncWiringTest.php](/C:/xampp/htdocs/questão-pro-backend/tests/SubscriptionsPlanSyncWiringTest.php)
- smoke `401` sem sessão em [sync_plans_mp.php](/C:/xampp/htdocs/questão-pro-backend/api/subscriptions/sync_plans_mp.php)
- home `200` em [http://localhost:3000/#/](http://localhost:3000/#/)

# Architecture: Subscriptions Checkout Automation

## Estado atual (`2026-05-20`)

O checkout interno Mercado Pago foi removido. O produto opera em modo
**Stripe-only**; `api/subscriptions/process_payment.php`, `create.php`,
`webhook.php` e `webhook_mp.php` respondem `410` diretamente, sem abrir conexao
MySQL. O helper de automacao permanece ativo apenas para operacao Stripe/admin.

## Objetivo

Documentar a absorcao do checkout interno Mercado Pago e do helper de automacao de cron pelo modulo oficial `subscriptions`.

## Endpoints legados mantidos como bridge

- `C:\xampp\htdocs\questao-pro-backend\api\subscriptions\process_payment.php`
- `C:\xampp\htdocs\questao-pro-backend\api\subscriptions\automation_helper.php`

O endpoint Mercado Pago agora apenas responde `410`; o helper de automacao delega para `modules/subscriptions/routes.php`.

## Camada oficial

### Controller

- `C:\xampp\htdocs\questao-pro-backend\modules\subscriptions\controllers\SubscriptionsController.php`

Responsabilidades novas:

- delegar o processamento do checkout Mercado Pago interno
- delegar a geracao do helper de automacao
- manter controller fino, sem SQL e sem detalhes de integracao externa

### Services

- `C:\xampp\htdocs\questao-pro-backend\modules\subscriptions\services\SubscriptionsMercadoPagoCheckoutService.php`
- `C:\xampp\htdocs\questao-pro-backend\modules\subscriptions\services\SubscriptionsAutomationService.php`
- `C:\xampp\htdocs\questao-pro-backend\modules\subscriptions\services\SubscriptionsService.php`

#### `SubscriptionsMercadoPagoCheckoutService`

Concentra a orquestracao do fluxo:

- bootstrap do checkout
- sincronizacao de cartao salvo
- calculo de preco final e credito proporcional
- cobranca inicial Mercado Pago
- ativacao da assinatura aprovada
- traducao de erros de API para mensagens amigaveis
- persistencia de log operacional em `storage/logs/subscriptions-payment.log`

#### `SubscriptionsAutomationService`

Centraliza a geracao do material de operacao:

- URL do cron recorrente com `CRON_SECRET`
- comando Linux para `curl`
- script `.bat` para Agendador do Windows

### Routes

- `C:\xampp\htdocs\questao-pro-backend\modules\subscriptions\routes.php`

Handlers novos:

- `handleSubscriptionsMercadoPagoProcessPaymentRoute(PDO $db)`
- `handleSubscriptionsAutomationHelperRoute(PDO $db)`

Regras aplicadas:

- `process_payment` aceita apenas `POST`
- `automation_helper` aceita apenas `GET`
- `automation_helper` exige contexto admin
- logs operacionais saem de `api/` e vao para `storage/logs`

## Seguranca e limpeza

Melhorias aplicadas:

- o helper de automacao nao usa mais chave placeholder fixa
- o endpoint de automacao passou a exigir sessao admin
- o log `payment_debug.log` deixou de viver em `api/subscriptions`
- respostas de erro do Mercado Pago deixaram de expor o payload bruto da API para o cliente

## Impacto funcional

Compatibilidade preservada:

- checkout atual continua chamando `subscriptions/process_payment.php`
- admin continua baixando o `.bat` pelo mesmo endpoint legado

Mudanca funcional positiva:

- a UI administrativa agora pode receber a URL real do cron e o comando Linux oficial do backend

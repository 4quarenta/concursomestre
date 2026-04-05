# Subscriptions Checkout Automation

## Escopo

Esta rodada concluiu a migração de dois pontos legados importantes de `subscriptions`:

- `api/subscriptions/process_payment.php`
- `api/subscriptions/automation_helper.php`

Ambos deixaram de conter regra procedural e passaram a delegar para `modules/subscriptions`.

## Backend

### Checkout Mercado Pago

O fluxo interno de checkout Mercado Pago agora é orquestrado por:

- `C:\xampp\htdocs\questao-pro-backend\modules\subscriptions\services\SubscriptionsMercadoPagoCheckoutService.php`

Esse service concentra:

- leitura do payload bruto do checkout
- bootstrap de autenticação e contexto do usuário
- reaproveitamento das rotinas oficiais de cartão salvo
- cálculo de crédito proporcional e recorrência
- cobrança inicial via Mercado Pago
- ativação final da assinatura aprovada
- normalização de erros operacionais
- log técnico em `storage/logs/subscriptions-payment.log`

### Helper de automação

O material operacional mostrado ao admin agora é gerado por:

- `C:\xampp\htdocs\questao-pro-backend\modules\subscriptions\services\SubscriptionsAutomationService.php`

Esse service:

- monta a URL real do cron recorrente usando `CRON_SECRET`
- expõe o comando Linux oficial
- gera o `.bat` de Windows
- evita o placeholder antigo `SECURE_CRON_KEY_123` na UI

## Frontend

A tela administrativa de automação em:

- `C:\dev\concursomestre\src\app\admin\page.tsx`

passou a consumir:

- `C:\dev\concursomestre\src\services\subscriptions\subscriptionsService.ts`

com o endpoint oficial:

- `subscriptions/automation_helper.php`

Com isso:

- o botão de download usa a URL oficial retornada pelo backend
- o comando copiado para Linux usa a chave real configurada no ambiente
- a interface deixa de depender de string hardcoded

## Compatibilidade

Os endpoints legados continuam existindo, mas agora são bridges finos:

- `C:\xampp\htdocs\questao-pro-backend\api\subscriptions\process_payment.php`
- `C:\xampp\htdocs\questao-pro-backend\api\subscriptions\automation_helper.php`

## Validação

Esta rodada foi validada com:

- `php -l` nos arquivos alterados
- `C:\xampp\htdocs\questao-pro-backend\tests\SubscriptionsCheckoutWiringTest.php`
- `npx vitest run src/services/subscriptions/__tests__/subscriptionsService.test.ts`
- `npm run build`
- `npm run test:auth`
- `npm run test:admin`
- smoke `POST` sem sessão em `api/subscriptions/process_payment.php` retornando `401`
- smoke sem sessão em `api/subscriptions/automation_helper.php` retornando `401`

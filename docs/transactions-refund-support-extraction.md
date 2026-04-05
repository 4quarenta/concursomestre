# Transactions Refund Support Extraction

## Objetivo
Remover a regra de estorno do legado `api/utils/payment_refund_helper.php` e oficializar esse comportamento dentro do dominio `transactions`.

## Implementacao oficial
- `C:\xampp\htdocs\questao-pro-backend\modules\transactions\services\TransactionsRefundSupport.php`

## Bridges legados
- `C:\xampp\htdocs\questao-pro-backend\api\utils\payment_refund_helper.php`

## Modulos consumidores alinhados
- `modules/transactions/services/TransactionsService.php`
- `modules/subscriptions/services/SubscriptionsService.php`
- `modules/admin/services/AdminUserActionsService.php`

## Regras consolidadas
- processamento de estorno por gateway
- resolucao de `PaymentIntent` Stripe para reembolso
- persistencia do estado local de transacao reembolsada
- montagem de detalhes de reembolso para e-mail
- selecao da ultima transacao de plano elegivel para reembolso

## Validacao executada
- `C:\xampp\php\php.exe -l` nos arquivos alterados
- `C:\xampp\php\php.exe C:\xampp\htdocs\questao-pro-backend\tests\TransactionsRefundSupportWiringTest.php`
- `C:\xampp\php\php.exe C:\xampp\htdocs\questao-pro-backend\tests\SubscriptionsCheckoutWiringTest.php`
- `C:\xampp\php\php.exe C:\xampp\htdocs\questao-pro-backend\tests\AdminSecurityWiringTest.php`
- `npx vitest run src/services/transactions/__tests__/transactionsService.test.ts src/services/admin/__tests__/adminService.test.ts src/services/subscriptions/__tests__/subscriptionsService.test.ts`
- `npm run build`
- smoke `401` em `api/transactions/approve_refund.php`
- smoke `200` na home `http://localhost:3000/#/`

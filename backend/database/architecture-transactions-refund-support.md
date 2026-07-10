# Architecture: Transactions Refund Support

## Papel na arquitetura
O suporte de estorno pertence ao dominio `transactions`, mesmo quando reutilizado por `subscriptions` e `admin`, porque a fonte de verdade continua sendo a transacao financeira local.

## Implementacao oficial
- `modules/transactions/services/TransactionsRefundSupport.php`

## Responsabilidades
- traduzir dados de reembolso Stripe para payload persistivel
- localizar `PaymentIntent`/`invoice` ligados a transacoes locais
- acionar reembolso no gateway configurado
- atualizar a transacao local para `refunded`
- gerar detalhes padronizados para comunicacao ao usuario
- localizar transacao de plano elegivel para cancelamento com reembolso

## Compatibilidade
`api/utils/payment_refund_helper.php` permanece apenas como bridge legado.

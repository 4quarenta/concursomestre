<?php

declare(strict_types=1);

function phase06Assert(bool $condition, string $message): void
{
    if (!$condition) {
        throw new RuntimeException($message);
    }
}

$root = dirname(__DIR__);
$ledger = (string) file_get_contents($root . '/modules/finance/services/FinancialLedger.php');
$migration = (string) file_get_contents($root . '/database/migrations/20260711_030000_financial_ledger_foundation.php');
$refundSupport = (string) file_get_contents($root . '/modules/transactions/services/TransactionsRefundSupport.php');
$subscriptions = (string) file_get_contents($root . '/modules/subscriptions/services/SubscriptionsService.php');
$webhookRoute = (string) file_get_contents($root . '/modules/subscriptions/routes.php');
$transactionsRoute = (string) file_get_contents($root . '/modules/transactions/routes.php');
$paymentProvider = (string) file_get_contents($root . '/config/payment_provider.php');

phase06Assert(str_contains($migration, 'financial_ledger_entries'), 'Migration financeira precisa criar o ledger aditivo.');
phase06Assert(str_contains($migration, 'refunded_amount'), 'Migration financeira precisa persistir o valor estornado.');
phase06Assert(!str_contains(strtoupper($migration), 'DROP TABLE'), 'Migration financeira nao pode remover tabelas.');
phase06Assert(!str_contains(strtoupper($migration), 'DROP COLUMN'), 'Migration financeira nao pode remover colunas.');

phase06Assert(str_contains($ledger, "'entry_type' => 'capture'"), 'Ledger precisa registrar capturas comprovadas.');
phase06Assert(str_contains($ledger, "'entry_type' => 'refund'"), 'Ledger precisa registrar estornos comprovados.');
phase06Assert(str_contains($ledger, "'fee_amount' => -\$reversedFee"), 'Ledger precisa reverter proporcionalmente a taxa comercial em estornos.');
phase06Assert(str_contains($ledger, 'ON DUPLICATE KEY UPDATE'), 'Ledger precisa ser idempotente por chave de lancamento.');

phase06Assert(str_contains($refundSupport, "'partially_refunded'"), 'Fluxo administrativo precisa representar estorno parcial.');
phase06Assert(str_contains($subscriptions, "&& !\$isPartialRefund"), 'Estorno parcial nao pode cancelar a assinatura automaticamente.');
phase06Assert(str_contains($subscriptions, 'assertStripeEventMatchesConfiguredMode'), 'Webhook precisa validar modo test/live antes de mutar dados.');
$stripeWebhookOffset = strpos($webhookRoute, 'function handleSubscriptionsStripeWebhookRoute');
$stripeWebhookEnd = $stripeWebhookOffset === false ? false : strpos($webhookRoute, "\nfunction ", $stripeWebhookOffset + 1);
$stripeWebhookScope = $stripeWebhookOffset === false
    ? ''
    : substr($webhookRoute, $stripeWebhookOffset, $stripeWebhookEnd === false ? null : $stripeWebhookEnd - $stripeWebhookOffset);
phase06Assert(str_contains($stripeWebhookScope, '$maxPayloadBytes = 1024 * 1024'), 'Webhook precisa limitar o tamanho do payload.');
phase06Assert(!str_contains($stripeWebhookScope, '\'message\' => $e->getMessage()'), 'Webhook publico nao pode vazar detalhes internos de erro.');
phase06Assert(str_contains($paymentProvider, 'SchemaReadiness::assertTablesAndColumns'), 'Rotas financeiras precisam validar schema sem DDL runtime.');
phase06Assert(str_contains($transactionsRoute, 'verifyAuthenticatedUserPayload(true)'), 'Listagem de transacoes precisa exigir sessao autenticada.');

fwrite(STDOUT, "Financial ledger phase 06 wiring assertions passed.\n");

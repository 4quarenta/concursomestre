<?php

declare(strict_types=1);

$source = (string) file_get_contents(dirname(__DIR__) . '/scripts/backfills/backfill_financial_ledger.php');
foreach ([
    "PHP_SAPI !== 'cli'",
    "getenv('BACKFILL_APPLY')",
    "getenv('BACKFILL_AFTER_ID')",
    "getenv('BACKFILL_BATCH_SIZE')",
    'FinancialLedger::syncTransactionById',
    'ORDER BY id ASC',
] as $needle) {
    if (!str_contains($source, $needle)) {
        throw new RuntimeException('Backfill do ledger incompleto: ' . $needle);
    }
}
if (str_contains($source, 'FinancialLedgerService')) {
    throw new RuntimeException('Backfill nao pode introduzir o ledger paralelo da R6.1.');
}

echo "Financial ledger backfill wiring assertions passed.\n";

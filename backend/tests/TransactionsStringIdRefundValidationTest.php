<?php

/*
* ----------------------------------------------------
* @author: 4quarenta
* @author URI: https://github.com/4quarenta
* @copyright: (c) 2026 ConcursoMestre. All rights reserved
* ----------------------------------------------------
*
* @since 1.0.0
*
*/

require_once __DIR__ . '/../modules/transactions/validators/TransactionsValidator.php';

function transactionsStringIdAssertSame($actual, $expected, string $message): void
{
    if ($actual !== $expected) {
        throw new RuntimeException($message . ' Esperado ' . var_export($expected, true) . ', recebido ' . var_export($actual, true) . '.');
    }
}

try {
    $validator = new TransactionsValidator();

    $requestPayload = $validator->validateRefundRequest([
        'transaction_id' => 'tx-elite-001',
        'reason' => 'quero cancelar',
    ]);

    $purchasePayload = $validator->validateMaterialPurchase([
        'material_id' => 'mat-abc-001',
        'coupon_code' => 'FREE100',
    ]);

    $resolutionPayload = $validator->validateRefundResolution([
        'transaction_id' => 'tx-elite-001',
        'reason' => 'avaliar proposta',
    ]);

    transactionsStringIdAssertSame($purchasePayload['material_id'], 'mat-abc-001', 'O validator deve preservar material_id textual na compra de material.');
    transactionsStringIdAssertSame($purchasePayload['coupon_code'], 'FREE100', 'O validator deve preservar cupom informado na compra de material.');
    transactionsStringIdAssertSame($requestPayload['transaction_id'], 'tx-elite-001', 'O validator deve preservar transaction_id textual na solicitacao.');
    transactionsStringIdAssertSame($resolutionPayload['transaction_id'], 'tx-elite-001', 'O validator deve preservar transaction_id textual na resolucao.');

    fwrite(STDOUT, "TransactionsStringIdRefundValidationTest: PASS\n");
} catch (Throwable $e) {
    fwrite(STDERR, "TransactionsStringIdRefundValidationTest: FAIL - {$e->getMessage()}\n");
    exit(1);
}

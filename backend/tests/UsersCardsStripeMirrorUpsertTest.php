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

require_once __DIR__ . '/../modules/users/services/UsersCardsStripeSupport.php';
require_once __DIR__ . '/../config/database.php';

function usersCardsStripeMirrorAssertSame($actual, $expected, string $message): void
{
    if ($actual !== $expected) {
        throw new RuntimeException($message . ' Esperado ' . var_export($expected, true) . ', recebido ' . var_export($actual, true) . '.');
    }
}

try {
    $database = new Database();
    $db = $database->getConnection();

    $db->exec('DROP TEMPORARY TABLE IF EXISTS user_cards');
    $db->exec("
        CREATE TEMPORARY TABLE user_cards (
            id VARCHAR(64) PRIMARY KEY,
            user_id VARCHAR(64) NOT NULL,
            payment_provider VARCHAR(50) NOT NULL DEFAULT 'stripe',
            stripe_payment_method_id VARCHAR(255) NULL,
            provider_customer_id VARCHAR(255) NULL,
            brand VARCHAR(32) NOT NULL,
            last_four_digits VARCHAR(4) NOT NULL,
            exp_month INT NOT NULL,
            exp_year INT NOT NULL,
            holder_name VARCHAR(255) NULL,
            is_default TINYINT(1) NOT NULL DEFAULT 0,
            locked_by_recurring TINYINT(1) NOT NULL DEFAULT 0,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            UNIQUE KEY idx_user_card_unique (user_id, brand, last_four_digits)
        )
    ");

    $paymentMethodOne = (object) [
        'id' => 'pm_first',
        'card' => (object) [
            'brand' => 'visa',
            'last4' => '4242',
            'exp_month' => 12,
            'exp_year' => 2030,
        ],
        'billing_details' => (object) [
            'name' => 'Admin Teste',
        ],
    ];

    $paymentMethodTwo = (object) [
        'id' => 'pm_second',
        'card' => (object) [
            'brand' => 'visa',
            'last4' => '4242',
            'exp_month' => 12,
            'exp_year' => 2030,
        ],
        'billing_details' => (object) [
            'name' => 'Admin Teste',
        ],
    ];

    $firstId = upsertLocalStripeCardMirror($db, 'u-admin', 'cus_admin', $paymentMethodOne, true);
    $secondId = upsertLocalStripeCardMirror($db, 'u-admin', 'cus_admin', $paymentMethodTwo, true);

    usersCardsStripeMirrorAssertSame($secondId, $firstId, 'O mesmo cartao deve reutilizar o espelho local existente.');

    $row = $db->query("SELECT stripe_payment_method_id, brand, last_four_digits, is_default FROM user_cards LIMIT 1")
        ->fetch(PDO::FETCH_ASSOC);
    $count = (int) $db->query("SELECT COUNT(*) FROM user_cards")->fetchColumn();

    usersCardsStripeMirrorAssertSame($count, 1, 'A sincronizacao nao deve duplicar espelhos locais para o mesmo cartao.');
    usersCardsStripeMirrorAssertSame($row['stripe_payment_method_id'], 'pm_second', 'O espelho local deve atualizar para o payment method mais recente.');
    usersCardsStripeMirrorAssertSame($row['brand'], 'visa', 'A marca do cartao deve permanecer consistente.');
    usersCardsStripeMirrorAssertSame($row['last_four_digits'], '4242', 'Os quatro ultimos digitos devem permanecer consistentes.');
    usersCardsStripeMirrorAssertSame((int) $row['is_default'], 1, 'O cartao atualizado deve continuar como padrao quando aplicavel.');

    fwrite(STDOUT, "UsersCardsStripeMirrorUpsertTest: PASS\n");
} catch (Throwable $e) {
    fwrite(STDERR, "UsersCardsStripeMirrorUpsertTest: FAIL - {$e->getMessage()}\n");
    exit(1);
}

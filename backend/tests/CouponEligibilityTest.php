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

require_once __DIR__ . '/../modules/subscriptions/services/SubscriptionsBillingSupport.php';

function couponEligibilityAssert(bool $condition, string $message): void
{
    if (!$condition) {
        throw new RuntimeException($message);
    }
}

try {
    if (!in_array('sqlite', PDO::getAvailableDrivers(), true)) {
        echo "CouponEligibilityTest: SKIP - sqlite PDO driver unavailable\n";
        exit(0);
    }

    $db = new PDO('sqlite::memory:');
    $db->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    $db->exec('CREATE TABLE system_settings (key_name TEXT PRIMARY KEY, value_json TEXT NOT NULL)');
    $coupons = [
        [
            'code' => 'VIP50',
            'discountPercentage' => 50,
            'discountAmount' => 0,
            'uses' => 0,
            'maxUses' => 10,
            'autoApply' => false,
            'targetType' => 'plan',
            'targetId' => '3',
            'allowedUserEmails' => ['aluno@teste.com'],
        ],
        [
            'code' => 'FIXO10',
            'discountPercentage' => 0,
            'discountAmount' => 10,
            'uses' => 0,
            'maxUses' => 0,
            'autoApply' => false,
            'targetType' => 'all',
        ],
    ];
    $stmt = $db->prepare("INSERT INTO system_settings (key_name, value_json) VALUES ('coupons', :value_json)");
    $stmt->execute([':value_json' => json_encode($coupons, JSON_UNESCAPED_UNICODE)]);

    $allowed = validateCouponForAmount($db, 'VIP50', 100.00, [
        'plan_id' => 3,
        'target_type' => 'plan',
        'target_id' => '3',
        'user_email' => 'aluno@teste.com',
    ]);
    couponEligibilityAssert($allowed['valid'] === true, 'Cupom restrito deve validar para e-mail autorizado.');
    couponEligibilityAssert(abs($allowed['discount_amount'] - 50.00) < 0.001, 'Cupom percentual deve calcular 50,00.');

    $blocked = validateCouponForAmount($db, 'VIP50', 100.00, [
        'plan_id' => 3,
        'target_type' => 'plan',
        'target_id' => '3',
        'user_email' => 'outro@teste.com',
    ]);
    couponEligibilityAssert($blocked['valid'] === false, 'Cupom restrito nao pode validar para outro e-mail.');
    couponEligibilityAssert($blocked['message'] === 'Cupom restrito a usuarios selecionados.', 'Mensagem de bloqueio deve explicar restricao de usuario.');

    $fixed = validateCouponForAmount($db, 'FIXO10', 7.00, []);
    couponEligibilityAssert($fixed['valid'] === true, 'Cupom fixo deve validar.');
    couponEligibilityAssert(abs($fixed['discount_amount'] - 7.00) < 0.001, 'Cupom fixo nao pode gerar desconto maior que o total.');

    echo "CouponEligibilityTest: PASS\n";
} catch (Throwable $e) {
    fwrite(STDERR, "CouponEligibilityTest: FAIL - {$e->getMessage()}\n");
    exit(1);
}

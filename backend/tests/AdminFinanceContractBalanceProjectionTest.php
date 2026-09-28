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

declare(strict_types=1);

require_once __DIR__ . '/../modules/admin/services/AdminAnalyticsService.php';

function adminFinanceProjectionAssert(bool $condition, string $message): void
{
    if (!$condition) {
        throw new RuntimeException($message);
    }
}

class AdminFinanceContractProjectionFakeRepository extends AdminAnalyticsRepository
{
    public function __construct()
    {
    }
}

try {
    $service = new AdminAnalyticsService(
        new AdminFinanceContractProjectionFakeRepository(),
        new AdminAnalyticsValidator()
    );
    $buildProjection = new ReflectionMethod($service, 'buildConfirmedRevenueProjection');
    $buildProjection->setAccessible(true);
    $firstDueAt = (new DateTimeImmutable('+180 days'))->format('Y-m-d H:i:s');

    $monthly = $buildProjection->invoke($service, [[
        'id' => 506,
        'user_id' => 'projection-monthly-user',
        'plan_id' => 8,
        'status' => 'active',
        'plan_name' => 'Pro - Mensal',
        'price' => 40.00,
        'recurring_amount' => 40.00,
        'interval_unit' => 'month',
        'interval_count' => 1,
        'total_installments' => 1,
        'paid_installments' => 1,
        'auto_renew' => 1,
        'next_renewal_date' => $firstDueAt,
    ]], []);

    adminFinanceProjectionAssert(
        $monthly['totalRemainingInstallments'] === 0
            && $monthly['totalProjectedAmount'] === 0.0
            && $monthly['items'] === [],
        'A paid monthly subscription must not create a projection for an indefinite renewal.'
    );

    $quarterly = $buildProjection->invoke($service, [[
        'id' => 507,
        'user_id' => 'projection-quarterly-user',
        'plan_id' => 9,
        'status' => 'active',
        'plan_name' => 'Pro - Trimestral',
        'price' => 96.00,
        'recurring_amount' => 32.00,
        'interval_unit' => 'month',
        'interval_count' => 3,
        'total_installments' => 3,
        'paid_installments' => 1,
        'auto_renew' => 0,
        'next_renewal_date' => $firstDueAt,
    ]], []);

    adminFinanceProjectionAssert(
        $quarterly['totalRemainingInstallments'] === 2
            && count($quarterly['items']) === 1
            && $quarterly['items'][0]['paidInstallments'] === 1
            && $quarterly['items'][0]['totalInstallments'] === 3,
        'A quarterly contract paid once must project only installments 2 and 3.'
    );

    $annual = $buildProjection->invoke($service, [[
        'id' => 508,
        'user_id' => 'projection-annual-user',
        'plan_id' => 10,
        'status' => 'active',
        'plan_name' => 'Pro - Anual',
        'price' => 360.00,
        'recurring_amount' => 30.00,
        'interval_unit' => 'year',
        'interval_count' => 1,
        'total_installments' => 12,
        'paid_installments' => 1,
        'auto_renew' => 0,
        'next_renewal_date' => $firstDueAt,
    ]], []);

    adminFinanceProjectionAssert(
        $annual['totalRemainingInstallments'] === 11
            && count($annual['items']) === 1
            && $annual['items'][0]['paidInstallments'] === 1
            && $annual['items'][0]['totalInstallments'] === 12,
        'An annual contract paid once must project installments 2 through 12, never a thirteenth charge.'
    );

    fwrite(STDOUT, "AdminFinanceContractBalanceProjectionTest: PASS\n");
} catch (Throwable $error) {
    fwrite(STDERR, 'AdminFinanceContractBalanceProjectionTest: FAIL - ' . $error->getMessage() . PHP_EOL);
    exit(1);
}

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

require_once __DIR__ . '/../modules/subscriptions/services/SubscriptionsService.php';

function assertSubscriptionsTermDebt(bool $condition, string $message): void
{
    if (!$condition) {
        throw new RuntimeException($message);
    }
}

function callPrivateSubscriptionsTermDebtMethod(string $methodName, array $arguments = [])
{
    $reflection = new ReflectionClass(SubscriptionsService::class);
    $service = $reflection->newInstanceWithoutConstructor();
    $method = $reflection->getMethod($methodName);
    $method->setAccessible(true);

    return $method->invokeArgs($service, $arguments);
}

$annualDebt = callPrivateSubscriptionsTermDebtMethod('calculateOutstandingTermDebt', [[
    'total_installments' => 12,
    'paid_installments' => 2,
    'recurring_amount' => 25.87,
]]);

assertSubscriptionsTermDebt($annualDebt['remaining_installments'] === 10, 'Annual debt must count unpaid installments.');
assertSubscriptionsTermDebt(abs($annualDebt['amount'] - 258.70) < 0.001, 'Annual debt amount must sum unpaid installment amounts.');
assertSubscriptionsTermDebt(abs($annualDebt['installment_amount'] - 25.87) < 0.001, 'Annual debt must preserve contracted installment amount.');

$quarterlyDebtWithPlanPriceFallback = callPrivateSubscriptionsTermDebtMethod('calculateOutstandingTermDebt', [[
    'total_installments' => 3,
    'paid_installments' => 1,
    'price' => 36.97,
]]);

assertSubscriptionsTermDebt($quarterlyDebtWithPlanPriceFallback['remaining_installments'] === 2, 'Quarterly debt must count remaining installments.');
assertSubscriptionsTermDebt(abs($quarterlyDebtWithPlanPriceFallback['amount'] - 73.94) < 0.001, 'Quarterly debt must fallback to plan price when recurring amount is absent.');

$settledDebt = callPrivateSubscriptionsTermDebtMethod('calculateOutstandingTermDebt', [[
    'total_installments' => 12,
    'paid_installments' => 12,
    'recurring_amount' => 25.87,
]]);

assertSubscriptionsTermDebt($settledDebt['amount'] === 0.0, 'Fully paid term must not generate outstanding debt.');
assertSubscriptionsTermDebt($settledDebt['remaining_installments'] === 0, 'Fully paid term must have zero remaining installments.');

$futureEnd = date('Y-m-d H:i:s', time() + (15 * 24 * 60 * 60));
$pastEnd = date('Y-m-d H:i:s', time() - (24 * 60 * 60));

$shouldPreserve = callPrivateSubscriptionsTermDebtMethod('shouldPreserveSettledTermAccess', [[
    'total_installments' => 12,
    'paid_installments' => 12,
    'auto_renew' => 0,
    'cancel_at_period_end' => 1,
    'current_period_end' => $futureEnd,
]]);

assertSubscriptionsTermDebt($shouldPreserve === true, 'Settled parcelled term must preserve local access until term end.');

$shouldNotPreserveUnpaid = callPrivateSubscriptionsTermDebtMethod('shouldPreserveSettledTermAccess', [[
    'total_installments' => 12,
    'paid_installments' => 11,
    'auto_renew' => 0,
    'cancel_at_period_end' => 1,
    'current_period_end' => $futureEnd,
]]);

assertSubscriptionsTermDebt($shouldNotPreserveUnpaid === false, 'Unpaid parcelled term must not preserve access after remote cancellation.');

$shouldNotPreserveExpired = callPrivateSubscriptionsTermDebtMethod('shouldPreserveSettledTermAccess', [[
    'total_installments' => 12,
    'paid_installments' => 12,
    'auto_renew' => 0,
    'cancel_at_period_end' => 1,
    'current_period_end' => $pastEnd,
]]);

assertSubscriptionsTermDebt($shouldNotPreserveExpired === false, 'Expired settled term must not preserve access.');

fwrite(STDOUT, "Subscriptions term debt behavior assertions passed.\n");

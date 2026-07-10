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

function stripeBillingAssert(bool $condition, string $message): void
{
    if (!$condition) {
        throw new RuntimeException($message);
    }
}

try {
    $quarterlyPlan = [
        'name' => 'Essencial - Trimestral',
        'interval_unit' => 'month',
        'interval_count' => 3,
    ];

    $annualPlan = [
        'name' => 'Pro - Anual',
        'interval_unit' => 'year',
        'interval_count' => 1,
    ];

    $testPlan = [
        'name' => 'Elite - Teste 2 dias',
        'interval_unit' => 'day',
        'interval_count' => 2,
    ];

    $quarterlyTwoInstallments = getStripeBillingTermConfig($quarterlyPlan, 39.90, 'term_recurring', 2);
    stripeBillingAssert($quarterlyTwoInstallments['charge_interval'] === 'day', 'Trimestral em 2x deve cobrar em dias.');
    stripeBillingAssert($quarterlyTwoInstallments['charge_interval_count'] === 45, 'Trimestral em 2x deve cobrar a cada 45 dias.');
    stripeBillingAssert($quarterlyTwoInstallments['access_interval_unit'] === 'month', 'Trimestral em 2x deve manter acesso em meses.');
    stripeBillingAssert($quarterlyTwoInstallments['access_interval_count'] === 3, 'Trimestral em 2x deve liberar 3 meses no primeiro pagamento.');
    stripeBillingAssert(abs($quarterlyTwoInstallments['cycle_charge_amount'] - 19.95) < 0.001, 'Trimestral em 2x deve cobrar 19,95 por parcela.');

    $annualTwelveInstallments = getStripeBillingTermConfig($annualPlan, 118.80, 'term_recurring', 12);
    stripeBillingAssert($annualTwelveInstallments['charge_interval'] === 'month', 'Anual em 12x deve cobrar por mes-calendario.');
    stripeBillingAssert($annualTwelveInstallments['charge_interval_count'] === 1, 'Anual em 12x deve cobrar mensalmente sem deriva de calendario.');
    stripeBillingAssert($annualTwelveInstallments['access_interval_unit'] === 'year', 'Anual em 12x deve manter acesso em anos.');
    stripeBillingAssert($annualTwelveInstallments['access_interval_count'] === 1, 'Anual em 12x deve liberar 1 ano no primeiro pagamento.');
    stripeBillingAssert(abs($annualTwelveInstallments['cycle_charge_amount'] - 9.90) < 0.001, 'Anual em 12x deve cobrar 9,90 por parcela.');

    $quarterlyThreeInstallments = getStripeBillingTermConfig($quarterlyPlan, 39.90, 'term_recurring', 3);
    stripeBillingAssert($quarterlyThreeInstallments['charge_interval'] === 'month', 'Trimestral em 3x deve cobrar por mes-calendario.');
    stripeBillingAssert($quarterlyThreeInstallments['charge_interval_count'] === 1, 'Trimestral em 3x deve cobrar mensalmente.');

    $quarterlyRoundingProtection = getStripeBillingTermConfig($quarterlyPlan, 29.90, 'term_recurring', 3);
    stripeBillingAssert($quarterlyRoundingProtection['term_total_cents'] === 2990, 'Trimestral em 3x deve preservar o total contratado de 29,90.');
    stripeBillingAssert($quarterlyRoundingProtection['cycle_charge_cents'] === 997, 'Trimestral em 3x deve arredondar a parcela para cima.');
    stripeBillingAssert($quarterlyRoundingProtection['first_invoice_discount_cents'] === 1, 'Trimestral em 3x deve compensar 1 centavo na primeira fatura.');
    stripeBillingAssert($quarterlyRoundingProtection['first_invoice_charge_cents'] === 996, 'Primeira fatura trimestral em 3x deve fechar o total exato.');

    $annualRoundingProtection = getStripeBillingTermConfig($annualPlan, 119.77, 'term_recurring', 12);
    stripeBillingAssert($annualRoundingProtection['term_total_cents'] === 11977, 'Anual em 12x deve preservar o total contratado de 119,77.');
    stripeBillingAssert($annualRoundingProtection['cycle_charge_cents'] === 999, 'Anual em 12x deve arredondar a parcela para cima.');
    stripeBillingAssert($annualRoundingProtection['first_invoice_discount_cents'] === 11, 'Anual em 12x deve compensar a diferenca na primeira fatura.');
    stripeBillingAssert($annualRoundingProtection['first_invoice_charge_cents'] === 988, 'Primeira fatura anual em 12x deve fechar o total exato.');

    $quarterlyAccessDays = calculateSubscriptionPeriodRange(
        $quarterlyTwoInstallments['access_interval_unit'],
        $quarterlyTwoInstallments['access_interval_count']
    );
    stripeBillingAssert($quarterlyAccessDays['days'] === 90, 'Trimestral em 2x deve conceder 90 dias integrais.');

    $annualAccessDays = calculateSubscriptionPeriodRange(
        $annualTwelveInstallments['access_interval_unit'],
        $annualTwelveInstallments['access_interval_count']
    );
    stripeBillingAssert($annualAccessDays['days'] === 360, 'Anual em 12x deve conceder 360 dias integrais.');

    $testPlanSingleCharge = getStripeBillingTermConfig($testPlan, 2.00, 'single_installment', 1);
    stripeBillingAssert($testPlanSingleCharge['charge_interval'] === 'day', 'Plano teste deve cobrar em dias.');
    stripeBillingAssert($testPlanSingleCharge['charge_interval_count'] === 2, 'Plano teste deve manter ciclo de 2 dias na Stripe.');
    stripeBillingAssert($testPlanSingleCharge['access_interval_unit'] === 'day', 'Plano teste deve liberar acesso em dias.');
    stripeBillingAssert($testPlanSingleCharge['access_interval_count'] === 2, 'Plano teste deve liberar exatamente 2 dias.');

    $testPlanAccessDays = calculateSubscriptionPeriodRange(
        $testPlanSingleCharge['access_interval_unit'],
        $testPlanSingleCharge['access_interval_count']
    );
    stripeBillingAssert($testPlanAccessDays['days'] === 2, 'Plano teste nao pode cair no fallback mensal de 30/31 dias.');

    echo "StripeSubscriptionBillingTermTest: PASS\n";
} catch (Throwable $e) {
    fwrite(STDERR, "StripeSubscriptionBillingTermTest: FAIL - {$e->getMessage()}\n");
    exit(1);
}

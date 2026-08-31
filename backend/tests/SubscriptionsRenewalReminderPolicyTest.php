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

require_once __DIR__ . '/../modules/subscriptions/services/SubscriptionsBillingSupport.php';

putenv('APP_TIMEZONE=America/Sao_Paulo');

function renewalReminderPolicyAssert(bool $condition, string $message): void
{
    if (!$condition) {
        throw new RuntimeException($message);
    }
}

function renewalReminderPolicyAssertFileContains(string $path, string $needle, string $message): void
{
    $content = file_get_contents($path);
    if ($content === false || strpos($content, $needle) === false) {
        throw new RuntimeException($message . ' [' . $path . ']');
    }
}

function renewalReminderPolicyRow(string $intervalUnit, int $intervalCount, string $nextRenewalDate): array
{
    return [
        'interval_unit' => $intervalUnit,
        'interval_count' => $intervalCount,
        'next_renewal_date' => $nextRenewalDate,
    ];
}

$now = strtotime('2026-05-10 08:00:00');

$twoDayFiveDaysOut = resolveStripeRenewalReminderNotice(
    renewalReminderPolicyRow('day', 2, '2026-05-15 19:32:00'),
    $now
);
renewalReminderPolicyAssert(
    $twoDayFiveDaysOut === null,
    'Plano de 2 dias nao pode receber lembrete de renovacao em 5 dias.'
);

$fiveDayPlanFiveDaysOut = resolveStripeRenewalReminderNotice(
    renewalReminderPolicyRow('day', 5, '2026-05-15 19:32:00'),
    $now
);
renewalReminderPolicyAssert(
    $fiveDayPlanFiveDaysOut === null,
    'Plano de 5 dias tambem nao deve receber lembrete em 5 dias; ele deve ser reservado para ciclos maiores.'
);

$monthlyFiveDaysOut = resolveStripeRenewalReminderNotice(
    renewalReminderPolicyRow('month', 1, '2026-05-15 19:32:00'),
    $now
);
renewalReminderPolicyAssert(
    is_array($monthlyFiveDaysOut) && $monthlyFiveDaysOut['type'] === 'five_days',
    'Plano mensal deve receber o lembrete de 5 dias quando a data de renovacao estiver a 5 dias.'
);
renewalReminderPolicyAssert(
    $monthlyFiveDaysOut['template_key'] === 'subscription_renewal_reminder',
    'Lembrete de 5 dias deve usar o template editavel subscription_renewal_reminder.'
);

$twoDayTomorrow = resolveStripeRenewalReminderNotice(
    renewalReminderPolicyRow('day', 2, '2026-05-11 19:32:00'),
    $now
);
renewalReminderPolicyAssert(
    is_array($twoDayTomorrow) && $twoDayTomorrow['type'] === 'tomorrow',
    'Plano de 2 dias deve receber apenas o lembrete de amanha.'
);
renewalReminderPolicyAssert(
    $twoDayTomorrow['template_key'] === 'subscription_renewal_tomorrow',
    'Lembrete de amanha deve usar o template editavel subscription_renewal_tomorrow.'
);

$monthlyToday = resolveStripeRenewalReminderNotice(
    renewalReminderPolicyRow('month', 1, '2026-05-10 19:32:00'),
    $now
);
renewalReminderPolicyAssert(
    $monthlyToday === null,
    'Renovacao no proprio dia nao deve disparar o lembrete de amanha.'
);

$backendBase = dirname(__DIR__);
renewalReminderPolicyAssertFileContains(
    $backendBase . '/shared/utils/EmailTemplateResolver.php',
    "'subscription_renewal_tomorrow'",
    'Catalogo backend precisa expor o template editavel de renovacao amanha.'
);
renewalReminderPolicyAssertFileContains(
    $backendBase . '/modules/subscriptions/services/SubscriptionsService.php',
    'resolveStripeRenewalReminderNotice($subscriptionRow)',
    'Servico de assinaturas deve usar a politica centralizada de lembretes.'
);
renewalReminderPolicyAssertFileContains(
    $backendBase . '/modules/subscriptions/services/SubscriptionsService.php',
    'sendStripePaymentReceiptEmail',
    'Renovacoes materializadas por webhook/cron devem enviar recibo por email.'
);
renewalReminderPolicyAssertFileContains(
    $backendBase . '/modules/subscriptions/services/SubscriptionsService.php',
    'Assinatura renovada',
    'Renovacoes materializadas por webhook/cron devem gerar notificacao in-app especifica.'
);
renewalReminderPolicyAssertFileContains(
    $backendBase . '/modules/subscriptions/services/SubscriptionsService.php',
    'Stripe webhook payment notification warning',
    'Falha de persistencia da notificacao de renovacao precisa aparecer nos logs operacionais.'
);

fwrite(STDOUT, "Subscriptions renewal reminder policy assertions passed.\n");

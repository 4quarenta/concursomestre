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

require_once __DIR__ . '/../modules/admin/services/AdminAnalyticsService.php';

function adminAnalyticsWindowAssertSame($actual, $expected, string $message): void
{
    if ($actual !== $expected) {
        throw new RuntimeException($message . ' Esperado ' . var_export($expected, true) . ', recebido ' . var_export($actual, true) . '.');
    }
}

class AdminAnalyticsWindowFakeRepository extends AdminAnalyticsRepository
{
    public function __construct()
    {
    }
}

try {
    $service = new AdminAnalyticsService(new AdminAnalyticsWindowFakeRepository(), new AdminAnalyticsValidator());
    $resolveWindow = new ReflectionMethod($service, 'resolveWindow');
    $resolveWindow->setAccessible(true);
    $resolveTrendWindow = new ReflectionMethod($service, 'resolveTrendWindow');
    $resolveTrendWindow->setAccessible(true);

    foreach (['today', 'week', 'month', 'year'] as $period) {
        $window = $resolveWindow->invoke($service, [
            'period' => $period,
            'startDate' => null,
            'endDate' => null,
        ]);

        adminAnalyticsWindowAssertSame(substr((string) $window['startDateTime'], -8), '00:00:00', "O periodo {$period} deve iniciar no comeco do dia.");
        adminAnalyticsWindowAssertSame(substr((string) $window['endDateTime'], -8), '23:59:59', "O periodo {$period} deve terminar no fim do dia.");

        if ($period === 'year') {
            adminAnalyticsWindowAssertSame(substr((string) $window['startDateTime'], 8, 2), '01', 'O periodo anual deve iniciar no primeiro dia do mes inicial.');
        }

        $trendWindow = $resolveTrendWindow->invoke($service, $window);
        adminAnalyticsWindowAssertSame($trendWindow['currentEnd'], $window['endDateTime'], "A tendencia de {$period} deve usar o mesmo fim do filtro.");
    }

    $allWindow = $resolveWindow->invoke($service, [
        'period' => 'all',
        'startDate' => null,
        'endDate' => null,
    ]);
    adminAnalyticsWindowAssertSame($allWindow['startDateTime'], null, 'O periodo Tudo nao deve aplicar data inicial.');

    fwrite(STDOUT, "AdminAnalyticsWindowTest: PASS\n");
} catch (Throwable $e) {
    fwrite(STDERR, "AdminAnalyticsWindowTest: FAIL - {$e->getMessage()}\n");
    exit(1);
}

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

require_once __DIR__ . '/../modules/admin/services/AdminStatsService.php';

function adminStatsAssertAlmost(float $actual, float $expected, string $message): void
{
    if (abs($actual - $expected) > 0.001) {
        throw new RuntimeException($message . " Esperado {$expected}, recebido {$actual}.");
    }
}

function adminStatsAssertSame($actual, $expected, string $message): void
{
    if ($actual !== $expected) {
        throw new RuntimeException($message . ' Esperado ' . var_export($expected, true) . ', recebido ' . var_export($actual, true) . '.');
    }
}

class AdminStatsFakeRepository extends AdminStatsRepository
{
    public function __construct()
    {
    }

    public function fetchTransactions(string $dateCondition, array $params): array
    {
        adminStatsAssertSame($dateCondition, ' AND created_at BETWEEN :start AND :end', 'O recorte customizado deve usar limites explicitos.');
        adminStatsAssertSame($params[':start'] ?? null, '2000-01-01 00:00:00', 'Data inicial customizada invalida.');
        adminStatsAssertSame($params[':end'] ?? null, '2000-01-31 23:59:59', 'Data final customizada invalida.');

        return [
            ['amount' => 100.00, 'platform_fee' => 100.00, 'type' => 'plan', 'material_id' => null, 'created_at' => '2000-01-10 10:00:00', 'status' => 'completed'],
            ['amount' => 50.00, 'platform_fee' => 10.00, 'type' => 'material', 'material_id' => 7, 'created_at' => '2000-01-11 10:00:00', 'status' => 'approved'],
            ['amount' => 20.00, 'platform_fee' => 20.00, 'type' => 'plan', 'material_id' => null, 'created_at' => '2000-01-12 10:00:00', 'status' => 'refunded'],
            ['amount' => 80.00, 'platform_fee' => 16.00, 'type' => 'material', 'material_id' => 8, 'created_at' => '2000-01-13 10:00:00', 'status' => 'refund_requested'],
        ];
    }

    public function fetchSubscriptionStatusCounts(string $now): array
    {
        if (!preg_match('/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/', $now)) {
            throw new RuntimeException('Status de assinatura deve receber data/hora explicita.');
        }

        return [
            ['status' => 'active', 'count' => 2],
            ['status' => 'canceled', 'count' => 1],
            ['status' => 'expired', 'count' => 3],
            ['status' => 'trialing', 'count' => 1],
        ];
    }

    public function fetchActiveSubscriptionPlans(string $now): array
    {
        if (!preg_match('/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/', $now)) {
            throw new RuntimeException('MRR deve receber data/hora explicita.');
        }

        return [
            ['price' => 298.56, 'interval_unit' => 'year', 'interval_count' => 1, 'recurring_amount' => 9.95, 'total_installments' => 12],
            ['price' => 29.90, 'interval_unit' => 'month', 'interval_count' => 1, 'recurring_amount' => 29.90, 'total_installments' => 1],
        ];
    }

    public function countNewUsers(string $dateCondition, array $params): int
    {
        adminStatsAssertSame($dateCondition, ' AND created_at BETWEEN :start AND :end', 'Novos usuarios devem respeitar o recorte customizado.');
        adminStatsAssertSame($params[':start'] ?? null, '2000-01-01 00:00:00', 'Inicio de novos usuarios customizado invalido.');
        adminStatsAssertSame($params[':end'] ?? null, '2000-01-31 23:59:59', 'Fim de novos usuarios customizado invalido.');

        return 4;
    }

    public function countNewQuestions(string $dateCondition, array $params): int
    {
        adminStatsAssertSame($dateCondition, ' AND created_at BETWEEN :start AND :end', 'Novas questoes devem respeitar o recorte customizado.');
        adminStatsAssertSame($params[':start'] ?? null, '2000-01-01 00:00:00', 'Inicio de novas questoes customizado invalido.');
        adminStatsAssertSame($params[':end'] ?? null, '2000-01-31 23:59:59', 'Fim de novas questoes customizado invalido.');

        return 8;
    }

    public function fetchGlobalCounters(): array
    {
        return [
            'questions_count' => 10,
            'users_count' => 5,
            'materials_count' => 3,
            'rankings_count' => 2,
            'feedback_count' => 1,
        ];
    }
}

class AdminStatsAllPeriodFakeRepository extends AdminStatsRepository
{
    public function __construct()
    {
    }

    public function fetchTransactions(string $dateCondition, array $params): array
    {
        adminStatsAssertSame($dateCondition, '', 'O periodo Tudo nao deve filtrar transacoes por data.');
        adminStatsAssertSame($params, [], 'O periodo Tudo nao deve enviar parametros de data para transacoes.');

        return [];
    }

    public function fetchSubscriptionStatusCounts(string $now): array
    {
        return [];
    }

    public function fetchActiveSubscriptionPlans(string $now): array
    {
        return [];
    }

    public function countNewUsers(string $dateCondition, array $params): int
    {
        adminStatsAssertSame($dateCondition, '', 'O periodo Tudo deve contar usuarios no historico completo.');
        adminStatsAssertSame($params, [], 'O periodo Tudo nao deve aplicar parametros de data em usuarios.');

        return 44;
    }

    public function countNewQuestions(string $dateCondition, array $params): int
    {
        adminStatsAssertSame($dateCondition, '', 'O periodo Tudo deve contar questoes no historico completo.');
        adminStatsAssertSame($params, [], 'O periodo Tudo nao deve aplicar parametros de data em questoes.');

        return 88;
    }

    public function fetchGlobalCounters(): array
    {
        return [];
    }
}

class AdminStatsBoundedWindowFakeRepository extends AdminStatsRepository
{
    private string $period;

    public function __construct(string $period)
    {
        $this->period = $period;
    }

    private function assertBoundedWindow(string $dateCondition, array $params): void
    {
        adminStatsAssertSame($dateCondition, ' AND created_at BETWEEN :start AND :end', "O periodo {$this->period} deve usar limites explicitos.");
        $start = (string) ($params[':start'] ?? '');
        $end = (string) ($params[':end'] ?? '');
        adminStatsAssertSame(substr($start, -8), '00:00:00', "O periodo {$this->period} deve iniciar no começo do dia.");
        adminStatsAssertSame(substr($end, -8), '23:59:59', "O periodo {$this->period} deve terminar no fim do dia.");

        if ($this->period === 'year') {
            adminStatsAssertSame(substr($start, 8, 2), '01', 'O periodo anual deve iniciar no primeiro dia do mes inicial.');
        }
    }

    public function fetchTransactions(string $dateCondition, array $params): array
    {
        $this->assertBoundedWindow($dateCondition, $params);
        return [];
    }

    public function fetchSubscriptionStatusCounts(string $now): array
    {
        return [];
    }

    public function fetchActiveSubscriptionPlans(string $now): array
    {
        return [];
    }

    public function countNewUsers(string $dateCondition, array $params): int
    {
        $this->assertBoundedWindow($dateCondition, $params);
        return 0;
    }

    public function countNewQuestions(string $dateCondition, array $params): int
    {
        $this->assertBoundedWindow($dateCondition, $params);
        return 0;
    }

    public function fetchGlobalCounters(): array
    {
        return [];
    }
}

class AdminStatsPartialRefundFakeRepository extends AdminStatsRepository
{
    public function __construct()
    {
    }

    public function getConnection(): PDO
    {
        throw new RuntimeException('Ledger intentionally unavailable in aggregation fallback test.');
    }

    public function fetchTransactions(string $dateCondition, array $params): array
    {
        return [
            [
                'amount' => 100.00,
                'platform_fee' => 20.00,
                'type' => 'material',
                'material_id' => 7,
                'created_at' => '2000-01-10 10:00:00',
                'status' => 'partially_refunded',
                'refunded_amount' => 25.00,
            ],
        ];
    }

    public function fetchSubscriptionStatusCounts(string $now): array
    {
        return [];
    }

    public function fetchActiveSubscriptionPlans(string $now): array
    {
        return [];
    }

    public function countNewUsers(string $dateCondition, array $params): int
    {
        return 0;
    }

    public function countNewQuestions(string $dateCondition, array $params): int
    {
        return 0;
    }

    public function fetchGlobalCounters(): array
    {
        return [];
    }
}

try {
    $service = new AdminStatsService(new AdminStatsFakeRepository(), new AdminStatsValidator());
    $stats = $service->getStats('custom', '2000-01-01', '2000-01-31');

    adminStatsAssertAlmost((float) $stats['total_revenue'], 150.00, 'Receita deve considerar apenas transacoes pagas.');
    adminStatsAssertAlmost((float) $stats['available_total_revenue'], 150.00, 'Receita disponivel total deve vir do agregado canonico.');
    adminStatsAssertAlmost((float) $stats['subscription_revenue'], 100.00, 'Receita de assinatura deve excluir reembolsos e analise.');
    adminStatsAssertAlmost((float) $stats['marketplace_revenue'], 50.00, 'Receita de marketplace deve excluir reembolsos e analise.');
    adminStatsAssertAlmost((float) $stats['platform_revenue'], 110.00, 'Receita da plataforma deve usar taxa real por tipo.');
    adminStatsAssertAlmost((float) $stats['available_platform_revenue'], 110.00, 'Receita disponivel deve usar a mesma regra canonica.');
    adminStatsAssertAlmost((float) $stats['seller_payout'], 40.00, 'Repasse deve usar bruto menos taxa real.');
    adminStatsAssertAlmost((float) $stats['available_seller_payout'], 40.00, 'Repasse disponivel deve excluir apenas valores retidos.');
    adminStatsAssertAlmost((float) $stats['total_refunded'], 20.00, 'Reembolso efetivado deve ficar separado da receita.');
    adminStatsAssertAlmost((float) $stats['refund_requested_amount'], 80.00, 'Reembolso em analise deve ficar separado da receita.');
    adminStatsAssertSame($stats['refund_requests_count'], 1, 'Quantidade de reembolsos em analise incorreta.');
    adminStatsAssertSame($stats['transactions_count'], 2, 'Apenas transacoes pagas devem contar como venda.');
    adminStatsAssertAlmost((float) $stats['held_balance'], 0.00, 'Saldo retido deve respeitar garantia e virada do mes.');
    adminStatsAssertAlmost((float) $stats['total_paid'], 150.00, 'Total pago deve excluir reembolso e analise.');
    adminStatsAssertAlmost((float) $stats['mrr'], 39.85, 'MRR deve usar recorrencia real mensalizada.');
    adminStatsAssertSame($stats['active_subscriptions'], 2, 'Assinaturas ativas incorretas.');
    adminStatsAssertSame($stats['cancelled_subscriptions'], 1, 'Assinaturas canceladas incorretas.');
    adminStatsAssertSame($stats['expired_subscriptions'], 3, 'Assinaturas expiradas incorretas.');
    adminStatsAssertSame($stats['trial_subscriptions'], 1, 'Assinaturas em trial incorretas.');
    adminStatsAssertSame($stats['new_users'], 4, 'Novos usuarios customizados incorretos.');
    adminStatsAssertSame($stats['new_questions'], 8, 'Novas questoes customizadas incorretas.');

    $allStats = (new AdminStatsService(new AdminStatsAllPeriodFakeRepository(), new AdminStatsValidator()))->getStats('all', null, null);
    adminStatsAssertSame($allStats['new_users'], 44, 'Periodo Tudo deve contar usuarios do historico completo.');
    adminStatsAssertSame($allStats['new_questions'], 88, 'Periodo Tudo deve contar questoes do historico completo.');

    foreach (['today', 'week', 'month', 'year'] as $period) {
        (new AdminStatsService(new AdminStatsBoundedWindowFakeRepository($period), new AdminStatsValidator()))->getStats($period, null, null);
    }

    $partialRefundStats = (new AdminStatsService(new AdminStatsPartialRefundFakeRepository(), new AdminStatsValidator()))->getStats('all', null, null);
    adminStatsAssertAlmost((float) $partialRefundStats['total_revenue'], 75.00, 'Estorno parcial deve reduzir somente a parcela estornada da receita.');
    adminStatsAssertAlmost((float) $partialRefundStats['total_refunded'], 25.00, 'Estorno parcial deve aparecer separadamente no total estornado.');
    adminStatsAssertAlmost((float) $partialRefundStats['platform_revenue'], 15.00, 'Comissao deve ser proporcional ao valor restante apos estorno parcial.');
    adminStatsAssertAlmost((float) $partialRefundStats['seller_payout'], 60.00, 'Repasse deve refletir a parcela ainda reconhecida apos estorno parcial.');

    fwrite(STDOUT, "AdminStatsAggregationTest: PASS\n");
} catch (Throwable $e) {
    fwrite(STDERR, "AdminStatsAggregationTest: FAIL - {$e->getMessage()}\n");
    exit(1);
}

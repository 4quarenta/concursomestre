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

require_once __DIR__ . '/../repositories/AdminStatsRepository.php';
require_once __DIR__ . '/../validators/AdminStatsValidator.php';

/**
 * Servico do dashboard administrativo.
 * Consolida regras de agregacao sem acoplar a logica ao endpoint HTTP.
 */
class AdminStatsService
{
    private AdminStatsRepository $repository;
    private AdminStatsValidator $validator;

    /**
     * Inicializa o service do dashboard com repositorio e validador.
     *
     * @since 1.0.0
     */
    public function __construct(
        AdminStatsRepository $repository,
        AdminStatsValidator $validator
    ) {
        $this->repository = $repository;
        $this->validator = $validator;
    }

    /**
     * Monta o painel de metricas administrativas conforme periodo filtrado.
     *
     * @since 1.0.0
     */
    public function getStats(?string $period, ?string $startDate, ?string $endDate): array
    {
        $filters = $this->validator->validateFilters($period, $startDate, $endDate);
        [$dateCondition, $params] = $this->buildDateCondition($filters);
        $timezone = new DateTimeZone('America/Sao_Paulo');
        $metricsNow = new DateTimeImmutable('now', $timezone);
        $metricsNowSql = $metricsNow->format('Y-m-d H:i:s');

        $response = [
            'total_revenue' => 0,
            'available_total_revenue' => 0,
            'platform_revenue' => 0,
            'subscription_revenue' => 0,
            'available_subscription_revenue' => 0,
            'marketplace_revenue' => 0,
            'active_subscriptions' => 0,
            'cancelled_subscriptions' => 0,
            'expired_subscriptions' => 0,
            'trial_subscriptions' => 0,
            'mrr' => 0,
            'new_users' => 0,
            'new_questions' => 0,
            'seller_payout' => 0,
            'available_seller_payout' => 0,
            'transactions_count' => 0,
            'refund_requests_count' => 0,
            'refund_requested_amount' => 0,
            'total_refunded' => 0,
            'held_balance' => 0,
            'total_paid' => 0,
            'feedback_count' => 0,
            'questions_count' => 0,
            'users_count' => 0,
            'materials_count' => 0,
            'pending_materials_count' => 0,
            'rankings_count' => 0,
            'available_platform_revenue' => 0,
        ];

        $transactions = $this->repository->fetchTransactions($dateCondition, $params);

        $totalVolume = 0.0;
        $subscriptionRevenue = 0.0;
        $availableSubscriptionRevenue = 0.0;
        $marketplaceRevenue = 0.0;
        $platformCommission = 0.0;
        $availablePlatformCommission = 0.0;
        $sellerPayout = 0.0;
        $availableSellerPayout = 0.0;
        $totalRefunded = 0.0;
        $refundRequestedAmount = 0.0;
        $heldBalance = 0.0;
        $totalPaid = 0.0;
        $validTransactionsCount = 0;

        $now = $metricsNow->getTimestamp();
        $sevenDaysAgo = $now - (7 * 24 * 60 * 60);

        foreach ($transactions as $transaction) {
            $amount = (float) $transaction['amount'];
            $platformFee = (float) ($transaction['platform_fee'] ?? 0);
            $normalizedStatus = $this->normalizeTransactionStatus($transaction);

            if ($normalizedStatus === 'refunded') {
                $totalRefunded += $amount;
                continue;
            }

            if ($normalizedStatus === 'refund_requested') {
                $refundRequestedAmount += $amount;
                $response['refund_requests_count']++;
                continue;
            }

            if (!in_array($normalizedStatus, ['completed', 'approved'], true)) {
                continue;
            }

            $validTransactionsCount++;
            $totalVolume += $amount;

            $isSubscription = (($transaction['type'] ?? '') === 'plan' || ($transaction['type'] ?? '') === 'subscription')
                || (empty($transaction['type']) && empty($transaction['material_id']));

            $createdAt = new DateTimeImmutable((string) $transaction['created_at'], $timezone);
            $passedWarranty = $createdAt->getTimestamp() < $sevenDaysAgo;
            $currentMonth = (int) $metricsNow->format('m');
            $currentYear = (int) $metricsNow->format('Y');
            $transactionMonth = (int) $createdAt->format('m');
            $transactionYear = (int) $createdAt->format('Y');
            $isPastDay1OfNextMonth = ($currentYear > $transactionYear) || ($currentYear === $transactionYear && $currentMonth > $transactionMonth);
            $isHeld = !($passedWarranty && $isPastDay1OfNextMonth);
            if ($isSubscription) {
                $subscriptionRevenue += $amount;
                $subscriptionPlatformRevenue = $platformFee > 0.0 ? $platformFee : $amount;
                $platformCommission += $subscriptionPlatformRevenue;
                if (!$isHeld) {
                    $availableSubscriptionRevenue += $amount;
                    $availablePlatformCommission += $subscriptionPlatformRevenue;
                }
            } else {
                $marketplaceRevenue += $amount;
                if ($platformFee === 0.0 && $amount > 0) {
                    $platformFee = $amount * 0.20;
                }

                $platformCommission += $platformFee;
                if (!$isHeld) {
                    $availablePlatformCommission += $platformFee;
                }

                $sellerShare = $amount - $platformFee;
                $sellerPayout += $sellerShare;
                if (!$isHeld) {
                    $availableSellerPayout += $sellerShare;
                }
            }

            if ($isHeld) {
                $heldBalance += $amount;
            }

            $totalPaid += $amount;
        }

        $response['total_revenue'] = round($totalVolume, 2);
        $response['available_total_revenue'] = round(max(0.0, $totalVolume - $heldBalance), 2);
        $response['subscription_revenue'] = round($subscriptionRevenue, 2);
        $response['available_subscription_revenue'] = round($availableSubscriptionRevenue, 2);
        $response['marketplace_revenue'] = round($marketplaceRevenue, 2);
        $response['platform_revenue'] = round($platformCommission, 2);
        $response['available_platform_revenue'] = round($availablePlatformCommission, 2);
        $response['seller_payout'] = round($sellerPayout, 2);
        $response['available_seller_payout'] = round($availableSellerPayout, 2);
        $response['transactions_count'] = $validTransactionsCount;
        $response['refund_requested_amount'] = round($refundRequestedAmount, 2);
        $response['total_refunded'] = round($totalRefunded, 2);
        $response['held_balance'] = round($heldBalance, 2);
        $response['total_paid'] = round($totalPaid, 2);

        foreach ($this->repository->fetchSubscriptionStatusCounts($metricsNowSql) as $row) {
            if (($row['status'] ?? '') === 'active') {
                $response['active_subscriptions'] = (int) $row['count'];
            }
            if (in_array((string) ($row['status'] ?? ''), ['canceled', 'cancelled'], true)) {
                $response['cancelled_subscriptions'] = (int) $row['count'];
            }
            if (($row['status'] ?? '') === 'expired') {
                $response['expired_subscriptions'] = (int) $row['count'];
            }
            if (($row['status'] ?? '') === 'trialing') {
                $response['trial_subscriptions'] = (int) $row['count'];
            }
        }

        $mrr = 0.0;
        foreach ($this->repository->fetchActiveSubscriptionPlans($metricsNowSql) as $subscription) {
            $mrr += $this->monthlyizeSubscriptionAmount($subscription);
        }
        $response['mrr'] = round($mrr, 2);

        if ($dateCondition !== '') {
            $response['new_users'] = $this->repository->countNewUsers($dateCondition, $params);
            $response['new_questions'] = $this->repository->countNewQuestions($dateCondition, $params);
        } else {
            $response['new_users'] = $this->repository->countNewUsers('', []);
            $response['new_questions'] = $this->repository->countNewQuestions('', []);
        }

        foreach ($this->repository->fetchGlobalCounters() as $key => $value) {
            $response[$key] = $value;
        }

        return $response;
    }

    private function normalizeTransactionStatus(array $transaction): string
    {
        if (
            trim((string) ($transaction['provider_refund_id'] ?? '')) !== ''
            || trim((string) ($transaction['refunded_at'] ?? '')) !== ''
        ) {
            return 'refunded';
        }

        $status = strtolower(trim((string) ($transaction['status'] ?? '')));
        if ($status === 'canceled') {
            return 'cancelled';
        }
        if ($status === 'succeeded' || $status === 'paid') {
            return 'approved';
        }

        return $status;
    }

    /**
     * Monta a clausula de data baseada no filtro selecionado.
     *
     * @return array{0:string,1:array<string,string>}
     *
     * @since 1.0.0
     */
    private function buildDateCondition(array $filters): array
    {
        $period = $filters['period'];
        $timezone = new DateTimeZone('America/Sao_Paulo');
        $now = new DateTimeImmutable('now', $timezone);

        if ($period === 'custom' && $filters['startDate'] && $filters['endDate']) {
            $start = new DateTimeImmutable($filters['startDate'] . ' 00:00:00', $timezone);
            $end = new DateTimeImmutable($filters['endDate'] . ' 23:59:59', $timezone);

            return [
                ' AND created_at BETWEEN :start AND :end',
                [
                    ':start' => $start->format('Y-m-d H:i:s'),
                    ':end' => $end->format('Y-m-d H:i:s'),
                ],
            ];
        }

        switch ($period) {
            case 'today':
                return $this->buildBoundedDateCondition(
                    $now->setTime(0, 0, 0),
                    $now->setTime(23, 59, 59)
                );
            case 'week':
                return $this->buildBoundedDateCondition(
                    $now->setTime(0, 0, 0)->modify('-6 days'),
                    $now->setTime(23, 59, 59)
                );
            case 'month':
                return $this->buildBoundedDateCondition(
                    $now->setTime(0, 0, 0)->modify('-29 days'),
                    $now->setTime(23, 59, 59)
                );
            case 'year':
                return $this->buildBoundedDateCondition(
                    $now->modify('first day of this month')->setTime(0, 0, 0)->modify('-11 months'),
                    $now->setTime(23, 59, 59)
                );
            default:
                return ['', []];
        }
    }

    /**
     * Retorna uma condicao SQL com limites explicitos no timezone de Sao Paulo.
     *
     * @return array{0:string,1:array<string,string>}
     *
     * @since 1.0.0
     */
    private function buildBoundedDateCondition(DateTimeImmutable $start, DateTimeImmutable $end): array
    {
        return [
            ' AND created_at BETWEEN :start AND :end',
            [
                ':start' => $start->format('Y-m-d H:i:s'),
                ':end' => $end->format('Y-m-d H:i:s'),
            ],
        ];
    }

    /**
     * Mensaliza a receita recorrente usando o valor real salvo na assinatura.
     *
     * @since 1.0.0
     */
    private function monthlyizeSubscriptionAmount(array $subscription): float
    {
        $planPrice = max(0.0, (float) ($subscription['price'] ?? 0));
        $recurringAmount = max(0.0, (float) ($subscription['recurring_amount'] ?? 0));
        $intervalUnit = strtolower((string) ($subscription['interval_unit'] ?? 'month'));
        $intervalCount = max(1, (int) ($subscription['interval_count'] ?? 1));
        $installments = max(1, (int) ($subscription['total_installments'] ?? 1));

        $termMonths = $this->intervalToMonths($intervalUnit, $intervalCount);

        if ($recurringAmount > 0.0) {
            return $termMonths > 0
                ? ($recurringAmount * $installments) / $termMonths
                : $recurringAmount;
        }

        return $termMonths > 0 ? $planPrice / $termMonths : $planPrice;
    }

    /**
     * Converte ciclos recorrentes para meses aproximados para MRR.
     *
     * @since 1.0.0
     */
    private function intervalToMonths(string $intervalUnit, int $intervalCount): float
    {
        $safeCount = max(1, $intervalCount);

        return match ($intervalUnit) {
            'day' => ($safeCount / 30.4375),
            'week' => (($safeCount * 7) / 30.4375),
            'year' => (12 * $safeCount),
            default => $safeCount,
        };
    }
}

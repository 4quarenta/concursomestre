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

require_once __DIR__ . '/../repositories/AdminAnalyticsRepository.php';
require_once __DIR__ . '/../validators/AdminAnalyticsValidator.php';
require_once __DIR__ . '/../../subscriptions/services/SubscriptionsBillingSupport.php';
require_once __DIR__ . '/../../finance/services/FinancialLedger.php';
require_once __DIR__ . '/../../../config/notification_helper.php';

/**
 * Service analitico do admin.
 * Consolida funil, SaaS metrics e segmentos acionaveis usando Stripe + eventos first-party.
 *
 * @since 1.0.0
 */
class AdminAnalyticsService
{
    private const TRACKED_FUNNEL_EVENTS = [
        'identifiable_visit',
        'signup_started',
        'email_captured',
        'signup_completed',
        'checkout_started',
        'plan_viewed',
        'payment_method_started',
        'checkout_abandoned',
        'purchase_completed',
        'payment_failed',
        'renewal_upcoming',
        'renewal_completed',
        'subscription_cancelled',
        'subscription_reactivated',
    ];

    public function __construct(
        private readonly AdminAnalyticsRepository $repository,
        private readonly AdminAnalyticsValidator $validator
    ) {
    }

    public function getFinanceAnalytics(?string $period, ?string $startDate, ?string $endDate): array
    {
        $filters = $this->validator->validateFilters($period, $startDate, $endDate);
        $window = $this->resolveWindow($filters);
        $events = $this->repository->fetchLifecycleEvents(
            $window['startDateTime'],
            $window['endDateTime'],
            self::TRACKED_FUNNEL_EVENTS
        );
        $transactions = $this->repository->fetchTransactions($window['startDateTime'], $window['endDateTime']);
        $projectionTransactions = $this->repository->fetchTransactions();
        $subscriptions = $this->repository->fetchSubscriptionsWithPlansAndUsers();
        $ledgerSummary = null;
        try {
            $ledgerSummary = FinancialLedger::summarize(
                $this->repository->getConnection(),
                $window['startDateTime'],
                $window['endDateTime']
            );
        } catch (Throwable) {
            // Non-production report fakes and installs pending the additive
            // migration retain the legacy aggregation for read-only reports.
            $ledgerSummary = null;
        }
        $userDirectory = $this->indexUsers($this->repository->fetchUserDirectory());
        $journeys = $this->buildLeadJourneys($events, $userDirectory);

        $summary = $this->buildFinanceSummary(
            $events,
            $transactions,
            $subscriptions,
            $projectionTransactions,
            $ledgerSummary
        );
        $funnel = $this->buildFunnel($events);
        $funnelDetails = $this->buildFunnelDetails($journeys);
        $conversionByCycle = $this->buildConversionByCycle($events, $subscriptions);
        $billingHealth = $this->buildBillingHealth($events, $transactions, $subscriptions);
        $cohorts = $this->buildCohorts($journeys, $subscriptions);
        $revenueProjection = $this->buildConfirmedRevenueProjection($subscriptions, $projectionTransactions);

        return [
            'period' => $filters['period'],
            'range' => [
                'startDate' => $window['startDateTime'],
                'endDate' => $window['endDateTime'],
            ],
            'summary' => $summary,
            'funnel' => $funnel,
            'funnelDetails' => $funnelDetails,
            'conversionByCycle' => $conversionByCycle,
            'billingHealth' => $billingHealth,
            'cohorts' => $cohorts,
            'revenueProjection' => $revenueProjection,
        ];
    }

    public function sendBillingRiskEmail(array $payload): array
    {
        $userId = trim((string) ($payload['userId'] ?? ''));
        if ($userId === '') {
            throw new InvalidArgumentException('Usuario invalido para envio de recuperacao de cobranca.');
        }

        $subscriptions = $this->repository->fetchSubscriptionsWithPlansAndUsers();
        $events = $this->repository->fetchLifecycleEvents(null, null, self::TRACKED_FUNNEL_EVENTS);
        $riskRows = $this->buildBillingRiskRows($events, $subscriptions);
        $riskRow = null;

        foreach ($riskRows as $row) {
            if ((string) ($row['userId'] ?? '') === $userId) {
                $riskRow = $row;
                break;
            }
        }

        if (!$riskRow) {
            throw new OutOfBoundsException('Este usuario nao possui risco de cobranca ativo no momento.');
        }

        $subscription = null;
        foreach ($subscriptions as $candidate) {
            if ((string) ($candidate['id'] ?? '') === (string) ($riskRow['subscriptionId'] ?? '')) {
                $subscription = $candidate;
                break;
            }
        }

        if (!$subscription) {
            foreach ($subscriptions as $candidate) {
                if ((string) ($candidate['user_id'] ?? '') === $userId) {
                    $subscription = $candidate;
                    break;
                }
            }
        }

        $email = trim((string) ($riskRow['userEmail'] ?? $subscription['user_email'] ?? ''));
        if ($email === '') {
            throw new InvalidArgumentException('Este usuario nao possui email cadastrado para envio.');
        }

        $db = $this->repository->getConnection();
        $user = [
            'id' => $userId,
            'name' => (string) ($riskRow['userName'] ?? $subscription['user_name'] ?? 'assinante'),
            'email' => $email,
        ];
        $invoiceContext = [
            'amount' => $this->resolveSubscriptionOpenAmount($subscription ?? []),
            'due_date' => (string) (
                $subscription['next_billing_at']
                ?? $subscription['current_period_end']
                ?? $subscription['provider_current_period_end']
                ?? ''
            ),
        ];

        $this->sendBillingRiskRecoveryEmail($db, $user, $subscription ?? [], $riskRow, $invoiceContext);

        createNotification(
            $db,
            $userId,
            'Atualize seus dados de pagamento',
            (string) ($riskRow['reason'] ?? 'Sua assinatura precisa de atencao. Atualize ou troque o cartao salvo para manter o acesso.'),
            in_array((string) ($riskRow['severity'] ?? ''), ['blocking', 'error'], true) ? 'error' : 'warning',
            'billing',
            '/profile/personal#saved-cards-personal-section',
            'subscription_payment_method_update'
        );

        return [
            'sent' => true,
            'userId' => $userId,
            'email' => $email,
            'reason' => (string) ($riskRow['reason'] ?? ''),
        ];
    }

    public function getDashboardAnalytics(?string $period, ?string $startDate, ?string $endDate): array
    {
        $filters = $this->validator->validateFilters($period, $startDate, $endDate);
        $window = $this->resolveWindow($filters);
        $trendWindow = $this->resolveTrendWindow($window);
        $platformCounts = $this->repository->fetchPlatformCounts();
        $events = $this->repository->fetchLifecycleEvents(
            $window['startDateTime'],
            $window['endDateTime'],
            self::TRACKED_FUNNEL_EVENTS
        );
        $transactions = $this->repository->fetchTransactions($window['startDateTime'], $window['endDateTime']);
        $subscriptions = $this->repository->fetchSubscriptionsWithPlansAndUsers();

        $counts = array_merge($platformCounts, [
            'refund_requests_count' => $this->countTransactionsByStatus($transactions, 'refund_requested'),
            'failed_payments_count' => $this->countDistinctLeadsForEvents($events, ['payment_failed']),
            'past_due_subscribers_count' => $this->countSubscriptionsByStatuses($subscriptions, ['past_due']),
        ]);

        $trends = [
            $this->buildTrendItem(
                'users',
                'Usuarios',
                $this->repository->countCreatedInWindow('users', 'created_at', $trendWindow['currentStart'], $trendWindow['currentEnd']),
                $this->repository->countCreatedInWindow('users', 'created_at', $trendWindow['previousStart'], $trendWindow['previousEnd'])
            ),
            $this->buildTrendItem(
                'materials',
                'Materiais',
                $this->repository->countCreatedInWindow('materials', 'created_at', $trendWindow['currentStart'], $trendWindow['currentEnd']),
                $this->repository->countCreatedInWindow('materials', 'created_at', $trendWindow['previousStart'], $trendWindow['previousEnd'])
            ),
            $this->buildTrendItem(
                'questions',
                'Questoes',
                $this->repository->countCreatedInWindow('questions', 'created_at', $trendWindow['currentStart'], $trendWindow['currentEnd']),
                $this->repository->countCreatedInWindow('questions', 'created_at', $trendWindow['previousStart'], $trendWindow['previousEnd'])
            ),
            $this->buildTrendItem(
                'laws',
                'Leis',
                $this->repository->countCreatedInWindow('laws', 'created_at', $trendWindow['currentStart'], $trendWindow['currentEnd']),
                $this->repository->countCreatedInWindow('laws', 'created_at', $trendWindow['previousStart'], $trendWindow['previousEnd'])
            ),
            $this->buildTrendItem(
                'comments',
                'Comentarios',
                $this->repository->countUnifiedCommentsCreatedInWindow($trendWindow['currentStart'], $trendWindow['currentEnd']),
                $this->repository->countUnifiedCommentsCreatedInWindow($trendWindow['previousStart'], $trendWindow['previousEnd'])
            ),
        ];

        $funnel = $this->buildFunnel($events);
        $billingHealth = $this->buildBillingHealth($events, $transactions, $subscriptions);
        $insights = $this->buildDashboardInsights($counts, $trends, $funnel, $billingHealth);

        return [
            'period' => $filters['period'],
            'counts' => $counts,
            'trends' => $trends,
            'insights' => $insights,
            'funnelSummary' => $funnel,
            'billingHealth' => $billingHealth,
        ];
    }

    public function getFunnelAnalytics(?string $period, ?string $startDate, ?string $endDate): array
    {
        $filters = $this->validator->validateFilters($period, $startDate, $endDate);
        $window = $this->resolveWindow($filters);
        $events = $this->repository->fetchLifecycleEvents(
            $window['startDateTime'],
            $window['endDateTime'],
            self::TRACKED_FUNNEL_EVENTS
        );
        $subscriptions = $this->repository->fetchSubscriptionsWithPlansAndUsers();
        $userDirectory = $this->indexUsers($this->repository->fetchUserDirectory());
        $journeys = $this->buildLeadJourneys($events, $userDirectory);

        return [
            'period' => $filters['period'],
            'range' => [
                'startDate' => $window['startDateTime'],
                'endDate' => $window['endDateTime'],
            ],
            'funnel' => $this->buildFunnel($events),
            'funnelDetails' => $this->buildFunnelDetails($journeys),
            'conversionByCycle' => $this->buildConversionByCycle($events, $subscriptions),
        ];
    }

    public function getSegments(?string $period, ?string $startDate, ?string $endDate): array
    {
        $filters = $this->validator->validateFilters($period, $startDate, $endDate);
        $window = $this->resolveWindow($filters);
        $events = $this->repository->fetchLifecycleEvents(null, null, self::TRACKED_FUNNEL_EVENTS);
        $subscriptions = $this->repository->fetchSubscriptionsWithPlansAndUsers();
        $users = $this->repository->fetchUserDirectory();
        $userDirectory = $this->indexUsers($users);
        $activeSubscriptionLookup = $this->buildActiveSubscriptionLookup($subscriptions);
        $now = $this->now();

        $segments = [
            $this->buildLeadSegment(
                'almost_signed_up',
                'Quase cadastrou',
                $this->collectAlmostSignedUpLeads($events, $userDirectory, $activeSubscriptionLookup)
            ),
            $this->buildLeadSegment(
                'almost_purchased',
                'Quase comprou',
                $this->collectAlmostPurchasedLeads($events, $userDirectory, $activeSubscriptionLookup)
            ),
            $this->buildLeadSegment(
                'checkout_abandoned',
                'Checkout abandonado',
                $this->collectCheckoutAbandonedLeads($events, $userDirectory, $activeSubscriptionLookup)
            ),
            $this->buildLeadSegment(
                'payment_failed',
                'Pagamento falhou',
                $this->collectPaymentFailedLeads($events, $userDirectory)
            ),
            $this->buildLeadSegment(
                'renewal_upcoming',
                'Renovacao em 5 dias',
                $this->collectRenewalUpcomingLeads($subscriptions, $userDirectory, $now)
            ),
            $this->buildLeadSegment(
                'cancelled_recently',
                'Cancelou recentemente',
                $this->collectCancelledRecentlyLeads($events, $userDirectory, $now)
            ),
            $this->buildLeadSegment(
                'active_without_subscription',
                'Ativo sem assinatura',
                $this->collectActiveWithoutSubscriptionLeads($events, $subscriptions, $userDirectory, $now)
            ),
            $this->buildLeadSegment(
                'subscriber_at_risk',
                'Assinante com risco de churn',
                $this->collectSubscriberAtRiskLeads($subscriptions, $userDirectory)
            ),
        ];

        return [
            'period' => $filters['period'],
            'range' => [
                'startDate' => $window['startDateTime'],
                'endDate' => $window['endDateTime'],
            ],
            'segments' => $segments,
        ];
    }

    public function exportFunnelLeads(?string $period, ?string $startDate, ?string $endDate): array
    {
        $filters = $this->validator->validateFilters($period, $startDate, $endDate);
        $window = $this->resolveWindow($filters);
        $events = $this->repository->fetchLifecycleEvents(
            $window['startDateTime'],
            $window['endDateTime'],
            self::TRACKED_FUNNEL_EVENTS
        );
        $userDirectory = $this->indexUsers($this->repository->fetchUserDirectory());
        $journeys = array_values($this->buildLeadJourneys($events, $userDirectory));

        usort($journeys, static fn(array $left, array $right): int => strcmp(
            (string) ($right['lastEventAt'] ?? ''),
            (string) ($left['lastEventAt'] ?? '')
        ));

        return array_map(static function (array $journey): array {
            return [
                'leadKey' => $journey['leadKey'] ?? '',
                'email' => $journey['email'] ?? '',
                'name' => $journey['name'] ?? '',
                'userId' => $journey['userId'] ?? '',
                'referrer' => $journey['referrerLabel'] ?? '',
                'originUrl' => $journey['originUrl'] ?? '',
                'utmSource' => $journey['utmSource'] ?? '',
                'utmMedium' => $journey['utmMedium'] ?? '',
                'utmCampaign' => $journey['utmCampaign'] ?? '',
                'currentStage' => $journey['currentStage'] ?? '',
                'createdAccount' => !empty($journey['createdAccount']) ? 'sim' : 'nao',
                'checkoutStarted' => !empty($journey['checkoutStarted']) ? 'sim' : 'nao',
                'paymentStarted' => !empty($journey['paymentStarted']) ? 'sim' : 'nao',
                'purchased' => !empty($journey['purchased']) ? 'sim' : 'nao',
                'firstEventAt' => $journey['firstEventAt'] ?? '',
                'lastEventAt' => $journey['lastEventAt'] ?? '',
            ];
        }, $journeys);
    }

    public function exportSegments(?string $period, ?string $startDate, ?string $endDate, ?string $segmentKey = null): array
    {
        $payload = $this->getSegments($period, $startDate, $endDate);
        $segments = array_values(array_filter(
            $payload['segments'] ?? [],
            static fn(array $segment): bool => $segmentKey === null || $segmentKey === '' || ($segment['key'] ?? '') === $segmentKey
        ));

        $rows = [];
        foreach ($segments as $segment) {
            foreach (($segment['items'] ?? []) as $item) {
                $rows[] = [
                    'segmentKey' => $segment['key'] ?? '',
                    'segmentLabel' => $segment['label'] ?? '',
                    'email' => $item['email'] ?? '',
                    'name' => $item['name'] ?? '',
                    'userId' => $item['userId'] ?? '',
                    'lastEventAt' => $item['lastEventAt'] ?? '',
                    'notes' => $item['notes'] ?? '',
                ];
            }
        }

        return $rows;
    }

    private function buildFinanceSummary(
        array $events,
        array $transactions,
        array $subscriptions,
        array $projectionTransactions = [],
        ?array $ledgerSummary = null
    ): array
    {
        $totalRevenue = 0.0;
        $paidTransactionsCount = 0;
        $refundRequestedAmount = 0.0;
        $refundedAmount = 0.0;

        foreach ($transactions as $transaction) {
            $status = $this->normalizeTransactionStatus($transaction);
            $amount = (float) ($transaction['amount'] ?? 0);

            if (in_array($status, ['completed', 'approved'], true)) {
                $totalRevenue += $amount;
                $paidTransactionsCount++;
            } elseif ($status === 'refund_requested') {
                $refundRequestedAmount += $amount;
            } elseif ($status === 'partially_refunded') {
                $refundedPartialAmount = min($amount, max(0.0, (float) ($transaction['refunded_amount'] ?? 0)));
                $totalRevenue += max(0.0, $amount - $refundedPartialAmount);
                $paidTransactionsCount++;
                $refundedAmount += $refundedPartialAmount;
            } elseif ($status === 'refunded') {
                $refundedAmount += $amount;
            }
        }

        if (is_array($ledgerSummary)) {
            $totalRevenue = (float) ($ledgerSummary['recognized_gross'] ?? 0);
            $paidTransactionsCount = (int) ($ledgerSummary['captured_transactions'] ?? 0);
            $refundedAmount = (float) ($ledgerSummary['refunded_amount'] ?? 0);
        }

        $activeSubscribers = $this->countSubscriptionsByStatuses($subscriptions, ['active', 'trialing']);
        $pastDueSubscribers = $this->countSubscriptionsByStatuses($subscriptions, ['past_due']);
        $churnedSubscribers = $this->countDistinctLeadsForEvents($events, ['subscription_cancelled']);
        $recoveredSubscribers = $this->countRecoveredLeads($events);
        $mrr = $this->calculateMrr($subscriptions);
        $arr = $mrr * 12;
        $avgTicket = $paidTransactionsCount > 0 ? $totalRevenue / $paidTransactionsCount : 0.0;
        $churnBase = max(1, $activeSubscribers + $churnedSubscribers);
        $churnRate = ($churnedSubscribers / $churnBase) * 100;
        $arpa = $activeSubscribers > 0 ? $mrr / $activeSubscribers : 0.0;
        $ltvOperational = $churnRate > 0 ? $arpa / ($churnRate / 100) : $arpa;
        $projection = $this->buildConfirmedRevenueProjection($subscriptions, $projectionTransactions);

        return [
            'totalRevenue' => round($totalRevenue, 2),
            'grossCapturedAmount' => round((float) ($ledgerSummary['gross_captured'] ?? $totalRevenue), 2),
            'financeSource' => is_array($ledgerSummary) ? 'ledger' : 'transactions_legacy',
            'mrr' => round($mrr, 2),
            'arr' => round($arr, 2),
            'projectedConfirmedRevenue' => $projection['totalProjectedAmount'],
            'projectedRemainingInstallments' => $projection['totalRemainingInstallments'],
            'activeSubscribers' => $activeSubscribers,
            'churnedSubscribers' => $churnedSubscribers,
            'churnRate' => round($churnRate, 2),
            'pastDueSubscribers' => $pastDueSubscribers,
            'recoveredSubscribers' => $recoveredSubscribers,
            'avgTicket' => round($avgTicket, 2),
            'ltvOperational' => round($ltvOperational, 2),
            'refundRequestedAmount' => round($refundRequestedAmount, 2),
            'refundedAmount' => round($refundedAmount, 2),
        ];
    }

    private function buildConfirmedRevenueProjection(array $subscriptions, array $transactions = []): array
    {
        $items = [];
        $breakdown = [];
        $monthlyBreakdown = [];
        $overduePayments = [];
        $totalProjectedAmount = 0.0;
        $totalRemainingInstallments = 0;
        $atRiskProjectedAmount = 0.0;
        $overduePaymentAmount = 0.0;
        $now = new \DateTimeImmutable();
        $paidEvidenceLookup = $this->buildProjectionPaidEvidenceLookup($transactions);

        foreach ($subscriptions as $subscription) {
            $status = strtolower((string) ($subscription['status'] ?? ''));
            $totalInstallments = max(1, (int) ($subscription['total_installments'] ?? 1));
            $cycleMetadataInstallments = $totalInstallments;
            $paidInstallments = max(0, (int) ($subscription['paid_installments'] ?? 0));
            $remainingInstallments = max(0, $totalInstallments - $paidInstallments);
            $autoRenew = (int) ($subscription['auto_renew'] ?? 0) === 1;
            $cancelAtPeriodEnd = (int) ($subscription['cancel_at_period_end'] ?? 0) === 1;

            if (!in_array($status, ['active', 'trialing', 'past_due', 'canceled', 'cancelled'], true)) {
                continue;
            }

            if ($this->shouldSkipRevenueProjectionForSubscription($subscription)) {
                continue;
            }

            $isCancelledWithOpenContract = in_array($status, ['canceled', 'cancelled'], true) && $remainingInstallments > 0;
            if ($isCancelledWithOpenContract && !$this->subscriptionHasProjectionPaidEvidence($subscription, $paidEvidenceLookup)) {
                continue;
            }
            if (!$isCancelledWithOpenContract && in_array($status, ['canceled', 'cancelled'], true)) {
                continue;
            }

            $isRecurringRenewal = $autoRenew && !$cancelAtPeriodEnd && in_array($status, ['active', 'trialing'], true);
            $projectionCycles = $remainingInstallments;
            $projectionMode = 'installments';

            if ($totalInstallments <= 1 || $remainingInstallments <= 0) {
                if (!$isRecurringRenewal) {
                    continue;
                }

                $projectionCycles = 12;
                $remainingInstallments = 12;
                $paidInstallments = 0;
                $totalInstallments = 12;
                $projectionMode = 'auto_renew';
            }

            if ($projectionCycles <= 0) {
                continue;
            }

            $recurringAmount = max(0.0, (float) ($subscription['recurring_amount'] ?? 0));
            $planPrice = max(0.0, (float) ($subscription['price'] ?? 0));
            $installmentAmount = $recurringAmount > 0.0
                ? $recurringAmount
                : ($totalInstallments > 0 ? $planPrice / $totalInstallments : $planPrice);

            $cycleKey = $this->normalizeCycleLabel(
                (string) ($subscription['cycle_label'] ?? ''),
                [
                    'interval_unit' => $subscription['interval_unit'] ?? null,
                    'interval_count' => $subscription['interval_count'] ?? null,
                    'total_installments' => $cycleMetadataInstallments,
                ]
            );
            $cycleLabel = $this->formatCycleLabel($cycleKey);

            $baseDate = $this->parseProjectionDate(
                $subscription['next_billing_at']
                    ?? $subscription['provider_current_period_end']
                    ?? $subscription['current_period_end']
                    ?? $subscription['next_renewal_date']
                    ?? null
            );
            $planIntervalUnit = strtolower((string) ($subscription['interval_unit'] ?? 'month'));
            $planIntervalCount = max(1, (int) ($subscription['interval_count'] ?? 1));
            $chargeIntervalDays = $this->resolveProjectionChargeIntervalDays([
                'name' => (string) ($subscription['plan_name'] ?? ''),
                'interval_unit' => $planIntervalUnit,
                'interval_count' => $planIntervalCount,
            ], $cycleMetadataInstallments);
            $scheduledDueDates = [];

            for ($installmentIndex = 0; $installmentIndex < $projectionCycles; $installmentIndex++) {
                $dueDate = $this->addProjectionInterval(
                    $baseDate,
                    $installmentIndex,
                    'day',
                    $chargeIntervalDays
                );

                if ($dueDate < $now) {
                    $daysOverdue = max(0, (int) floor(($now->getTimestamp() - $dueDate->getTimestamp()) / 86400));
                    $overduePaymentAmount = round($overduePaymentAmount + $installmentAmount, 2);
                    $overduePayments[] = [
                        'subscriptionId' => (string) ($subscription['id'] ?? ''),
                        'userId' => (string) ($subscription['user_id'] ?? ''),
                        'userName' => (string) ($subscription['user_name'] ?? ''),
                        'userEmail' => (string) ($subscription['user_email'] ?? ''),
                        'planName' => (string) ($subscription['plan_name'] ?? ''),
                        'status' => $status,
                        'cycleKey' => $cycleKey,
                        'cycleLabel' => $cycleLabel,
                        'installmentNumber' => $paidInstallments + $installmentIndex + 1,
                        'installmentCount' => $totalInstallments,
                        'amount' => round($installmentAmount, 2),
                        'dueAt' => $dueDate->format('Y-m-d H:i:s'),
                        'daysOverdue' => $daysOverdue,
                        'reason' => $status === 'past_due'
                            ? 'Assinatura em atraso na Stripe'
                            : ($isCancelledWithOpenContract
                                ? 'Parcela contratada pendente apos cancelamento'
                                : 'Parcela prevista venceu sem transacao local correspondente'),
                    ];
                    continue;
                }

                $scheduledDueDates[] = [
                    'date' => $dueDate,
                    'installmentNumber' => $paidInstallments + $installmentIndex + 1,
                ];
            }

            $futureInstallments = count($scheduledDueDates);
            $projectedAmount = round($installmentAmount * $futureInstallments, 2);

            if ($futureInstallments <= 0 || $projectedAmount <= 0.0) {
                continue;
            }

            $totalProjectedAmount += $projectedAmount;
            $totalRemainingInstallments += $futureInstallments;
            if ($status === 'past_due') {
                $atRiskProjectedAmount += $projectedAmount;
            }

            if (!isset($breakdown[$cycleKey])) {
                $breakdown[$cycleKey] = [
                    'key' => $cycleKey,
                    'label' => $cycleLabel,
                    'subscriptions' => 0,
                    'remainingInstallments' => 0,
                    'projectedAmount' => 0.0,
                ];
            }

            $breakdown[$cycleKey]['subscriptions']++;
            $breakdown[$cycleKey]['remainingInstallments'] += $futureInstallments;
            $breakdown[$cycleKey]['projectedAmount'] = round(
                $breakdown[$cycleKey]['projectedAmount'] + $projectedAmount,
                2
            );

            foreach ($scheduledDueDates as $scheduledDueDate) {
                $dueDate = $scheduledDueDate['date'];
                $monthKey = $dueDate->format('Y-m');

                if (!isset($monthlyBreakdown[$monthKey])) {
                    $monthlyBreakdown[$monthKey] = [
                        'key' => $monthKey,
                        'label' => $this->formatProjectionMonthLabel($dueDate),
                        'year' => (int) $dueDate->format('Y'),
                        'month' => (int) $dueDate->format('n'),
                        'installments' => 0,
                        'amount' => 0.0,
                        'atRiskAmount' => 0.0,
                    ];
                }

                $monthlyBreakdown[$monthKey]['installments']++;
                $monthlyBreakdown[$monthKey]['amount'] = round(
                    $monthlyBreakdown[$monthKey]['amount'] + $installmentAmount,
                    2
                );

                if ($status === 'past_due') {
                    $monthlyBreakdown[$monthKey]['atRiskAmount'] = round(
                        $monthlyBreakdown[$monthKey]['atRiskAmount'] + $installmentAmount,
                        2
                    );
                }
            }

            $firstScheduledDueDate = $scheduledDueDates[0]['date'];
            $firstScheduledInstallmentNumber = max(1, (int) ($scheduledDueDates[0]['installmentNumber'] ?? 1));

            $items[] = [
                'subscriptionId' => (string) ($subscription['id'] ?? ''),
                'userId' => (string) ($subscription['user_id'] ?? ''),
                'userName' => (string) ($subscription['user_name'] ?? ''),
                'userEmail' => (string) ($subscription['user_email'] ?? ''),
                'planName' => (string) ($subscription['plan_name'] ?? ''),
                'status' => $status,
                'cycleKey' => $cycleKey,
                'cycleLabel' => $cycleLabel,
                'totalInstallments' => $totalInstallments,
                'paidInstallments' => max(0, $firstScheduledInstallmentNumber - 1),
                'remainingInstallments' => $futureInstallments,
                'installmentAmount' => round($installmentAmount, 2),
                'projectedAmount' => $projectedAmount,
                'nextBillingAt' => $firstScheduledDueDate->format('Y-m-d H:i:s'),
                'currentPeriodEnd' => $subscription['current_period_end'] ?? $subscription['provider_current_period_end'] ?? null,
                'intervalUnit' => 'day',
                'intervalCount' => $chargeIntervalDays,
                'chargeIntervalUnit' => 'day',
                'chargeIntervalCount' => $chargeIntervalDays,
                'projectionMode' => $projectionMode,
            ];
        }

        usort($items, static fn(array $left, array $right): int => ($right['projectedAmount'] <=> $left['projectedAmount']));
        usort($breakdown, static fn(array $left, array $right): int => ($right['projectedAmount'] <=> $left['projectedAmount']));
        ksort($monthlyBreakdown);

        return [
            'totalProjectedAmount' => round($totalProjectedAmount, 2),
            'totalRemainingInstallments' => $totalRemainingInstallments,
            'activeContracts' => count($items),
            'atRiskProjectedAmount' => round($atRiskProjectedAmount, 2),
            'overduePaymentCount' => count($overduePayments),
            'overduePaymentAmount' => round($overduePaymentAmount, 2),
            'overduePayments' => array_values($overduePayments),
            'breakdownByCycle' => array_values($breakdown),
            'breakdownByMonth' => array_values($monthlyBreakdown),
            'items' => array_values($items),
        ];
    }

    private function buildProjectionPaidEvidenceLookup(array $transactions): array
    {
        $lookup = [];

        foreach ($transactions as $transaction) {
            if (!$this->transactionIsProjectionPaidEvidence($transaction)) {
                continue;
            }

            foreach ($this->buildProjectionEvidenceKeys($transaction) as $key) {
                $lookup[$key] = true;
            }
        }

        return $lookup;
    }

    private function transactionIsProjectionPaidEvidence(array $transaction): bool
    {
        $status = $this->normalizeTransactionStatus($transaction);
        if (!in_array($status, ['approved', 'completed'], true)) {
            return false;
        }

        return (float) ($transaction['amount'] ?? 0) > 0.0;
    }

    private function subscriptionHasProjectionPaidEvidence(array $subscription, array $lookup): bool
    {
        foreach ($this->buildProjectionEvidenceKeys($subscription) as $key) {
            if (isset($lookup[$key])) {
                return true;
            }
        }

        return false;
    }

    private function buildProjectionEvidenceKeys(array $row): array
    {
        $userId = trim((string) ($row['user_id'] ?? ''));
        $planId = trim((string) ($row['plan_id'] ?? ''));
        $providerCustomerId = trim((string) ($row['provider_customer_id'] ?? ''));
        $keys = [];

        if ($planId === '') {
            return [];
        }

        if ($userId !== '') {
            $keys[] = 'user:' . $userId . '|plan:' . $planId;
        }

        if ($providerCustomerId !== '') {
            $keys[] = 'customer:' . $providerCustomerId . '|plan:' . $planId;
        }

        if ($userId !== '' && $providerCustomerId !== '') {
            $keys[] = 'user:' . $userId . '|customer:' . $providerCustomerId . '|plan:' . $planId;
        }

        return array_values(array_unique($keys));
    }

    private function parseProjectionDate(mixed $value): \DateTimeImmutable
    {
        if (is_numeric($value)) {
            $timestamp = (int) $value;
            if ($timestamp > 0) {
                if ($timestamp < 10000000000) {
                    $timestamp *= 1000;
                }

                return (new \DateTimeImmutable())->setTimestamp((int) floor($timestamp / 1000));
            }
        }

        $raw = trim((string) ($value ?? ''));
        if ($raw !== '') {
            try {
                return new \DateTimeImmutable($raw);
            } catch (\Throwable) {
                // Falls back to now when provider dates are malformed.
            }
        }

        return new \DateTimeImmutable();
    }

    private function shouldSkipRevenueProjectionForSubscription(array $subscription): bool
    {
        $isTestPlan = filter_var($subscription['is_test_plan'] ?? false, FILTER_VALIDATE_BOOL, FILTER_NULL_ON_FAILURE);
        if ($isTestPlan === null) {
            $isTestPlan = ((int) ($subscription['is_test_plan'] ?? 0)) > 0;
        }

        if ($isTestPlan) {
            return true;
        }

        $planName = mb_strtolower((string) ($subscription['plan_name'] ?? ''));
        if ($planName !== '' && preg_match('/\b(teste|trial|demo|homologacao|homologa[cç][aã]o)\b/u', $planName) === 1) {
            return true;
        }

        $intervalUnit = strtolower((string) ($subscription['interval_unit'] ?? 'month'));
        $intervalCount = max(1, (int) ($subscription['interval_count'] ?? 1));
        return $intervalUnit === 'day' && $intervalCount <= 7;
    }

    private function addProjectionMonths(\DateTimeImmutable $date, int $months): \DateTimeImmutable
    {
        if ($months <= 0) {
            return $date;
        }

        return $date->modify(sprintf('+%d months', $months));
    }

    private function formatProjectionMonthLabel(\DateTimeImmutable $date): string
    {
        $months = [
            1 => 'Janeiro',
            2 => 'Fevereiro',
            3 => 'Março',
            4 => 'Abril',
            5 => 'Maio',
            6 => 'Junho',
            7 => 'Julho',
            8 => 'Agosto',
            9 => 'Setembro',
            10 => 'Outubro',
            11 => 'Novembro',
            12 => 'Dezembro',
        ];

        return ($months[(int) $date->format('n')] ?? $date->format('m')) . '/' . $date->format('Y');
    }

    private function buildFunnel(array $events): array
    {
        $steps = [
            ['key' => 'visit', 'label' => 'Visitou', 'events' => ['identifiable_visit']],
            ['key' => 'email', 'label' => 'Capturou email', 'events' => ['email_captured']],
            ['key' => 'signup', 'label' => 'Cadastrou', 'events' => ['signup_completed']],
            ['key' => 'checkout', 'label' => 'Iniciou checkout', 'events' => ['checkout_started']],
            ['key' => 'payment', 'label' => 'Iniciou pagamento', 'events' => ['payment_method_started']],
            ['key' => 'purchase', 'label' => 'Comprou', 'events' => ['purchase_completed', 'renewal_completed']],
        ];

        $result = [];
        $previousCount = null;

        foreach ($steps as $step) {
            $count = $this->countDistinctLeadsForEvents($events, $step['events']);
            $conversionFromPrevious = $previousCount && $previousCount > 0
                ? round(($count / $previousCount) * 100, 2)
                : null;

            $result[] = [
                'key' => $step['key'],
                'label' => $step['label'],
                'count' => $count,
                'conversionFromPrevious' => $conversionFromPrevious,
            ];
            $previousCount = $count;
        }

        return $result;
    }

    private function buildFunnelDetails(array $journeys): array
    {
        $identifiedJourneys = array_values(array_filter($journeys, static function (array $journey): bool {
            return trim((string) ($journey['email'] ?? '')) !== '' || trim((string) ($journey['userId'] ?? '')) !== '';
        }));

        usort($identifiedJourneys, static fn(array $left, array $right): int => strcmp(
            (string) ($right['lastEventAt'] ?? ''),
            (string) ($left['lastEventAt'] ?? '')
        ));

        return [
            'identifiedLeads' => count($identifiedJourneys),
            'capturedEmailsCount' => count(array_filter($identifiedJourneys, static fn(array $journey): bool => (bool) ($journey['emailCaptured'] ?? false))),
            'createdAccountsCount' => count(array_filter($identifiedJourneys, static fn(array $journey): bool => (bool) ($journey['createdAccount'] ?? false))),
            'checkoutStartedCount' => count(array_filter($identifiedJourneys, static fn(array $journey): bool => (bool) ($journey['checkoutStarted'] ?? false))),
            'paymentStartedCount' => count(array_filter($identifiedJourneys, static fn(array $journey): bool => (bool) ($journey['paymentStarted'] ?? false))),
            'purchasedCount' => count(array_filter($identifiedJourneys, static fn(array $journey): bool => (bool) ($journey['purchased'] ?? false))),
            'recentLeads' => array_values(array_slice($identifiedJourneys, 0, 12)),
            'topReferrers' => $this->buildAttributionBreakdown($identifiedJourneys, 'referrer'),
            'topCampaigns' => $this->buildAttributionBreakdown($identifiedJourneys, 'campaign'),
        ];
    }

    private function buildConversionByCycle(array $events, array $subscriptions): array
    {
        $eventsByCycle = [];
        foreach ($events as $event) {
            if (!in_array($event['event_name'] ?? '', ['purchase_completed', 'renewal_completed'], true)) {
                continue;
            }

            $metadata = $this->decodeJson((string) ($event['metadata_json'] ?? ''));
            $cycleLabel = $this->normalizeCycleLabel(
                (string) ($event['cycle_label'] ?? ''),
                $metadata
            );

            if (!isset($eventsByCycle[$cycleLabel])) {
                $eventsByCycle[$cycleLabel] = [
                    'key' => $cycleLabel,
                    'label' => $this->formatCycleLabel($cycleLabel),
                    'purchases' => 0,
                    'activeSubscribers' => 0,
                ];
            }

            $eventsByCycle[$cycleLabel]['purchases']++;
        }

        foreach ($subscriptions as $subscription) {
            if (!in_array(strtolower((string) ($subscription['status'] ?? '')), ['active', 'trialing', 'past_due'], true)) {
                continue;
            }

            $cycleLabel = $this->normalizeCycleLabel(
                (string) ($subscription['cycle_label'] ?? ''),
                [
                    'interval_unit' => $subscription['interval_unit'] ?? null,
                    'interval_count' => $subscription['interval_count'] ?? null,
                    'total_installments' => $subscription['total_installments'] ?? null,
                ]
            );

            if (!isset($eventsByCycle[$cycleLabel])) {
                $eventsByCycle[$cycleLabel] = [
                    'key' => $cycleLabel,
                    'label' => $this->formatCycleLabel($cycleLabel),
                    'purchases' => 0,
                    'activeSubscribers' => 0,
                ];
            }

            $eventsByCycle[$cycleLabel]['activeSubscribers']++;
        }

        return array_values($eventsByCycle);
    }

    private function buildBillingHealth(array $events, array $transactions, array $subscriptions): array
    {
        $riskRows = $this->buildBillingRiskRows($events, $subscriptions);

        return [
            'failedPayments' => $this->countDistinctLeadsForEvents($events, ['payment_failed']),
            'pastDueSubscribers' => $this->countSubscriptionsByStatuses($subscriptions, ['past_due']),
            'recoveredSubscribers' => $this->countRecoveredLeads($events),
            'refundRequestedCount' => $this->countTransactionsByStatus($transactions, 'refund_requested'),
            'refundedCount' => $this->countTransactionsByStatus($transactions, 'refunded'),
            'cardExpiredSubscribers' => $this->countBillingRiskRowsByType($riskRows, 'expired_card'),
            'cardExpiringSubscribers' => $this->countBillingRiskRowsByType($riskRows, 'expiring_card'),
            'missingCardSubscribers' => $this->countBillingRiskRowsByType($riskRows, 'no_card'),
            'riskRows' => $riskRows,
        ];
    }

    private function buildBillingRiskRows(array $events, array $subscriptions): array
    {
        $rowsByKey = [];
        $now = $this->now();
        $currentMonth = (int) $now->format('m');
        $currentYear = (int) $now->format('Y');
        $recovered = $this->buildLeadCompletionMap($events, ['purchase_completed', 'renewal_completed']);
        $failedByLead = $this->groupEventsByLead(
            $events,
            static fn(array $event): bool => ($event['event_name'] ?? '') === 'payment_failed'
        );

        foreach ($subscriptions as $subscription) {
            $status = strtolower((string) ($subscription['status'] ?? ''));
            if (!in_array($status, ['active', 'trialing', 'past_due'], true)) {
                continue;
            }

            $userId = trim((string) ($subscription['user_id'] ?? ''));
            $email = trim((string) ($subscription['user_email'] ?? ''));
            if ($userId === '' && $email === '') {
                continue;
            }

            $planPrice = max(0.0, (float) ($subscription['price'] ?? 0));
            if ($planPrice <= 0.0) {
                continue;
            }

            $autoRenew = (int) ($subscription['auto_renew'] ?? 1) === 1;
            $cancelAtPeriodEnd = (int) ($subscription['cancel_at_period_end'] ?? 0) === 1;
            $subscriptionId = (string) ($subscription['id'] ?? '');
            $lastSignalAt = (string) (
                $subscription['updated_at']
                ?? $subscription['next_billing_at']
                ?? $subscription['current_period_end']
                ?? $subscription['created_at']
                ?? ''
            );
            $cardLabel = $this->buildBillingCardLabel($subscription);

            if ($status === 'past_due') {
                $this->addBillingRiskRow($rowsByKey, [
                    'riskType' => 'past_due',
                    'severity' => 'blocking',
                    'source' => 'Past due',
                    'reason' => 'Assinatura em atraso na Stripe e precisando de recuperacao.',
                    'actionLabel' => 'Enviar e-mail de regularizacao',
                    'subscriptionId' => $subscriptionId,
                    'userId' => $userId,
                    'userName' => (string) ($subscription['user_name'] ?? ''),
                    'userEmail' => $email,
                    'planName' => (string) ($subscription['plan_name'] ?? ''),
                    'status' => $status,
                    'cardLabel' => $cardLabel,
                    'lastSignalAt' => $lastSignalAt,
                    'canSendEmail' => $email !== '' && $userId !== '',
                ]);
            }

            if (!$autoRenew || $cancelAtPeriodEnd) {
                $this->addBillingRiskRow($rowsByKey, [
                    'riskType' => 'renewal_disabled',
                    'severity' => 'attention',
                    'source' => 'Renovacao desligada',
                    'reason' => 'Assinatura ativa sem renovacao automatica habilitada.',
                    'actionLabel' => 'Enviar e-mail',
                    'subscriptionId' => $subscriptionId,
                    'userId' => $userId,
                    'userName' => (string) ($subscription['user_name'] ?? ''),
                    'userEmail' => $email,
                    'planName' => (string) ($subscription['plan_name'] ?? ''),
                    'status' => $status,
                    'cardLabel' => $cardLabel,
                    'lastSignalAt' => $lastSignalAt,
                    'canSendEmail' => $email !== '' && $userId !== '',
                ]);
                continue;
            }

            $hasPaymentCard = (int) ($subscription['has_payment_card'] ?? 0) > 0;
            if (!$hasPaymentCard) {
                if ($this->subscriptionRequiresImmediateCard($subscription)) {
                    $this->addBillingRiskRow($rowsByKey, [
                        'riskType' => 'no_card',
                        'severity' => 'blocking',
                        'source' => 'Sem cartao salvo',
                        'reason' => 'Assinatura recorrente paga sem cartao salvo para a proxima cobranca.',
                        'actionLabel' => 'Enviar e-mail para cadastrar cartao',
                        'subscriptionId' => $subscriptionId,
                        'userId' => $userId,
                        'userName' => (string) ($subscription['user_name'] ?? ''),
                        'userEmail' => $email,
                        'planName' => (string) ($subscription['plan_name'] ?? ''),
                        'status' => $status,
                        'cardLabel' => '',
                        'lastSignalAt' => $lastSignalAt,
                        'canSendEmail' => $email !== '' && $userId !== '',
                    ]);
                }
                continue;
            }

            $expMonth = (int) ($subscription['card_exp_month'] ?? 0);
            $expYear = (int) ($subscription['card_exp_year'] ?? 0);
            if ($expMonth <= 0 || $expYear <= 0) {
                continue;
            }

            if ($expYear < $currentYear || ($expYear === $currentYear && $expMonth < $currentMonth)) {
                $this->addBillingRiskRow($rowsByKey, [
                    'riskType' => 'expired_card',
                    'severity' => 'blocking',
                    'source' => 'Cartao vencido',
                    'reason' => $cardLabel === ''
                        ? 'Cartao da assinatura expirado. O aluno precisa atualizar os dados de pagamento.'
                        : "Cartao {$cardLabel} expirado. O aluno precisa atualizar os dados de pagamento.",
                    'actionLabel' => 'Enviar e-mail para atualizar cartao',
                    'subscriptionId' => $subscriptionId,
                    'userId' => $userId,
                    'userName' => (string) ($subscription['user_name'] ?? ''),
                    'userEmail' => $email,
                    'planName' => (string) ($subscription['plan_name'] ?? ''),
                    'status' => $status,
                    'cardLabel' => $cardLabel,
                    'lastSignalAt' => $lastSignalAt,
                    'canSendEmail' => $email !== '' && $userId !== '',
                ]);
                continue;
            }

            $monthsUntilExpiry = (($expYear - $currentYear) * 12) + ($expMonth - $currentMonth);
            if ($monthsUntilExpiry <= 1) {
                $this->addBillingRiskRow($rowsByKey, [
                    'riskType' => 'expiring_card',
                    'severity' => 'warning',
                    'source' => 'Cartao perto de vencer',
                    'reason' => $cardLabel === ''
                        ? 'Cartao da assinatura vence em ate 1 mes e pode causar falha de renovacao.'
                        : "Cartao {$cardLabel} vence em ate 1 mes e pode causar falha de renovacao.",
                    'actionLabel' => 'Enviar e-mail preventivo',
                    'subscriptionId' => $subscriptionId,
                    'userId' => $userId,
                    'userName' => (string) ($subscription['user_name'] ?? ''),
                    'userEmail' => $email,
                    'planName' => (string) ($subscription['plan_name'] ?? ''),
                    'status' => $status,
                    'cardLabel' => $cardLabel,
                    'lastSignalAt' => $lastSignalAt,
                    'canSendEmail' => $email !== '' && $userId !== '',
                ]);
            }
        }

        foreach ($failedByLead as $leadKey => $leadEvents) {
            if (isset($recovered[$leadKey])) {
                continue;
            }

            $latest = $leadEvents[0];
            $metadata = $this->decodeJson((string) ($latest['metadata_json'] ?? ''));
            $userId = trim((string) ($latest['user_id'] ?? ''));
            $email = trim((string) ($latest['email'] ?? ''));
            if ($userId === '' && $email === '') {
                continue;
            }

            $this->addBillingRiskRow($rowsByKey, [
                'riskType' => 'payment_failed',
                'severity' => 'blocking',
                'source' => 'Falha de pagamento',
                'reason' => 'Falha de cobranca recente ainda sem evento posterior de recuperacao.',
                'actionLabel' => 'Enviar e-mail de regularizacao',
                'subscriptionId' => '',
                'userId' => $userId,
                'userName' => (string) ($metadata['name'] ?? ''),
                'userEmail' => $email,
                'planName' => (string) ($metadata['plan_name'] ?? ''),
                'status' => 'payment_failed',
                'cardLabel' => '',
                'lastSignalAt' => (string) ($latest['created_at'] ?? ''),
                'canSendEmail' => $email !== '' && $userId !== '',
            ]);
        }

        $rows = array_values($rowsByKey);
        usort($rows, function (array $left, array $right): int {
            $severityCompare = $this->billingRiskSeverityWeight((string) ($right['severity'] ?? ''))
                <=> $this->billingRiskSeverityWeight((string) ($left['severity'] ?? ''));
            if ($severityCompare !== 0) {
                return $severityCompare;
            }

            $typeCompare = $this->billingRiskTypeWeight((string) ($right['riskType'] ?? ''))
                <=> $this->billingRiskTypeWeight((string) ($left['riskType'] ?? ''));
            if ($typeCompare !== 0) {
                return $typeCompare;
            }

            return strcmp((string) ($right['lastSignalAt'] ?? ''), (string) ($left['lastSignalAt'] ?? ''));
        });

        return array_values(array_slice($rows, 0, 80));
    }

    private function addBillingRiskRow(array &$rowsByKey, array $row): void
    {
        $key = $this->buildBillingRiskRowKey($row);
        if ($key === '') {
            return;
        }

        if (!isset($rowsByKey[$key])) {
            $rowsByKey[$key] = $row;
            return;
        }

        $current = $rowsByKey[$key];
        $incomingWeight = $this->billingRiskSeverityWeight((string) ($row['severity'] ?? ''));
        $currentWeight = $this->billingRiskSeverityWeight((string) ($current['severity'] ?? ''));
        $incomingTypeWeight = $this->billingRiskTypeWeight((string) ($row['riskType'] ?? ''));
        $currentTypeWeight = $this->billingRiskTypeWeight((string) ($current['riskType'] ?? ''));
        if (
            $incomingWeight > $currentWeight
            || (
                $incomingWeight === $currentWeight
                && (
                    $incomingTypeWeight > $currentTypeWeight
                    || (
                        $incomingTypeWeight === $currentTypeWeight
                        && (string) ($row['lastSignalAt'] ?? '') > (string) ($current['lastSignalAt'] ?? '')
                    )
                )
            )
        ) {
            $rowsByKey[$key] = $row;
        }
    }

    private function buildBillingRiskRowKey(array $row): string
    {
        $userId = trim((string) ($row['userId'] ?? ''));
        if ($userId !== '') {
            return 'user:' . $userId;
        }

        $email = strtolower(trim((string) ($row['userEmail'] ?? '')));
        return $email !== '' ? 'email:' . $email : '';
    }

    private function countBillingRiskRowsByType(array $riskRows, string $riskType): int
    {
        return count(array_filter($riskRows, static fn(array $row): bool => ($row['riskType'] ?? '') === $riskType));
    }

    private function billingRiskSeverityWeight(string $severity): int
    {
        return match ($severity) {
            'blocking', 'error' => 3,
            'warning' => 2,
            'attention' => 1,
            default => 0,
        };
    }

    private function billingRiskTypeWeight(string $riskType): int
    {
        return match ($riskType) {
            'expired_card' => 5,
            'no_card' => 4,
            'past_due', 'payment_failed' => 3,
            'expiring_card' => 2,
            'renewal_disabled' => 1,
            default => 0,
        };
    }

    private function subscriptionRequiresImmediateCard(array $subscription): bool
    {
        $intervalUnit = strtolower((string) ($subscription['interval_unit'] ?? ''));
        $intervalCount = max(1, (int) ($subscription['interval_count'] ?? 1));
        $totalInstallments = max(1, (int) ($subscription['total_installments'] ?? 1));

        if ($intervalUnit === 'day' && $intervalCount <= 7) {
            return false;
        }

        return $intervalUnit === 'year'
            || $intervalCount >= 3
            || $totalInstallments >= 3;
    }

    private function buildBillingCardLabel(array $subscription): string
    {
        $brand = strtoupper(trim((string) ($subscription['card_brand'] ?? '')));
        $lastFour = trim((string) ($subscription['card_last_four_digits'] ?? ''));

        if ($brand === '' && $lastFour === '') {
            return '';
        }

        if ($lastFour === '') {
            return $brand;
        }

        return trim(($brand !== '' ? $brand . ' ' : '') . 'final ' . $lastFour);
    }

    private function resolveSubscriptionOpenAmount(array $subscription): float
    {
        $recurringAmount = max(0.0, (float) ($subscription['recurring_amount'] ?? 0));
        if ($recurringAmount > 0.0) {
            return round($recurringAmount, 2);
        }

        $planPrice = max(0.0, (float) ($subscription['price'] ?? 0));
        $totalInstallments = max(1, (int) ($subscription['total_installments'] ?? 1));
        return round($totalInstallments > 1 ? $planPrice / $totalInstallments : $planPrice, 2);
    }

    private function sendBillingRiskRecoveryEmail(
        PDO $db,
        array $user,
        array $subscriptionContext,
        array $riskRow,
        array $invoiceContext
    ): void {
        $riskType = (string) ($riskRow['riskType'] ?? '');
        if (in_array($riskType, ['past_due', 'payment_failed'], true)) {
            sendStripePaymentFailureEmail($db, $user, $subscriptionContext, $invoiceContext);
            return;
        }

        $email = trim((string) ($user['email'] ?? ''));
        if ($email === '') {
            return;
        }

        $planName = trim((string) ($subscriptionContext['plan_name'] ?? $riskRow['planName'] ?? 'Assinatura'));
        $cardLabel = trim((string) ($riskRow['cardLabel'] ?? ''));
        $reason = trim((string) ($riskRow['reason'] ?? 'Sua assinatura precisa de atencao nos dados de pagamento.'));
        $billingUrl = buildAppHashRoute('/profile', ['tab' => 'billing']);
        $cardLine = $cardLabel !== ''
            ? '<b>Cartao:</b> ' . htmlspecialchars($cardLabel, ENT_QUOTES, 'UTF-8') . '<br>'
            : '';

        $content = 'Ola ' . htmlspecialchars((string) ($user['name'] ?? 'assinante'), ENT_QUOTES, 'UTF-8') . ',<br><br>'
            . 'Identificamos que os dados de pagamento da sua assinatura no <b>ConcursoMestre</b> precisam de atencao.<br><br>'
            . '<b>Plano:</b> ' . htmlspecialchars($planName, ENT_QUOTES, 'UTF-8') . '<br>'
            . $cardLine
            . '<b>Motivo:</b> ' . htmlspecialchars($reason, ENT_QUOTES, 'UTF-8') . '<br><br>'
            . 'Atualize ou troque o cartao salvo para evitar bloqueios nos simulados e materiais premium.';

        $bodyHtml = Mailer::htmlTemplate(
            'Atualize seu pagamento',
            $content,
            $billingUrl,
            'Atualizar pagamento'
        );

        $template = resolveSystemEmailTemplate(
            'subscription_payment_method_update',
            [
                'subject' => 'Atualize os dados de pagamento da sua assinatura',
                'htmlBody' => $bodyHtml,
                'textBody' => "Ola {$user['name']},\n\nIdentificamos que os dados de pagamento da sua assinatura precisam de atencao.\nMotivo: {$reason}\nAtualize em: {$billingUrl}",
            ],
            [
                'name' => (string) ($user['name'] ?? ''),
                'email' => $email,
                'plan_name' => $planName,
                'card_label' => $cardLabel,
                'reason' => $reason,
                'billing_url' => $billingUrl,
                'app_url' => rtrim((string) (getenv('APP_URL') ?: 'http://localhost:3000'), '/'),
            ],
            $db
        );

        if ($template['enabled']) {
            Mailer::send(
                $email,
                (string) ($user['name'] ?? 'Assinante'),
                $template['subject'],
                $template['htmlBody'],
                $template['textBody']
            );
        }
    }

    private function buildCohorts(array $journeys, array $subscriptions): array
    {
        $activeLeadKeys = [];
        foreach ($subscriptions as $subscription) {
            if (!in_array(strtolower((string) ($subscription['status'] ?? '')), ['active', 'trialing'], true)) {
                continue;
            }

            $activeLeadKeys[$this->buildLeadKey([
                'user_id' => $subscription['user_id'] ?? null,
                'email' => $subscription['user_email'] ?? null,
            ])] = true;
        }

        $acquisitionCohorts = [];
        $revenueCohorts = [];

        foreach ($journeys as $leadKey => $journey) {
            $acquisitionMonth = (string) ($journey['acquisitionMonth'] ?? '');
            if ($acquisitionMonth !== '' && (($journey['emailCaptured'] ?? false) || ($journey['createdAccount'] ?? false))) {
                if (!isset($acquisitionCohorts[$acquisitionMonth])) {
                    $acquisitionCohorts[$acquisitionMonth] = [
                        'month' => $acquisitionMonth,
                        'capturedEmails' => 0,
                        'createdAccounts' => 0,
                        'checkoutStarted' => 0,
                        'purchases' => 0,
                    ];
                }

                if ($journey['emailCaptured'] ?? false) {
                    $acquisitionCohorts[$acquisitionMonth]['capturedEmails']++;
                }

                if ($journey['createdAccount'] ?? false) {
                    $acquisitionCohorts[$acquisitionMonth]['createdAccounts']++;
                }

                if ($journey['checkoutStarted'] ?? false) {
                    $acquisitionCohorts[$acquisitionMonth]['checkoutStarted']++;
                }

                if ($journey['purchased'] ?? false) {
                    $acquisitionCohorts[$acquisitionMonth]['purchases']++;
                }
            }

            $purchaseMonth = (string) ($journey['purchaseMonth'] ?? '');
            if ($purchaseMonth === '' || !($journey['purchased'] ?? false)) {
                continue;
            }

            if (!isset($revenueCohorts[$purchaseMonth])) {
                $revenueCohorts[$purchaseMonth] = [
                    'month' => $purchaseMonth,
                    'buyers' => 0,
                    'currentlyActive' => 0,
                    'renewed' => 0,
                ];
            }

            $revenueCohorts[$purchaseMonth]['buyers']++;
            if (isset($activeLeadKeys[$leadKey])) {
                $revenueCohorts[$purchaseMonth]['currentlyActive']++;
            }
            if ($journey['renewed'] ?? false) {
                $revenueCohorts[$purchaseMonth]['renewed']++;
            }
        }

        ksort($acquisitionCohorts);
        ksort($revenueCohorts);

        return [
            'acquisition' => array_values(array_map(static function (array $cohort): array {
                $capturedEmails = max(1, (int) $cohort['capturedEmails']);
                return [
                    'month' => $cohort['month'],
                    'capturedEmails' => (int) $cohort['capturedEmails'],
                    'createdAccounts' => (int) $cohort['createdAccounts'],
                    'checkoutStarted' => (int) $cohort['checkoutStarted'],
                    'purchases' => (int) $cohort['purchases'],
                    'signupRate' => round(((int) $cohort['createdAccounts'] / $capturedEmails) * 100, 2),
                    'purchaseRate' => round(((int) $cohort['purchases'] / $capturedEmails) * 100, 2),
                ];
            }, array_slice($acquisitionCohorts, -6, 6, true))),
            'revenue' => array_values(array_map(static function (array $cohort): array {
                $buyers = max(1, (int) $cohort['buyers']);
                return [
                    'month' => $cohort['month'],
                    'buyers' => (int) $cohort['buyers'],
                    'currentlyActive' => (int) $cohort['currentlyActive'],
                    'renewed' => (int) $cohort['renewed'],
                    'retentionRate' => round(((int) $cohort['currentlyActive'] / $buyers) * 100, 2),
                ];
            }, array_slice($revenueCohorts, -6, 6, true))),
        ];
    }

    private function buildLeadJourneys(array $events, array $userDirectory): array
    {
        $grouped = $this->groupEventsByLead($events, static fn(array $event): bool => true);
        $journeys = [];

        foreach ($grouped as $leadKey => $leadEvents) {
            $latest = $leadEvents[0];
            $oldestFirst = array_reverse($leadEvents);
            $email = '';
            $userId = '';
            $name = null;
            $referrerUrl = '';
            $originUrl = '';
            $utmSource = '';
            $utmMedium = '';
            $utmCampaign = '';
            $firstEventAt = '';
            $acquisitionAt = '';
            $firstPurchaseAt = '';
            $emailCaptured = false;
            $createdAccount = false;
            $checkoutStarted = false;
            $paymentStarted = false;
            $purchased = false;
            $renewed = false;

            foreach ($oldestFirst as $event) {
                $eventName = (string) ($event['event_name'] ?? '');
                $createdAt = trim((string) ($event['created_at'] ?? ''));
                $metadata = $this->decodeJson((string) ($event['metadata_json'] ?? ''));

                if ($firstEventAt === '' && $createdAt !== '') {
                    $firstEventAt = $createdAt;
                }

                if ($userId === '') {
                    $userId = trim((string) ($event['user_id'] ?? ''));
                }

                if ($email === '') {
                    $email = strtolower(trim((string) ($event['email'] ?? '')));
                }

                if ($name === null) {
                    $candidateName = trim((string) ($metadata['name'] ?? ''));
                    if ($candidateName !== '') {
                        $name = $candidateName;
                    }
                }

                if ($referrerUrl === '') {
                    $referrerUrl = trim((string) ($event['referrer_url'] ?? ''));
                }

                if ($originUrl === '') {
                    $originUrl = trim((string) ($event['origin_url'] ?? ''));
                }

                if ($utmSource === '') {
                    $utmSource = trim((string) ($event['utm_source'] ?? ''));
                }

                if ($utmMedium === '') {
                    $utmMedium = trim((string) ($event['utm_medium'] ?? ''));
                }

                if ($utmCampaign === '') {
                    $utmCampaign = trim((string) ($event['utm_campaign'] ?? ''));
                }

                if (!$emailCaptured && $eventName === 'email_captured') {
                    $emailCaptured = true;
                    if ($acquisitionAt === '' && $createdAt !== '') {
                        $acquisitionAt = $createdAt;
                    }
                }

                if (!$createdAccount && $eventName === 'signup_completed') {
                    $createdAccount = true;
                    if ($acquisitionAt === '' && $createdAt !== '') {
                        $acquisitionAt = $createdAt;
                    }
                }

                if (!$checkoutStarted && $eventName === 'checkout_started') {
                    $checkoutStarted = true;
                }

                if (!$paymentStarted && $eventName === 'payment_method_started') {
                    $paymentStarted = true;
                }

                if (in_array($eventName, ['purchase_completed', 'renewal_completed'], true)) {
                    $purchased = true;
                    if ($firstPurchaseAt === '' && $createdAt !== '') {
                        $firstPurchaseAt = $createdAt;
                    }
                    if ($eventName === 'renewal_completed') {
                        $renewed = true;
                    }
                }

                if ($acquisitionAt === '' && $eventName === 'signup_started' && $createdAt !== '') {
                    $acquisitionAt = $createdAt;
                }
            }

            $directoryItem = $userId !== '' && isset($userDirectory['byId'][$userId])
                ? $userDirectory['byId'][$userId]
                : ($email !== '' && isset($userDirectory['byEmail'][$email])
                    ? $userDirectory['byEmail'][$email]
                    : null);

            if ($name === null) {
                $directoryName = trim((string) ($directoryItem['name'] ?? ''));
                $name = $directoryName !== '' ? $directoryName : null;
            }

            if ($email === '') {
                $email = strtolower(trim((string) ($directoryItem['email'] ?? '')));
            }

            if ($userId === '') {
                $userId = trim((string) ($directoryItem['id'] ?? ''));
            }

            if ($acquisitionAt === '' && $firstEventAt !== '') {
                $acquisitionAt = $firstEventAt;
            }

            $journeys[$leadKey] = [
                'leadKey' => $leadKey,
                'userId' => $userId !== '' ? $userId : null,
                'email' => $email,
                'name' => $name,
                'referrerUrl' => $referrerUrl !== '' ? $referrerUrl : null,
                'referrerLabel' => $this->formatReferrerLabel($referrerUrl),
                'originUrl' => $originUrl !== '' ? $originUrl : null,
                'utmSource' => $utmSource !== '' ? $utmSource : null,
                'utmMedium' => $utmMedium !== '' ? $utmMedium : null,
                'utmCampaign' => $utmCampaign !== '' ? $utmCampaign : null,
                'currentStage' => $this->resolveJourneyStage($emailCaptured, $createdAccount, $checkoutStarted, $paymentStarted, $purchased),
                'emailCaptured' => $emailCaptured,
                'createdAccount' => $createdAccount,
                'checkoutStarted' => $checkoutStarted,
                'paymentStarted' => $paymentStarted,
                'purchased' => $purchased,
                'renewed' => $renewed,
                'firstEventAt' => $firstEventAt,
                'lastEventAt' => (string) ($latest['created_at'] ?? ''),
                'acquisitionMonth' => $acquisitionAt !== '' ? substr($acquisitionAt, 0, 7) : null,
                'purchaseMonth' => $firstPurchaseAt !== '' ? substr($firstPurchaseAt, 0, 7) : null,
            ];
        }

        return $journeys;
    }

    private function buildAttributionBreakdown(array $journeys, string $mode): array
    {
        $buckets = [];

        foreach ($journeys as $journey) {
            if ($mode === 'campaign') {
                $label = $this->formatCampaignLabel(
                    (string) ($journey['utmSource'] ?? ''),
                    (string) ($journey['utmMedium'] ?? ''),
                    (string) ($journey['utmCampaign'] ?? '')
                );
            } else {
                $label = trim((string) ($journey['referrerLabel'] ?? ''));
                if ($label === '') {
                    $label = 'Direto / sem referencia';
                }
            }

            $key = strtolower($label);
            if (!isset($buckets[$key])) {
                $buckets[$key] = [
                    'key' => $key,
                    'label' => $label,
                    'leads' => 0,
                    'capturedEmails' => 0,
                    'createdAccounts' => 0,
                    'checkouts' => 0,
                    'purchases' => 0,
                ];
            }

            $buckets[$key]['leads']++;
            if ($journey['emailCaptured'] ?? false) {
                $buckets[$key]['capturedEmails']++;
            }
            if ($journey['createdAccount'] ?? false) {
                $buckets[$key]['createdAccounts']++;
            }
            if ($journey['checkoutStarted'] ?? false) {
                $buckets[$key]['checkouts']++;
            }
            if ($journey['purchased'] ?? false) {
                $buckets[$key]['purchases']++;
            }
        }

        usort($buckets, static function (array $left, array $right): int {
            if ((int) $right['leads'] === (int) $left['leads']) {
                return (int) $right['purchases'] <=> (int) $left['purchases'];
            }

            return (int) $right['leads'] <=> (int) $left['leads'];
        });

        return array_values(array_slice($buckets, 0, 8));
    }

    private function buildDashboardInsights(array $counts, array $trends, array $funnel, array $billingHealth): array
    {
        $insights = [];
        $usersTrend = $this->findTrend($trends, 'users');
        $commentsTrend = $this->findTrend($trends, 'comments');
        $purchaseStep = $this->findFunnelStep($funnel, 'purchase');
        $checkoutStep = $this->findFunnelStep($funnel, 'checkout');

        if ($usersTrend && $usersTrend['deltaPercent'] > 10) {
            $insights[] = [
                'tone' => 'success',
                'title' => 'Base em crescimento',
                'body' => 'Usuarios cresceram mais de 10% na janela comparada.',
            ];
        }

        if ($checkoutStep && $purchaseStep && $checkoutStep['count'] > 0) {
            $checkoutConversion = ($purchaseStep['count'] / max(1, $checkoutStep['count'])) * 100;
            if ($checkoutConversion < 25) {
                $insights[] = [
                    'tone' => 'warning',
                    'title' => 'Conversao de checkout pedindo atencao',
                    'body' => 'Menos de um quarto dos leads que iniciaram checkout concluíram a compra.',
                ];
            }
        }

        if (($billingHealth['failedPayments'] ?? 0) > 0 || ($billingHealth['pastDueSubscribers'] ?? 0) > 0) {
            $insights[] = [
                'tone' => 'warning',
                'title' => 'Risco financeiro ativo',
                'body' => 'Ha falhas de pagamento ou assinaturas em past_due exigindo recuperacao.',
            ];
        }

        if (($counts['pending_comments_count'] ?? 0) > 0) {
            $insights[] = [
                'tone' => 'info',
                'title' => 'Fila de moderacao aberta',
                'body' => sprintf(
                    'Existem %d comentarios aguardando triagem.',
                    (int) ($counts['pending_comments_count'] ?? 0)
                ),
            ];
        }

        if ($commentsTrend && $commentsTrend['deltaPercent'] > 20) {
            $insights[] = [
                'tone' => 'info',
                'title' => 'Engajamento subindo',
                'body' => 'O volume de comentarios acelerou frente ao periodo anterior.',
            ];
        }

        return array_slice($insights, 0, 5);
    }

    private function collectAlmostSignedUpLeads(array $events, array $userDirectory, array $activeSubscriptionLookup): array
    {
        $relevant = $this->groupEventsByLead($events, static fn(array $event): bool => in_array(
            $event['event_name'] ?? '',
            ['signup_started', 'email_captured'],
            true
        ));
        $completed = $this->buildLeadCompletionMap($events, ['signup_completed', 'purchase_completed']);

        $items = [];
        foreach ($relevant as $leadKey => $leadEvents) {
            $latest = $leadEvents[0];
            $email = trim((string) ($latest['email'] ?? ''));
            if (
                $email === ''
                || isset($completed[$leadKey])
                || $this->hasRegisteredAccount($latest, $userDirectory)
                || $this->hasActiveSubscription($latest, $userDirectory, $activeSubscriptionLookup)
            ) {
                continue;
            }

            $items[] = $this->buildSegmentItem($latest, $userDirectory, 'Iniciou cadastro, mas nao concluiu a conta.');
        }

        return $this->sortSegmentItems($items);
    }

    private function collectAlmostPurchasedLeads(array $events, array $userDirectory, array $activeSubscriptionLookup): array
    {
        $relevant = $this->groupEventsByLead($events, static fn(array $event): bool => in_array(
            $event['event_name'] ?? '',
            ['checkout_started', 'payment_method_started'],
            true
        ));
        $completed = $this->buildLeadCompletionMap($events, ['purchase_completed', 'renewal_completed']);

        $items = [];
        foreach ($relevant as $leadKey => $leadEvents) {
            $latest = $leadEvents[0];
            $email = trim((string) ($latest['email'] ?? ''));
            if (
                $email === ''
                || isset($completed[$leadKey])
                || $this->hasActiveSubscription($latest, $userDirectory, $activeSubscriptionLookup)
            ) {
                continue;
            }

            $items[] = $this->buildSegmentItem($latest, $userDirectory, 'Chegou ao checkout, mas nao concluiu o pagamento.');
        }

        return $this->sortSegmentItems($items);
    }

    private function collectCheckoutAbandonedLeads(array $events, array $userDirectory, array $activeSubscriptionLookup): array
    {
        $relevant = $this->groupEventsByLead($events, static fn(array $event): bool => ($event['event_name'] ?? '') === 'checkout_abandoned');
        $completed = $this->buildLeadCompletionMap($events, ['purchase_completed', 'renewal_completed']);

        $items = [];
        foreach ($relevant as $leadKey => $leadEvents) {
            $latest = $leadEvents[0];
            $email = trim((string) ($latest['email'] ?? ''));
            if (
                $email === ''
                || isset($completed[$leadKey])
                || $this->hasActiveSubscription($latest, $userDirectory, $activeSubscriptionLookup)
            ) {
                continue;
            }

            $items[] = $this->buildSegmentItem($latest, $userDirectory, 'Abandonou o checkout apos se identificar.');
        }

        return $this->sortSegmentItems($items);
    }

    private function collectPaymentFailedLeads(array $events, array $userDirectory): array
    {
        $failedByLead = $this->groupEventsByLead($events, static fn(array $event): bool => ($event['event_name'] ?? '') === 'payment_failed');
        $recovered = $this->buildLeadCompletionMap($events, ['purchase_completed', 'renewal_completed']);

        $items = [];
        foreach ($failedByLead as $leadKey => $leadEvents) {
            $latest = $leadEvents[0];
            $email = trim((string) ($latest['email'] ?? ''));
            if ($email === '' || isset($recovered[$leadKey])) {
                continue;
            }

            $items[] = $this->buildSegmentItem($latest, $userDirectory, 'Teve falha de pagamento e ainda nao regularizou.');
        }

        return $this->sortSegmentItems($items);
    }

    private function collectRenewalUpcomingLeads(array $subscriptions, array $userDirectory, DateTimeImmutable $now): array
    {
        $items = [];
        $limit = $now->modify('+5 days')->format('Y-m-d H:i:s');
        $nowSql = $now->format('Y-m-d H:i:s');

        foreach ($subscriptions as $subscription) {
            if (!in_array(strtolower((string) ($subscription['status'] ?? '')), ['active', 'trialing'], true)) {
                continue;
            }

            if ((int) ($subscription['auto_renew'] ?? 0) !== 1 || (int) ($subscription['cancel_at_period_end'] ?? 0) === 1) {
                continue;
            }

            $nextRenewalDate = trim((string) ($subscription['next_renewal_date'] ?? $subscription['current_period_end'] ?? ''));
            if ($nextRenewalDate === '' || $nextRenewalDate < $nowSql || $nextRenewalDate > $limit) {
                continue;
            }

            $items[] = [
                'userId' => (string) ($subscription['user_id'] ?? ''),
                'email' => (string) ($subscription['user_email'] ?? ''),
                'name' => (string) ($subscription['user_name'] ?? ''),
                'lastEventAt' => $nextRenewalDate,
                'notes' => sprintf(
                    'Renovacao prevista para %s no plano %s.',
                    substr($nextRenewalDate, 0, 10),
                    $subscription['plan_name'] ?? 'assinatura'
                ),
            ];
        }

        return $this->sortSegmentItems($items);
    }

    private function collectCancelledRecentlyLeads(array $events, array $userDirectory, DateTimeImmutable $now): array
    {
        $cutoff = $now->modify('-30 days')->format('Y-m-d H:i:s');
        $grouped = $this->groupEventsByLead(
            array_filter($events, static fn(array $event): bool => trim((string) ($event['created_at'] ?? '')) >= $cutoff),
            static fn(array $event): bool => ($event['event_name'] ?? '') === 'subscription_cancelled'
        );

        $items = [];
        foreach ($grouped as $leadEvents) {
            $latest = $leadEvents[0];
            $items[] = $this->buildSegmentItem($latest, $userDirectory, 'Cancelou a assinatura recentemente.');
        }

        return $this->sortSegmentItems($items);
    }

    private function collectActiveWithoutSubscriptionLeads(array $events, array $subscriptions, array $userDirectory, DateTimeImmutable $now): array
    {
        $cutoff = $now->modify('-30 days')->format('Y-m-d H:i:s');
        $activeSubscriptionLookup = $this->buildActiveSubscriptionLookup($subscriptions);

        $recentEvents = $this->groupEventsByLead(
            array_filter($events, static fn(array $event): bool => trim((string) ($event['created_at'] ?? '')) >= $cutoff),
            static fn(array $event): bool => true
        );

        $items = [];
        foreach ($recentEvents as $leadEvents) {
            $latest = $leadEvents[0];
            if (
                trim((string) ($latest['email'] ?? '')) === ''
                || $this->hasActiveSubscription($latest, $userDirectory, $activeSubscriptionLookup)
            ) {
                continue;
            }

            $items[] = $this->buildSegmentItem($latest, $userDirectory, 'Seguiu ativo no produto, mas sem assinatura vigente.');
        }

        return $this->sortSegmentItems($items);
    }

    private function collectSubscriberAtRiskLeads(array $subscriptions, array $userDirectory): array
    {
        $items = [];

        foreach ($subscriptions as $subscription) {
            $status = strtolower((string) ($subscription['status'] ?? ''));
            $cancelAtPeriodEnd = (int) ($subscription['cancel_at_period_end'] ?? 0);
            $autoRenew = (int) ($subscription['auto_renew'] ?? 1);

            if (!in_array($status, ['active', 'trialing', 'past_due'], true)) {
                continue;
            }

            if ($status !== 'past_due' && $cancelAtPeriodEnd !== 1 && $autoRenew !== 0) {
                continue;
            }

            $notes = $status === 'past_due'
                ? 'Assinatura em past_due e precisando de recuperacao.'
                : 'Assinatura ativa com renovacao desligada.';

            $items[] = [
                'userId' => (string) ($subscription['user_id'] ?? ''),
                'email' => (string) ($subscription['user_email'] ?? ''),
                'name' => (string) ($subscription['user_name'] ?? ''),
                'lastEventAt' => (string) ($subscription['updated_at'] ?? $subscription['created_at'] ?? ''),
                'notes' => $notes,
            ];
        }

        return $this->sortSegmentItems($items);
    }

    private function buildLeadSegment(string $key, string $label, array $items): array
    {
        return [
            'key' => $key,
            'label' => $label,
            'count' => count($items),
            'items' => $items,
        ];
    }

    private function groupEventsByLead(array $events, callable $predicate): array
    {
        $grouped = [];

        foreach ($events as $event) {
            if (!$predicate($event)) {
                continue;
            }

            $leadKey = $this->buildLeadKey($event);
            if (!isset($grouped[$leadKey])) {
                $grouped[$leadKey] = [];
            }

            $grouped[$leadKey][] = $event;
        }

        foreach ($grouped as &$leadEvents) {
            usort($leadEvents, static fn(array $left, array $right): int => strcmp(
                (string) ($right['created_at'] ?? ''),
                (string) ($left['created_at'] ?? '')
            ));
        }
        unset($leadEvents);

        return $grouped;
    }

    private function buildLeadCompletionMap(array $events, array $completionEventNames): array
    {
        $map = [];
        foreach ($events as $event) {
            if (!in_array($event['event_name'] ?? '', $completionEventNames, true)) {
                continue;
            }

            $map[$this->buildLeadKey($event)] = true;
        }

        return $map;
    }

    private function buildSegmentItem(array $event, array $userDirectory, string $notes): array
    {
        $userId = trim((string) ($event['user_id'] ?? ''));
        $email = trim((string) ($event['email'] ?? ''));
        $metadata = $this->decodeJson((string) ($event['metadata_json'] ?? ''));
        $directoryItem = $userId !== '' && isset($userDirectory['byId'][$userId])
            ? $userDirectory['byId'][$userId]
            : ($email !== '' && isset($userDirectory['byEmail'][strtolower($email)])
                ? $userDirectory['byEmail'][strtolower($email)]
                : null);

        return [
            'userId' => $userId !== '' ? $userId : ($directoryItem['id'] ?? null),
            'email' => $email !== '' ? $email : ($directoryItem['email'] ?? ''),
            'name' => $metadata['name'] ?? $directoryItem['name'] ?? null,
            'lastEventAt' => (string) ($event['created_at'] ?? ''),
            'notes' => $notes,
        ];
    }

    private function resolveJourneyStage(
        bool $emailCaptured,
        bool $createdAccount,
        bool $checkoutStarted,
        bool $paymentStarted,
        bool $purchased
    ): string {
        if ($purchased) {
            return 'Comprou';
        }

        if ($paymentStarted) {
            return 'Iniciou pagamento';
        }

        if ($checkoutStarted) {
            return 'Iniciou checkout';
        }

        if ($createdAccount) {
            return 'Criou conta';
        }

        if ($emailCaptured) {
            return 'Capturou email';
        }

        return 'Visitou';
    }

    private function formatReferrerLabel(string $referrerUrl): string
    {
        $referrerUrl = trim($referrerUrl);
        if ($referrerUrl === '') {
            return 'Direto / sem referencia';
        }

        $host = parse_url($referrerUrl, PHP_URL_HOST);
        if (!is_string($host) || trim($host) === '') {
            return $referrerUrl;
        }

        return preg_replace('/^www\./i', '', $host) ?: $referrerUrl;
    }

    private function formatCampaignLabel(string $utmSource, string $utmMedium, string $utmCampaign): string
    {
        $parts = array_values(array_filter([
            trim($utmSource),
            trim($utmMedium),
            trim($utmCampaign),
        ], static fn(string $value): bool => $value !== ''));

        if ($parts === []) {
            return 'Sem campanha mapeada';
        }

        return implode(' / ', $parts);
    }

    private function sortSegmentItems(array $items): array
    {
        usort($items, static fn(array $left, array $right): int => strcmp(
            (string) ($right['lastEventAt'] ?? ''),
            (string) ($left['lastEventAt'] ?? '')
        ));

        return array_values($items);
    }

    private function buildActiveSubscriptionLookup(array $subscriptions): array
    {
        $lookup = [
            'byUserId' => [],
            'byEmail' => [],
        ];

        foreach ($subscriptions as $subscription) {
            if (!in_array(strtolower((string) ($subscription['status'] ?? '')), ['active', 'trialing', 'past_due'], true)) {
                continue;
            }

            $userId = trim((string) ($subscription['user_id'] ?? ''));
            $email = strtolower(trim((string) ($subscription['user_email'] ?? '')));

            if ($userId !== '') {
                $lookup['byUserId'][$userId] = true;
            }

            if ($email !== '') {
                $lookup['byEmail'][$email] = true;
            }
        }

        return $lookup;
    }

    private function resolveDirectoryUser(array $row, array $userDirectory): ?array
    {
        $userId = trim((string) ($row['user_id'] ?? $row['userId'] ?? ''));
        if ($userId !== '' && isset($userDirectory['byId'][$userId])) {
            return $userDirectory['byId'][$userId];
        }

        $email = strtolower(trim((string) ($row['email'] ?? '')));
        if ($email !== '' && isset($userDirectory['byEmail'][$email])) {
            return $userDirectory['byEmail'][$email];
        }

        return null;
    }

    private function hasRegisteredAccount(array $row, array $userDirectory): bool
    {
        return $this->resolveDirectoryUser($row, $userDirectory) !== null;
    }

    private function hasActiveSubscription(array $row, array $userDirectory, array $activeSubscriptionLookup): bool
    {
        $userId = trim((string) ($row['user_id'] ?? $row['userId'] ?? ''));
        $email = strtolower(trim((string) ($row['email'] ?? '')));
        $directoryUser = $this->resolveDirectoryUser($row, $userDirectory);

        if ($userId !== '' && isset($activeSubscriptionLookup['byUserId'][$userId])) {
            return true;
        }

        if ($email !== '' && isset($activeSubscriptionLookup['byEmail'][$email])) {
            return true;
        }

        $directoryUserId = trim((string) ($directoryUser['id'] ?? ''));
        if ($directoryUserId !== '' && isset($activeSubscriptionLookup['byUserId'][$directoryUserId])) {
            return true;
        }

        $directoryEmail = strtolower(trim((string) ($directoryUser['email'] ?? '')));
        if ($directoryEmail !== '' && isset($activeSubscriptionLookup['byEmail'][$directoryEmail])) {
            return true;
        }

        return false;
    }

    private function indexUsers(array $users): array
    {
        $byId = [];
        $byEmail = [];

        foreach ($users as $user) {
            $id = trim((string) ($user['id'] ?? ''));
            $email = strtolower(trim((string) ($user['email'] ?? '')));

            if ($id !== '') {
                $byId[$id] = $user;
            }

            if ($email !== '') {
                $byEmail[$email] = $user;
            }
        }

        return [
            'byId' => $byId,
            'byEmail' => $byEmail,
        ];
    }

    private function countDistinctLeadsForEvents(array $events, array $eventNames): int
    {
        $leads = [];
        foreach ($events as $event) {
            if (!in_array($event['event_name'] ?? '', $eventNames, true)) {
                continue;
            }

            $leads[$this->buildLeadKey($event)] = true;
        }

        return count($leads);
    }

    private function countTransactionsByStatus(array $transactions, string $status): int
    {
        $normalizedStatus = strtolower($status);
        $count = 0;

        foreach ($transactions as $transaction) {
            if ($this->normalizeTransactionStatus($transaction) === $normalizedStatus) {
                $count++;
            }
        }

        return $count;
    }

    private function normalizeTransactionStatus(array $transaction): string
    {
        if (
            trim((string) ($transaction['provider_refund_id'] ?? '')) !== ''
            || trim((string) ($transaction['refunded_at'] ?? '')) !== ''
        ) {
            if (
                (float) ($transaction['refunded_amount'] ?? 0) > 0
                && (float) ($transaction['refunded_amount'] ?? 0) < (float) ($transaction['amount'] ?? 0)
            ) {
                return 'partially_refunded';
            }
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

    private function countSubscriptionsByStatuses(array $subscriptions, array $statuses): int
    {
        $normalizedStatuses = array_map(static fn(string $value): string => strtolower($value), $statuses);

        return count(array_filter($subscriptions, static function (array $subscription) use ($normalizedStatuses): bool {
            return in_array(strtolower((string) ($subscription['status'] ?? '')), $normalizedStatuses, true);
        }));
    }

    private function countRecoveredLeads(array $events): int
    {
        $failedByLead = [];
        $recoveredByLead = [];

        foreach ($events as $event) {
            $leadKey = $this->buildLeadKey($event);
            $eventName = $event['event_name'] ?? '';
            $createdAt = (string) ($event['created_at'] ?? '');

            if ($eventName === 'payment_failed') {
                $failedByLead[$leadKey] = $createdAt;
            }

            if (in_array($eventName, ['purchase_completed', 'renewal_completed'], true)) {
                $recoveredByLead[$leadKey] = $createdAt;
            }
        }

        $count = 0;
        foreach ($failedByLead as $leadKey => $failedAt) {
            if (($recoveredByLead[$leadKey] ?? '') > $failedAt) {
                $count++;
            }
        }

        return $count;
    }

    private function calculateMrr(array $subscriptions): float
    {
        $mrr = 0.0;

        foreach ($subscriptions as $subscription) {
            if (!in_array(strtolower((string) ($subscription['status'] ?? '')), ['active', 'trialing', 'past_due'], true)) {
                continue;
            }

            if ((int) ($subscription['auto_renew'] ?? 0) !== 1 || (int) ($subscription['cancel_at_period_end'] ?? 0) === 1) {
                continue;
            }

            $mrr += $this->monthlyizeSubscriptionAmount($subscription);
        }

        return $mrr;
    }

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

    private function addProjectionInterval(\DateTimeImmutable $date, int $steps, string $intervalUnit, int $intervalCount): \DateTimeImmutable
    {
        if ($steps <= 0) {
            return $date;
        }

        $amount = max(1, $intervalCount) * $steps;

        return match ($intervalUnit) {
            'day' => $date->modify(sprintf('+%d days', $amount)),
            'week' => $date->modify(sprintf('+%d weeks', $amount)),
            'year' => $date->modify(sprintf('+%d years', $amount)),
            default => $date->modify(sprintf('+%d months', $amount)),
        };
    }

    private function resolveProjectionChargeIntervalDays(array $planContext, int $termCycles): int
    {
        if (function_exists('getStripeChargeIntervalDays')) {
            return max(1, (int) getStripeChargeIntervalDays($planContext, max(1, $termCycles)));
        }

        return max(1, (int) round($this->intervalToMonths(
            strtolower((string) ($planContext['interval_unit'] ?? 'month')),
            max(1, (int) ($planContext['interval_count'] ?? 1))
        ) * 30.4375 / max(1, $termCycles)));
    }

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

    private function buildTrendItem(string $key, string $label, int $current, int $previous): array
    {
        $deltaPercent = $previous > 0
            ? (($current - $previous) / $previous) * 100
            : ($current > 0 ? 100.0 : 0.0);

        return [
            'key' => $key,
            'label' => $label,
            'current' => $current,
            'previous' => $previous,
            'deltaPercent' => round($deltaPercent, 2),
        ];
    }

    private function findTrend(array $trends, string $key): ?array
    {
        foreach ($trends as $trend) {
            if (($trend['key'] ?? '') === $key) {
                return $trend;
            }
        }

        return null;
    }

    private function findFunnelStep(array $funnel, string $key): ?array
    {
        foreach ($funnel as $step) {
            if (($step['key'] ?? '') === $key) {
                return $step;
            }
        }

        return null;
    }

    private function resolveWindow(array $filters): array
    {
        $timezone = new DateTimeZone('America/Sao_Paulo');
        $now = new DateTimeImmutable('now', $timezone);
        $start = null;
        $end = $now;

        if ($filters['period'] === 'custom' && $filters['startDate'] && $filters['endDate']) {
            $start = new DateTimeImmutable($filters['startDate'] . ' 00:00:00', $timezone);
            $end = new DateTimeImmutable($filters['endDate'] . ' 23:59:59', $timezone);
        } elseif ($filters['period'] === 'today') {
            $start = $now->setTime(0, 0, 0);
            $end = $now->setTime(23, 59, 59);
        } elseif ($filters['period'] === 'week') {
            $start = $now->setTime(0, 0, 0)->modify('-6 days');
            $end = $now->setTime(23, 59, 59);
        } elseif ($filters['period'] === 'month') {
            $start = $now->setTime(0, 0, 0)->modify('-29 days');
            $end = $now->setTime(23, 59, 59);
        } elseif ($filters['period'] === 'year') {
            $start = $now->modify('first day of this month')->setTime(0, 0, 0)->modify('-11 months');
            $end = $now->setTime(23, 59, 59);
        }

        return [
            'period' => $filters['period'],
            'startDateTime' => $start?->format('Y-m-d H:i:s'),
            'endDateTime' => $end?->format('Y-m-d H:i:s'),
            'now' => $now,
        ];
    }

    private function resolveTrendWindow(array $window): array
    {
        /** @var DateTimeImmutable $now */
        $now = $window['now'];
        $currentEnd = $window['endDateTime']
            ? new DateTimeImmutable($window['endDateTime'], new DateTimeZone('America/Sao_Paulo'))
            : $now;

        if ($window['startDateTime']) {
            $currentStart = new DateTimeImmutable($window['startDateTime'], new DateTimeZone('America/Sao_Paulo'));
        } else {
            $currentStart = $now->modify('-30 days');
        }

        $interval = $currentEnd->getTimestamp() - $currentStart->getTimestamp();
        if ($interval <= 0) {
            $interval = 30 * 24 * 60 * 60;
        }

        $previousEnd = $currentStart->modify('-1 second');
        $previousStart = $previousEnd->modify('-' . $interval . ' seconds');

        return [
            'currentStart' => $currentStart->format('Y-m-d H:i:s'),
            'currentEnd' => $currentEnd->format('Y-m-d H:i:s'),
            'previousStart' => $previousStart->format('Y-m-d H:i:s'),
            'previousEnd' => $previousEnd->format('Y-m-d H:i:s'),
        ];
    }

    private function buildLeadKey(array $row): string
    {
        $userId = trim((string) ($row['user_id'] ?? ''));
        if ($userId !== '') {
            return 'user:' . $userId;
        }

        $email = strtolower(trim((string) ($row['email'] ?? '')));
        if ($email !== '') {
            return 'email:' . $email;
        }

        $sessionKey = trim((string) ($row['session_key'] ?? ''));
        if ($sessionKey !== '') {
            return 'session:' . $sessionKey;
        }

        return 'event:' . (string) ($row['id'] ?? uniqid('event-', true));
    }

    private function decodeJson(string $raw): array
    {
        if ($raw === '') {
            return [];
        }

        $decoded = json_decode($raw, true);
        return is_array($decoded) ? $decoded : [];
    }

    private function normalizeCycleLabel(string $cycleLabel, array $metadata = []): string
    {
        $normalized = strtolower(trim($cycleLabel));
        if ($normalized !== '') {
            return $normalized;
        }

        $intervalUnit = strtolower((string) ($metadata['interval_unit'] ?? ''));
        $intervalCount = (int) ($metadata['interval_count'] ?? 0);
        $totalInstallments = (int) ($metadata['total_installments'] ?? 0);

        if ($intervalUnit === 'day') {
            return $intervalCount === 1 ? 'diario' : $intervalCount . '_dias';
        }

        if ($intervalUnit === 'week') {
            return $intervalCount === 1 ? 'semanal' : $intervalCount . '_semanas';
        }

        if ($intervalUnit === 'year' || $intervalCount === 12 || $totalInstallments >= 12) {
            return 'anual';
        }

        if ($intervalCount === 3 || $totalInstallments === 3) {
            return 'trimestral';
        }

        if ($intervalCount === 1 || $intervalUnit === 'month') {
            return 'mensal';
        }

        return 'indefinido';
    }

    private function formatCycleLabel(string $cycleLabel): string
    {
        return match ($cycleLabel) {
            'mensal' => 'Mensal',
            'trimestral' => 'Trimestral',
            'anual' => 'Anual',
            'diario' => 'Diario',
            'semanal' => 'Semanal',
            default => ucfirst(str_replace('_', ' ', $cycleLabel)),
        };
    }

    private function now(): DateTimeImmutable
    {
        return new DateTimeImmutable('now', new DateTimeZone('America/Sao_Paulo'));
    }
}

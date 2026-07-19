<?php

declare(strict_types=1);

function assertReferralContains(string $path, string $needle, string $message): void
{
    $content = file_get_contents($path);
    if ($content === false || strpos($content, $needle) === false) {
        fwrite(STDERR, $message . ' [' . $path . ']' . PHP_EOL);
        exit(1);
    }
}

function assertReferralNotContains(string $path, string $needle, string $message): void
{
    $content = file_get_contents($path);
    if ($content !== false && strpos($content, $needle) !== false) {
        fwrite(STDERR, $message . ' [' . $path . ']' . PHP_EOL);
        exit(1);
    }
}

$base = dirname(__DIR__);
$service = $base . '/modules/finance/services/ReferralFinance.php';
$ledger = $base . '/modules/finance/services/FinancialLedger.php';
$migration = $base . '/database/migrations/20260719_010000_referral_finance_foundation.php';
$rewards = $base . '/modules/users/services/UsersReferralRewardsService.php';
$transactionsRepository = $base . '/modules/transactions/repositories/TransactionsRepository.php';
$transactionsService = $base . '/modules/transactions/services/TransactionsService.php';
$analytics = $base . '/modules/admin/services/AdminAnalyticsService.php';
$frontendProvider = dirname($base) . '/src/providers/MarketplaceProvider.tsx';

assertReferralContains($migration, 'UNIQUE KEY uq_referral_commission_entry_key', 'Commission entries must be idempotent');
assertReferralContains($migration, 'referral_payout_cycles', 'Payout cycles must be persisted');
assertReferralContains($migration, 'referral_payout_items', 'Payout items must be auditable');
assertReferralNotContains($migration, 'INSERT INTO referral_commission_entries SELECT', 'Migration must not create retroactive liabilities');

assertReferralContains($service, "transactionType !== 'plan'", 'Only subscription captures may create referral commission');
assertReferralContains($service, 'commission_percent', 'Commission percentage must be snapshotted');
assertReferralContains($service, 'refund-total', 'Refund adjustments must be idempotent');
assertReferralContains($service, "available_at <= NOW()", 'Only mature entries may enter payout cycles');
assertReferralContains($service, "providerReference", 'Paid payouts must require evidence');
assertReferralContains($service, 'no_available_balance', 'Empty cycles must not be created');
assertReferralContains($service, 'WHERE e.payout_item_id = i.id', 'Cycle items must be recalculated from entries actually assigned');
assertReferralContains($service, 'SET payout_item_id = NULL WHERE payout_item_id = :item_id', 'Non-positive raced balances must remain available for future offsetting');

assertReferralContains($ledger, 'ReferralFinance::syncTransaction', 'Financial synchronization must materialize referral liabilities');
assertReferralNotContains($rewards, 'incrementUserXp', 'Legacy XP rewards must be disabled');
assertReferralNotContains($rewards, 'updateUserRewardPlan', 'Legacy plan-day rewards must be disabled');

assertReferralContains($transactionsRepository, "WHEN t.type = 'plan' THEN", 'Plan revenue must belong to the platform');
assertReferralContains($transactionsService, "\$type === 'material'", 'Seller payable must be restricted to marketplace material sales');
assertReferralContains($analytics, "\$ledgerByType['plan']", 'Analytics must separate subscription and marketplace accounting');
assertReferralContains($analytics, "\$ledgerByType['material']", 'Analytics must isolate seller payable');

assertReferralNotContains($frontendProvider, "status: 'refund_requested',\n              limit: ADMIN_TRANSACTION_LIST_LIMIT", 'Admin transactions must not issue a second filtered request');

fwrite(STDOUT, "Referral finance wiring tests passed.\n");

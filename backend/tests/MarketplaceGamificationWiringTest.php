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

function assertMarketplaceGamificationContains(string $path, string $needle, string $message): void
{
    $content = file_get_contents($path);
    if ($content === false || strpos($content, $needle) === false) {
        throw new RuntimeException($message . ' [' . $path . ']');
    }
}

$base = 'C:/xampp/htdocs/questao-pro-backend';
$helper = $base . '/config/gamification_helper.php';
$transactionsService = $base . '/modules/transactions/services/TransactionsService.php';
$paymentsService = $base . '/modules/payments/services/PaymentsService.php';
$materialsService = $base . '/modules/materials/services/MaterialsService.php';
$questionsRepository = $base . '/modules/questions/repositories/QuestionsRepository.php';
$schema = $base . '/database/schema.sql';
$migration = $base . '/scripts/migrations/migrate_marketplace_schema_compatibility.php';

assertMarketplaceGamificationContains(
    $helper,
    'CREATE TABLE IF NOT EXISTS user_gamification_events',
    'Gamification helper must create an idempotent event ledger'
);

assertMarketplaceGamificationContains(
    $helper,
    'UNIQUE KEY uniq_user_gamification_event_key',
    'Gamification event ledger must protect repeated webhooks and retries'
);

assertMarketplaceGamificationContains(
    $helper,
    'function applyMarketplaceSaleGamification',
    'Marketplace sales must have a canonical gamification rule'
);

assertMarketplaceGamificationContains(
    $helper,
    'function resolveGamificationEventEffect',
    'Gamification helper must resolve admin-configured XP and reputation effects'
);

assertMarketplaceGamificationContains(
    $helper,
    "array_key_exists('xp', \$rule)",
    'Admin gamification rules must be able to override fixed XP values'
);

assertMarketplaceGamificationContains(
    $helper,
    "array_key_exists('maxXp', \$rule)",
    'Admin gamification rules must keep variable rewards capped by max XP'
);

assertMarketplaceGamificationContains(
    $helper,
    '$xpDelta = (int) $effect[\'xp_delta\'];',
    'Granting gamification events must apply the resolved XP delta'
);

assertMarketplaceGamificationContains(
    $helper,
    'function applyMarketplaceRefundGamification',
    'Marketplace refunds must have a canonical reputation adjustment rule'
);

assertMarketplaceGamificationContains(
    $helper,
    'function applyMaterialModerationGamification',
    'Approved marketplace materials must reward authors'
);

assertMarketplaceGamificationContains(
    $transactionsService,
    "/../../../config/gamification_helper.php",
    'Direct transactions must load gamification helper'
);

assertMarketplaceGamificationContains(
    $transactionsService,
    'applyMarketplaceSaleGamification(',
    'Direct material purchases must grant marketplace XP/reputation'
);

assertMarketplaceGamificationContains(
    $transactionsService,
    'applyMarketplaceRefundGamification(',
    'Processed refunds must adjust seller reputation idempotently'
);

assertMarketplaceGamificationContains(
    $paymentsService,
    "/../../../config/gamification_helper.php",
    'Stripe payment flow must load gamification helper'
);

assertMarketplaceGamificationContains(
    $paymentsService,
    'applyMarketplaceSaleGamification(',
    'Stripe material approvals must grant marketplace XP/reputation'
);

assertMarketplaceGamificationContains(
    $materialsService,
    'applyMaterialModerationGamification(',
    'Material approval moderation must reward authors'
);

assertMarketplaceGamificationContains(
    $questionsRepository,
    'ALTER TABLE user_badges MODIFY user_id VARCHAR(64) NOT NULL',
    'Question gamification bootstrap must repair old badge user id width'
);

assertMarketplaceGamificationContains(
    $schema,
    'CREATE TABLE IF NOT EXISTS user_gamification_events',
    'Reference schema must include gamification event ledger'
);

assertMarketplaceGamificationContains(
    $migration,
    'ensureGamificationSupportSchema($db)',
    'Marketplace compatibility migration must bootstrap gamification tables'
);

fwrite(STDOUT, "Marketplace gamification wiring assertions passed.\n");

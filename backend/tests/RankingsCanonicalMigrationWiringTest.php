<?php

declare(strict_types=1);

function assertRankingMigration(bool $condition, string $message): void
{
    if (!$condition) {
        throw new RuntimeException($message);
    }
}

$base = dirname(__DIR__);
$migration = file_get_contents($base . '/database/migrations/20260718_020000_rankings_canonical_contract.php');
$repository = file_get_contents($base . '/modules/rankings/repositories/RankingsRepository.php');
$service = file_get_contents($base . '/modules/rankings/services/RankingsService.php');

assertRankingMigration(is_string($migration), 'Rankings migration is missing.');
assertRankingMigration(is_string($repository), 'Rankings repository is missing.');
assertRankingMigration(is_string($service), 'Rankings service is missing.');

foreach (['vacancies_ac', 'official_key_release_date', 'published_by_user_id', 'registration_number', 'discursive_score'] as $column) {
    assertRankingMigration(strpos($migration, $column) !== false, "Migration does not formalize {$column}.");
}
assertRankingMigration(strpos($repository, 'ensureRankingRuntimeColumns') === false, 'Ranking insert still repairs schema at runtime.');
assertRankingMigration(strpos($repository, 'ALTER TABLE') === false, 'Ranking repository still executes runtime DDL.');
assertRankingMigration(strpos($repository, 'CREATE TABLE') === false, 'Ranking repository still creates tables at runtime.');
assertRankingMigration(strpos($service, 'ALTER TABLE') === false, 'Ranking service still exposes DDL over HTTP.');
assertRankingMigration(strpos($service, 'assertCanonicalSchema') !== false, 'Ranking service does not validate the canonical schema.');

fwrite(STDOUT, "Rankings canonical migration wiring assertions passed.\n");

<?php

declare(strict_types=1);

$root = dirname(__DIR__);
$marketing = (string) file_get_contents($root . '/modules/marketing/services/MarketingCampaignService.php');
$benefits = (string) file_get_contents($root . '/modules/benefits/services/BenefitService.php');
$routes = (string) file_get_contents($root . '/modules/benefits/routes.php');

$assert = static function (bool $condition, string $message): void {
    if (!$condition) {
        throw new RuntimeException($message);
    }
};

$assert(str_contains($marketing, 'grantCampaignBenefit'), 'Marketing must expose one canonical benefit fulfillment boundary.');
$assert(str_contains($marketing, 'grantMarketingBenefit'), 'Marketing must delegate fulfillment to BenefitService.');
$assert(str_contains($benefits, 'source_type\' => \'MARKETING\''), 'Marketing grants must be marked with their canonical source type.');
$assert(str_contains($routes, "'reconcile_provider_extension'"), 'Provider reconciliation must have an explicit recoverable route.');
$assert(!str_contains($marketing, 'UPDATE benefit_'), 'Marketing must not mutate benefit persistence directly.');

fwrite(STDOUT, "Marketing benefit authority assertions passed.\n");

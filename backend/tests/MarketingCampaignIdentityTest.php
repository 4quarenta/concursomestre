<?php

declare(strict_types=1);

require_once __DIR__ . '/../modules/marketing/services/MarketingCampaignService.php';

$reflection = new ReflectionClass(MarketingCampaignService::class);
$service = $reflection->newInstanceWithoutConstructor();
$generator = $reflection->getMethod('uuid');
$seen = [];
for ($i = 0; $i < 1000; $i++) {
    $id = $generator->invoke($service);
    if (strlen($id) !== 36 || !preg_match('/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/D', $id)) {
        throw new RuntimeException('Marketing identity must fit CHAR(36) and use UUID v4.');
    }
    if (isset($seen[$id])) {
        throw new RuntimeException('Duplicate generated marketing identity.');
    }
    $seen[$id] = true;
}
echo "MarketingCampaignIdentityTest PASS\n";

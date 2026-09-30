<?php

declare(strict_types=1);

$serviceSource = (string) file_get_contents(__DIR__ . '/../modules/admin/services/AdminSettingsService.php');

foreach ([
    <<<'TEXT'
fetchAllSystemSettings();
        $this->validateFeaturedOrganizationFilterTypes($data, $persistedSettings);
TEXT,
    'private function validateFeaturedOrganizationFilterTypes(array $payload, array $persistedSettings = []): void',
    'if ($items == $persistedItems) {',
    "throw new InvalidArgumentException('A vitrine aceita somente filtros existentes do tipo orgao.');",
] as $required) {
    if (!str_contains($serviceSource, $required)) {
        throw new RuntimeException('Admin settings featured organization validation wiring is incomplete.');
    }
}

echo "Admin settings featured organization validation assertions passed.\n";

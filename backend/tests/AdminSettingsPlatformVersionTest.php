<?php

declare(strict_types=1);

require_once dirname(__DIR__) . '/modules/admin/validators/AdminSettingsValidator.php';

function assertPlatformVersion(bool $condition, string $message): void
{
    if (!$condition) {
        throw new RuntimeException($message);
    }
}

$validator = new AdminSettingsValidator();

$validated = $validator->validateUpdatePayload([
    'platformVersion' => ' 1.2.3-beta.1 ',
]);

assertPlatformVersion(
    ($validated['platformVersion'] ?? null) === '1.2.3-beta.1',
    'Platform version must be trimmed and preserved.'
);

$tooLongVersionRejected = false;
try {
    $validator->validateUpdatePayload([
        'platformVersion' => str_repeat('1', 41),
    ]);
} catch (InvalidArgumentException) {
    $tooLongVersionRejected = true;
}

assertPlatformVersion($tooLongVersionRejected, 'Platform version length must be validated.');

fwrite(STDOUT, "Admin settings platform version assertions passed.\n");

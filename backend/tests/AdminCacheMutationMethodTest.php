<?php

declare(strict_types=1);

require_once dirname(__DIR__) . '/modules/admin/validators/AdminCacheValidator.php';

$validator = new AdminCacheValidator();

foreach (['GET', 'PUT', 'PATCH', 'DELETE'] as $method) {
    try {
        $validator->validateMutationMethod($method);
        throw new RuntimeException('Mutating cache action accepted unsafe method: ' . $method);
    } catch (RuntimeException $exception) {
        if ($exception->getMessage() === 'Mutating cache action accepted unsafe method: ' . $method) {
            throw $exception;
        }
    }
}

$validator->validateMutationMethod('POST');

$service = (string) file_get_contents(dirname(__DIR__) . '/modules/admin/services/AdminCacheService.php');
if (!str_contains($service, "in_array(\$action, ['clear', 'clean'], true)")) {
    throw new RuntimeException('Cache mutation actions must be guarded by the HTTP method validator.');
}

fwrite(STDOUT, "Admin cache mutation method assertions passed.\n");

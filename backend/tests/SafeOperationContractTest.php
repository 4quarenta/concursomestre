<?php

declare(strict_types=1);

require_once __DIR__ . '/../modules/admin/services/SafeOperationPolicy.php';

function assertSafeOperationContract(bool $condition, string $message): void
{
    if (!$condition) {
        throw new RuntimeException($message);
    }
}

$policy = SafeOperationPolicy::catalog();
assertSafeOperationContract(count($policy) === 4, 'Safe operation catalog must remain a closed four-operation allowlist.');
assertSafeOperationContract(isset($policy['global_reset.synthetic']), 'Global reset preview contract is missing.');
assertSafeOperationContract($policy['global_reset.synthetic']['execution_allowed'] === false, 'Broad reset must remain preview-only.');
assertSafeOperationContract($policy['cache.synthetic_expired_cleanup']['execution_allowed'] === true, 'Synthetic cache cleanup must be executable through the authority.');

$policyPath = (string) file_get_contents(__DIR__ . '/../modules/admin/services/SafeOperationPolicy.php');
$servicePath = (string) file_get_contents(__DIR__ . '/../modules/admin/services/SafeOperationService.php');
$routesPath = (string) file_get_contents(__DIR__ . '/../modules/admin/routes.php');

assertSafeOperationContract(str_contains($servicePath, 'preview_fingerprint'), 'SafeOperation must persist and verify the preview fingerprint.');
assertSafeOperationContract(str_contains($servicePath, 'confirmation_expires_at'), 'SafeOperation must expire scoped confirmations.');
assertSafeOperationContract(str_contains($servicePath, 'stale_preview'), 'SafeOperation must deny stale previews.');
assertSafeOperationContract(str_contains($servicePath, 'FOR UPDATE'), 'SafeOperation must serialize concurrent execution.');
assertSafeOperationContract(str_contains($servicePath, 'PROHIBITED_IN_PRODUCTION'), 'Global reset must be prohibited in production execution.');
assertSafeOperationContract(str_contains($routesPath, 'requireAdminMutationCsrf();'), 'SafeOperation mutations must require the shared CSRF contract.');
assertSafeOperationContract(str_contains($routesPath, 'handleAdminSafeOperationsRoute'), 'The SafeOperation endpoint must delegate to the canonical admin route.');
assertSafeOperationContract(!str_contains($policyPath, 'confirm = true'), 'Generic confirmation must not appear in the policy.');

echo "SafeOperationContractTest: PASS\n";

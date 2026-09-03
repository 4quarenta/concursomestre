<?php

declare(strict_types=1);

require_once __DIR__ . '/../scripts/operations/RuntimeGrantContract.php';

function runtimeGrantAssert(bool $condition, string $message): void
{
    if (!$condition) throw new RuntimeException($message);
}

$valid = RuntimeGrantContract::evaluate([
    'GRANT SELECT, INSERT, UPDATE, DELETE ON `app`.* TO `runtime`@`127.0.0.1`',
]);
runtimeGrantAssert($valid['ok'] === true, 'Least-privilege DML grant set must pass.');
runtimeGrantAssert($valid['rawGrantsIncluded'] === false, 'Raw grants must never be returned by the verifier.');

$usageOnly = RuntimeGrantContract::evaluate(['GRANT USAGE ON *.* TO `runtime`@`127.0.0.1`']);
runtimeGrantAssert($usageOnly['ok'] === false && count($usageOnly['missingCapabilities']) === 4, 'Usage-only principal must fail the runtime contract.');

$broad = RuntimeGrantContract::evaluate(['GRANT ALL PRIVILEGES ON *.* TO `runtime`@`127.0.0.1` WITH GRANT OPTION']);
runtimeGrantAssert($broad['ok'] === false, 'Broad/grant-option principal must fail closed.');
runtimeGrantAssert(in_array('ALL PRIVILEGES', $broad['forbiddenCapabilities'], true), 'ALL PRIVILEGES must be forbidden.');

$triggerCapable = RuntimeGrantContract::evaluate([
    'GRANT SELECT, INSERT, UPDATE, DELETE, TRIGGER ON `app`.* TO `runtime`@`127.0.0.1`',
]);
runtimeGrantAssert($triggerCapable['ok'] === false, 'Runtime must never receive TRIGGER as a sitemap repair workaround.');
runtimeGrantAssert(in_array('TRIGGER', $triggerCapable['forbiddenCapabilities'], true), 'TRIGGER must be forbidden for runtime.');

fwrite(STDOUT, "Runtime grant contract assertions passed.\n");

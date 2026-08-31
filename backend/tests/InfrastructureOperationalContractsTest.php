<?php

declare(strict_types=1);

require_once __DIR__ . '/../scripts/data/DatasetWriterSystemdFreezePolicy.php';

function infrastructureContractAssert(bool $condition, string $message): void
{
    if (!$condition) throw new RuntimeException($message);
}

$freeze = DatasetWriterSystemdFreezePolicy::availabilitySafeFreezeGuard();
infrastructureContractAssert($freeze['valid'] === true, 'Availability-safe freeze guard must pass.');
infrastructureContractAssert($freeze['blockers'] === [], 'Freeze guard must have no serving-layer blockers.');
foreach (DatasetWriterSystemdFreezePolicy::publicServingLayerUnits() as $unit) {
    infrastructureContractAssert(!in_array($unit, DatasetWriterSystemdFreezePolicy::stopOrder(), true), 'Public serving unit is still in stop order: ' . $unit);
}

$nginx = (string) file_get_contents(dirname(__DIR__, 2) . '/config/deploy/nginx.concursomestre.conf.example');
infrastructureContractAssert(str_contains($nginx, 'location ^~ /questao-pro-backend/'), 'Legacy backend route must be explicitly denied.');
infrastructureContractAssert(str_contains($nginx, 'return 404;'), 'Legacy backend route candidate must fail closed.');

$mysql = (string) file_get_contents(dirname(__DIR__, 2) . '/config/deploy/mysql-network-hardening.cnf.example');
infrastructureContractAssert(str_contains($mysql, 'bind-address = 127.0.0.1'), 'MySQL candidate must bind privately.');
infrastructureContractAssert(str_contains($mysql, 'mysqlx-bind-address = 127.0.0.1'), 'MySQL X candidate must bind privately.');

fwrite(STDOUT, "Infrastructure operational contract assertions passed.\n");

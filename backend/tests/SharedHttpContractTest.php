<?php

declare(strict_types=1);

require_once __DIR__ . '/../shared/responses/ApiEnvelope.php';
require_once __DIR__ . '/../shared/http/Request.php';
require_once __DIR__ . '/../shared/errors/HttpException.php';

function httpContractAssert(bool $condition, string $message): void
{
    if (!$condition) {
        throw new RuntimeException($message);
    }
}

foreach ([[], 0, false, null, ''] as $value) {
    $envelope = ApiEnvelope::success($value);
    httpContractAssert(array_key_exists('data', $envelope), 'Envelope de sucesso perdeu o campo data.');
    httpContractAssert($envelope['data'] === $value, 'Envelope de sucesso alterou um valor falsy valido.');
}

Request::setRawBodyForTesting('{"enabled":false,"count":0,"items":[]}');
httpContractAssert(
    Request::json() === ['enabled' => false, 'count' => 0, 'items' => []],
    'Request::json alterou o payload.'
);

Request::setRawBodyForTesting('[]');
try {
    Request::json();
    throw new RuntimeException('Request::json aceitou lista no lugar de objeto.');
} catch (InvalidArgumentException) {
}

$_SERVER['REQUEST_METHOD'] = 'PATCH';
try {
    Request::requireMethod(['GET', 'POST']);
    throw new RuntimeException('Request::requireMethod aceitou metodo fora do contrato.');
} catch (MethodNotAllowedException $exception) {
    httpContractAssert($exception->statusCode() === 405, 'Status incorreto para metodo nao permitido.');
}

Request::setRawBodyForTesting(null);
fwrite(STDOUT, "SharedHttpContractTest: PASS\n");

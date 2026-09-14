<?php

declare(strict_types=1);

require_once dirname(__DIR__) . '/modules/ingestion/domain/BrowserFixturePublicationPolicy.php';

function m20f05FinalActionAssert(bool $condition, string $message): void
{
    if (!$condition) throw new RuntimeException($message);
}

$retryable = [
    'source' => [
        'provider' => BrowserFixturePublicationPolicy::PROVIDER,
        'fixtureStatus' => BrowserFixturePublicationPolicy::RETRYABLE_FAILURE,
    ],
];
$blocked = [
    'source' => [
        'provider' => BrowserFixturePublicationPolicy::PROVIDER,
        'fixtureStatus' => BrowserFixturePublicationPolicy::PUBLICATION_BLOCKED,
    ],
];
$payload = ['schemaVersion' => 'question-import.v2', 'import' => ['extractionMode' => 'm20f05_browser_fixture'], 'questions' => [$retryable]];

m20f05FinalActionAssert(
    BrowserFixturePublicationPolicy::shouldFailFirstRetryableAttempt($retryable, $payload),
    'A primeira tentativa retryable deve falhar de forma deterministica.'
);
$retryPayload = BrowserFixturePublicationPolicy::markRetryAttempt($payload, 2);
m20f05FinalActionAssert(
    !BrowserFixturePublicationPolicy::shouldFailFirstRetryableAttempt($retryable, $retryPayload),
    'A segunda tentativa retryable deve seguir para sucesso.'
);
m20f05FinalActionAssert(
    BrowserFixturePublicationPolicy::isPublicationBlocked($blocked),
    'O candidato bloqueado deve ser reconhecido pela guarda canonica.'
);
m20f05FinalActionAssert(
    !BrowserFixturePublicationPolicy::isPublicationBlocked(['source' => ['provider' => 'gran']]),
    'A guarda fixture nao pode bloquear provider real.'
);

fwrite(STDOUT, "M20F-05 browser final action policy assertions passed.\n");

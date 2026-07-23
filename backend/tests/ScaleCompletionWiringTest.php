<?php

declare(strict_types=1);

function scaleCompletionAssert(bool $condition, string $message): void
{
    if (!$condition) {
        throw new RuntimeException($message);
    }
}

$backend = dirname(__DIR__);
$database = (string) file_get_contents($backend . '/config/database.php');
$exams = (string) file_get_contents($backend . '/modules/exams/services/ExamsService.php');
$legal = (string) file_get_contents($backend . '/modules/legal_commentary/services/LegalCommentaryService.php');
$storage = (string) file_get_contents($backend . '/shared/storage/ObjectStorage.php');
$archive = (string) file_get_contents($backend . '/scripts/tasks/archive_user_answers.php');
$sitemap = (string) file_get_contents($backend . '/scripts/seo/generate_static_sitemaps.php');
$outbox = (string) file_get_contents($backend . '/shared/events/TransactionalOutbox.php');
$questionWorker = (string) file_get_contents($backend . '/ops/systemd/concursomestre-question-ingestion@.service');
$eventWorker = (string) file_get_contents($backend . '/ops/systemd/concursomestre-platform-events@.service');
$eventOperations = (string) file_get_contents($backend . '/scripts/tasks/manage_platform_events.php');
$readRoutes = implode("\n", array_map(
    static fn (string $path): string => (string) file_get_contents($backend . $path),
    [
        '/api/exams/files.php',
        '/api/exams/list.php',
        '/api/exams/show.php',
        '/api/questions/list.php',
        '/api/legal-commentary/list.php',
        '/api/legal-commentary/admin/list.php',
    ]
));

foreach (['DB_READ_HOST', 'isUsingReplica'] as $needle) {
    scaleCompletionAssert(str_contains($database, $needle), 'Read replica sem wiring: ' . $needle);
}
scaleCompletionAssert(
    preg_match_all('/new\s+Database\([\'\"]read[\'\"]\)/', $readRoutes) === 6,
    'Nem todas as rotas pesadas usam a conexao de leitura.'
);
scaleCompletionAssert(str_contains($exams, 'SignedKeysetCursor'), 'Provas sem cursor assinado.');
scaleCompletionAssert(str_contains($legal, 'SignedKeysetCursor'), 'Leis sem cursor assinado.');
scaleCompletionAssert(str_contains($storage, 'AWS4-HMAC-SHA256'), 'Driver S3/R2 sem assinatura V4.');
scaleCompletionAssert(str_contains($storage, "['local', 's3']"), 'Storage sem drivers explicitos.');
scaleCompletionAssert(str_contains($archive, 'all_old_non_simulation_attempts'), 'Politica de archive nao e limitada por idade.');
scaleCompletionAssert(!str_contains($archive, 'FROM user_answers newer'), 'Archive ainda preserva tentativas antigas indefinidamente.');
scaleCompletionAssert(str_contains($sitemap, 'ORDER BY id'), 'Sitemap sem keyset por ID.');
scaleCompletionAssert(str_contains($sitemap, 'sitemap.xml'), 'Sitemap index nao e materializado.');
scaleCompletionAssert(str_contains($outbox, 'FOR UPDATE SKIP LOCKED'), 'Outbox sem claim concorrente.');
scaleCompletionAssert(str_contains($outbox, "'dead_letter'"), 'Outbox sem dead-letter.');
scaleCompletionAssert(str_contains($eventOperations, "--requeue"), 'Outbox sem recuperacao operacional de dead-letter.');
scaleCompletionAssert(str_contains($questionWorker, 'WORKER_SLOT=%i'), 'Worker de ingestao sem slots concorrentes.');
scaleCompletionAssert(str_contains($eventWorker, 'WORKER_SLOT=%i'), 'Worker de eventos sem slots concorrentes.');

fwrite(STDOUT, "Scale completion wiring assertions passed.\n");

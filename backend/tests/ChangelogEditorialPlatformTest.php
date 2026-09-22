<?php

declare(strict_types=1);

require_once __DIR__ . '/../modules/changelog/validators/ChangelogValidator.php';

function assertChangelogEditorial(bool $condition, string $message): void
{
    if (!$condition) {
        throw new RuntimeException($message);
    }
}

$backend = dirname(__DIR__);
$root = dirname($backend);
$validator = new ChangelogValidator();
$entry = $validator->validateSave([
    'title' => 'Agora ficou mais facil revisar questoes',
    'description' => 'Os filtros foram reorganizados para encontrar conteudo com menos passos.',
    'releaseDate' => '2026-08-10',
    'status' => 'published',
    'channel' => 'APP',
    'content' => [[
        'title' => 'O que mudou',
        'icon' => 'Sparkles',
        'items' => ['Filtros mais claros.', 'Navegacao mais rapida.'],
    ]],
]);
assertChangelogEditorial($entry['slug'] === 'agora-ficou-mais-facil-revisar-questoes', 'The slug must be canonical.');
assertChangelogEditorial($entry['channel'] === 'APP', 'The editorial channel must be validated and preserved.');
assertChangelogEditorial(count($entry['content']) === 1, 'At least one user-facing section must be preserved.');

$suggestion = $validator->validateSuggestionUpdate(['id' => 7, 'status' => 'completed']);
assertChangelogEditorial($suggestion['status'] === 'completed', 'Completed must be a valid product status.');
try {
    $validator->validateSuggestionUpdate(['id' => 7, 'status' => 'resolved']);
    throw new RuntimeException('Support status must not be accepted as product status.');
} catch (InvalidArgumentException) {
}

$migration = (string) file_get_contents($backend . '/database/migrations/20260810_230000_novidades_editorial.php');
foreach (['CREATE TABLE IF NOT EXISTS changelogs', 'suggestion_status', 'idx_feedback_suggestion_workflow'] as $needle) {
    assertChangelogEditorial(str_contains($migration, $needle), 'Migration is missing ' . $needle . '.');
}

$versionMigration = (string) file_get_contents($backend . '/database/migrations/20260811_151000_feedback_platform_version.php');
foreach (['platform_version', "key_name = 'platformVersion'", "type = 'suggestion'"] as $needle) {
    assertChangelogEditorial(str_contains($versionMigration, $needle), 'Version migration is missing ' . $needle . '.');
}

$routes = (string) file_get_contents($backend . '/modules/changelog/routes.php');
foreach (['requireAdminSessionContext', 'handleChangelogAdminSaveRoute', 'handleChangelogAdminSuggestionsRoute', 'logAdminAudit'] as $needle) {
    assertChangelogEditorial(str_contains($routes, $needle), 'Admin changelog routes are missing ' . $needle . '.');
}

$repository = (string) file_get_contents($backend . '/modules/changelog/repositories/ChangelogRepository.php');
assertChangelogEditorial(str_contains($repository, "status = 'published'"), 'The public query must serialize only published entries.');
assertChangelogEditorial(str_contains($repository, 'content_json, channel'), 'The public query must expose the persisted audience channel.');
assertChangelogEditorial(str_contains($repository, "channel = 'BOTH'"), 'The public query must include entries shared across channels.');
assertChangelogEditorial(str_contains($repository, "f.type = 'suggestion'"), 'The suggestion queue must only include suggestions.');
assertChangelogEditorial(str_contains($repository, 'f.platform_version'), 'The suggestion queue must expose its platform version snapshot.');
assertChangelogEditorial(str_contains($repository, 'LIMIT :limit OFFSET :offset'), 'Admin queues must be paginated.');

$feedbackService = (string) file_get_contents($backend . '/modules/feedback/services/FeedbackService.php');
assertChangelogEditorial(str_contains($feedbackService, "normalized['type'] === 'suggestion'"), 'Only root suggestions should receive a platform version.');
assertChangelogEditorial(str_contains($feedbackService, 'resolveCurrentPlatformVersion'), 'Suggestion version must be resolved by the backend.');

$publicPage = (string) file_get_contents($root . '/src/app/novidades/page.tsx');
foreach (['Novidades', 'CollectionPage', 'fetchChangelogForServer', 'entry.content.map'] as $needle) {
    assertChangelogEditorial(str_contains($publicPage, $needle), 'SSR novidades page is missing ' . $needle . '.');
}

$adminPage = (string) file_get_contents($root . '/src/app/admin/components/changelog/AdminChangelogSection.tsx');
foreach (['Arquivo de novidades', 'Sugestões dos usuários', 'AdminCollectionPagination', 'PRODUCT_STATUS_OPTIONS'] as $needle) {
    assertChangelogEditorial(str_contains($adminPage, $needle), 'Admin novidades library is missing ' . $needle . '.');
}
assertChangelogEditorial(str_contains($adminPage, 'suggestion.platformVersion'), 'Admin novidades must display the suggestion version.');

fwrite(STDOUT, "Changelog editorial platform assertions passed.\n");

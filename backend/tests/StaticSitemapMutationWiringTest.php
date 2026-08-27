<?php

declare(strict_types=1);

function sitemapMutationWiringAssert(bool $condition, string $message): void
{
    if (!$condition) {
        throw new RuntimeException($message);
    }
}

$backend = dirname(__DIR__);
$writers = [
    'filters' => 'modules/filters/repositories/FiltersRepository.php',
    'questions' => 'modules/questions/repositories/QuestionsRepository.php',
    'exams' => 'modules/exams/repositories/ExamsRepository.php',
    'blog' => 'modules/blog/repositories/BlogRepository.php',
    'materials' => 'modules/materials/repositories/MaterialsRepository.php',
    'laws' => 'modules/legal_commentary/repositories/LegalCommentaryRepository.php',
    'taxonomy_import' => 'modules/admin/services/AdminGranTaxonomySyncService.php',
];

foreach ($writers as $domain => $relativePath) {
    $source = (string) file_get_contents($backend . '/' . $relativePath);
    sitemapMutationWiringAssert(
        str_contains($source, 'StaticSitemapMutationInvalidator.php'),
        "{$domain} writer does not load the sitemap mutation invalidator."
    );
    sitemapMutationWiringAssert(
        str_contains($source, 'StaticSitemapMutationInvalidator::invalidate('),
        "{$domain} writer does not invalidate derived sitemap artifacts."
    );
}

$reset = (string) file_get_contents($backend . '/scripts/data/reset_definitive_dataset.php');
sitemapMutationWiringAssert(
    str_contains($reset, "invalidate('RESET_POLICY_V2_COMMITTED'"),
    'Bulk reset does not invalidate the sitemap with its authoritative reason code.'
);
sitemapMutationWiringAssert(
    str_contains($reset, '$sitemapPublisher->withdraw()'),
    'Bulk reset does not withdraw the previously published artifact tree.'
);

fwrite(STDOUT, "StaticSitemapMutationWiringTest: PASS\n");

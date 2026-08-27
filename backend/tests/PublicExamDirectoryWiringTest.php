<?php

declare(strict_types=1);

$base = dirname(__DIR__);
$checks = [
    [$base . '/api/exams/directory.php', 'handlePublicExamsDirectoryRoute'],
    [$base . '/api/exams/detail.php', 'handlePublicExamDetailRoute'],
    [$base . '/modules/exams/routes.php', 'function handlePublicExamsDirectoryRoute'],
    [$base . '/modules/exams/routes.php', 'function handlePublicExamDetailRoute'],
    [$base . '/modules/exams/services/ExamsService.php', 'listPublicDirectory'],
    [$base . '/modules/exams/services/ExamsService.php', 'showPublic'],
    [$base . '/modules/exams/services/ExamsService.php', "'pageInfo'"],
    [$base . '/modules/exams/repositories/ExamsRepository.php', "p.status_editorial = 'published'"],
    [$base . '/modules/exams/repositories/ExamsRepository.php', "p.visibility_status = 'public'"],
    [$base . '/modules/exams/repositories/ExamsRepository.php', 'LIMIT {$limit} OFFSET {$offset}'],
    [$base . '/scripts/seo/generate_static_sitemaps.php', '$routes->examDetail($slug)'],
    [$base . '/scripts/seo/generate_static_sitemaps.php', "FROM provas"],
    [$base . '/scripts/seo/generate_static_sitemaps.php', "'status' => (string) (\$row['status_editorial'] ?? 'unpublished')"],
    [$base . '/scripts/seo/generate_static_sitemaps.php', "sprintf('exams-%05d.xml'"],
    [$base . '/modules/exams/repositories/ExamsRepository.php', "'publishedAt' => \$metadata['publishedAt']"],
    [$base . '/modules/exams/repositories/ExamsRepository.php', 'COUNT(DISTINCT qp.question_id) AS question_count'],
    [$base . '/modules/exams/repositories/ExamsRepository.php', 'listRelatedPublic'],
    [$base . '/modules/exams/services/ExamsService.php', "'relatedExams'"],
];

foreach ($checks as [$file, $needle]) {
    $contents = file_get_contents($file);
    if (!is_string($contents) || !str_contains($contents, $needle)) {
        throw new RuntimeException("Missing {$needle} in {$file}");
    }
}

fwrite(STDOUT, "PublicExamDirectoryWiringTest: PASS\n");

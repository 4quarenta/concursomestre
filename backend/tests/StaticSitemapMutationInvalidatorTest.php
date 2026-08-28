<?php

declare(strict_types=1);

require_once __DIR__ . '/../modules/seo/sitemaps/StaticSitemapMutationInvalidator.php';

function mutationInvalidatorAssert(bool $condition, string $message): void
{
    if (!$condition) {
        throw new RuntimeException($message);
    }
}

$root = sys_get_temp_dir() . '/cm-sitemap-mutation-' . bin2hex(random_bytes(5));
$output = $root . '/sitemaps';
mkdir($output, 0775, true);
putenv('SITEMAP_OUTPUT_DIR=' . $output);

$state = new StaticSitemapArtifactState($output);
$state->markCurrent(str_repeat('a', 64), str_repeat('b', 64), str_repeat('c', 64), str_repeat('d', 64), str_repeat('e', 64), gmdate('c'));
StaticSitemapMutationInvalidator::invalidate('QUESTION_CONTENT_MUTATION');
$dirty = $state->read();
mutationInvalidatorAssert(($dirty['state'] ?? null) === 'DIRTY', 'Canonical content mutation must mark the sitemap DIRTY.');
mutationInvalidatorAssert(($dirty['reason'] ?? null) === 'QUESTION_CONTENT_MUTATION', 'Mutation reason code was not preserved.');

StaticSitemapMutationInvalidator::invalidate('FILTER_CONTENT_MUTATION');
mutationInvalidatorAssert(
    ($state->read()['reason'] ?? null) === 'QUESTION_CONTENT_MUTATION',
    'Repeated mutations must not rewrite an already DIRTY marker.'
);

@unlink($state->statePath());
@rmdir($output);
@rmdir($root);
putenv('SITEMAP_OUTPUT_DIR');

fwrite(STDOUT, "StaticSitemapMutationInvalidatorTest: PASS\n");

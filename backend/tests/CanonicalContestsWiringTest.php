<?php

declare(strict_types=1);

$root = dirname(__DIR__);
$migration = file_get_contents($root . '/database/migrations/20260819_120000_canonical_contests.php');
$repository = file_get_contents($root . '/modules/contests/repositories/ContestsRepository.php');
$projection = file_get_contents($root . '/modules/contests/projections/PublicContestProjection.php');
$service = file_get_contents($root . '/modules/contests/services/ContestsService.php');
$openState = file_get_contents($root . '/modules/contests/domain/ContestOpenState.php');
$examRepository = file_get_contents($root . '/modules/exams/repositories/ExamsRepository.php');
$organizationRepository = file_get_contents($root . '/modules/filters/repositories/FiltersRepository.php');

$assert = static function (bool $condition, string $message): void {
    if (!$condition) throw new RuntimeException($message);
};
$assert(str_contains($migration, 'CREATE TABLE IF NOT EXISTS contests'), 'Canonical contests table missing.');
$assert(str_contains($migration, 'publication_status') && str_contains($migration, "DEFAULT 'draft'"), 'Draft-by-default publication is required.');
$assert(!preg_match('/\bINSERT\s+INTO|\bDELETE\s+FROM|\$db->exec\(["\']UPDATE\s/i', $migration), 'Migration must not backfill synthetic contests.');
$assert(str_contains($repository, "publication_status = 'published'") && str_contains($repository, "visibility_status = 'public'"), 'Public repository must enforce publication.');
$assert(str_contains($repository, 'c.slug = :slug') && str_contains($repository, 'CAST({$alias}.slug AS BINARY) REGEXP CAST'), 'Canonical slug lookup must keep indexed equality plus a MySQL 8.4-compatible case-sensitive persisted-slug gate.');
$assert(str_contains($repository, "CAST(public_org.slug AS BINARY) REGEXP CAST") && str_contains($repository, "CAST(p.slug AS BINARY) REGEXP CAST"), 'Public repository must enforce case-sensitive persisted slugs.');
$assert(substr_count($repository, "NOT IN ('pending', 'internal', 'technical')") >= 4, 'Public contest relations must exclude internal taxonomies.');
$assert(str_contains($repository, 'EXISTS (') && str_contains($repository, 'public_co.contest_id'), 'A public contest must have an explicit public organization relation.');
$assert(str_contains($openState, "domain_status = 'registration_open'") && str_contains($openState, 'registration_end_at >= NOW()'), 'Open-contest rule must use status and dates.');
$assert(str_contains($openState, 'DateTimeImmutable $now') && str_contains($openState, '$end < $start'), 'Open-contest boundaries must be deterministic and reject inconsistent dates.');
$now = new DateTimeImmutable('2026-08-19 12:00:00', new DateTimeZone('America/Sao_Paulo'));
require_once $root . '/modules/contests/domain/ContestOpenState.php';
$assert(ContestOpenState::isOpen('registration_open', '2026-08-19 12:00:00', '2026-08-19 12:00:00', $now), 'Open boundaries must be inclusive.');
$assert(ContestOpenState::isOpen('registration_open', null, null, $now), 'Declared open status may use an unspecified date window.');
$assert(!ContestOpenState::isOpen('registration_open', '2026-08-20 00:00:00', null, $now), 'Future registration must not be open.');
$assert(!ContestOpenState::isOpen('registration_open', null, '2026-08-19 11:59:59', $now), 'Expired registration must not be open.');
$assert(!ContestOpenState::isOpen('registration_open', 'invalid', null, $now), 'Malformed registration dates must fail closed.');
$assert(!ContestOpenState::isOpen('registration_open', '2026-08-20 00:00:00', '2026-08-19 00:00:00', $now), 'Inverted registration dates must not be open.');
$assert(!ContestOpenState::isOpen('cancelled', null, null, $now), 'Cancelled contests must not be open.');
$assert(!ContestOpenState::isOpen('announced', '2026-08-01 00:00:00', '2026-08-30 00:00:00', $now), 'Dates alone must not infer open status.');
$assert(substr_count($repository, "p.status_editorial = 'published'") >= 3, 'Exam lists and question projections must require a public exam.');
$assert(str_contains($repository, "CAST(p.slug AS BINARY) REGEXP CAST('^[a-z0-9]+(-[a-z0-9]+)*$' AS BINARY)") && str_contains($repository, "TRIM(p.nome) <> ''"), 'Public exam links must require a valid persisted identity.');
$assert(str_contains($service, 'contestDetail') && str_contains($service, 'redirectSlug'), 'Canonical routes and aliases must be wired.');
$assert(str_contains($service, "^[a-z0-9]+(?:-[a-z0-9]+)*$"), 'Contest resolver must enforce canonical slug grammar.');
$assert(str_contains($examRepository, 'contest_organizations public_co') && str_contains($examRepository, "REGEXP_LIKE(c.slug, '^[a-z0-9]+(-[a-z0-9]+)*$', 'c')"), 'Exam interlinks must require a ready canonical contest.');
$assert(str_contains($organizationRepository, "REGEXP_LIKE(c.slug, '^[a-z0-9]+(-[a-z0-9]+)*$', 'c')"), 'Organization interlinks must exclude invalid contest slugs.');
$assert(!str_contains($projection, 'internal_notes') && !str_contains($projection, 'provider_identity'), 'Projection allowlist leaked private fields.');
$assert(str_contains($projection, 'FILTER_FLAG_NO_PRIV_RANGE') && str_contains($projection, "'.internal'"), 'Editorial URLs must reject private/internal destinations.');
require_once $root . '/modules/contests/projections/PublicContestProjection.php';
$publicUrlFixture = [
    'contest' => ['id' => 1, 'slug' => 'contest', 'title' => 'Contest', 'official_url' => 'http://127.0.0.1/private'],
    'documents' => [['id' => 1, 'type' => 'notice', 'title' => 'Private', 'url' => 'http://10.0.0.1/private']],
];
$publicUrlProjection = PublicContestProjection::detail($publicUrlFixture);
$assert($publicUrlProjection['officialUrl'] === null && $publicUrlProjection['documents'] === [], 'Private editorial URLs crossed the projection boundary.');
$signedUrlProjection = PublicContestProjection::detail([
    'contest' => ['id' => 3, 'slug' => 'signed-contest', 'title' => 'Signed contest'],
    'documents' => [['id' => 2, 'type' => 'notice', 'title' => 'Signed', 'url' => 'https://storage.example/notice.pdf?X-Amz-Signature=SECRET']],
]);
$assert($signedUrlProjection['documents'] === [], 'Signed/private document URLs crossed the projection boundary.');
$dateProjection = PublicContestProjection::detail([
    'contest' => ['id' => 2, 'slug' => 'dated-contest', 'title' => 'Dated contest', 'registration_start_at' => '2026-08-19 00:00:00'],
]);
$assert($dateProjection['dates']['registrationStartAt'] === '2026-08-19T00:00:00-03:00', 'Public contest dates must carry the domain timezone.');
$sitemap = file_get_contents($root . '/scripts/seo/generate_static_sitemaps.php');
$assert(str_contains($sitemap, 'co.contest_id = contests.id') && str_contains($sitemap, "organization.type = 'orgao'"), 'Contest sitemap must enforce organization readiness.');
echo "CanonicalContestsWiringTest PASS\n";

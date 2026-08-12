<?php

declare(strict_types=1);

$root = dirname(__DIR__);
$routes = file_get_contents($root . '/modules/feedback/routes.php') ?: '';
$service = file_get_contents($root . '/modules/feedback/services/FeedbackService.php') ?: '';
$repository = file_get_contents($root . '/modules/feedback/repositories/FeedbackRepository.php') ?: '';

$assertions = [
    'public read uses optional authentication' => str_contains($routes, 'verifyAuthenticatedUserPayload(false)'),
    'public service accepts anonymous viewer' => str_contains($service, 'listPublicSuggestions(?array $authenticatedUserPayload'),
    'votable and moderated statuses are public' => str_contains($repository, "IN ('pending', 'under_review', 'approved', 'planned', 'in_progress', 'completed')"),
    'declined suggestions stay private' => !str_contains($repository, "IN ('pending', 'under_review', 'approved', 'planned', 'in_progress', 'completed', 'declined')"),
    'public payload includes product status' => str_contains($repository, "'product_status'"),
    'public payload includes platform version' => str_contains($repository, "'platform_version'"),
    'public payload does not expose account name' => str_contains($repository, "'user_name' => 'Comunidade'"),
];

$failures = array_keys(array_filter($assertions, static fn (bool $passed): bool => !$passed));
if ($failures !== []) {
    fwrite(STDERR, "Public suggestions wiring failures:\n- " . implode("\n- ", $failures) . "\n");
    exit(1);
}

echo "Public suggestions visibility wiring: OK\n";

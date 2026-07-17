<?php

/*
* ----------------------------------------------------
* @author: 4quarenta
* @author URI: https://github.com/4quarenta
* @copyright: (c) 2026 ConcursoMestre. All rights reserved
* ----------------------------------------------------
*
* @since 1.0.0
*
*/

declare(strict_types=1);

function assertFeedbackTestimonialsWiring(string $path, string $needle, string $message): void
{
    $content = file_get_contents($path);
    if ($content === false || strpos($content, $needle) === false) {
        throw new RuntimeException($message . ' [' . $path . ']');
    }
}

$base = dirname(__DIR__) . '';

assertFeedbackTestimonialsWiring(
    $base . '/api/feedback/testimonials.php',
    'handleFeedbackTestimonialsRoute',
    'Public testimonials endpoint must delegate to the feedback module.'
);

assertFeedbackTestimonialsWiring(
    $base . '/modules/feedback/routes.php',
    'function handleFeedbackTestimonialsRoute',
    'Feedback module must expose a public testimonials route.'
);

assertFeedbackTestimonialsWiring(
    $base . '/modules/feedback/repositories/FeedbackRepository.php',
    "f.status = 'resolved'",
    'Public testimonials must require approved/resolved feedback.'
);

assertFeedbackTestimonialsWiring(
    $base . '/modules/feedback/repositories/FeedbackRepository.php',
    'f.home_published_at IS NOT NULL',
    'Public testimonials must require explicit home publication timestamp.'
);

assertFeedbackTestimonialsWiring(
    $base . '/modules/admin/repositories/AdminFeedbackRepository.php',
    'home_published_at = CASE',
    'Admin approval must control home publication.'
);

fwrite(STDOUT, "Feedback testimonials wiring assertions passed.\n");

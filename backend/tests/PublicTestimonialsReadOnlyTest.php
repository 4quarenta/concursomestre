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

$endpoint = (string) file_get_contents(__DIR__ . '/../api/feedback/testimonials.php');
$repository = (string) file_get_contents(__DIR__ . '/../modules/feedback/repositories/FeedbackRepository.php');

if (!str_contains($endpoint, "new Database('read')")) {
    throw new RuntimeException('Public testimonials endpoint must use the dedicated read connection.');
}

$methodStart = strpos($repository, 'public function listPublishedTestimonials');
$methodEnd = strpos($repository, 'public function listPublicSuggestions', $methodStart ?: 0);
$method = $methodStart !== false && $methodEnd !== false
    ? substr($repository, $methodStart, $methodEnd - $methodStart)
    : '';
if ($method === '' || str_contains($method, 'ensureFeedbackSchema')) {
    throw new RuntimeException('Public testimonials reads must not execute runtime schema maintenance.');
}

fwrite(STDOUT, "Public testimonials read-only boundary assertions passed.\n");

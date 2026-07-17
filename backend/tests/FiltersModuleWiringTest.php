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

function assertContainsFiltersDelegate(string $path, string $needle, string $message): void
{
    $content = file_get_contents($path);
    if ($content === false || strpos($content, $needle) === false) {
        throw new RuntimeException($message . ' [' . $path . ']');
    }
}

$base = dirname(__DIR__) . '';

assertContainsFiltersDelegate(
    $base . '/api/filters/list.php',
    'handleFiltersListRoute',
    'Filters list endpoint must delegate to filters module routes'
);

assertContainsFiltersDelegate(
    $base . '/api/filters/save.php',
    'handleFiltersSaveRoute',
    'Filters save endpoint must delegate to filters module routes'
);

assertContainsFiltersDelegate(
    $base . '/api/filters/delete.php',
    'handleFiltersDeleteRoute',
    'Filters delete endpoint must delegate to filters module routes'
);

assertContainsFiltersDelegate(
    $base . '/modules/filters/routes.php',
    'function handleFiltersListRoute',
    'Filters routes must expose the list handler'
);

assertContainsFiltersDelegate(
    $base . '/modules/filters/routes.php',
    'function handleFiltersSaveRoute',
    'Filters routes must expose the save handler'
);

assertContainsFiltersDelegate(
    $base . '/modules/filters/routes.php',
    'function handleFiltersDeleteRoute',
    'Filters routes must expose the delete handler'
);

fwrite(STDOUT, "Filters module wiring assertions passed.\n");

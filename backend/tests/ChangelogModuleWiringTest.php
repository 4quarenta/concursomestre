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

function assertContainsChangelogDelegate(string $path, string $needle, string $message): void
{
    $content = file_get_contents($path);
    if ($content === false || strpos($content, $needle) === false) {
        throw new RuntimeException($message . ' [' . $path . ']');
    }
}

$base = 'C:/xampp/htdocs/questao-pro-backend';

assertContainsChangelogDelegate(
    $base . '/api/changelog/list.php',
    'handleChangelogListRoute',
    'Changelog list endpoint must delegate to changelog module routes'
);

assertContainsChangelogDelegate(
    $base . '/modules/changelog/routes.php',
    'function handleChangelogListRoute',
    'Changelog routes must expose the list handler'
);

fwrite(STDOUT, "Changelog module wiring assertions passed.\n");

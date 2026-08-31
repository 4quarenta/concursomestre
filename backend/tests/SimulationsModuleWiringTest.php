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

function assertContainsSimulationsDelegate(string $path, string $needle, string $message): void
{
    $content = file_get_contents($path);
    if ($content === false || strpos($content, $needle) === false) {
        throw new RuntimeException($message . ' [' . $path . ']');
    }
}

$base = 'C:/xampp/htdocs/questao-pro-backend';

assertContainsSimulationsDelegate(
    $base . '/api/simulations/create.php',
    'handleSimulationsCreateRoute',
    'Simulations create endpoint must delegate to simulations module routes'
);

assertContainsSimulationsDelegate(
    $base . '/api/simulations/list.php',
    'handleSimulationsListRoute',
    'Simulations list endpoint must delegate to simulations module routes'
);

assertContainsSimulationsDelegate(
    $base . '/api/simulations/submit.php',
    'handleSimulationsSubmitRoute',
    'Simulations submit endpoint must delegate to simulations module routes'
);

assertContainsSimulationsDelegate(
    $base . '/modules/simulations/routes.php',
    'function handleSimulationsCreateRoute',
    'Simulations routes must expose the create handler'
);

assertContainsSimulationsDelegate(
    $base . '/modules/simulations/routes.php',
    'function handleSimulationsListRoute',
    'Simulations routes must expose the list handler'
);

fwrite(STDOUT, "Simulations module wiring assertions passed.\n");

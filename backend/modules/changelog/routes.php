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

require_once __DIR__ . '/controllers/ChangelogController.php';
require_once __DIR__ . '/services/ChangelogService.php';
require_once __DIR__ . '/repositories/ChangelogRepository.php';
require_once __DIR__ . '/validators/ChangelogValidator.php';
require_once __DIR__ . '/../../shared/responses/Response.php';

/**
 * Fabrica o controller oficial do modulo de changelog.
 *
 * @since 1.0.0
 */
function buildChangelogController(PDO $db): ChangelogController
{
    return new ChangelogController(
        new ChangelogService(
            new ChangelogRepository($db),
            new ChangelogValidator()
        )
    );
}

/**
 * Entrada oficial da listagem publica do changelog.
 *
 * @since 1.0.0
 */
function handleChangelogListRoute(PDO $db): void
{
    try {
        $result = buildChangelogController($db)->listEntries();
        Response::success($result);
    } catch (Throwable $e) {
        Response::serverError('Nao foi possivel carregar o changelog.', $e);
    }
}

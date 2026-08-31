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

require_once __DIR__ . '/controllers/PlansController.php';
require_once __DIR__ . '/services/PlansService.php';
require_once __DIR__ . '/repositories/PlansRepository.php';
require_once __DIR__ . '/validators/PlansValidator.php';
require_once __DIR__ . '/../../shared/responses/Response.php';

/**
 * Ponto de entrada do modulo de planos para o catalogo publico.
 *
 * @since 1.0.0
 */
function handlePlansListRoute(PDO $db): void
{
    try {
        header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
        header('Pragma: no-cache');
        header('Expires: 0');

        $controller = new PlansController(
            new PlansService(
                new PlansRepository($db),
                new PlansValidator()
            )
        );

        Response::success($controller->list());
    } catch (Throwable $e) {
        Response::serverError('Nao foi possivel carregar os planos.', $e);
    }
}

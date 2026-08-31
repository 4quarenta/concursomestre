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

require_once __DIR__ . '/../../config/cors.php';
require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../../modules/plans/routes.php';

/**
 * Bridge oficial do catalogo de planos.
 * Mantem a URL publica legada em /api/plans/list.php, mas delega toda a regra
 * para o modulo de dominio em modules/plans.
 */
$database = new Database();
$db = $database->getConnection();

handlePlansListRoute($db);

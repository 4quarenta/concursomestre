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

require_once __DIR__ . '/../admin/controllers/AdminSettingsController.php';
require_once __DIR__ . '/../admin/services/AdminSettingsService.php';
require_once __DIR__ . '/../admin/repositories/AdminSettingsRepository.php';
require_once __DIR__ . '/../admin/validators/AdminSettingsValidator.php';
require_once __DIR__ . '/../../shared/responses/Response.php';

/**
 * Entry point oficial para leitura publica saneada das configuracoes.
 * Mantem `api/settings.php` como bridge compativel, mas separa esse fluxo
 * do endpoint administrativo de escrita em `api/admin/settings.php`.
 *
 * @since 1.0.0
 */
function handlePublicSettingsRoute(PDO $db): void
{
    try {
        header('Cache-Control: no-store, no-cache, must-revalidate, max-age=0');
        header('Pragma: no-cache');
        header('Expires: 0');

        $method = (string) ($_SERVER['REQUEST_METHOD'] ?? 'GET');

        if ($method !== 'GET') {
            Response::error('Metodo nao permitido.', 405);
        }

        $controller = new AdminSettingsController(
            new AdminSettingsService(
                $db,
                new AdminSettingsRepository($db),
                new AdminSettingsValidator()
            )
        );

        $payload = $controller->show(null);
        Response::success($payload);
    } catch (InvalidArgumentException $e) {
        Response::badRequest($e->getMessage());
    } catch (Throwable $e) {
        error_log('[public_settings_route] ' . $e->getMessage());
        Response::serverError('Nao foi possivel carregar configuracoes publicas.', $e);
    }
}

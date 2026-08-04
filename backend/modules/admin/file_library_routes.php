<?php

/*
* ----------------------------------------------------
* @author: 4quarenta
* @author URI: https://github.com/4quarenta
* @copyright: (c) 2026 ConcursoMestre. All rights reserved
* ----------------------------------------------------
*
* @since 1.0.0
*/

declare(strict_types=1);

require_once __DIR__ . '/services/AdminFilesService.php';
require_once __DIR__ . '/../../shared/security/AdminSecurity.php';
require_once __DIR__ . '/../../shared/responses/Response.php';

function handleAdminFileLibraryRoute(PDO $db): void
{
    try {
        requirePlatformAdminSessionContext($db);
        $service = new AdminFilesService(new AdminFilesRepository($db), new ObjectStorage());
        $method = strtoupper((string) ($_SERVER['REQUEST_METHOD'] ?? 'GET'));
        if ($method === 'GET') {
            Response::success($service->list($_GET), 'Arquivos carregados.');
            return;
        }
        if ($method === 'DELETE') {
            $id = trim((string) ($_GET['id'] ?? ''));
            $service->delete($id);
            Response::success(null, 'Arquivo excluido.');
            return;
        }
        header('Allow: GET, DELETE');
        Response::error('Metodo nao permitido.', 405, null, 'method_not_allowed');
    } catch (InvalidArgumentException $e) {
        Response::badRequest($e->getMessage());
    } catch (RuntimeException $e) {
        Response::conflict($e->getMessage());
    } catch (Throwable $e) {
        Response::serverError('Nao foi possivel moderar os arquivos.', $e);
    }
}

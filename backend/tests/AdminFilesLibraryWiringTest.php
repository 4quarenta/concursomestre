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

function adminFilesRead(string $path): string
{
    $content = file_get_contents($path);
    if ($content === false) {
        throw new RuntimeException('Arquivo ausente: ' . $path);
    }
    return $content;
}

function adminFilesAssertContains(string $content, string $needle, string $message): void
{
    if (strpos($content, $needle) === false) {
        throw new RuntimeException($message);
    }
}

try {
    $backend = dirname(__DIR__);
    $route = adminFilesRead($backend . '/modules/admin/file_library_routes.php');
    $repository = adminFilesRead($backend . '/modules/admin/repositories/AdminFilesRepository.php');
    $service = adminFilesRead($backend . '/modules/admin/services/AdminFilesService.php');
    $endpoint = adminFilesRead($backend . '/api/admin/files.php');

    adminFilesAssertContains($route, 'requirePlatformAdminSessionContext($db)', 'A biblioteca deve exigir sessao administrativa.');
    adminFilesAssertContains($endpoint, 'handleAdminFileLibraryRoute', 'O endpoint deve delegar para a rota modular.');
    adminFilesAssertContains($repository, 'UNION ALL', 'O inventario deve consultar as origens em uma unica pagina.');
    foreach (['question_assets', 'prova_arquivos', 'material_uploads', 'users', 'filters', 'materials', 'blog_articles'] as $table) {
        adminFilesAssertContains($repository, $table, 'Origem ausente no inventario: ' . $table);
    }
    adminFilesAssertContains($repository, "attached_material_id IS NULL AND status = 'pending'", 'Somente uploads pendentes e desvinculados podem ser excluidos.');
    adminFilesAssertContains($service, "preg_match('/^material_upload:(\\d+)$/',", 'A exclusao deve rejeitar identificadores de recursos vinculados.');

    $databaseDelete = strpos($service, 'deleteMaterialUpload(');
    $storageDelete = strpos($service, '$this->storage->delete(');
    if ($databaseDelete === false || $storageDelete === false || $databaseDelete > $storageDelete) {
        throw new RuntimeException('O registro deve ser removido atomicamente antes da limpeza fisica tolerante a falha.');
    }

    echo "Admin file library wiring test passed.\n";
} catch (Throwable $exception) {
    fwrite(STDERR, $exception->getMessage() . "\n");
    exit(1);
}

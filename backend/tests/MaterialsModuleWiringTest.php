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

function assertContainsMaterialsDelegate(string $path, string $needle, string $message): void
{
    $content = file_get_contents($path);
    if ($content === false || strpos($content, $needle) === false) {
        throw new RuntimeException($message . ' [' . $path . ']');
    }
}

$base = 'C:/xampp/htdocs/questao-pro-backend';

assertContainsMaterialsDelegate(
    $base . '/api/materials/list.php',
    'handleMaterialsListRoute',
    'Materials list endpoint must delegate to materials module routes'
);

assertContainsMaterialsDelegate(
    $base . '/api/materials/create.php',
    'handleMaterialsCreateRoute',
    'Materials create endpoint must delegate to materials module routes'
);

assertContainsMaterialsDelegate(
    $base . '/api/materials/update.php',
    'handleMaterialsUpdateRoute',
    'Materials update endpoint must delegate to materials module routes'
);

assertContainsMaterialsDelegate(
    $base . '/api/materials/moderate.php',
    'handleMaterialsModerateRoute',
    'Materials moderate endpoint must delegate to materials module routes'
);

assertContainsMaterialsDelegate(
    $base . '/api/materials/delete.php',
    'handleMaterialsDeleteRoute',
    'Materials delete endpoint must delegate to materials module routes'
);

assertContainsMaterialsDelegate(
    $base . '/api/materials/rate.php',
    'handleMaterialsRateRoute',
    'Materials rate endpoint must delegate to materials module routes'
);

assertContainsMaterialsDelegate(
    $base . '/api/users/materials.php',
    'handleMaterialsPurchasedLibraryRoute',
    'Users materials endpoint must delegate to the materials module library handler'
);

assertContainsMaterialsDelegate(
    $base . '/api/materials/access.php',
    'handleMaterialsAccessRoute',
    'Materials access endpoint must delegate to the protected access handler'
);

assertContainsMaterialsDelegate(
    $base . '/api/materials/download.php',
    'handleMaterialsDownloadRoute',
    'Materials download endpoint must delegate to the protected download handler'
);

assertContainsMaterialsDelegate(
    $base . '/api/materials/get_bookmarks.php',
    'handleMaterialsBookmarksListRoute',
    'Materials get_bookmarks endpoint must delegate to the materials module reader handler'
);

assertContainsMaterialsDelegate(
    $base . '/api/materials/save_bookmark.php',
    'handleMaterialsBookmarkCreateRoute',
    'Materials save_bookmark endpoint must delegate to the materials module reader handler'
);

assertContainsMaterialsDelegate(
    $base . '/api/materials/delete_bookmark.php',
    'handleMaterialsBookmarkDeleteRoute',
    'Materials delete_bookmark endpoint must delegate to the materials module reader handler'
);

assertContainsMaterialsDelegate(
    $base . '/api/materials/get_highlights.php',
    'handleMaterialsHighlightsListRoute',
    'Materials get_highlights endpoint must delegate to the materials module reader handler'
);

assertContainsMaterialsDelegate(
    $base . '/api/materials/save_highlight.php',
    'handleMaterialsHighlightCreateRoute',
    'Materials save_highlight endpoint must delegate to the materials module reader handler'
);

assertContainsMaterialsDelegate(
    $base . '/api/materials/delete_highlight.php',
    'handleMaterialsHighlightDeleteRoute',
    'Materials delete_highlight endpoint must delegate to the materials module reader handler'
);

assertContainsMaterialsDelegate(
    $base . '/api/materials/get_note.php',
    'handleMaterialsNoteGetRoute',
    'Materials get_note endpoint must delegate to the materials module reader handler'
);

assertContainsMaterialsDelegate(
    $base . '/api/materials/save_note.php',
    'handleMaterialsNoteSaveRoute',
    'Materials save_note endpoint must delegate to the materials module reader handler'
);

assertContainsMaterialsDelegate(
    $base . '/api/upload.php',
    'handleMaterialsUploadRoute',
    'Legacy upload endpoint must delegate to the materials module upload handler'
);

assertContainsMaterialsDelegate(
    $base . '/modules/materials/routes.php',
    'function handleMaterialsPurchasedLibraryRoute',
    'Materials routes must expose the purchased library handler'
);

assertContainsMaterialsDelegate(
    $base . '/modules/materials/routes.php',
    'function handleMaterialsAccessRoute',
    'Materials routes must expose the protected access handler'
);

assertContainsMaterialsDelegate(
    $base . '/modules/materials/routes.php',
    'function handleMaterialsDownloadRoute',
    'Materials routes must expose the protected download handler'
);

assertContainsMaterialsDelegate(
    $base . '/modules/materials/routes.php',
    'function handleMaterialsBookmarksListRoute',
    'Materials routes must expose the bookmarks reader handler'
);

assertContainsMaterialsDelegate(
    $base . '/modules/materials/routes.php',
    'function handleMaterialsBookmarkCreateRoute',
    'Materials routes must expose the bookmark create handler'
);

assertContainsMaterialsDelegate(
    $base . '/modules/materials/routes.php',
    'function handleMaterialsBookmarkDeleteRoute',
    'Materials routes must expose the bookmark delete handler'
);

assertContainsMaterialsDelegate(
    $base . '/modules/materials/routes.php',
    'function handleMaterialsHighlightsListRoute',
    'Materials routes must expose the highlights reader handler'
);

assertContainsMaterialsDelegate(
    $base . '/modules/materials/routes.php',
    'function handleMaterialsHighlightCreateRoute',
    'Materials routes must expose the highlight create handler'
);

assertContainsMaterialsDelegate(
    $base . '/modules/materials/routes.php',
    'function handleMaterialsHighlightDeleteRoute',
    'Materials routes must expose the highlight delete handler'
);

assertContainsMaterialsDelegate(
    $base . '/modules/materials/routes.php',
    'function handleMaterialsNoteGetRoute',
    'Materials routes must expose the note reader handler'
);

assertContainsMaterialsDelegate(
    $base . '/modules/materials/routes.php',
    'function handleMaterialsNoteSaveRoute',
    'Materials routes must expose the note save handler'
);

assertContainsMaterialsDelegate(
    $base . '/modules/materials/routes.php',
    'function handleMaterialsUploadRoute',
    'Materials routes must expose the upload handler'
);

fwrite(STDOUT, "Materials module wiring assertions passed.\n");

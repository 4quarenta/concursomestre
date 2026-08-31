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

require_once __DIR__ . '/../shared/security/UploadSecurity.php';

function assertUploadSecurity(bool $condition, string $message): void
{
    if (!$condition) {
        throw new RuntimeException($message);
    }
}

function assertContainsUploadSecurity(string $path, string $needle, string $message): void
{
    $content = file_get_contents($path);
    if ($content === false || strpos($content, $needle) === false) {
        throw new RuntimeException($message . ' [' . $path . ']');
    }
}

$base = 'C:/xampp/htdocs/questao-pro-backend';

foreach ([
    '/modules/materials/validators/MaterialsValidator.php',
    '/modules/questions/validators/QuestionsValidator.php',
    '/modules/users/validators/UsersValidator.php',
] as $path) {
    assertContainsUploadSecurity(
        $base . $path,
        'UploadSecurity::validate',
        'Upload validators must use the shared UploadSecurity helper'
    );
}

assertContainsUploadSecurity(
    $base . '/shared/security/UploadSecurity.php',
    'rejectDangerousOriginalName',
    'UploadSecurity must reject dangerous original filenames'
);

assertContainsUploadSecurity(
    $base . '/uploads/.htaccess',
    'Options -Indexes -ExecCGI -Includes',
    'Uploads directory must disable indexes, CGI execution and server-side includes on Apache'
);

assertContainsUploadSecurity(
    $base . '/uploads/.htaccess',
    'php_flag engine off',
    'Uploads directory must disable PHP engine when Apache mod_php is available'
);

assertContainsUploadSecurity(
    $base . '/uploads/.htaccess',
    '<FilesMatch "^\.">',
    'Uploads directory must deny dotfiles on Apache'
);

assertContainsUploadSecurity(
    $base . '/uploads/.htaccess',
    'Require all denied',
    'Uploads directory must deny executable/script extensions on Apache'
);

assertContainsUploadSecurity(
    $base . '/uploads/.htaccess',
    'Header set Access-Control-Allow-Headers "Content-Type, X-Requested-With"',
    'Uploads CORS headers must avoid exposing Authorization on static assets'
);

$pngBytes = base64_decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/p9sAAAAASUVORK5CYII=');
$tmpPath = tempnam(sys_get_temp_dir(), 'cm-upload-');
if ($tmpPath === false || $pngBytes === false) {
    throw new RuntimeException('Nao foi possivel preparar fixture de upload.');
}
file_put_contents($tmpPath, $pngBytes);

try {
    $upload = UploadSecurity::validate([
        'error' => UPLOAD_ERR_OK,
        'tmp_name' => $tmpPath,
        'name' => 'avatar.png',
        'size' => filesize($tmpPath),
    ], [
        'image/png' => ['extension' => 'png', 'maxSize' => 1024 * 1024],
    ], [
        'requireUploadedFile' => false,
    ]);

    assertUploadSecurity($upload['extension'] === 'png', 'PNG upload must resolve the safe extension from MIME.');

    $rejectedDangerousName = false;
    try {
        UploadSecurity::validate([
            'error' => UPLOAD_ERR_OK,
            'tmp_name' => $tmpPath,
            'name' => 'avatar.png.php',
            'size' => filesize($tmpPath),
        ], [
            'image/png' => ['extension' => 'png', 'maxSize' => 1024 * 1024],
        ], [
            'requireUploadedFile' => false,
        ]);
    } catch (InvalidArgumentException $e) {
        $rejectedDangerousName = str_contains($e->getMessage(), 'extensao nao permitida');
    }

    assertUploadSecurity($rejectedDangerousName, 'Dangerous double extensions must be rejected.');
} finally {
    @unlink($tmpPath);
}

fwrite(STDOUT, "Upload security wiring assertions passed.\n");

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

$iterator = new RecursiveIteratorIterator(
    new RecursiveDirectoryIterator(__DIR__ . '/../modules', FilesystemIterator::SKIP_DOTS)
);

foreach ($iterator as $file) {
    if (!$file->isFile() || strtolower($file->getExtension()) !== 'php') {
        continue;
    }

    $contents = file_get_contents($file->getPathname());
    if ($contents === false) {
        throw new RuntimeException('Não foi possível ler ' . $file->getPathname());
    }

    if (strpos($contents, 'api/utils/') !== false) {
        throw new RuntimeException('Modulo ainda depende de api/utils: ' . $file->getPathname());
    }
}

fwrite(STDOUT, "Shared module dependency wiring assertions passed.\n");

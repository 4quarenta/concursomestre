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

$root = 'C:/xampp/htdocs/questao-pro-backend';

function assertBackendRootHasNoOperationalArtifacts(string $root): void
{
    $blockedRootExtensions = ['log', 'sql', 'bak', 'backup', 'old', 'zip', 'rar', '7z', 'tar', 'gz'];
    $rootFiles = glob($root . '/*') ?: [];

    foreach ($rootFiles as $file) {
        if (!is_file($file)) {
            continue;
        }

        $extension = strtolower((string) pathinfo($file, PATHINFO_EXTENSION));
        $filename = strtolower(basename($file));
        $blockedByName = preg_match('/(^|[._-])(dump|backup|debug|temp|tmp|trace|error-log|phpinfo)([._-]|$)/i', $filename) === 1;

        if (in_array($extension, $blockedRootExtensions, true) || $blockedByName) {
            throw new RuntimeException('A raiz publica contem artefato operacional: ' . basename($file));
        }
    }
}

function assertBackendRootHtaccessBlocksInternalSurface(string $root): void
{
    $htaccess = file_get_contents($root . '/.htaccess');

    if ($htaccess === false || !str_contains($htaccess, 'RewriteRule ^(?:config|database|modules|runtime|shared|storage|tests|vendor)(?:/|$) - [F,L,NC]')) {
        throw new RuntimeException('A raiz precisa bloquear acesso direto a diretorios internos sensiveis.');
    }

    if (!str_contains($htaccess, '<FilesMatch "^\.env(?:\..*)?$">')) {
        throw new RuntimeException('A raiz precisa bloquear .env e variantes como .env.example.');
    }

    if (!str_contains($htaccess, 'RewriteRule ^scripts/importers/questions/gran/(?:index|import_worker)\.php$ - [L,NC]')) {
        throw new RuntimeException('A raiz precisa manter allowlist explicito apenas para o crawler Gran.');
    }

    if (!str_contains($htaccess, 'RewriteRule ^scripts/ - [F,L,NC]')) {
        throw new RuntimeException('A raiz precisa bloquear acesso direto aos scripts operacionais.');
    }

    if (!str_contains($htaccess, '\.(zip|rar|7z|tar|gz|sql|bak|backup|old)$')) {
        throw new RuntimeException('A raiz precisa bloquear download direto de backups e dumps.');
    }
}

function assertBackendDevScriptsAreOutsidePublicRoot(string $root): void
{
    foreach (['debug', 'manual-tests', 'setup', 'maintenance', 'seed', 'seeds'] as $devScriptDir) {
        if (is_dir($root . '/scripts/' . $devScriptDir)) {
            throw new RuntimeException('scripts/' . $devScriptDir . ' deve ficar fora de htdocs em producao.');
        }
    }

    foreach (glob($root . '/scripts/checks/{temp,tmp,debug,test}*.php', GLOB_BRACE) ?: [] as $devCheckFile) {
        throw new RuntimeException('scripts/checks contem artefato temporario de desenvolvimento: ' . basename($devCheckFile));
    }

    $allowedMigrations = ['migrate_marketplace_schema_compatibility.php'];
    $migrationsRoot = $root . '/scripts/migrations';
    if (!is_dir($migrationsRoot)) {
        return;
    }

    $iterator = new RecursiveIteratorIterator(
        new RecursiveDirectoryIterator($migrationsRoot, FilesystemIterator::SKIP_DOTS)
    );

    foreach ($iterator as $migrationFile) {
        if (!$migrationFile->isFile() || strtolower($migrationFile->getExtension()) !== 'php') {
            continue;
        }

        $relative = str_replace('\\', '/', substr($migrationFile->getPathname(), strlen($migrationsRoot) + 1));
        if (!in_array($relative, $allowedMigrations, true)) {
            throw new RuntimeException('scripts/migrations contem migracao PHP legada fora do allowlist: ' . $relative);
        }
    }
}

if (is_dir($root . '/migrations')) {
    throw new RuntimeException('A raiz ainda contem o diretorio legado migrations.');
}

if (is_dir($root . '/backups')) {
    throw new RuntimeException('A raiz ainda contem o diretorio legado backups.');
}

assertBackendRootHasNoOperationalArtifacts($root);
assertBackendRootHtaccessBlocksInternalSurface($root);
assertBackendDevScriptsAreOutsidePublicRoot($root);

if (file_exists($root . '/composer.phar')) {
    throw new RuntimeException('A raiz ainda contem o artefato operacional composer.phar.');
}

if (!is_dir($root . '/database/migrations/legacy')) {
    throw new RuntimeException('database/migrations/legacy nao foi criado.');
}

if (is_dir($root . '/storage/backups/legacy-code')) {
    throw new RuntimeException('storage/backups/legacy-code deve ficar fora de htdocs em producao.');
}

fwrite(STDOUT, "Backend root cleanup assertions passed.\n");

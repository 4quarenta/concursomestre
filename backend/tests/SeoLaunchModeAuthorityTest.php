<?php

declare(strict_types=1);

require_once dirname(__DIR__) . '/modules/seo/launch/SeoLaunchMode.php';
require_once dirname(__DIR__) . '/modules/seo/launch/SeoLaunchModeAuthority.php';

$path = tempnam(sys_get_temp_dir(), 'cm-launch-');
if ($path === false) {
    throw new RuntimeException('Nao foi possivel criar fixture temporaria.');
}

$previousPath = getenv('SEO_LAUNCH_MODE_FILE');
putenv('SEO_LAUNCH_MODE_FILE=' . $path);

try {
    file_put_contents($path, json_encode(['mode' => 'invalid']));
    if (SeoLaunchModeAuthority::read() !== 'PRELAUNCH') {
        throw new RuntimeException('Modo invalido nao falhou fechado.');
    }

    $result = SeoLaunchModeAuthority::write('GO_CANDIDATE', 'admin-test', 'correlation-test');
    if ($result['previousMode'] !== 'PRELAUNCH' || SeoLaunchModeAuthority::read() !== 'GO_CANDIDATE') {
        throw new RuntimeException('Transicao de launch mode nao foi persistida.');
    }
    if ((fileperms($path) & 0007) !== 0) {
        throw new RuntimeException('Arquivo de launch mode ficou acessivel para outros usuarios.');
    }
} finally {
    if ($previousPath === false || $previousPath === null) {
        putenv('SEO_LAUNCH_MODE_FILE');
    } else {
        putenv('SEO_LAUNCH_MODE_FILE=' . $previousPath);
    }
    @unlink($path);
}

fwrite(STDOUT, "SeoLaunchModeAuthorityTest: PASS\n");

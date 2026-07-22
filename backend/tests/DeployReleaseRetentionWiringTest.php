<?php

declare(strict_types=1);

function assertReleaseRetention(bool $condition, string $message): void
{
    if (!$condition) {
        throw new RuntimeException($message);
    }
}

$root = dirname(__DIR__, 2);
$deploy = (string) file_get_contents($root . '/scripts/deploy/deploy-release.sh');
$library = (string) file_get_contents($root . '/scripts/deploy/lib.sh');

assertReleaseRetention(
    str_contains($deploy, 'CM_KEEP_RELEASES'),
    'O deploy deve exigir a configuracao de retencao.'
);
assertReleaseRetention(
    str_contains($deploy, 'cm_prune_releases "$CM_RELEASES_DIR" "$CM_KEEP_RELEASES"'),
    'O deploy deve aplicar a retencao apos o smoke e a troca atomica.'
);
assertReleaseRetention(
    str_contains($deploy, '"$release_dir" "$previous_frontend" "$previous_backend"'),
    'Release atual e alvos de rollback devem ser protegidos.'
);
assertReleaseRetention(
    str_contains($library, 'cm_safe_release_path "$candidate" "$releases_root"'),
    'A remocao deve validar cada caminho dentro da raiz configurada.'
);
assertReleaseRetention(
    str_contains($library, 'rm -rf --one-file-system -- "$resolved"'),
    'A remocao deve permanecer no filesystem e usar caminho resolvido.'
);

fwrite(STDOUT, "DeployReleaseRetentionWiringTest: PASS\n");

<?php

declare(strict_types=1);

$path = __DIR__ . '/../modules/legal_commentary/repositories/LegalCommentaryRepository.php';
$source = file_get_contents($path);
if ($source === false) {
    throw new RuntimeException('Nao foi possivel ler o repositorio de lei comentada.');
}

$start = strpos($source, 'public function deleteLaw');
$end = strpos($source, 'private function findLawOwnership', $start === false ? 0 : $start);
if ($start === false || $end === false) {
    throw new RuntimeException('Nao foi possivel localizar a politica de exclusao de lei.');
}

$deleteMethod = substr($source, $start, $end - $start);
if (!str_contains($deleteMethod, "\$creatorId = trim((string) (\$ownership['created_by_user_id'] ?? ''))")) {
    throw new RuntimeException('A exclusao de lei deve conferir o autor original.');
}
if (str_contains($deleteMethod, "\$ownership['updated_by_user_id']") || str_contains($deleteMethod, "\$ownership['published_by_user_id']")) {
    throw new RuntimeException('Editar ou publicar uma lei nao pode transferir ownership para staff.');
}

fwrite(STDOUT, "LegalCommentaryOwnershipWiringTest: PASS\n");

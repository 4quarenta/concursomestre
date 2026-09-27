<?php

declare(strict_types=1);

require_once __DIR__ . '/../modules/questions/repositories/ImportedExamSlugPolicy.php';

$base = 'concurso-publico-prefeitura';
$first = ImportedExamSlugPolicy::collisionCandidate($base, 'gran:exam:source-a');
$same = ImportedExamSlugPolicy::collisionCandidate($base, 'gran:exam:source-a');
$other = ImportedExamSlugPolicy::collisionCandidate($base, 'gran:exam:source-b');
$long = ImportedExamSlugPolicy::collisionCandidate(str_repeat('a', 300), 'gran:exam:source-a');

if ($first !== $same) {
    throw new RuntimeException('Imported exam collision slugs must be deterministic.');
}
if ($first === $other || !str_starts_with($first, $base . '-')) {
    throw new RuntimeException('Distinct provider identities must not share a collision slug.');
}
if (strlen($long) > 255) {
    throw new RuntimeException('Imported exam collision slug exceeds the canonical column limit.');
}

fwrite(STDOUT, "ImportedExamSlugPolicyTest: PASS\n");

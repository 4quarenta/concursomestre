<?php

declare(strict_types=1);

$repository = (string) file_get_contents(__DIR__ . '/../modules/questions/repositories/QuestionsRepository.php');
$resolver = strpos($repository, '$record[\'slug\'] = $this->resolveUniqueImportedExamSlug');
$insert = strpos($repository, 'INSERT INTO provas (', $resolver === false ? 0 : $resolver);

if ($resolver === false || $insert === false || $resolver > $insert) {
    throw new RuntimeException('Imported exam slug conflicts must be resolved before inserting a proof.');
}
if (!str_contains($repository, 'ImportedExamSlugPolicy::collisionCandidate')) {
    throw new RuntimeException('Imported exam slug collision policy is not connected to persistence.');
}
if (!str_contains($repository, 'ImportedExamIdentityPolicy::isSameGranExam')
    || !str_contains($repository, 'preserve its')
    || !str_contains($repository, '$this->syncImportedExamFiles((int) $existingId, $record);')) {
    throw new RuntimeException('Equivalent Gran proofs must reuse the canonical proof without replacing its source identity.');
}

fwrite(STDOUT, "ImportedExamSlugCollisionWiringTest: PASS\n");

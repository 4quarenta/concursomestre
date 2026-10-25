<?php
declare(strict_types=1);
require_once __DIR__ . '/../modules/ingestion/domain/CmBatchTaxonomyPolicy.php';

$entities = [
    ['category' => 'subjects', 'key' => 'portuguese', 'parentKey' => null, 'canonicalId' => 41],
    ['category' => 'topics', 'key' => 'interpretation', 'parentKey' => 'portuguese', 'canonicalId' => 73],
    ['category' => 'subtopics', 'key' => 'implicit', 'parentKey' => 'interpretation', 'canonicalId' => 91],
    ['category' => 'subjects', 'key' => 'law', 'parentKey' => null, 'canonicalId' => 101],
];
$candidate = ['id' => 73, 'type' => 'assunto', 'parent_id' => 41, 'taxonomy_level' => 'topico'];
CmBatchTaxonomyPolicy::assertCandidate($entities[1], $entities, $candidate);
foreach ([['parent_id' => 101], ['type' => 'orgao'], ['taxonomy_level' => 'subtopico']] as $change) {
    try {
        CmBatchTaxonomyPolicy::assertCandidate($entities[1], $entities, array_merge($candidate, $change));
        throw new RuntimeException('Incompatible canonical ID accepted');
    } catch (DomainException) {}
}
$unresolved = $entities;
$unresolved[0]['canonicalId'] = null;
try {
    CmBatchTaxonomyPolicy::assertCandidate($entities[1], $unresolved, $candidate);
    throw new RuntimeException('Unresolved parent accepted');
} catch (DomainException) {}
$invalidated = CmBatchTaxonomyPolicy::invalidateDescendants($entities, 'portuguese');
if ($invalidated[1]['canonicalId'] !== null || $invalidated[2]['canonicalId'] !== null || $invalidated[3]['canonicalId'] !== 101) {
    throw new RuntimeException('Descendant invalidation crossed scope or missed nested children');
}
echo "CmBatchTaxonomyPolicyTest: PASS\n";

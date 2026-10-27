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
foreach (['subjects'=>'assunto','topics'=>'assunto','examBoards'=>'banca','roles'=>'cargo','careers'=>'area'] as $category=>$sourceType) {
    if (CmBatchTaxonomyPolicy::sourceType($category)!==$sourceType) throw new RuntimeException('Wrong provider namespace');
}
$ordered=CmBatchTaxonomyPolicy::orderedEntities(['topics'=>[['key'=>'child','parentKey'=>'root']], 'subjects'=>[['key'=>'root']]]);
if(array_column(array_column($ordered,'entity'),'key')!==['root','child'])throw new RuntimeException('Parent ordering failed');
$new=['name'=>'New topic','reviewRequired'=>false];
if(!CmBatchTaxonomyPolicy::canProposeCreation($new,'no_verified_local_match',[],true))throw new RuntimeException('Safe creation blocked');
foreach ([['no_verified_local_match',[7],true],['source_identity_parent_unresolved_or_mismatched',[],true],['no_verified_local_match',[],false]] as $args) {
    if(CmBatchTaxonomyPolicy::canProposeCreation($new,...$args))throw new RuntimeException('Unsafe creation allowed');
}
if(CmBatchTaxonomyPolicy::canProposeCreation(array_merge($new,['reviewRequired'=>true]),'no_verified_local_match',[],true))throw new RuntimeException('Review bypassed');
echo "CmBatchTaxonomyPolicyTest: PASS\n";

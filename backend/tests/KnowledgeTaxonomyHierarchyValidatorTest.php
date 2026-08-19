<?php

declare(strict_types=1);

require_once dirname(__DIR__) . '/modules/seo/taxonomy/KnowledgeTaxonomyHierarchyValidator.php';

function hierarchyAssert(bool $condition, string $message): void
{
    if (!$condition) throw new RuntimeException($message);
}

try {
    $topic = ['id' => 2, 'name' => 'Controle', 'type' => 'assunto', 'taxonomy_level' => 'topico', 'slug' => 'controle', 'own_parent_id' => 1, 'parent_id' => 1, 'parent_parent_id' => 0, 'parent_type' => 'assunto', 'parent_taxonomy_level' => 'materia', 'parent_meta_materia' => 1, 'parent_slug' => 'direito-constitucional', 'parent_name' => 'Direito Constitucional'];
    hierarchyAssert(KnowledgeTaxonomyHierarchyValidator::evaluate($topic, 'topico')['status'] === 'READY', 'Topico valido foi bloqueado.');
    $subtopic = [
        'id' => 3, 'name' => 'Modelos', 'type' => 'assunto', 'taxonomy_level' => 'subtopico', 'slug' => 'modelos',
        'own_parent_id' => 2, 'parent_id' => 2, 'parent_parent_id' => 1,
        'parent_type' => 'assunto', 'parent_taxonomy_level' => 'topico', 'parent_slug' => 'controle', 'parent_name' => 'Controle',
        'grandparent_id' => 1, 'grandparent_parent_id' => 0,
        'grandparent_type' => 'assunto', 'grandparent_taxonomy_level' => 'materia', 'grandparent_meta_materia' => 1,
        'grandparent_slug' => 'direito-constitucional', 'grandparent_name' => 'Direito Constitucional',
    ];
    hierarchyAssert(KnowledgeTaxonomyHierarchyValidator::evaluate($subtopic, 'subtopico')['status'] === 'READY', 'Subtopico valido foi bloqueado.');
    $orphan = array_replace($topic, ['parent_id' => null, 'parent_type' => null, 'parent_taxonomy_level' => null]);
    $orphanResult = KnowledgeTaxonomyHierarchyValidator::evaluate($orphan, 'topico');
    hierarchyAssert($orphanResult['status'] === 'NOT_READY', 'Orfao ficou READY.');
    hierarchyAssert(in_array('instance_readiness.orphan', $orphanResult['reasonCodes'], true), 'Reason code de orfao ausente.');
    $cycle = array_replace($topic, ['own_parent_id' => 2, 'parent_id' => 2]);
    $cycleReasons = KnowledgeTaxonomyHierarchyValidator::evaluate($cycle, 'topico')['reasonCodes'];
    hierarchyAssert(in_array('instance_readiness.invalid_taxonomy_chain', $cycleReasons, true), 'Ciclo nao foi refletido na readiness.');
    hierarchyAssert(in_array('instance_readiness.cycle', $cycleReasons, true), 'Reason code de ciclo ausente.');
    $wrongParent = array_replace($topic, ['parent_taxonomy_level' => 'subtopico', 'parent_meta_materia' => 0]);
    hierarchyAssert(in_array('instance_readiness.wrong_parent_level', KnowledgeTaxonomyHierarchyValidator::evaluate($wrongParent, 'topico')['reasonCodes'], true), 'Reason code de parent incompatível ausente.');
    $directSubject = array_replace($subtopic, [
        'id' => 4, 'name' => 'Assunto direto', 'slug' => 'assunto-direto', 'taxonomy_level' => 'assunto',
        'own_parent_id' => 2, 'parent_id' => 2, 'parent_parent_id' => 1,
        'parent_taxonomy_level' => 'topico', 'grandparent_id' => 1,
        'grandparent_parent_id' => 0, 'grandparent_taxonomy_level' => 'materia', 'grandparent_meta_materia' => 1,
    ]);
    hierarchyAssert(in_array('instance_readiness.invalid_taxonomy_chain', KnowledgeTaxonomyHierarchyValidator::evaluate($directSubject, 'assunto')['reasonCodes'], true), 'Assunto sem subtopico intermediario foi aceito.');
    $long = array_replace($topic, ['slug' => str_repeat('topico-', 14)]);
    hierarchyAssert(in_array('instance_readiness.invalid_slug', KnowledgeTaxonomyHierarchyValidator::evaluate($long, 'topico')['reasonCodes'], true), 'Slug acima do contrato v1 nao foi bloqueado.');
    $wrongType = array_replace($topic, ['type' => 'banca']);
    hierarchyAssert(in_array('instance_readiness.wrong_type', KnowledgeTaxonomyHierarchyValidator::evaluate($wrongType, 'topico')['reasonCodes'], true), 'Wrong type nao foi diagnosticado.');
    $placeholder = array_replace($topic, ['name' => 'Geral']);
    hierarchyAssert(in_array('instance_readiness.placeholder', KnowledgeTaxonomyHierarchyValidator::evaluate($placeholder, 'topico')['reasonCodes'], true), 'Placeholder nao foi diagnosticado.');
    $falseMatter = array_replace($topic, ['taxonomy_level' => 'topico', 'meta_materia' => '0']);
    hierarchyAssert(KnowledgeTaxonomyHierarchyValidator::evaluate($falseMatter, 'materia')['status'] === 'NOT_READY', 'meta_materia="0" classificou topico como materia.');
    $invalidAncestor = array_replace($topic, ['parent_slug' => str_repeat('materia-', 12)]);
    $invalidAncestorReasons = KnowledgeTaxonomyHierarchyValidator::evaluate($invalidAncestor, 'topico')['reasonCodes'];
    hierarchyAssert(in_array('instance_readiness.invalid_slug', $invalidAncestorReasons, true), 'Slug incompatível de ancestor nao bloqueou readiness.');
    hierarchyAssert(in_array('instance_readiness.invalid_taxonomy_chain', $invalidAncestorReasons, true), 'Ancestor nao publico nao invalidou a cadeia.');
    echo "KnowledgeTaxonomyHierarchyValidatorTest: PASS\n";
    exit(0);
} catch (Throwable $error) {
    fwrite(STDERR, 'KnowledgeTaxonomyHierarchyValidatorTest: FAIL - ' . $error->getMessage() . PHP_EOL);
    exit(1);
}

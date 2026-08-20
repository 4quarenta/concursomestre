<?php

declare(strict_types=1);

require_once __DIR__ . '/../modules/questions/services/QuestionsService.php';

try {
    $reflection = new ReflectionClass(QuestionsService::class);
    $service = $reflection->newInstanceWithoutConstructor();
    $partition = $reflection->getMethod('partitionFilters');
    $summary = $reflection->getMethod('buildTaxonomySummaryV2');

    $filters = [
        ['id' => 10, 'type' => 'assunto', 'name' => 'Direito Penal', 'slug' => 'direito-penal', 'parent_id' => null, 'meta_materia' => 1, 'taxonomy_level' => 'materia'],
        ['id' => 11, 'type' => 'assunto', 'name' => 'Legislacao Especial', 'slug' => 'legislacao-especial', 'parent_id' => 10, 'meta_materia' => 0, 'taxonomy_level' => 'topico', 'taxonomy_parent_id' => 10, 'taxonomy_parent_parent_id' => null, 'taxonomy_parent_type' => 'assunto', 'taxonomy_parent_name' => 'Direito Penal', 'taxonomy_parent_slug' => 'direito-penal', 'taxonomy_parent_meta_materia' => 1, 'taxonomy_parent_level' => 'materia'],
        ['id' => 12, 'type' => 'assunto', 'name' => 'Crimes em espécie', 'slug' => 'crimes-em-especie', 'parent_id' => 11, 'meta_materia' => 0, 'taxonomy_level' => 'subtopico', 'taxonomy_parent_id' => 11, 'taxonomy_parent_parent_id' => 10, 'taxonomy_parent_type' => 'assunto', 'taxonomy_parent_name' => 'Legislacao Especial', 'taxonomy_parent_slug' => 'legislacao-especial', 'taxonomy_parent_meta_materia' => 0, 'taxonomy_parent_level' => 'topico', 'taxonomy_grandparent_id' => 10, 'taxonomy_grandparent_parent_id' => null, 'taxonomy_grandparent_type' => 'assunto', 'taxonomy_grandparent_name' => 'Direito Penal', 'taxonomy_grandparent_slug' => 'direito-penal', 'taxonomy_grandparent_meta_materia' => 1, 'taxonomy_grandparent_level' => 'materia'],
        ['id' => 13, 'type' => 'assunto', 'name' => 'Lei de Abuso de Autoridade', 'slug' => 'lei-abuso-autoridade', 'parent_id' => 12, 'meta_materia' => 0, 'taxonomy_level' => 'assunto', 'taxonomy_parent_id' => 12, 'taxonomy_parent_parent_id' => 11, 'taxonomy_parent_type' => 'assunto', 'taxonomy_parent_name' => 'Crimes em espécie', 'taxonomy_parent_slug' => 'crimes-em-especie', 'taxonomy_parent_meta_materia' => 0, 'taxonomy_parent_level' => 'subtopico', 'taxonomy_grandparent_id' => 11, 'taxonomy_grandparent_parent_id' => 10, 'taxonomy_grandparent_type' => 'assunto', 'taxonomy_grandparent_name' => 'Legislacao Especial', 'taxonomy_grandparent_slug' => 'legislacao-especial', 'taxonomy_grandparent_meta_materia' => 0, 'taxonomy_grandparent_level' => 'topico', 'taxonomy_great_grandparent_id' => 10, 'taxonomy_great_grandparent_parent_id' => null, 'taxonomy_great_grandparent_type' => 'assunto', 'taxonomy_great_grandparent_name' => 'Direito Penal', 'taxonomy_great_grandparent_slug' => 'direito-penal', 'taxonomy_great_grandparent_meta_materia' => 1, 'taxonomy_great_grandparent_level' => 'materia'],
        ['id' => 14, 'type' => 'assunto', 'name' => 'Cadeia Inválida', 'slug' => 'cadeia-invalida', 'parent_id' => 10, 'meta_materia' => 0, 'taxonomy_level' => 'assunto', 'taxonomy_parent_id' => 10, 'taxonomy_parent_parent_id' => null, 'taxonomy_parent_type' => 'assunto', 'taxonomy_parent_name' => 'Direito Penal', 'taxonomy_parent_slug' => 'direito-penal', 'taxonomy_parent_meta_materia' => 1, 'taxonomy_parent_level' => 'materia'],
        ['id' => 15, 'type' => 'cargo', 'name' => 'Auditor Fiscal', 'slug' => 'auditor-fiscal', 'parent_id' => null, 'taxonomy_level' => null],
        ['id' => 16, 'type' => 'carreira', 'name' => 'Carreira Fiscal', 'slug' => 'carreira-fiscal', 'parent_id' => null, 'taxonomy_level' => null, 'professional_relation_ready' => 1],
        ['id' => 18, 'type' => 'carreira', 'name' => 'Carreira sem vínculo explícito', 'slug' => 'carreira-sem-vinculo', 'parent_id' => null, 'taxonomy_level' => null, 'professional_relation_ready' => 0],
        ['id' => 17, 'type' => 'cargo', 'name' => 'Cargo não identificado', 'slug' => 'cargo-nao-identificado', 'parent_id' => null, 'taxonomy_level' => null],
    ];

    $buckets = $partition->invoke($service, $filters);
    $taxonomySummary = $summary->invoke($service, $buckets);

    if (($taxonomySummary['subjects'][0]['label'] ?? null) !== 'Direito Penal') {
        throw new RuntimeException('A raiz curricular sem meta_materia nao foi classificada como materia.');
    }
    if (($taxonomySummary['topics'][0]['label'] ?? null) !== 'Legislacao Especial') {
        throw new RuntimeException('O filho direto da materia nao foi classificado como topico.');
    }
    if (($taxonomySummary['subtopics'][0]['label'] ?? null) !== 'Lei de Abuso de Autoridade') {
        throw new RuntimeException('O terceiro nivel curricular nao foi classificado como assunto.');
    }
    foreach (['subjects', 'topics', 'subtopics'] as $bucket) {
        if (($taxonomySummary[$bucket][0]['seoReady'] ?? false) !== true) {
            throw new RuntimeException('Taxonomia valida nao recebeu sinal explicito de readiness: ' . $bucket);
        }
    }
    $invalid = array_values(array_filter($buckets['assuntos'], static fn (array $item): bool => ($item['id'] ?? null) === 14));
    if (($invalid[0]['seoReady'] ?? true) !== false) {
        throw new RuntimeException('Taxonomia de cadeia invalida recebeu readiness de interlink.');
    }
    if (($taxonomySummary['roles'][0]['seoReady'] ?? false) !== true
        || ($taxonomySummary['careers'][0]['seoReady'] ?? false) !== true) {
        throw new RuntimeException('Cargo/Carreira validos nao receberam readiness de interlink.');
    }
    if (($taxonomySummary['roles'][1]['seoReady'] ?? true) !== false) {
        throw new RuntimeException('Placeholder de Cargo recebeu readiness de interlink.');
    }
    if (($taxonomySummary['careers'][1]['seoReady'] ?? true) !== false) {
        throw new RuntimeException('Carreira sem relacao Cargo-Carreira recebeu readiness de interlink.');
    }

    fwrite(STDOUT, "QuestionTaxonomyHierarchyContractTest: PASS\n");
} catch (Throwable $exception) {
    fwrite(STDERR, 'QuestionTaxonomyHierarchyContractTest: FAIL - ' . $exception->getMessage() . "\n");
    exit(1);
}

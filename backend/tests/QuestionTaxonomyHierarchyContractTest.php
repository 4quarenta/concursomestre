<?php

declare(strict_types=1);

require_once __DIR__ . '/../modules/questions/services/QuestionsService.php';

try {
    $reflection = new ReflectionClass(QuestionsService::class);
    $service = $reflection->newInstanceWithoutConstructor();
    $partition = $reflection->getMethod('partitionFilters');
    $summary = $reflection->getMethod('buildTaxonomySummaryV2');

    $filters = [
        ['id' => 10, 'type' => 'assunto', 'name' => 'Direito Penal', 'slug' => 'direito-penal', 'parent_id' => null, 'meta_materia' => 0],
        ['id' => 11, 'type' => 'assunto', 'name' => 'Legislacao Especial', 'slug' => 'legislacao-especial', 'parent_id' => 10, 'meta_materia' => 0],
        ['id' => 12, 'type' => 'assunto', 'name' => 'Lei de Abuso de Autoridade', 'slug' => 'lei-abuso-autoridade', 'parent_id' => 11, 'meta_materia' => 0],
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

    fwrite(STDOUT, "QuestionTaxonomyHierarchyContractTest: PASS\n");
} catch (Throwable $exception) {
    fwrite(STDERR, 'QuestionTaxonomyHierarchyContractTest: FAIL - ' . $exception->getMessage() . "\n");
    exit(1);
}

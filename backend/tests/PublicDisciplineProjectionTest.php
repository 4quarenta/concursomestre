<?php

declare(strict_types=1);

require_once dirname(__DIR__) . '/modules/filters/projections/PublicKnowledgeTaxonomyProjection.php';
require_once dirname(__DIR__) . '/modules/filters/repositories/FiltersRepository.php';

function disciplineProjectionAssert(bool $condition, string $message): void
{
    if (!$condition) throw new RuntimeException($message);
}

try {
    $projection = PublicKnowledgeTaxonomyProjection::fromRepositoryData([
        'identity' => ['id' => 10, 'slug' => 'direito', 'name' => 'Direito', 'description' => '<p>Publica</p>', 'taxonomy_level' => 'materia', 'question_count' => 0, 'source_identity' => 'SECRET_IMPORTER'],
        'requestedSlug' => 'direito', 'taxonomyLevel' => 'materia', 'canonicalPath' => '/disciplinas/direito', 'questionsPath' => '/questoes?materia=Direito',
        'readiness' => ['status' => 'READY', 'reasonCodes' => []],
        'questions' => [['id' => 40, 'excerpt' => '<p>Enunciado público</p>', 'path' => '/questoes/40/enunciado-publico', 'answer' => 'SECRET_ANSWER']],
    ], [['label' => 'Início', 'canonicalPath' => '/'], ['label' => 'Disciplinas', 'canonicalPath' => '/disciplinas'], ['label' => 'Direito', 'canonicalPath' => '/disciplinas/direito']]);
    $encoded = json_encode($projection, JSON_THROW_ON_ERROR | JSON_UNESCAPED_UNICODE);
    foreach (['SECRET_IMPORTER', 'SECRET_ANSWER', 'answer'] as $forbidden) disciplineProjectionAssert(!str_contains($encoded, $forbidden), 'Projection vazou ' . $forbidden);
    disciplineProjectionAssert($projection['description'] === 'Publica', 'Descricao nao foi sanitizada.');
    disciplineProjectionAssert($projection['questions'][0]['excerpt'] === 'Enunciado público', 'Excerpt nao foi sanitizado.');
    disciplineProjectionAssert(FiltersRepository::PUBLIC_KNOWLEDGE_TAXONOMY_QUERY_BUDGET === 6, 'Query budget compartilhado mudou.');
    $source = (string) file_get_contents(dirname(__DIR__) . '/modules/filters/repositories/FiltersRepository.php');
    disciplineProjectionAssert(str_contains($source, "f.type = 'assunto'"), 'Lookup nao restringe tipo canonico.');
    disciplineProjectionAssert(str_contains($source, "f.taxonomy_level = 'topico'"), 'Lookup nao distingue topico.');
    disciplineProjectionAssert(str_contains($source, "taxonomy_level = 'assunto'"), 'Lookup nao distingue assunto final.');
    echo "PublicDisciplineProjectionTest: PASS\n";
    exit(0);
} catch (Throwable $error) {
    fwrite(STDERR, 'PublicDisciplineProjectionTest: FAIL - ' . $error->getMessage() . PHP_EOL);
    exit(1);
}

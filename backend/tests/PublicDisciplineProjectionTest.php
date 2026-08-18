<?php

declare(strict_types=1);

require_once dirname(__DIR__) . '/modules/filters/projections/PublicDisciplineProjection.php';
require_once dirname(__DIR__) . '/modules/filters/repositories/FiltersRepository.php';

function disciplineProjectionAssert(bool $condition, string $message): void
{
    if (!$condition) throw new RuntimeException($message);
}

try {
    $projection = PublicDisciplineProjection::fromRepositoryData([
        'identity' => [
            'id' => 10, 'slug' => 'direito', 'name' => 'Direito', 'description' => '<p>Publica</p>',
            'question_count' => 50, 'content_updated_at' => '2026-08-16 12:00:00',
            'source_identity' => 'SECRET_IMPORTER', 'admin_note' => 'SECRET_ADMIN',
        ],
        'topics' => [['id' => 11, 'slug' => 'constitucional', 'name' => 'Constitucional', 'questionCount' => 20]],
        'exams' => [['id' => 20, 'slug' => 'prova', 'name' => 'Prova', 'year' => 2026, 'questionCount' => 5]],
        'boards' => [['id' => 30, 'slug' => 'banca', 'name' => 'Banca', 'acronym' => 'BC', 'questionCount' => 10]],
        'questions' => [[
            'id' => 40, 'excerpt' => '<p>Enunciado público</p>', 'updatedAt' => '2026-08-16',
            'path' => '/questoes/40/enunciado-publico',
            'answer' => 'SECRET_ANSWER', 'teacherComment' => 'SECRET_COMMENT',
        ]],
        'canonicalPath' => '/disciplinas/direito',
        'questionsPath' => '/questoes?materia=Direito',
    ], [
        ['label' => 'Início', 'canonicalPath' => '/'],
        ['label' => 'Disciplinas', 'canonicalPath' => '/disciplinas'],
        ['label' => 'Direito', 'canonicalPath' => '/disciplinas/direito'],
    ]);
    $encoded = json_encode($projection, JSON_THROW_ON_ERROR | JSON_UNESCAPED_UNICODE);
    foreach (['SECRET_IMPORTER', 'SECRET_ADMIN', 'SECRET_ANSWER', 'SECRET_COMMENT', 'answer', 'teacherComment'] as $forbidden) {
        disciplineProjectionAssert(!str_contains($encoded, $forbidden), 'Projection vazou ' . $forbidden);
    }
    disciplineProjectionAssert($projection['questions'][0]['excerpt'] === 'Enunciado público', 'Excerpt nao foi sanitizado.');
    disciplineProjectionAssert($projection['description'] === 'Publica', 'Descricao publica nao foi sanitizada.');
    disciplineProjectionAssert($projection['questions'][0]['path'] === '/questoes/40/enunciado-publico', 'Path publico da questao ausente.');
    disciplineProjectionAssert($projection['canonicalPath'] === '/disciplinas/direito', 'Canonical path da projection ausente.');
    disciplineProjectionAssert(count($projection['breadcrumbs']) === 3, 'Breadcrumb preparatorio incompleto.');
    disciplineProjectionAssert(FiltersRepository::PUBLIC_DISCIPLINE_QUERY_BUDGET === 5, 'Query budget da disciplina mudou.');

    $source = (string) file_get_contents(dirname(__DIR__) . '/modules/filters/repositories/FiltersRepository.php');
    disciplineProjectionAssert(str_contains($source, "f.type = 'assunto'"), 'Projection nao restringe a taxonomia canonica.');
    disciplineProjectionAssert(str_contains($source, "f.taxonomy_level = 'materia' OR f.meta_materia = 1"), 'Projection aceita assunto como disciplina.');

    echo "PublicDisciplineProjectionTest: PASS\n";
    exit(0);
} catch (Throwable $error) {
    fwrite(STDERR, 'PublicDisciplineProjectionTest: FAIL - ' . $error->getMessage() . PHP_EOL);
    exit(1);
}

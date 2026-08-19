<?php

declare(strict_types=1);

require_once dirname(__DIR__) . '/modules/filters/projections/PublicOrganizationProjection.php';
require_once dirname(__DIR__) . '/modules/filters/repositories/FiltersRepository.php';

function organizationProjectionAssert(bool $condition, string $message): void
{
    if (!$condition) throw new RuntimeException($message);
}

try {
    $projection = PublicOrganizationProjection::fromRepositoryData([
        'identity' => [
            'id' => 70, 'slug' => 'policia-federal', 'name' => 'Polícia Federal', 'acronym' => 'PF',
            'description' => '<p>Órgão público federal.</p>', 'website' => 'https://www.gov.br/pf/',
            'asset_url' => 'https://cdn.example.test/pf.png', 'meta_uf' => 'BR', 'meta_esfera' => 'Federal',
            'question_count' => 42, 'exam_count' => 3, 'content_updated_at' => '2026-08-18',
            'source_identity' => 'SECRET_IMPORTER', 'admin_note' => 'SECRET_ADMIN',
        ],
        'roles' => [['id' => 71, 'name' => 'Agente', 'questionsPath' => '/questoes?cargo=Agente', 'source_provider' => 'SECRET_PROVIDER']],
        'disciplines' => [['id' => 10, 'slug' => 'direito', 'name' => 'Direito', 'questionCount' => 12, 'path' => '/disciplinas/direito']],
        'boards' => [['id' => 30, 'slug' => 'cebraspe', 'name' => 'Cebraspe', 'acronym' => 'CEBRASPE', 'examCount' => 2, 'path' => '/bancas/cebraspe']],
        'exams' => [['id' => 20, 'slug' => 'pf-2026', 'name' => 'PF 2026', 'year' => 2026, 'questionCount' => 5, 'path' => '/provas/pf-2026']],
        'questions' => [[
            'id' => 40, 'excerpt' => '<p>Enunciado público</p>', 'updatedAt' => '2026-08-18',
            'path' => '/questoes/40/enunciado-publico', 'correctAnswer' => 'SECRET_ANSWER',
            'teacherComment' => 'SECRET_COMMENT',
        ]],
        'contests' => [[
            'id' => 80, 'slug' => 'pf-2026', 'title' => 'Concurso PF 2026', 'status' => 'announced',
            'year' => 2026, 'path' => '/concursos/pf-2026', 'admin_note' => 'SECRET_CONTEST_ADMIN',
        ]],
        'canonicalPath' => '/orgaos/policia-federal',
        'questionsPath' => '/questoes?orgao=Pol%C3%ADcia%20Federal',
    ], [
        ['label' => 'Início', 'canonicalPath' => '/'],
        ['label' => 'Órgãos', 'canonicalPath' => '/orgaos'],
        ['label' => 'Polícia Federal', 'canonicalPath' => '/orgaos/policia-federal'],
    ]);

    $encoded = json_encode($projection, JSON_THROW_ON_ERROR | JSON_UNESCAPED_UNICODE);
    foreach (['SECRET_IMPORTER', 'SECRET_ADMIN', 'SECRET_PROVIDER', 'SECRET_ANSWER', 'SECRET_COMMENT', 'SECRET_CONTEST_ADMIN', 'correctAnswer', 'teacherComment'] as $forbidden) {
        organizationProjectionAssert(!str_contains($encoded, $forbidden), 'Projection vazou ' . $forbidden);
    }
    organizationProjectionAssert($projection['description'] === 'Órgão público federal.', 'Descricao nao foi sanitizada.');
    organizationProjectionAssert($projection['questions'][0]['excerpt'] === 'Enunciado público', 'Questao nao foi sanitizada.');
    organizationProjectionAssert($projection['website'] === 'https://www.gov.br/pf/', 'Website publico valido foi removido.');
    organizationProjectionAssert($projection['contests'][0]['path'] === '/concursos/pf-2026', 'Interlink canonico de concurso ausente.');
    organizationProjectionAssert(FiltersRepository::PUBLIC_ORGANIZATION_QUERY_BUDGET === 7, 'Query budget do orgao mudou.');

    $source = (string) file_get_contents(dirname(__DIR__) . '/modules/filters/repositories/FiltersRepository.php');
    organizationProjectionAssert(str_contains($source, "WHERE f.type = 'orgao'"), 'Lookup nao restringe type=orgao.');
    organizationProjectionAssert(!str_contains($encoded, 'filter_source_identities'), 'Projection incluiu identidade externa.');

    echo "PublicOrganizationProjectionTest: PASS\n";
    exit(0);
} catch (Throwable $error) {
    fwrite(STDERR, 'PublicOrganizationProjectionTest: FAIL - ' . $error->getMessage() . PHP_EOL);
    exit(1);
}

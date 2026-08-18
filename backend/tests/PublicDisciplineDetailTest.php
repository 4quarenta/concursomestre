<?php

declare(strict_types=1);

require_once dirname(__DIR__) . '/modules/filters/services/FiltersService.php';

function publicDisciplineAssert(bool $condition, string $message): void
{
    if (!$condition) throw new RuntimeException($message);
}

final class PublicDisciplineFixtureRepository extends FiltersRepository
{
    /** @param array<string, mixed>|null $fixture */
    public function __construct(private ?array $fixture)
    {
    }

    public function fetchPublicDisciplineProjectionData(
        string $slug,
        int $topicLimit = 12,
        int $examLimit = 8,
        int $boardLimit = 8,
        int $questionLimit = 10
    ): ?array {
        if ($this->fixture === null || ($this->fixture['identity']['slug'] ?? null) !== $slug) return null;
        return $this->fixture;
    }
}

/** @param array<string, mixed> $overrides @return array<string, mixed> */
function publicDisciplineFixture(array $overrides = []): array
{
    $identity = array_replace([
        'id' => 10,
        'type' => 'assunto',
        'taxonomy_level' => 'materia',
        'meta_materia' => 0,
        'slug' => 'direito-constitucional',
        'name' => 'Direito Constitucional',
        'description' => 'Descrição pública.',
        'question_count' => 12,
        'content_updated_at' => '2026-08-16 12:00:00',
        'external_identity' => 'SECRET_IMPORTER_SENTINEL',
    ], $overrides);
    return [
        'identity' => $identity,
        'topics' => [['id' => 11, 'slug' => 'controle', 'name' => 'Controle', 'questionCount' => 5]],
        'exams' => [['id' => 20, 'slug' => 'prova-persistida', 'name' => 'Prova pública', 'year' => 2026, 'questionCount' => 3]],
        'boards' => [['id' => 30, 'slug' => 'cebraspe', 'name' => 'Cebraspe', 'acronym' => 'CEBRASPE', 'questionCount' => 8]],
        'questions' => [[
            'id' => 40,
            'excerpt' => 'Art. 5º - Ação & Controle',
            'updatedAt' => '2026-08-16',
            'correctAnswer' => 'SECRET_CORRECT_ANSWER_SENTINEL',
            'teacherComment' => 'SECRET_TEACHER_COMMENT_SENTINEL',
        ]],
    ];
}

/** @param array<string, mixed>|null $fixture */
function publicDisciplineService(?array $fixture): FiltersService
{
    return new FiltersService(new PublicDisciplineFixtureRepository($fixture), new FiltersValidator());
}

try {
    $projection = publicDisciplineService(publicDisciplineFixture())
        ->getPublicDisciplineProjection('direito-constitucional');
    publicDisciplineAssert(is_array($projection), 'Disciplina valida nao resolveu.');
    publicDisciplineAssert(($projection['canonicalPath'] ?? '') === '/disciplinas/direito-constitucional', 'Canonical nao usa slug persistido.');
    publicDisciplineAssert(($projection['questionsPath'] ?? '') === '/questoes?materia=Direito%20Constitucional', 'Faceta funcional incorreta.');
    publicDisciplineAssert(($projection['topics'][0]['questionsPath'] ?? '') === '/questoes?topico=Controle', 'Topico nao usa faceta funcional.');
    publicDisciplineAssert(($projection['exams'][0]['path'] ?? '') === '/provas/prova-persistida', 'Slug de prova foi regenerado.');
    publicDisciplineAssert(($projection['boards'][0]['path'] ?? '') === '/bancas/cebraspe', 'Path de banca divergente.');
    publicDisciplineAssert(($projection['questions'][0]['path'] ?? '') === '/questoes/40/art-5o-acao-e-controle', 'Slug normativo da questao divergente.');
    $encoded = json_encode($projection, JSON_THROW_ON_ERROR | JSON_UNESCAPED_UNICODE);
    foreach (['SECRET_IMPORTER_SENTINEL', 'SECRET_CORRECT_ANSWER_SENTINEL', 'SECRET_TEACHER_COMMENT_SENTINEL', 'correctAnswer', 'teacherComment'] as $forbidden) {
        publicDisciplineAssert(!str_contains($encoded, $forbidden), 'Projection publica vazou ' . $forbidden);
    }

    publicDisciplineAssert(
        publicDisciplineService(publicDisciplineFixture(['taxonomy_level' => 'topico', 'meta_materia' => 0]))
            ->getPublicDisciplineProjection('direito-constitucional') === null,
        'Topico resolveu como disciplina.'
    );
    publicDisciplineAssert(
        publicDisciplineService(publicDisciplineFixture(['taxonomy_level' => 'pending', 'meta_materia' => 1]))
            ->getPublicDisciplineProjection('direito-constitucional') === null,
        'Taxonomia pending foi exposta.'
    );
    publicDisciplineAssert(
        publicDisciplineService(publicDisciplineFixture(['name' => 'Outros']))
            ->getPublicDisciplineProjection('direito-constitucional') === null,
        'Placeholder foi exposto.'
    );

    $longSlug = str_repeat('disciplina-', 10) . 'publica';
    $longProjection = publicDisciplineService(publicDisciplineFixture(['slug' => $longSlug]))
        ->getPublicDisciplineProjection($longSlug);
    publicDisciplineAssert(is_array($longProjection), 'Slug acima de 80 foi impedido de renderizar em NOINDEX.');
    publicDisciplineAssert(($longProjection['slug'] ?? '') === $longSlug, 'Slug persistido longo foi alterado.');
    publicDisciplineAssert(publicDisciplineService(null)->getPublicDisciplineProjection('inexistente') === null, 'Ausencia nao retornou null.');

    $root = dirname(__DIR__);
    $routes = (string) file_get_contents($root . '/modules/filters/routes.php');
    $endpoint = (string) file_get_contents($root . '/api/filters/discipline.php');
    publicDisciplineAssert(str_contains($routes, 'Response::notFound'), 'Endpoint nao possui 404 explicito.');
    publicDisciplineAssert(str_contains($endpoint, "new Database('read')"), 'Endpoint nao usa conexao de leitura.');
    publicDisciplineAssert(str_contains($endpoint, 'handlePublicDisciplineDetailRoute($db)'), 'Endpoint nao aciona rota publica.');

    echo "PublicDisciplineDetailTest: PASS\n";
    exit(0);
} catch (Throwable $error) {
    fwrite(STDERR, 'PublicDisciplineDetailTest: FAIL - ' . $error->getMessage() . PHP_EOL);
    exit(1);
}

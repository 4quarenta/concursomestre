<?php

declare(strict_types=1);

require_once dirname(__DIR__) . '/modules/filters/services/FiltersService.php';

function publicOrganizationAssert(bool $condition, string $message): void
{
    if (!$condition) throw new RuntimeException($message);
}

final class PublicOrganizationFixtureRepository extends FiltersRepository
{
    /** @param array<string, mixed>|null $fixture */
    public function __construct(private ?array $fixture)
    {
    }

    public function fetchPublicOrganizationProjectionData(
        string $slug,
        int $questionLimit = 10,
        int $examLimit = 8,
        int $roleLimit = 12,
        int $disciplineLimit = 10,
        int $boardLimit = 8
    ): ?array {
        if ($this->fixture === null || ($this->fixture['identity']['slug'] ?? null) !== $slug) return null;
        return $this->fixture;
    }
}

/** @param array<string, mixed> $overrides @return array<string, mixed> */
function publicOrganizationFixture(array $overrides = []): array
{
    return [
        'identity' => array_replace([
            'id' => 70, 'type' => 'orgao', 'taxonomy_level' => null,
            'slug' => 'policia-federal', 'name' => 'Polícia Federal', 'acronym' => 'PF',
            'description' => 'Órgão público federal.', 'website' => 'https://www.gov.br/pf/',
            'asset_url' => null, 'meta_uf' => 'BR', 'meta_esfera' => 'Federal',
            'question_count' => 42, 'exam_count' => 3, 'content_updated_at' => '2026-08-18',
            'external_identity' => 'SECRET_IMPORTER_SENTINEL',
        ], $overrides),
        'roles' => [['id' => 71, 'slug' => 'agente', 'name' => 'Agente']],
        'disciplines' => [['id' => 10, 'slug' => 'direito', 'name' => 'Direito', 'questionCount' => 12]],
        'boards' => [['id' => 30, 'slug' => 'cebraspe', 'name' => 'Cebraspe', 'acronym' => 'CEBRASPE', 'examCount' => 2]],
        'exams' => [['id' => 20, 'slug' => 'pf-2026', 'name' => 'PF 2026', 'year' => 2026, 'questionCount' => 5]],
        'questions' => [[
            'id' => 40, 'excerpt' => 'Art. 5º - Ação & Controle', 'updatedAt' => '2026-08-18',
            'correctAnswer' => 'SECRET_CORRECT_ANSWER_SENTINEL',
            'teacherComment' => 'SECRET_TEACHER_COMMENT_SENTINEL',
        ]],
    ];
}

/** @param array<string, mixed>|null $fixture */
function publicOrganizationService(?array $fixture): FiltersService
{
    return new FiltersService(new PublicOrganizationFixtureRepository($fixture), new FiltersValidator());
}

try {
    $projection = publicOrganizationService(publicOrganizationFixture())
        ->getPublicOrganizationProjection('policia-federal');
    publicOrganizationAssert(is_array($projection), 'Orgao valido nao resolveu.');
    publicOrganizationAssert(($projection['canonicalPath'] ?? '') === '/orgaos/policia-federal', 'Canonical nao usa slug persistido.');
    publicOrganizationAssert(($projection['questionsPath'] ?? '') === '/questoes?orgao=Pol%C3%ADcia%20Federal', 'Faceta de orgao divergente.');
    publicOrganizationAssert(($projection['roles'][0]['path'] ?? '') === '/cargos/agente', 'Cargo nao usa o slug persistido.');
    publicOrganizationAssert(($projection['roles'][0]['questionsPath'] ?? '') === '/questoes?cargo=Agente', 'Faceta funcional de cargo divergente.');
    publicOrganizationAssert(($projection['disciplines'][0]['path'] ?? '') === '/disciplinas/direito', 'Link de disciplina divergente.');
    publicOrganizationAssert(($projection['boards'][0]['path'] ?? '') === '/bancas/cebraspe', 'Link de banca divergente.');
    publicOrganizationAssert(($projection['exams'][0]['path'] ?? '') === '/provas/pf-2026', 'Slug de prova foi regenerado.');
    publicOrganizationAssert(($projection['questions'][0]['path'] ?? '') === '/questoes/40/art-5o-acao-e-controle', 'Rota normativa da questao divergente.');
    $encoded = json_encode($projection, JSON_THROW_ON_ERROR | JSON_UNESCAPED_UNICODE);
    foreach (['SECRET_IMPORTER_SENTINEL', 'SECRET_CORRECT_ANSWER_SENTINEL', 'SECRET_TEACHER_COMMENT_SENTINEL', 'correctAnswer', 'teacherComment'] as $forbidden) {
        publicOrganizationAssert(!str_contains($encoded, $forbidden), 'Projection publica vazou ' . $forbidden);
    }

    foreach (['banca', 'cargo', 'materia', 'topico', 'subtopico', 'assunto', 'ano', 'carreira'] as $wrongType) {
        publicOrganizationAssert(
            publicOrganizationService(publicOrganizationFixture(['type' => $wrongType]))
                ->getPublicOrganizationProjection('policia-federal') === null,
            $wrongType . ' resolveu como orgao.'
        );
    }
    publicOrganizationAssert(
        publicOrganizationService(publicOrganizationFixture(['taxonomy_level' => 'pending']))
            ->getPublicOrganizationProjection('policia-federal') === null,
        'Orgao pending foi exposto.'
    );
    foreach (['internal', 'technical'] as $blockedLevel) {
        publicOrganizationAssert(
            publicOrganizationService(publicOrganizationFixture(['taxonomy_level' => $blockedLevel]))
                ->getPublicOrganizationProjection('policia-federal') === null,
            'Orgao ' . $blockedLevel . ' foi exposto.'
        );
    }
    publicOrganizationAssert(
        publicOrganizationService(publicOrganizationFixture(['name' => 'Outros']))
            ->getPublicOrganizationProjection('policia-federal') === null,
        'Placeholder foi exposto.'
    );
    publicOrganizationAssert(publicOrganizationService(null)->getPublicOrganizationProjection('inexistente') === null, 'Ausencia nao retornou null.');
    publicOrganizationAssert(
        publicOrganizationService(publicOrganizationFixture())->getPublicOrganizationProjection('slug invalido') === null,
        'Slug invalido nao seguiu o fluxo de hard 404.'
    );

    $root = dirname(__DIR__);
    $routes = (string) file_get_contents($root . '/modules/filters/routes.php');
    $endpoint = (string) file_get_contents($root . '/api/filters/organization.php');
    $examService = (string) file_get_contents($root . '/modules/exams/services/ExamsService.php');
    publicOrganizationAssert(str_contains($routes, "Response::notFound('Orgao nao encontrado.')"), 'Endpoint nao possui 404 explicito.');
    publicOrganizationAssert(str_contains($endpoint, "new Database('read')"), 'Endpoint nao usa conexao de leitura.');
    publicOrganizationAssert(str_contains($endpoint, 'handlePublicOrganizationDetailRoute($db)'), 'Endpoint nao aciona rota publica.');
    publicOrganizationAssert(
        str_contains($examService, 'publicOrganizationList') && str_contains($examService, 'allowsOrganization'),
        'Interlink de prova nao aplica a policy publica de orgao.'
    );

    echo "PublicOrganizationDetailTest: PASS\n";
    exit(0);
} catch (Throwable $error) {
    fwrite(STDERR, 'PublicOrganizationDetailTest: FAIL - ' . $error->getMessage() . PHP_EOL);
    exit(1);
}

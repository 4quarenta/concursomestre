<?php

declare(strict_types=1);

require_once dirname(__DIR__) . '/modules/filters/services/FiltersService.php';

function publicKnowledgeAssert(bool $condition, string $message): void
{
    if (!$condition) throw new RuntimeException($message);
}

final class PublicKnowledgeFixtureRepository extends FiltersRepository
{
    /** @param array<string, mixed>|null $fixture */
    public function __construct(private ?array $fixture)
    {
    }

    public function fetchPublicDisciplineProjectionData(string $slug, int $a = 12, int $b = 8, int $c = 8, int $d = 10): ?array
    {
        return $this->fixtureFor($slug, 'materia');
    }

    public function fetchPublicKnowledgeTaxonomyProjectionData(string $slug, string $level, int $a = 40, int $b = 8, int $c = 8, int $d = 10): ?array
    {
        return $this->fixtureFor($slug, $level);
    }

    private function fixtureFor(string $slug, string $level): ?array
    {
        if ($this->fixture === null || ($this->fixture['identity']['requested_slug'] ?? $this->fixture['identity']['slug'] ?? null) !== $slug) return null;
        return $this->fixture['expectedLevel'] === $level ? $this->fixture : null;
    }
}

/** @param array<string, mixed> $identityOverrides @return array<string, mixed> */
function knowledgeFixture(string $level, array $identityOverrides = []): array
{
    $identity = array_replace([
        'id' => $level === 'materia' ? 10 : ($level === 'topico' ? 11 : 13),
        'type' => 'assunto', 'taxonomy_level' => $level, 'meta_materia' => $level === 'materia' ? 1 : 0,
        'own_parent_id' => $level === 'materia' ? 0 : ($level === 'topico' ? 10 : 12),
        'slug' => $level === 'materia' ? 'direito-constitucional' : ($level === 'topico' ? 'controle' : 'acao-direta'),
        'requested_slug' => $level === 'materia' ? 'direito-constitucional' : ($level === 'topico' ? 'controle' : 'acao-direta'),
        'name' => $level === 'materia' ? 'Direito Constitucional' : ($level === 'topico' ? 'Controle' : 'Ação Direta'),
        'description' => 'Descrição pública.', 'question_count' => 12, 'content_updated_at' => '2026-08-18 12:00:00',
        'parent_id' => $level === 'materia' ? null : ($level === 'topico' ? 10 : 12),
        'parent_parent_id' => $level === 'topico' ? 0 : 11,
        'parent_type' => $level === 'materia' ? null : 'assunto',
        'parent_taxonomy_level' => $level === 'topico' ? 'materia' : 'subtopico',
        'parent_meta_materia' => $level === 'topico' ? 1 : 0,
        'parent_slug' => $level === 'topico' ? 'direito-constitucional' : 'controle-concentrado',
        'parent_name' => $level === 'topico' ? 'Direito Constitucional' : 'Controle Concentrado',
        'grandparent_id' => $level === 'assunto' ? 11 : null, 'grandparent_parent_id' => $level === 'assunto' ? 10 : null,
        'grandparent_type' => $level === 'assunto' ? 'assunto' : null, 'grandparent_taxonomy_level' => $level === 'assunto' ? 'topico' : null,
        'grandparent_meta_materia' => 0, 'grandparent_slug' => $level === 'assunto' ? 'controle' : null, 'grandparent_name' => $level === 'assunto' ? 'Controle' : null,
        'great_grandparent_id' => $level === 'assunto' ? 10 : null, 'great_grandparent_parent_id' => 0,
        'great_grandparent_type' => $level === 'assunto' ? 'assunto' : null, 'great_grandparent_taxonomy_level' => $level === 'assunto' ? 'materia' : null,
        'great_grandparent_meta_materia' => $level === 'assunto' ? 1 : 0, 'great_grandparent_slug' => $level === 'assunto' ? 'direito-constitucional' : null,
        'great_grandparent_name' => $level === 'assunto' ? 'Direito Constitucional' : null,
        'external_identity' => 'SECRET_IMPORTER_SENTINEL',
    ], $identityOverrides);
    return [
        'expectedLevel' => $level,
        'identity' => $identity,
        'children' => $level === 'materia'
            ? [['id' => 11, 'type' => 'assunto', 'meta_materia' => 0, 'slug' => 'controle', 'name' => 'Controle', 'taxonomy_level' => 'topico', 'parent_id' => 10, 'questionCount' => 5]]
            : ($level === 'topico' ? [
                ['id' => 12, 'type' => 'assunto', 'meta_materia' => 0, 'slug' => 'controle-concentrado', 'name' => 'Controle Concentrado', 'taxonomy_level' => 'subtopico', 'parent_id' => 11, 'questionCount' => 0],
                ['id' => 13, 'type' => 'assunto', 'meta_materia' => 0, 'slug' => 'acao-direta', 'name' => 'Ação Direta', 'taxonomy_level' => 'assunto', 'parent_id' => 12, 'parent_name' => 'Controle Concentrado', 'parent_slug' => 'controle-concentrado', 'questionCount' => 5],
            ] : []),
        'exams' => [['id' => 20, 'slug' => 'prova-persistida', 'name' => 'Prova pública', 'year' => 2026, 'questionCount' => 3]],
        'boards' => [['id' => 30, 'slug' => 'cebraspe', 'name' => 'Cebraspe', 'acronym' => 'CEBRASPE', 'questionCount' => 8]],
        'organizations' => [['id' => 31, 'slug' => 'stf', 'name' => 'Supremo Tribunal Federal', 'acronym' => 'STF', 'questionCount' => 4]],
        'questions' => [['id' => 40, 'excerpt' => 'Art. 5º - Ação & Controle', 'updatedAt' => '2026-08-18', 'correctAnswer' => 'SECRET_ANSWER']],
    ];
}

function knowledgeService(?array $fixture): FiltersService
{
    return new FiltersService(new PublicKnowledgeFixtureRepository($fixture), new FiltersValidator());
}

try {
    $discipline = knowledgeService(knowledgeFixture('materia'))->getPublicDisciplineProjection('direito-constitucional');
    publicKnowledgeAssert(($discipline['topics'][0]['path'] ?? '') === '/topicos/controle', 'Disciplina nao aponta para landing de topico.');
    publicKnowledgeAssert(($discipline['topics'][0]['questionsPath'] ?? '') === '/questoes?topico=Controle', 'Faceta do topico divergente.');
    publicKnowledgeAssert(($discipline['readiness']['status'] ?? '') === 'READY', 'Disciplina valida nao ficou READY.');

    $topic = knowledgeService(knowledgeFixture('topico'))->getPublicKnowledgeTaxonomyProjection('controle', 'topico');
    publicKnowledgeAssert(($topic['canonicalPath'] ?? '') === '/topicos/controle', 'Canonical de topico divergente.');
    publicKnowledgeAssert(($topic['subjects'][0]['path'] ?? '') === '/assuntos/acao-direta', 'Assunto nao usa slug persistido.');
    publicKnowledgeAssert(($topic['subtopics'][0]['name'] ?? '') === 'Controle Concentrado', 'Subtopico nao foi preservado como agrupador.');

    $subject = knowledgeService(knowledgeFixture('assunto'))->getPublicKnowledgeTaxonomyProjection('acao-direta', 'assunto');
    publicKnowledgeAssert(($subject['root']['path'] ?? '') === '/disciplinas/direito-constitucional', 'Raiz do assunto divergente.');
    publicKnowledgeAssert(($subject['topic']['path'] ?? '') === '/topicos/controle', 'Topico do assunto divergente.');
    publicKnowledgeAssert(($subject['subtopic']['name'] ?? '') === 'Controle Concentrado', 'Contexto de subtopico ausente.');

    publicKnowledgeAssert(knowledgeService(knowledgeFixture('materia'))->getPublicKnowledgeTaxonomyProjection('direito-constitucional', 'topico') === null, 'Materia resolveu como topico.');
    publicKnowledgeAssert(knowledgeService(knowledgeFixture('topico'))->getPublicKnowledgeTaxonomyProjection('controle', 'assunto') === null, 'Topico resolveu como assunto.');

    $invalid = knowledgeFixture('topico', ['parent_id' => null, 'parent_type' => null, 'parent_taxonomy_level' => null, 'parent_slug' => null, 'parent_name' => null]);
    $invalidProjection = knowledgeService($invalid)->getPublicKnowledgeTaxonomyProjection('controle', 'topico');
    publicKnowledgeAssert(($invalidProjection['readiness']['status'] ?? '') === 'NOT_READY', 'Cadeia invalida virou 404 ou READY.');
    publicKnowledgeAssert(in_array('instance_readiness.invalid_taxonomy_chain', $invalidProjection['readiness']['reasonCodes'] ?? [], true), 'Reason code de cadeia invalida ausente.');
    publicKnowledgeAssert(($invalidProjection['root'] ?? null) === null, 'Cadeia invalida publicou raiz falsa.');
    publicKnowledgeAssert(($invalidProjection['parent'] ?? null) === null, 'Cadeia invalida publicou parent estrutural falso.');
    publicKnowledgeAssert(($invalidProjection['topic'] ?? null) === null, 'Cadeia invalida publicou topico estrutural falso.');
    publicKnowledgeAssert(($invalidProjection['subtopic'] ?? null) === null, 'Cadeia invalida publicou subtopico estrutural falso.');
    publicKnowledgeAssert(($invalidProjection['subjects'] ?? []) === [], 'Cadeia invalida promoveu descendentes estruturais.');

    $invalidChildFixture = knowledgeFixture('topico');
    $invalidChildFixture['children'][] = [
        'id' => 99, 'type' => 'assunto', 'meta_materia' => 0, 'slug' => 'assunto-invalido',
        'name' => 'Assunto inválido', 'taxonomy_level' => 'assunto', 'parent_id' => 999,
        'parent_name' => 'Subtópico inexistente', 'parent_slug' => 'subtopico-inexistente', 'questionCount' => 1,
    ];
    $topicWithoutInvalidLink = knowledgeService($invalidChildFixture)->getPublicKnowledgeTaxonomyProjection('controle', 'topico');
    publicKnowledgeAssert(!str_contains(json_encode($topicWithoutInvalidLink, JSON_THROW_ON_ERROR), '/assuntos/assunto-invalido'), 'Cadeia invalida recebeu interlink estrutural.');

    $aliasFixture = knowledgeFixture('topico', ['requested_slug' => 'controle-antigo']);
    $alias = knowledgeService($aliasFixture)->getPublicKnowledgeTaxonomyProjection('controle-antigo', 'topico');
    publicKnowledgeAssert(($alias['requestedSlug'] ?? '') === 'controle-antigo' && ($alias['slug'] ?? '') === 'controle', 'Alias nao preservou canonical atual.');

    $encoded = json_encode([$discipline, $topic, $subject], JSON_THROW_ON_ERROR | JSON_UNESCAPED_UNICODE);
    foreach (['SECRET_IMPORTER_SENTINEL', 'SECRET_ANSWER', 'correctAnswer'] as $forbidden) publicKnowledgeAssert(!str_contains($encoded, $forbidden), 'Projection publica vazou ' . $forbidden);
    publicKnowledgeAssert(knowledgeService(null)->getPublicKnowledgeTaxonomyProjection('inexistente', 'topico') === null, 'Ausencia nao retornou null.');
    $endpoint = (string) file_get_contents(dirname(__DIR__) . '/api/filters/knowledge-taxonomy.php');
    $routes = (string) file_get_contents(dirname(__DIR__) . '/modules/filters/routes.php');
    $repository = (string) file_get_contents(dirname(__DIR__) . '/modules/filters/repositories/FiltersRepository.php');
    publicKnowledgeAssert(str_contains($endpoint, "new Database('read')"), 'Endpoint publico nao usa conexao read-only.');
    publicKnowledgeAssert(str_contains($routes, "['materia', 'topico', 'assunto']"), 'Endpoint aceita nivel arbitrario.');
    publicKnowledgeAssert(str_contains($repository, "f.type = 'assunto'"), 'Lookup nao restringe a taxonomia real.');
    publicKnowledgeAssert(str_contains($repository, 'filter_aliases'), 'Alias tipado nao usa tabela persistida.');
    echo "PublicDisciplineDetailTest: PASS\n";
    exit(0);
} catch (Throwable $error) {
    fwrite(STDERR, 'PublicDisciplineDetailTest: FAIL - ' . $error->getMessage() . PHP_EOL);
    exit(1);
}

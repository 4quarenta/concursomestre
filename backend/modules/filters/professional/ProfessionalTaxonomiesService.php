<?php

declare(strict_types=1);

require_once __DIR__ . '/ProfessionalTaxonomiesRepository.php';
require_once __DIR__ . '/ProfessionalTaxonomyReadinessValidator.php';
require_once __DIR__ . '/PublicProfessionalTaxonomyProjection.php';
require_once dirname(__DIR__, 2) . '/seo/routes/PublicRouteBuilder.php';
require_once dirname(__DIR__, 2) . '/seo/services/SeoSlugService.php';

final class ProfessionalTaxonomiesService
{
    public function __construct(private readonly ProfessionalTaxonomiesRepository $repository) {}

    /** @return array<string,mixed> */
    public function directory(string $kind, int $page, int $limit, string $search = '', string $letter = ''): array
    {
        $data = $this->repository->listPublic($kind, $page, $limit, $search, $letter);
        $routes = new PublicRouteBuilder();
        $data['items'] = array_values(array_filter(array_map(static function (array $row) use ($kind, $routes): ?array {
            $readiness = ProfessionalTaxonomyReadinessValidator::evaluate($row + ['type' => $kind === 'career' ? 'carreira' : 'cargo'], $kind);
            if ($readiness['status'] !== 'READY') return null;
            return [
                'id' => (int) $row['id'], 'slug' => (string) $row['slug'], 'name' => (string) $row['name'],
                'description' => $row['description'] ?: null,
                'questionCount' => max(0, (int) ($row['question_count'] ?? 0)),
                'examCount' => max(0, (int) ($row['exam_count'] ?? 0)),
                'path' => $kind === 'career'
                    ? $routes->careerDetail((string) $row['slug'])
                    : $routes->positionDetail((string) $row['slug']),
            ];
        }, $data['rows'])));
        unset($data['rows']);
        $data['pageInfo'] = ['page' => (int) $data['page'], 'pages' => (int) $data['pages'], 'limit' => (int) $data['limit'], 'total' => (int) $data['total']];
        unset($data['page'], $data['pages'], $data['limit'], $data['total']);
        return $data;
    }

    /** @return array<string,mixed>|null */
    public function detail(string $kind, string $slug): ?array
    {
        $slug = trim($slug);
        if (!in_array($kind, ['career', 'position'], true) || $slug === '' || strlen($slug) > 190
            || preg_match('/^[a-z0-9]+(?:-[a-z0-9]+)*$/', $slug) !== 1) return null;
        $data = $this->repository->findPublicBySlug($kind, $slug);
        if ($data === null || isset($data['redirectSlug'])) return $data;
        $identity = is_array($data['identity'] ?? null) ? $data['identity'] : [];
        $readiness = ProfessionalTaxonomyReadinessValidator::evaluate($identity, $kind);
        if ($readiness['status'] !== 'READY') return null;

        $routes = new PublicRouteBuilder();
        $slugger = new SeoSlugService();
        $name = (string) ($identity['name'] ?? '');
        $persistedSlug = (string) ($identity['slug'] ?? '');
        $data['kind'] = $kind;
        $data['readiness'] = $readiness;
        $data['canonicalPath'] = $kind === 'career' ? $routes->careerDetail($persistedSlug) : $routes->positionDetail($persistedSlug);
        $data['questionsPath'] = $routes->questionsIndex([$kind === 'career' ? 'career' : 'role' => $name]);
        $data['contestsPath'] = $kind === 'career'
            ? $routes->contestsIndex()
            : $routes->contestsIndex(['cargo' => $name]);
        if ($kind === 'career') {
            $data['positions'] = $this->paths($data['memberships'] ?? [], fn (string $value): string => $routes->positionDetail($value));
            $data['careers'] = [];
        } else {
            $data['careers'] = $this->paths($data['memberships'] ?? [], fn (string $value): string => $routes->careerDetail($value));
            $data['positions'] = [];
        }
        unset($data['memberships']);
        $data['contests'] = $this->paths($data['contests'] ?? [], fn (string $value): string => $routes->contestDetail($value));
        $data['organizations'] = $this->paths($data['organizations'] ?? [], fn (string $value): string => $routes->organizationDetail($value));
        $data['exams'] = $this->paths($data['exams'] ?? [], fn (string $value): string => $routes->examDetail($value));
        $data['boards'] = $this->paths($data['boards'] ?? [], fn (string $value): string => $routes->boardDetail($value));
        $data['questions'] = array_map(static function (array $question) use ($routes, $slugger): array {
            $id = (int) ($question['id'] ?? 0);
            $question['path'] = $routes->questionDetail($id, $slugger->slug((string) ($question['excerpt'] ?? ''), 'questao', $id));
            return $question;
        }, is_array($data['questions'] ?? null) ? $data['questions'] : []);
        $hub = $kind === 'career' ? $routes->careersIndex() : $routes->positionsIndex();
        $data['breadcrumbs'] = [
            ['label' => 'Início', 'canonicalPath' => '/'],
            ['label' => $kind === 'career' ? 'Carreiras' : 'Cargos', 'canonicalPath' => $hub],
            ['label' => $name, 'canonicalPath' => $data['canonicalPath']],
        ];
        return PublicProfessionalTaxonomyProjection::detail($data);
    }

    /** @param mixed $rows @param callable(string):string $builder */
    private function paths(mixed $rows, callable $builder): array
    {
        if (!is_array($rows)) return [];
        return array_values(array_map(static function (array $row) use ($builder): array {
            $row['path'] = $builder((string) ($row['slug'] ?? ''));
            return $row;
        }, array_filter($rows, 'is_array')));
    }
}

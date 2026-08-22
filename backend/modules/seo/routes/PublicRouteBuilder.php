<?php

declare(strict_types=1);

require_once dirname(__DIR__) . '/policies/StructuralRoutePolicy.php';

/**
 * Constroi somente URLs publicas canônicas previstas na policy estrutural.
 * Aliases legados permanecem declarados na policy para compatibilidade, mas
 * nunca sao emitidos por este builder.
 */
final class PublicRouteBuilder
{
    public function disciplinesIndex(): string
    {
        return $this->requiredPath('discipline_hub');
    }

    private readonly StructuralRoutePolicy $routes;

    public function __construct(?StructuralRoutePolicy $routes = null)
    {
        $this->routes = $routes ?? new StructuralRoutePolicy();
    }

    /** @param array<string, scalar|list<scalar>|null> $query */
    public function questionsIndex(array $query = []): string
    {
        return $this->withQuery('questions_hub', $this->requiredPath('questions_hub'), $query);
    }

    public function questionDetail(string|int $id, string $slug): string
    {
        return $this->requiredPath('question_detail', [
            'id' => $id,
            'slug' => $slug,
        ]);
    }

    /** @param array<string, scalar|list<scalar>|null> $query */
    public function examsIndex(array $query = []): string
    {
        return $this->withQuery('exam_hub', $this->requiredPath('exam_hub'), $query);
    }

    public function examDetail(string $persistedSlug): string
    {
        return $this->requiredPath('exam_detail', ['slug' => $persistedSlug]);
    }

    public function disciplineDetail(string $persistedSlug): string
    {
        return $this->requiredPath('discipline_detail', ['slug' => $persistedSlug]);
    }

    public function topicDetail(string $persistedSlug): string
    {
        return $this->requiredPath('topic_detail', ['slug' => $persistedSlug]);
    }

    public function subjectDetail(string $persistedSlug): string
    {
        return $this->requiredPath('subject_detail', ['slug' => $persistedSlug]);
    }

    public function boardDetail(string $persistedSlug): string
    {
        return $this->requiredPath('board_detail', ['slug' => $persistedSlug]);
    }

    public function boardsIndex(): string
    {
        return $this->requiredPath('board_hub');
    }

    /** @param array<string, scalar|list<scalar>|null> $query */
    public function organizationsIndex(array $query = []): string
    {
        return $this->withQuery('organizations_hub', $this->requiredPath('organizations_hub'), $query);
    }

    public function organizationDetail(string $persistedSlug): string
    {
        return $this->requiredPath('organization_detail', ['slug' => $persistedSlug]);
    }

    /** @param array<string, scalar|list<scalar>|null> $query */
    public function careersIndex(array $query = []): string
    {
        return $this->withQuery('careers_hub', $this->requiredPath('careers_hub'), $query);
    }

    public function careerDetail(string $persistedSlug): string
    {
        return $this->requiredPath('career_detail', ['slug' => $persistedSlug]);
    }

    /** @param array<string, scalar|list<scalar>|null> $query */
    public function positionsIndex(array $query = []): string
    {
        return $this->withQuery('positions_hub', $this->requiredPath('positions_hub'), $query);
    }

    public function positionDetail(string $persistedSlug): string
    {
        return $this->requiredPath('position_detail', ['slug' => $persistedSlug]);
    }

    /** @param array<string, scalar|list<scalar>|null> $query */
    public function contestsIndex(array $query = []): string
    {
        return $this->withQuery('contest_hub', $this->requiredPath('contest_hub'), $query);
    }

    public function contestDetail(string $persistedSlug): string
    {
        return $this->requiredPath('contest_detail', ['slug' => $persistedSlug]);
    }

    /** @param array<string, scalar|list<scalar>|null> $query */
    public function openContests(array $query = []): string
    {
        return $this->withQuery('open_contests', $this->requiredPath('open_contests'), $query);
    }

    /** @param array<string, scalar|list<scalar>|null> $query */
    public function simulationsIndex(array $query = []): string
    {
        return $this->withQuery('simulations_hub', $this->requiredPath('simulations_hub'), $query);
    }

    public function simulationDetail(string $persistedSlug): string
    {
        return $this->requiredPath('simulation_detail', ['slug' => $persistedSlug]);
    }

    /** @param array<string, scalar|list<scalar>|null> $query */
    public function materialsIndex(array $query = []): string
    {
        return $this->withQuery('materials_hub', $this->requiredPath('materials_hub'), $query);
    }

    public function materialDetail(string $persistedSlug): string
    {
        return $this->requiredPath('material_detail', ['slug' => $persistedSlug]);
    }

    /** @param array<string, scalar|list<scalar>|null> $query */
    public function marketplaceIndex(array $query = []): string
    {
        return $this->withQuery('marketplace', $this->requiredPath('marketplace'), $query);
    }

    public function lawDetail(string $persistedSlug): string
    {
        return $this->requiredPath('law_detail', ['slug' => $persistedSlug]);
    }

    public function lawsIndex(): string
    {
        return $this->requiredPath('law_hub');
    }

    public function lawArticleDetail(string $lawPersistedSlug, string $articlePersistedSlug): string
    {
        return $this->requiredPath('law_article_detail', [
            'lawSlug' => $lawPersistedSlug,
            'articleSlug' => $articlePersistedSlug,
        ]);
    }

    public function blogIndex(): string
    {
        return $this->requiredPath('blog_hub');
    }

    public function blogArticleDetail(string $persistedSlug): string
    {
        return $this->requiredPath('blog_article', ['slug' => $persistedSlug]);
    }

    public function blogCategoryDetail(string $persistedSlug): string
    {
        return $this->requiredPath('blog_category', ['slug' => $persistedSlug]);
    }

    public function blogTagDetail(string $persistedSlug): string
    {
        return $this->requiredPath('blog_tag', ['slug' => $persistedSlug]);
    }

    public function blogAuthorDetail(int $id): string
    {
        return $this->requiredPath('blog_author', ['id' => (string) $id]);
    }

    /** @param array<string, string|int> $parameters */
    private function requiredPath(string $familyId, array $parameters = []): string
    {
        $path = $this->routes->buildPath($familyId, $parameters);
        if ($path === null) {
            throw new LogicException('Nao foi possivel construir a familia publica ' . $familyId . '.');
        }
        return $path;
    }

    /** @param array<string, scalar|list<scalar>|null> $query */
    private function withQuery(string $familyId, string $path, array $query): string
    {
        $pairs = [];
        foreach ($query as $parameter => $rawValue) {
            if (!$this->routes->allowsParameter($familyId, (string) $parameter)) {
                throw new InvalidArgumentException(
                    sprintf('Parametro %s nao permitido para a familia %s.', $parameter, $familyId)
                );
            }
            $values = is_array($rawValue) ? $rawValue : [$rawValue];
            foreach ($values as $value) {
                if ($value === null || $value === '') {
                    continue;
                }
                if (!is_scalar($value)) {
                    throw new InvalidArgumentException('Valor de query publica invalido.');
                }
                $pairs[] = rawurlencode((string) $parameter) . '=' . rawurlencode((string) $value);
            }
        }

        return $pairs === [] ? $path : $path . '?' . implode('&', $pairs);
    }
}

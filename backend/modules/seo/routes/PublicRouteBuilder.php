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

    public function boardDetail(string $persistedSlug): string
    {
        return $this->requiredPath('board_detail', ['slug' => $persistedSlug]);
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

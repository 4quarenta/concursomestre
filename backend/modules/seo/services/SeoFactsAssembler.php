<?php

declare(strict_types=1);

require_once dirname(__DIR__) . '/contracts/SeoContractValidator.php';

/**
 * Monta SeoFacts exclusivamente a partir de uma projecao publica fornecida
 * pelo chamador. A lista branca impede que gabarito, editoriais protegidos ou
 * campos administrativos atravessem a fronteira, mesmo quando existirem na
 * origem recebida.
 */
final class SeoFactsAssembler
{
    /**
     * @param array<string, mixed> $publicData
     * @return array<string, mixed>
     */
    public function assemble(string $resourceType, array $publicData): array
    {
        $facts = match ($resourceType) {
            'question' => $this->question($publicData),
            'exam' => $this->exam($publicData),
            'taxonomy' => $this->taxonomy($publicData),
            'board' => $this->board($publicData),
            'law' => $this->law($publicData),
            default => throw new InvalidArgumentException('SeoFactsAssembler nao suporta este recurso no Checkpoint 2.'),
        };

        $errors = SeoContractValidator::validateSeoFacts($facts);
        if ($errors !== []) {
            throw new InvalidArgumentException('SeoFacts invalido: ' . implode(' | ', $errors));
        }

        return $facts;
    }

    /** @param array<string, mixed> $data
     *  @return array<string, mixed>
     */
    private function question(array $data): array
    {
        $id = $this->text($data['id'] ?? '');
        $displayName = $this->text($data['displayName'] ?? '');
        if ($displayName === '') {
            $displayName = 'Questao ' . ($id !== '' ? $id : 'sem identificador');
        }

        return $this->base('question', $data, $displayName) + [
            'content' => [
                'questionExcerpt' => $this->excerpt($data['statement'] ?? '', 600),
                'supportExcerpt' => $this->excerpt($data['supportText'] ?? '', 600),
                'publicDescription' => $this->excerpt($data['publicDescription'] ?? '', 1200),
            ],
            'classification' => [
                'subjectName' => $this->nullableText($data['subjectName'] ?? null, 190),
                'topicName' => $this->nullableText($data['topicName'] ?? null, 190),
                'boardName' => $this->nullableText($data['boardName'] ?? null, 190),
                'organizationName' => $this->nullableText($data['organizationName'] ?? null, 190),
                'roleName' => $this->nullableText($data['roleName'] ?? null, 190),
                'year' => $this->year($data['year'] ?? null),
            ],
        ];
    }

    /** @param array<string, mixed> $data
     *  @return array<string, mixed>
     */
    private function exam(array $data): array
    {
        return $this->base('exam', $data, $this->requiredName($data, 'Prova')) + [
            'content' => [
                'summaryExcerpt' => $this->excerpt($data['summary'] ?? '', 600),
                'publicDescription' => $this->excerpt($data['publicDescription'] ?? '', 1200),
            ],
            'classification' => [
                'boardName' => $this->nullableText($data['boardName'] ?? null, 190),
                'organizationNames' => $this->textList($data['organizationNames'] ?? [], 190),
                'roleNames' => $this->textList($data['roleNames'] ?? [], 190),
                'year' => $this->year($data['year'] ?? null),
                'levelName' => $this->nullableText($data['levelName'] ?? null, 100),
            ],
        ];
    }

    /** @param array<string, mixed> $data
     *  @return array<string, mixed>
     */
    private function taxonomy(array $data): array
    {
        $kind = strtolower($this->text($data['taxonomyKind'] ?? ''));
        $allowedKinds = ['discipline', 'topic', 'subject', 'category', 'tag', 'organization', 'role', 'year'];
        if (!in_array($kind, $allowedKinds, true)) {
            $kind = 'subject';
        }

        return $this->base('taxonomy', $data, $this->requiredName($data, 'Taxonomia')) + [
            'taxonomyKind' => $kind,
            'content' => [
                'publicDescription' => $this->excerpt($data['publicDescription'] ?? '', 1200),
                'editorialIntroduction' => $this->excerpt($data['editorialIntroduction'] ?? '', 4000),
            ],
            'hierarchy' => [
                'parentName' => $this->nullableText($data['parentName'] ?? null, 190),
                'rootName' => $this->nullableText($data['rootName'] ?? null, 190),
            ],
            'metrics' => [
                'publicItemCount' => $this->nonNegativeInt($data['publicItemCount'] ?? 0),
            ],
        ];
    }

    /** @param array<string, mixed> $data
     *  @return array<string, mixed>
     */
    private function board(array $data): array
    {
        return $this->base('board', $data, $this->requiredName($data, 'Banca')) + [
            'content' => [
                'publicDescription' => $this->excerpt($data['publicDescription'] ?? '', 1200),
                'editorialIntroduction' => $this->excerpt($data['editorialIntroduction'] ?? '', 4000),
            ],
            'board' => [
                'acronym' => $this->nullableText($data['acronym'] ?? null, 40),
                'fullName' => $this->nullableText($data['fullName'] ?? null, 300),
                'website' => $this->publicUrlOrNull($data['website'] ?? null),
            ],
            'metrics' => [
                'publicQuestionCount' => $this->nonNegativeInt($data['publicQuestionCount'] ?? 0),
                'publicExamCount' => $this->nonNegativeInt($data['publicExamCount'] ?? 0),
            ],
        ];
    }

    /** @param array<string, mixed> $data
     *  @return array<string, mixed>
     */
    private function law(array $data): array
    {
        return $this->base('law', $data, $this->requiredName($data, 'Norma')) + [
            'content' => [
                'publicDescription' => $this->excerpt($data['publicDescription'] ?? '', 1200),
                'commentaryExcerpt' => $this->excerpt($data['commentaryExcerpt'] ?? '', 1200),
            ],
            'law' => [
                'identifier' => $this->nullableText($data['identifier'] ?? null, 190),
                'jurisdiction' => $this->nullableText($data['jurisdiction'] ?? null, 190),
                'articleCount' => $this->nonNegativeInt($data['articleCount'] ?? 0),
            ],
        ];
    }

    /** @param array<string, mixed> $data
     *  @return array<string, mixed>
     */
    private function base(string $resourceType, array $data, string $displayName): array
    {
        return [
            'factsVersion' => SeoContractEnums::SEO_FACTS_VERSION,
            'resourceType' => $resourceType,
            'locale' => 'pt-BR',
            'identity' => [
                'displayName' => $this->truncate($displayName, 300),
                'shortName' => $this->nullableText($data['shortName'] ?? null, 160),
            ],
            'dates' => [
                'publishedAt' => $this->date($data['publishedAt'] ?? null),
                'updatedAt' => $this->date($data['updatedAt'] ?? null),
            ],
            'primaryImage' => $this->primaryImage($data['primaryImage'] ?? null),
            'breadcrumbs' => $this->breadcrumbs($data['breadcrumbs'] ?? []),
        ];
    }

    /** @param array<string, mixed> $data */
    private function requiredName(array $data, string $fallback): string
    {
        $name = $this->text($data['displayName'] ?? $data['name'] ?? '');
        $id = $this->text($data['id'] ?? '');
        return $name !== '' ? $name : $fallback . ' ' . ($id !== '' ? $id : 'sem identificador');
    }

    private function excerpt(mixed $value, int $maximum): string
    {
        return $this->truncate($this->text($value), $maximum);
    }

    private function text(mixed $value): string
    {
        if (!is_scalar($value)) {
            return '';
        }
        $decoded = html_entity_decode(strip_tags((string) $value), ENT_QUOTES | ENT_HTML5, 'UTF-8');
        return trim(preg_replace('/\s+/u', ' ', $decoded) ?? $decoded);
    }

    private function nullableText(mixed $value, int $maximum): ?string
    {
        $text = $this->text($value);
        return $text === '' ? null : $this->truncate($text, $maximum);
    }

    /** @return list<string> */
    private function textList(mixed $value, int $maximum): array
    {
        if (!is_array($value)) {
            return [];
        }
        $items = [];
        foreach ($value as $item) {
            $text = $this->nullableText($item, $maximum);
            if ($text !== null) {
                $items[$text] = true;
            }
        }
        return array_keys($items);
    }

    private function truncate(string $value, int $maximum): string
    {
        if (function_exists('mb_substr')) {
            return mb_substr($value, 0, $maximum, 'UTF-8');
        }
        return substr($value, 0, $maximum);
    }

    private function year(mixed $value): ?int
    {
        $year = is_numeric($value) ? (int) $value : 0;
        return $year >= 1900 && $year <= 2200 ? $year : null;
    }

    private function nonNegativeInt(mixed $value): int
    {
        return max(0, is_numeric($value) ? (int) $value : 0);
    }

    private function date(mixed $value): ?string
    {
        if (!is_string($value) || trim($value) === '') {
            return null;
        }
        try {
            return (new DateTimeImmutable($value))->format(DateTimeInterface::ATOM);
        } catch (Throwable) {
            return null;
        }
    }

    /** @return array<string, mixed>|null */
    private function primaryImage(mixed $value): ?array
    {
        if (!is_array($value)) {
            return null;
        }
        $url = $this->text($value['url'] ?? '');
        if ($url === '' || !(str_starts_with($url, '/') || str_starts_with($url, 'https://'))) {
            return null;
        }
        return [
            'url' => $this->truncate($url, 2048),
            'alt' => $this->truncate($this->text($value['alt'] ?? ''), 300),
            'width' => isset($value['width']) && is_numeric($value['width']) && (int) $value['width'] > 0
                ? (int) $value['width']
                : null,
            'height' => isset($value['height']) && is_numeric($value['height']) && (int) $value['height'] > 0
                ? (int) $value['height']
                : null,
        ];
    }

    /** @return list<array{label: string, canonicalPath: string}> */
    private function breadcrumbs(mixed $value): array
    {
        if (!is_array($value)) {
            return [];
        }
        $breadcrumbs = [];
        foreach (array_slice($value, 0, 12) as $item) {
            if (!is_array($item)) {
                continue;
            }
            $label = $this->nullableText($item['label'] ?? null, 160);
            $path = $this->text($item['canonicalPath'] ?? '');
            if ($label === null || preg_match('~^/[^?#]*$~', $path) !== 1) {
                continue;
            }
            $breadcrumbs[] = ['label' => $label, 'canonicalPath' => $path];
        }
        return $breadcrumbs;
    }

    private function publicUrlOrNull(mixed $value): ?string
    {
        $url = $this->text($value);
        return $url !== '' && str_starts_with($url, 'https://') ? $this->truncate($url, 2048) : null;
    }
}

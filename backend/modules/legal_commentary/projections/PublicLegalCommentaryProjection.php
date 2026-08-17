<?php

/*
* ----------------------------------------------------
* @author: 4quarenta
* @author URI: https://github.com/4quarenta
* @copyright: (c) 2026 ConcursoMestre. All rights reserved
* ----------------------------------------------------
*
* @since 1.0.0
*
*/

declare(strict_types=1);

/**
 * Projecao allowlist usada pelo endpoint publico da Lei Comentada.
 * Campos novos do modelo interno permanecem privados ate serem autorizados aqui.
 */
final class PublicLegalCommentaryProjection
{
    /** @var list<string> */
    private const LAW_SCALAR_FIELDS = [
        'id', 'slug', 'areaId', 'lawTopicFilterId', 'lawTopicName', 'lawTopicSlug',
        'topicName', 'topicSlug', 'subjectFilterId', 'subjectName', 'materiaName',
        'disciplinaName', 'acronym', 'sigla', 'catalogId', 'title', 'shortTitle',
        'nome', 'number', 'numero', 'year', 'ano', 'description', 'descricao', 'date',
        'publishedAt', 'published_at', 'summary', 'preamble', 'ementa', 'status',
        'officialUrl', 'urlPlanalto', 'sourceName', 'lastSyncedAt', 'lastUpdatedAt',
        'ultimaSincronizacao', 'ultimaAtualizacao', 'isRecentlyUpdated',
        'atualizacaoPendente', 'articleCount', 'totalArtigos', 'commentedArticleCount',
        'artigosComentados', 'jurisprudenceCount', 'examTipCount', 'accessCount',
        'outlineOnly',
    ];

    /** @var list<string> */
    private const TAXONOMY_FIELDS = [
        'id', 'slug', 'name', 'nome', 'title', 'label', 'materia', 'meta_materia',
        'taxonomyLevel', 'taxonomy_level', 'parentId', 'parent_id',
    ];

    /** @var list<string> */
    private const AREA_FIELDS = [
        'id', 'catalogId', 'slug', 'name', 'nome', 'colorClass', 'cor', 'iconName',
        'icone', 'totalLaws', 'totalLeis', 'description', 'order', 'iconTone',
    ];

    /** @var list<string> */
    private const SECTION_FIELDS = [
        'id', 'lawId', 'slug', 'title', 'displayTitle', 'titleLabel', 'titleName',
        'chapterLabel', 'chapterName', 'subtopicFilterId', 'assuntoFilterId',
        'fromArticle', 'toArticle', 'articleCount', 'sortOrder',
    ];

    /** @var list<string> */
    private const ARTICLE_FIELDS = [
        'id', 'lawId', 'sectionId', 'slug', 'number', 'numero', 'title', 'titulo',
        'text', 'texto', 'officialAnchor', 'isRecentlyChanged', 'relatedQuestionCount',
        'questoesRelacionadas', 'assuntoFilterId',
    ];

    /** @var list<string> */
    private const ARTICLE_BLOCK_FIELDS = [
        'id', 'blockUid', 'kind', 'label', 'text', 'parentBlockId', 'anchor',
        'isRecentlyChanged', 'sortOrder',
    ];

    /** @var array<string, string> */
    private const ARTICLE_EDITORIAL_FEATURES = [
        'comentarios' => 'lei.comentario_basico',
        'doctrine' => 'lei.doutrina',
        'doutrina' => 'lei.doutrina',
        'macete' => 'lei.macete',
        'examTip' => 'lei.macete',
        'jurisprudenceNotes' => 'lei.jurisprudencia',
        'jurisprudencia' => 'lei.jurisprudencia',
        'syllabi' => 'lei.sumulas',
        'sumulas' => 'lei.sumulas',
    ];

    /** @param array<string, mixed> $detail
     *  @return array<string, mixed>
     */
    public function project(array $detail, bool $isAuthenticated): array
    {
        $features = $this->projectFeatures($detail['features'] ?? []);
        $result = $this->pick($detail, self::LAW_SCALAR_FIELDS);

        $result['aliases'] = $this->stringList($detail['aliases'] ?? []);
        $result['subject'] = $this->projectTaxonomy($detail['subject'] ?? null);
        $result['materia'] = $this->projectTaxonomy($detail['materia'] ?? null);
        $result['disciplina'] = $this->projectTaxonomy($detail['disciplina'] ?? null);

        foreach (['subjects', 'materias', 'disciplinas', 'disciplines', 'assuntos'] as $field) {
            $result[$field] = $this->projectTaxonomyList($detail[$field] ?? []);
        }

        if (is_array($detail['area'] ?? null)) {
            $result['area'] = $this->pick($detail['area'], self::AREA_FIELDS);
        }

        $result['sections'] = array_values(array_map(
            fn(array $section): array => $this->projectSection($section, $isAuthenticated),
            $this->arrayList($detail['sections'] ?? [])
        ));
        $result['articles'] = array_values(array_map(
            fn(array $article): array => $this->projectArticle($article, $features, $isAuthenticated),
            $this->arrayList($detail['articles'] ?? [])
        ));
        $result['sectionEditorials'] = array_values(array_map(
            fn(array $editorial): array => $this->projectSectionEditorial($editorial, $features, $isAuthenticated),
            $this->arrayList($detail['sectionEditorials'] ?? [])
        ));
        $result['userComments'] = $this->projectUserComments($detail['userComments'] ?? [], $isAuthenticated);
        $result['userCommentsPageInfo'] = $this->projectPageInfo($detail['userCommentsPageInfo'] ?? null);
        $result['updates'] = array_values(array_map(
            fn(array $update): array => $this->pick($update, [
                'id', 'lawId', 'articleId', 'changedAt', 'changeType', 'title', 'summary', 'sourceUrl',
            ]),
            $this->arrayList($detail['updates'] ?? [])
        ));
        $result['features'] = $features;
        $result['hasLockedFeatures'] = (bool) ($detail['hasLockedFeatures'] ?? $this->hasRestrictedFeature($features));
        $result['planAccess'] = $this->projectPlanAccess($detail['planAccess'] ?? null);
        $result['editorialAvailability'] = $this->editorialAvailability($detail, $features);

        if ($isAuthenticated) {
            if (array_key_exists('isFavorite', $detail)) {
                $result['isFavorite'] = (bool) $detail['isFavorite'];
            }
            if (array_key_exists('progressPercent', $detail)) {
                $result['progressPercent'] = (int) $detail['progressPercent'];
            }
            if (is_array($detail['progress'] ?? null)) {
                $result['progress'] = $this->pick($detail['progress'], [
                    'id', 'lawId', 'viewedArticleIds', 'lastArticleId', 'lastViewedAt', 'progressPercent',
                ]);
            }
        }

        return $result;
    }

    /** @param array<string, mixed> $section
     *  @return array<string, mixed>
     */
    private function projectSection(array $section, bool $isAuthenticated): array
    {
        $result = $this->pick($section, self::SECTION_FIELDS);
        if ($isAuthenticated && array_key_exists('isFavorite', $section)) {
            $result['isFavorite'] = (bool) $section['isFavorite'];
        }
        return $result;
    }

    /** @param array<string, mixed> $article
     *  @param array<string, array<string, mixed>> $features
     *  @return array<string, mixed>
     */
    private function projectArticle(array $article, array $features, bool $isAuthenticated): array
    {
        $result = $this->pick($article, self::ARTICLE_FIELDS);
        $result['paragraphs'] = $this->projectParagraphs($article['paragraphs'] ?? $article['paragrafos'] ?? []);
        $result['paragrafos'] = $result['paragraphs'];
        $result['blocks'] = array_values(array_map(
            fn(array $block): array => $this->pick($block, self::ARTICLE_BLOCK_FIELDS),
            $this->arrayList($article['blocks'] ?? [])
        ));

        if ($isAuthenticated) {
            if (array_key_exists('isFavorite', $article)) {
                $result['isFavorite'] = (bool) $article['isFavorite'];
            }
            if (array_key_exists('readAt', $article)) {
                $result['readAt'] = $article['readAt'];
            }
        }

        foreach (self::ARTICLE_EDITORIAL_FEATURES as $field => $featureKey) {
            if (!$this->isFeatureFull($features, $featureKey)) {
                continue;
            }

            $value = $article[$field] ?? null;
            $result[$field] = match ($field) {
                'comentarios' => $this->projectTeacherComments($value, $isAuthenticated),
                'jurisprudencia' => $this->projectJurisprudenceList($value, $isAuthenticated),
                'syllabi', 'sumulas' => $this->projectSyllabi($value, $isAuthenticated),
                'doctrine', 'doutrina', 'jurisprudenceNotes' => $this->projectTargetedTexts($value),
                'macete', 'examTip' => is_scalar($value) || $value === null ? $value : null,
                default => null,
            };
        }

        $result['studyModules'] = $this->projectStudyModules($article['studyModules'] ?? [], $features);

        return $result;
    }

    /** @param array<string, mixed> $editorial
     *  @param array<string, array<string, mixed>> $features
     *  @return array<string, mixed>
     */
    private function projectSectionEditorial(array $editorial, array $features, bool $isAuthenticated): array
    {
        $access = $this->featureMode($features, 'lei.raiox');
        $result = $this->pick($editorial, [
            'id', 'lawId', 'sectionId', 'sectionTitle', 'rangeLabel', 'fromArticle', 'toArticle', 'articleCount',
        ]);
        $result['hasContent'] = $this->sectionEditorialHasContent($editorial);
        $result['access'] = $access;

        if ($access !== 'full') {
            return $result;
        }

        $result += $this->pick($editorial, ['importance', 'style', 'summary', 'examFocusText']);
        $result['blocks'] = $this->projectRichBlocks($editorial['blocks'] ?? []);
        $result['examFocus'] = $this->stringList($editorial['examFocus'] ?? []);
        $result['keywords'] = $this->stringList($editorial['keywords'] ?? []);
        $result['highlights'] = array_values(array_map(
            fn(array $highlight): array => $this->pick($highlight, ['articleId', 'articleNumber', 'title', 'excerpt']),
            $this->arrayList($editorial['highlights'] ?? [])
        ));

        if ($this->isFeatureFull($features, 'lei.macete')) {
            $result['macetes'] = $this->stringList($editorial['macetes'] ?? []);
        }
        if ($this->isFeatureFull($features, 'lei.doutrina')) {
            $result['doctrine'] = $this->stringList($editorial['doctrine'] ?? $editorial['doutrina'] ?? []);
            $result['doutrina'] = $result['doctrine'];
        }
        if ($this->isFeatureFull($features, 'lei.jurisprudencia')) {
            $result['jurisprudence'] = $this->projectJurisprudenceList(
                $editorial['jurisprudence'] ?? $editorial['jurisprudencia'] ?? [],
                $isAuthenticated
            );
            $result['jurisprudencia'] = $result['jurisprudence'];
        }
        if ($this->isFeatureFull($features, 'lei.sumulas')) {
            $result['sumulas'] = $this->projectSyllabi($editorial['sumulas'] ?? [], $isAuthenticated);
        }

        return $this->withReaction($result, $editorial, $isAuthenticated);
    }

    /** @param mixed $modules
     *  @param array<string, array<string, mixed>> $features
     *  @return array<string, array<string, mixed>>
     */
    private function projectStudyModules(mixed $modules, array $features): array
    {
        if (!is_array($modules)) {
            return [];
        }

        $result = [];
        foreach ($modules as $key => $module) {
            if (!is_string($key) || !is_array($module)) {
                continue;
            }
            $featureKey = trim((string) ($module['feature']['feature_key'] ?? ''));
            $mode = $featureKey !== '' ? $this->featureMode($features, $featureKey) : 'locked';
            if ($mode === 'hidden') {
                continue;
            }

            $projected = $this->pick($module, ['title', 'badge']);
            $projected['mode'] = $mode;
            if ($featureKey !== '' && isset($features[$featureKey])) {
                $projected['feature'] = $features[$featureKey];
            }

            if ($mode === 'preview') {
                if (isset($module['preview']) && is_scalar($module['preview'])) {
                    $projected['preview'] = (string) $module['preview'];
                }
            } elseif ($mode === 'full') {
                $projected += $this->pick($module, [
                    'body', 'front', 'back', 'preview', 'percent', 'level', 'importance',
                    'theme', 'questionCount', 'count', 'ctaLabel', 'ctaHref',
                ]);
                $projected['items'] = $this->publicScalarList($module['items'] ?? []);
                $projected['connections'] = $this->publicScalarList($module['connections'] ?? []);
            }

            $result[$key] = $projected;
        }

        return $result;
    }

    /** @param mixed $comments
     *  @return list<array<string, mixed>>
     */
    private function projectTeacherComments(mixed $comments, bool $isAuthenticated): array
    {
        return array_values(array_map(function (array $comment) use ($isAuthenticated): array {
            $result = $this->pick($comment, [
                'id', 'articleId', 'title', 'body', 'texto', 'importance', 'style',
                'authorName', 'autor', 'authorRole', 'cargo', 'reviewedAt',
            ]);
            $result['richBlocks'] = $this->projectRichBlocks($comment['richBlocks'] ?? $comment['blocks'] ?? []);
            $result['blocks'] = $result['richBlocks'];
            $result['keywords'] = $this->stringList($comment['keywords'] ?? []);
            $result['examFocus'] = $this->stringList($comment['examFocus'] ?? []);
            $result['pitfalls'] = $this->stringList($comment['pitfalls'] ?? []);
            $result['relatedRefs'] = $this->stringList($comment['relatedRefs'] ?? []);
            return $this->withReaction($result, $comment, $isAuthenticated);
        }, $this->arrayList($comments)));
    }

    /** @param mixed $items
     *  @return list<array<string, mixed>>
     */
    private function projectJurisprudenceList(mixed $items, bool $isAuthenticated): array
    {
        return array_values(array_map(function (array $item) use ($isAuthenticated): array {
            $result = $this->pick($item, [
                'id', 'articleId', 'court', 'tribunal', 'precedentType', 'title', 'summary',
                'texto', 'examImpact', 'isConsolidated', 'priority', 'sourceUrl',
            ]);
            $result['target'] = $this->projectTarget($item['target'] ?? null);
            return $this->withReaction($result, $item, $isAuthenticated);
        }, $this->arrayList($items)));
    }

    /** @param mixed $items
     *  @return list<array<string, mixed>>
     */
    private function projectSyllabi(mixed $items, bool $isAuthenticated): array
    {
        return array_values(array_map(function (array $item) use ($isAuthenticated): array {
            $result = $this->pick($item, [
                'id', 'articleId', 'court', 'tribunal', 'number', 'numero', 'text', 'texto',
                'sourceUrl', 'priority', 'isBinding', 'vinculante',
            ]);
            $result['target'] = $this->projectTarget($item['target'] ?? null);
            return $this->withReaction($result, $item, $isAuthenticated);
        }, $this->arrayList($items)));
    }

    /** @param mixed $items
     *  @return list<array<string, mixed>>
     */
    private function projectTargetedTexts(mixed $items): array
    {
        $result = [];
        foreach (is_array($items) ? $items : [] as $item) {
            if (is_string($item)) {
                $result[] = ['body' => $item];
                continue;
            }
            if (!is_array($item)) {
                continue;
            }
            $projected = $this->pick($item, ['id', 'title', 'body', 'text', 'author']);
            $projected['target'] = $this->projectTarget($item['target'] ?? null);
            $result[] = $projected;
        }
        return $result;
    }

    /** @param mixed $blocks
     *  @return list<array<string, mixed>>
     */
    private function projectRichBlocks(mixed $blocks): array
    {
        return array_values(array_map(function (array $block): array {
            $result = $this->pick($block, ['type', 'title', 'content']);
            $result['items'] = $this->stringList($block['items'] ?? []);
            $result['headers'] = $this->stringList($block['headers'] ?? []);
            $result['rows'] = array_values(array_map(
                fn($row): array => $this->stringList($row),
                is_array($block['rows'] ?? null) ? $block['rows'] : []
            ));
            $result['target'] = $this->projectTarget($block['target'] ?? null);
            return $result;
        }, $this->arrayList($blocks)));
    }

    /** @param mixed $comments
     *  @return list<array<string, mixed>>
     */
    private function projectUserComments(mixed $comments, bool $isAuthenticated): array
    {
        $result = [];
        foreach ($this->arrayList($comments) as $comment) {
            $status = (string) ($comment['status'] ?? 'visible');
            $moderation = (string) ($comment['moderationStatus'] ?? 'approved');
            if (!$isAuthenticated && ($status !== 'visible' || $moderation !== 'approved')) {
                continue;
            }

            $projected = $this->pick($comment, [
                'id', 'articleId', 'parentCommentId', 'parent_comment_id', 'userName',
                'userAvatar', 'avatarUrl', 'photoUrl', 'userPhotoUrl', 'userPlan',
                'userRole', 'body', 'status', 'createdAt', 'updatedAt', 'likes', 'dislikes',
            ]);
            if ($isAuthenticated) {
                $projected += $this->pick($comment, [
                    'userId', 'moderationStatus', 'userHasPendingReport', 'userReaction',
                ]);
            }
            $result[] = $projected;
        }
        return $result;
    }

    /** @param mixed $features
     *  @return array<string, array<string, mixed>>
     */
    private function projectFeatures(mixed $features): array
    {
        if (!is_array($features)) {
            return [];
        }
        $result = [];
        foreach ($features as $featureKey => $state) {
            if (!is_string($featureKey) || !is_array($state)) {
                continue;
            }
            $projected = $this->pick($state, [
                'feature_key', 'requires_plan', 'enabled', 'mode', 'fallback_mode',
                'limit_key', 'limit_value',
            ]);
            $projected['feature_key'] = $featureKey;
            $projected['mode'] = $this->normalizeAccessMode($state['mode'] ?? 'locked');
            $projected['fallback_mode'] = $this->normalizeAccessMode($state['fallback_mode'] ?? 'locked');
            $result[$featureKey] = $projected;
        }
        return $result;
    }

    /** @param array<string, mixed> $detail
     *  @param array<string, array<string, mixed>> $features
     *  @return array<string, array{available:bool,access:string}>
     */
    private function editorialAvailability(array $detail, array $features): array
    {
        return [
            'commentary' => [
                'available' => $this->hasNestedItems($detail, 'comentarios') || !empty($detail['teacherComments']),
                'access' => $this->featureMode($features, 'lei.comentario_basico'),
            ],
            'doctrine' => [
                'available' => $this->hasNestedItems($detail, 'doctrine') || $this->hasNestedItems($detail, 'doutrina'),
                'access' => $this->featureMode($features, 'lei.doutrina'),
            ],
            'tips' => [
                'available' => $this->hasNestedValue($detail, ['macete', 'examTip']) || !empty($detail['examTips']),
                'access' => $this->featureMode($features, 'lei.macete'),
            ],
            'jurisprudence' => [
                'available' => $this->hasNestedItems($detail, 'jurisprudencia')
                    || $this->hasNestedItems($detail, 'jurisprudenceNotes')
                    || !empty($detail['jurisprudence']),
                'access' => $this->featureMode($features, 'lei.jurisprudencia'),
            ],
            'syllabi' => [
                'available' => $this->hasNestedItems($detail, 'sumulas') || !empty($detail['sumulas']),
                'access' => $this->featureMode($features, 'lei.sumulas'),
            ],
            'sectionEditorials' => [
                'available' => !empty($detail['sectionEditorials']),
                'access' => $this->featureMode($features, 'lei.raiox'),
            ],
        ];
    }

    /** @param array<string, mixed> $detail */
    private function hasNestedItems(array $detail, string $field): bool
    {
        foreach ($this->arrayList($detail['articles'] ?? []) as $article) {
            if (!empty($article[$field])) {
                return true;
            }
        }
        return false;
    }

    /** @param array<string, mixed> $detail
     *  @param list<string> $fields
     */
    private function hasNestedValue(array $detail, array $fields): bool
    {
        foreach ($this->arrayList($detail['articles'] ?? []) as $article) {
            foreach ($fields as $field) {
                if (trim((string) ($article[$field] ?? '')) !== '') {
                    return true;
                }
            }
        }
        return false;
    }

    /** @param array<string, mixed> $editorial */
    private function sectionEditorialHasContent(array $editorial): bool
    {
        foreach (['summary', 'blocks', 'examFocus', 'macetes', 'doctrine', 'doutrina', 'jurisprudence', 'jurisprudencia', 'sumulas', 'highlights'] as $field) {
            if (!empty($editorial[$field])) {
                return true;
            }
        }
        return false;
    }

    /** @param mixed $paragraphs
     *  @return list<array<string, mixed>>
     */
    private function projectParagraphs(mixed $paragraphs): array
    {
        return array_values(array_map(
            fn(array $paragraph): array => $this->pick($paragraph, ['number', 'text']),
            $this->arrayList($paragraphs)
        ));
    }

    /** @param mixed $value
     *  @return array<string, mixed>|string|null
     */
    private function projectTaxonomy(mixed $value): array|string|null
    {
        if (is_string($value)) {
            return $value;
        }
        return is_array($value) ? $this->pick($value, self::TAXONOMY_FIELDS) : null;
    }

    /** @param mixed $items
     *  @return list<array<string, mixed>|string>
     */
    private function projectTaxonomyList(mixed $items): array
    {
        $result = [];
        foreach (is_array($items) ? $items : [] as $item) {
            $projected = $this->projectTaxonomy($item);
            if ($projected !== null) {
                $result[] = $projected;
            }
        }
        return $result;
    }

    /** @param mixed $value
     *  @return array<string, mixed>|null
     */
    private function projectPageInfo(mixed $value): ?array
    {
        return is_array($value) ? $this->pick($value, ['limit', 'hasMore']) : null;
    }

    /** @param mixed $value
     *  @return array<string, mixed>|null
     */
    private function projectPlanAccess(mixed $value): ?array
    {
        return is_array($value) ? $this->pick($value, ['planName', 'status']) : null;
    }

    /** @param mixed $value
     *  @return array<string, mixed>|null
     */
    private function projectTarget(mixed $value): ?array
    {
        return is_array($value) ? $this->pick($value, ['kind', 'label', 'blockId']) : null;
    }

    /** @param array<string, mixed> $result
     *  @param array<string, mixed> $source
     *  @return array<string, mixed>
     */
    private function withReaction(array $result, array $source, bool $isAuthenticated): array
    {
        $result += $this->pick($source, ['reactionKey', 'likes', 'dislikes']);
        if ($isAuthenticated && array_key_exists('userReaction', $source)) {
            $result['userReaction'] = $source['userReaction'];
        }
        return $result;
    }

    /** @param array<string, array<string, mixed>> $features */
    private function isFeatureFull(array $features, string $featureKey): bool
    {
        return $this->featureMode($features, $featureKey) === 'full';
    }

    /** @param array<string, array<string, mixed>> $features */
    private function featureMode(array $features, string $featureKey): string
    {
        return $this->normalizeAccessMode($features[$featureKey]['mode'] ?? 'locked');
    }

    private function normalizeAccessMode(mixed $mode): string
    {
        $normalized = strtolower(trim((string) $mode));
        return in_array($normalized, ['full', 'preview', 'locked', 'hidden'], true)
            ? $normalized
            : 'locked';
    }

    /** @param array<string, array<string, mixed>> $features */
    private function hasRestrictedFeature(array $features): bool
    {
        foreach ($features as $featureKey => $state) {
            if ($featureKey !== 'lei.texto' && ($state['mode'] ?? 'locked') !== 'full') {
                return true;
            }
        }
        return false;
    }

    /** @param array<string, mixed> $source
     *  @param list<string> $fields
     *  @return array<string, mixed>
     */
    private function pick(array $source, array $fields): array
    {
        $result = [];
        foreach ($fields as $field) {
            if (array_key_exists($field, $source)) {
                $result[$field] = $source[$field];
            }
        }
        return $result;
    }

    /** @param mixed $value
     *  @return list<array<string, mixed>>
     */
    private function arrayList(mixed $value): array
    {
        return array_values(array_filter(
            is_array($value) ? $value : [],
            static fn($item): bool => is_array($item)
        ));
    }

    /** @param mixed $value
     *  @return list<string>
     */
    private function stringList(mixed $value): array
    {
        if (!is_array($value)) {
            return [];
        }
        return array_values(array_map('strval', array_filter(
            $value,
            static fn($item): bool => is_scalar($item) && trim((string) $item) !== ''
        )));
    }

    /** @param mixed $value
     *  @return list<string|int|float|bool>
     */
    private function publicScalarList(mixed $value): array
    {
        if (!is_array($value)) {
            return [];
        }
        return array_values(array_filter($value, static fn($item): bool => is_scalar($item)));
    }
}

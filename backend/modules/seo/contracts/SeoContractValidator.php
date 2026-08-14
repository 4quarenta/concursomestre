<?php

declare(strict_types=1);

require_once __DIR__ . '/SeoContractEnums.php';
require_once __DIR__ . '/SeoContractReasonCodes.php';

final class SeoContractValidator
{
    /** @param mixed $value
     *  @return list<string>
     */
    public static function validateSeoDecision(mixed $value): array
    {
        if (!is_array($value)) {
            return ['SeoDecision must be an object.'];
        }

        $errors = self::validateExactKeys(
            $value,
            ['policyVersion', 'resource', 'existence', 'quality', 'indexability', 'resolution', 'canonical', 'robots', 'sitemap'],
            ['policyVersion', 'resource', 'existence', 'quality', 'indexability', 'resolution', 'robots', 'sitemap']
        );
        if (($value['policyVersion'] ?? null) !== SeoContractEnums::SEO_POLICY_VERSION) {
            $errors[] = 'SeoDecision policyVersion is invalid.';
        }

        $resource = $value['resource'] ?? null;
        if (!is_array($resource)
            || self::validateExactKeys($resource, ['type', 'id'], ['type', 'id']) !== []
            || !in_array($resource['type'] ?? null, SeoContractEnums::RESOURCE_TYPES, true)
            || !is_string($resource['id'] ?? null)
            || $resource['id'] === '') {
            $errors[] = 'SeoDecision resource is invalid.';
        }

        $existence = $value['existence'] ?? null;
        if (!in_array($existence, SeoContractEnums::EXISTENCE_STATES, true)) {
            $errors[] = 'SeoDecision existence is invalid.';
        }

        $quality = $value['quality'] ?? null;
        if (!is_array($quality)
            || self::validateExactKeys($quality, ['status', 'reasonCodes'], ['status', 'reasonCodes']) !== []
            || !in_array($quality['status'] ?? null, SeoContractEnums::QUALITY_STATUSES, true)) {
            $errors[] = 'SeoDecision quality is invalid.';
        } else {
            $errors = array_merge($errors, SeoContractReasonCodes::validate('quality', $quality['reasonCodes'] ?? null));
        }

        $indexability = $value['indexability'] ?? null;
        if (!is_array($indexability)
            || self::validateExactKeys($indexability, ['status', 'reasonCodes'], ['status', 'reasonCodes']) !== []
            || !in_array($indexability['status'] ?? null, SeoContractEnums::INDEXABILITY_STATUSES, true)) {
            $errors[] = 'SeoDecision indexability is invalid.';
        } else {
            $errors = array_merge($errors, SeoContractReasonCodes::validate('indexability', $indexability['reasonCodes'] ?? null));
        }

        $resolution = $value['resolution'] ?? null;
        if (!is_array($resolution)
            || self::validateExactKeys($resolution, ['action', 'httpStatus', 'target'], ['action', 'httpStatus', 'target']) !== []
            || !in_array($resolution['action'] ?? null, SeoContractEnums::RESOLUTION_ACTIONS, true)
            || !is_int($resolution['httpStatus'] ?? null)
            || !in_array($resolution['httpStatus'], [200, 301, 308, 404, 410], true)
            || !(is_string($resolution['target'] ?? null) || ($resolution['target'] ?? null) === null)) {
            $errors[] = 'SeoDecision resolution is invalid.';
        }

        if (array_key_exists('canonical', $value) && !self::isCanonical($value['canonical'])) {
            $errors[] = 'SeoDecision canonical is invalid.';
        }
        if (!self::isBooleanObject($value['robots'] ?? null, ['index', 'follow', 'archive', 'imageIndex'])) {
            $errors[] = 'SeoDecision robots is invalid.';
        }

        $sitemap = $value['sitemap'] ?? null;
        if (!is_array($sitemap)
            || self::validateExactKeys($sitemap, ['eligible', 'section', 'lastModified'], ['eligible', 'section', 'lastModified']) !== []
            || !is_bool($sitemap['eligible'] ?? null)
            || !self::isNullableString($sitemap['section'] ?? null)
            || !self::isNullableString($sitemap['lastModified'] ?? null)) {
            $errors[] = 'SeoDecision sitemap is invalid.';
        }

        if ($errors !== []) {
            return array_values(array_unique($errors));
        }

        return self::validateSeoDecisionInvariants($value);
    }

    /** @param mixed $value
     *  @return list<string>
     */
    public static function validatePublicationDecision(mixed $value): array
    {
        if (!is_array($value)) {
            return ['PublicationDecision must be an object.'];
        }

        $errors = self::validateExactKeys(
            $value,
            ['policyVersion', 'status', 'visibility', 'access', 'reasonCodes'],
            ['policyVersion', 'status', 'visibility', 'access', 'reasonCodes']
        );
        if (($value['policyVersion'] ?? null) !== SeoContractEnums::PUBLICATION_POLICY_VERSION) {
            $errors[] = 'PublicationDecision policyVersion is invalid.';
        }
        if (!in_array($value['status'] ?? null, SeoContractEnums::PUBLICATION_STATUSES, true)) {
            $errors[] = 'PublicationDecision status is invalid.';
        }
        if (!in_array($value['visibility'] ?? null, SeoContractEnums::VISIBILITY_STATES, true)) {
            $errors[] = 'PublicationDecision visibility is invalid.';
        }
        if (!in_array($value['access'] ?? null, SeoContractEnums::ACCESS_STATES, true)) {
            $errors[] = 'PublicationDecision access is invalid.';
        }
        $errors = array_merge($errors, SeoContractReasonCodes::validate('publication', $value['reasonCodes'] ?? null));
        if (($value['status'] ?? null) === 'blocked' && ($value['access'] ?? null) !== 'denied') {
            $errors[] = 'Blocked publication requires denied access.';
        }

        return array_values(array_unique($errors));
    }

    /** @param mixed $value
     *  @return list<string>
     */
    public static function validateSeoFacts(mixed $value): array
    {
        if (!is_array($value)) {
            return ['SeoFacts must be an object.'];
        }

        $errors = [];
        if (($value['factsVersion'] ?? null) !== SeoContractEnums::SEO_FACTS_VERSION) {
            $errors[] = 'SeoFacts factsVersion is invalid.';
        }
        $resourceType = $value['resourceType'] ?? null;
        if (!in_array($resourceType, SeoContractEnums::FACT_RESOURCE_TYPES, true)) {
            $errors[] = 'SeoFacts resourceType is invalid.';
        }
        if (($value['locale'] ?? null) !== 'pt-BR') {
            $errors[] = 'SeoFacts locale is invalid.';
        }

        $topLevelKeys = [
            'question' => ['factsVersion', 'resourceType', 'locale', 'identity', 'content', 'classification', 'dates', 'primaryImage', 'breadcrumbs'],
            'exam' => ['factsVersion', 'resourceType', 'locale', 'identity', 'content', 'classification', 'dates', 'primaryImage', 'breadcrumbs'],
            'taxonomy' => ['factsVersion', 'resourceType', 'locale', 'identity', 'taxonomyKind', 'content', 'hierarchy', 'metrics', 'dates', 'primaryImage', 'breadcrumbs'],
            'board' => ['factsVersion', 'resourceType', 'locale', 'identity', 'content', 'board', 'metrics', 'dates', 'primaryImage', 'breadcrumbs'],
            'law' => ['factsVersion', 'resourceType', 'locale', 'identity', 'content', 'law', 'dates', 'primaryImage', 'breadcrumbs'],
            'contest' => ['factsVersion', 'resourceType', 'locale', 'identity', 'content', 'contest', 'dates', 'primaryImage', 'breadcrumbs'],
            'article' => ['factsVersion', 'resourceType', 'locale', 'identity', 'content', 'article', 'dates', 'primaryImage', 'breadcrumbs'],
        ];
        if (is_string($resourceType)
            && isset($topLevelKeys[$resourceType])
            && self::validateExactKeys($value, $topLevelKeys[$resourceType], $topLevelKeys[$resourceType]) !== []) {
            $errors[] = 'SeoFacts ' . $resourceType . ' properties are invalid.';
        }

        $forbiddenKeys = [
            'answer', 'resposta', 'correctAlternativeId', 'correctAlternativeTempIds',
            'teacherComment', 'detailedComment', 'editorial', 'questionEditorials',
            'title', 'description', 'openGraph', 'twitter', 'jsonLd', 'robots',
            'canonical', 'indexability', 'sitemap',
        ];
        if (self::hasForbiddenKeyDeep($value, $forbiddenKeys)) {
            $errors[] = 'SeoFacts contains presentation, decision or protected-content fields.';
        }

        $identity = $value['identity'] ?? null;
        if (!is_array($identity)
            || self::validateExactKeys($identity, ['displayName', 'shortName'], ['displayName', 'shortName']) !== []
            || !self::isBoundedString($identity['displayName'] ?? null, 300, 1)
            || !self::isNullableBoundedString($identity['shortName'] ?? null, 160)) {
            $errors[] = 'SeoFacts identity is invalid.';
        }

        $dates = $value['dates'] ?? null;
        if (!is_array($dates)
            || self::validateExactKeys($dates, ['publishedAt', 'updatedAt'], ['publishedAt', 'updatedAt']) !== []
            || !self::isNullableDateTime($dates['publishedAt'] ?? null)
            || !self::isNullableDateTime($dates['updatedAt'] ?? null)) {
            $errors[] = 'SeoFacts dates are invalid.';
        }
        if (!array_key_exists('primaryImage', $value) || !self::isPrimaryImage($value['primaryImage'] ?? null)) {
            $errors[] = 'SeoFacts primaryImage is invalid.';
        }
        if (!self::isBreadcrumbs($value['breadcrumbs'] ?? null)) {
            $errors[] = 'SeoFacts breadcrumbs are invalid.';
        }

        $contentSpecs = [
            'question' => ['questionExcerpt' => [0, 600], 'supportExcerpt' => [0, 600], 'publicDescription' => [0, 1200]],
            'exam' => ['summaryExcerpt' => [0, 600], 'publicDescription' => [0, 1200]],
            'taxonomy' => ['publicDescription' => [0, 1200], 'editorialIntroduction' => [0, 4000]],
            'board' => ['publicDescription' => [0, 1200], 'editorialIntroduction' => [0, 4000]],
            'law' => ['publicDescription' => [0, 1200], 'commentaryExcerpt' => [0, 1200]],
            'contest' => ['publicDescription' => [0, 1200], 'summaryExcerpt' => [0, 1200]],
            'article' => ['headline' => [1, 300], 'excerpt' => [0, 1200], 'publicDescription' => [0, 1200]],
        ];
        if (is_string($resourceType)
            && isset($contentSpecs[$resourceType])
            && !self::isStringObject($value['content'] ?? null, $contentSpecs[$resourceType])) {
            $errors[] = ucfirst($resourceType) . ' SeoFacts content is invalid.';
        }

        if ($resourceType === 'question') {
            $classification = $value['classification'] ?? null;
            if (!is_array($classification)
                || self::validateExactKeys($classification, ['subjectName', 'topicName', 'boardName', 'organizationName', 'roleName', 'year'], ['subjectName', 'topicName', 'boardName', 'organizationName', 'roleName', 'year']) !== []
                || !self::nullableStringFields($classification, ['subjectName', 'topicName', 'boardName', 'organizationName', 'roleName'], 190)
                || !self::isNullableYear($classification['year'] ?? null)) {
                $errors[] = 'Question SeoFacts classification is invalid.';
            }
        } elseif ($resourceType === 'exam') {
            $classification = $value['classification'] ?? null;
            if (!is_array($classification)
                || self::validateExactKeys($classification, ['boardName', 'organizationNames', 'roleNames', 'year', 'levelName'], ['boardName', 'organizationNames', 'roleNames', 'year', 'levelName']) !== []
                || !self::isNullableBoundedString($classification['boardName'] ?? null, 190)
                || !self::isUniqueBoundedStringArray($classification['organizationNames'] ?? null, 190)
                || !self::isUniqueBoundedStringArray($classification['roleNames'] ?? null, 190)
                || !self::isNullableYear($classification['year'] ?? null)
                || !self::isNullableBoundedString($classification['levelName'] ?? null, 100)) {
                $errors[] = 'Exam SeoFacts classification is invalid.';
            }
        } elseif ($resourceType === 'taxonomy') {
            if (!in_array($value['taxonomyKind'] ?? null, ['discipline', 'topic', 'subject', 'category', 'tag', 'organization', 'role', 'year'], true)) {
                $errors[] = 'Taxonomy SeoFacts taxonomyKind is invalid.';
            }
            $hierarchy = $value['hierarchy'] ?? null;
            if (!is_array($hierarchy)
                || self::validateExactKeys($hierarchy, ['parentName', 'rootName'], ['parentName', 'rootName']) !== []
                || !self::nullableStringFields($hierarchy, ['parentName', 'rootName'], 190)) {
                $errors[] = 'Taxonomy SeoFacts hierarchy is invalid.';
            }
            if (!self::isMetrics($value['metrics'] ?? null, ['publicItemCount'])) {
                $errors[] = 'Taxonomy SeoFacts metrics are invalid.';
            }
        } elseif ($resourceType === 'board') {
            $board = $value['board'] ?? null;
            if (!is_array($board)
                || self::validateExactKeys($board, ['acronym', 'fullName', 'website'], ['acronym', 'fullName', 'website']) !== []
                || !self::isNullableBoundedString($board['acronym'] ?? null, 40)
                || !self::isNullableBoundedString($board['fullName'] ?? null, 300)
                || !self::isNullableBoundedString($board['website'] ?? null, 2048)
                || (is_string($board['website'] ?? null) && filter_var($board['website'], FILTER_VALIDATE_URL) === false)) {
                $errors[] = 'Board SeoFacts board is invalid.';
            }
            if (!self::isMetrics($value['metrics'] ?? null, ['publicQuestionCount', 'publicExamCount'])) {
                $errors[] = 'Board SeoFacts metrics are invalid.';
            }
        } elseif ($resourceType === 'law') {
            $law = $value['law'] ?? null;
            if (!is_array($law)
                || self::validateExactKeys($law, ['identifier', 'jurisdiction', 'articleCount'], ['identifier', 'jurisdiction', 'articleCount']) !== []
                || !self::isNullableBoundedString($law['identifier'] ?? null, 190)
                || !self::isNullableBoundedString($law['jurisdiction'] ?? null, 190)
                || !self::isNonNegativeInteger($law['articleCount'] ?? null)) {
                $errors[] = 'Law SeoFacts law is invalid.';
            }
        } elseif ($resourceType === 'contest') {
            $contest = $value['contest'] ?? null;
            if (!is_array($contest)
                || self::validateExactKeys($contest, ['organizationNames', 'roleNames', 'locationNames', 'year', 'statusLabel'], ['organizationNames', 'roleNames', 'locationNames', 'year', 'statusLabel']) !== []
                || !self::isUniqueBoundedStringArray($contest['organizationNames'] ?? null, 190)
                || !self::isUniqueBoundedStringArray($contest['roleNames'] ?? null, 190)
                || !self::isUniqueBoundedStringArray($contest['locationNames'] ?? null, 190)
                || !self::isNullableYear($contest['year'] ?? null)
                || !self::isNullableBoundedString($contest['statusLabel'] ?? null, 100)) {
                $errors[] = 'Contest SeoFacts contest is invalid.';
            }
        } elseif ($resourceType === 'article') {
            $article = $value['article'] ?? null;
            if (!is_array($article)
                || self::validateExactKeys($article, ['authorName', 'categoryNames', 'tagNames'], ['authorName', 'categoryNames', 'tagNames']) !== []
                || !self::isNullableBoundedString($article['authorName'] ?? null, 190)
                || !self::isUniqueBoundedStringArray($article['categoryNames'] ?? null, 190)
                || !self::isUniqueBoundedStringArray($article['tagNames'] ?? null, 190)) {
                $errors[] = 'Article SeoFacts article is invalid.';
            }
        }

        return array_values(array_unique($errors));
    }

    /** @param mixed $value
     *  @param array<string, array{0:int, 1:int}> $fields
     */
    private static function isStringObject(mixed $value, array $fields): bool
    {
        if (!is_array($value) || self::validateExactKeys($value, array_keys($fields), array_keys($fields)) !== []) {
            return false;
        }
        foreach ($fields as $field => [$minimum, $maximum]) {
            if (!self::isBoundedString($value[$field], $maximum, $minimum)) {
                return false;
            }
        }

        return true;
    }

    /** @param array<string, mixed> $value
     *  @param list<string> $fields
     */
    private static function nullableStringFields(array $value, array $fields, int $maximum): bool
    {
        foreach ($fields as $field) {
            if (!self::isNullableBoundedString($value[$field] ?? null, $maximum)) {
                return false;
            }
        }

        return true;
    }

    /** @param mixed $value
     *  @param list<string> $fields
     */
    private static function isMetrics(mixed $value, array $fields): bool
    {
        if (!is_array($value) || self::validateExactKeys($value, $fields, $fields) !== []) {
            return false;
        }
        foreach ($fields as $field) {
            if (!self::isNonNegativeInteger($value[$field] ?? null)) {
                return false;
            }
        }

        return true;
    }

    /** @param mixed $value */
    private static function isPrimaryImage(mixed $value): bool
    {
        return $value === null || (
            is_array($value)
            && self::validateExactKeys($value, ['url', 'alt', 'width', 'height'], ['url', 'alt', 'width', 'height']) === []
            && self::isBoundedString($value['url'] ?? null, 2048, 1)
            && (str_starts_with($value['url'], '/') || str_starts_with($value['url'], 'https://'))
            && self::isBoundedString($value['alt'] ?? null, 300)
            && (($value['width'] ?? null) === null || (is_int($value['width']) && $value['width'] > 0))
            && (($value['height'] ?? null) === null || (is_int($value['height']) && $value['height'] > 0))
        );
    }

    /** @param mixed $value */
    private static function isBreadcrumbs(mixed $value): bool
    {
        if (!is_array($value) || count($value) > 12) {
            return false;
        }
        foreach ($value as $breadcrumb) {
            if (!is_array($breadcrumb)
                || self::validateExactKeys($breadcrumb, ['label', 'canonicalPath'], ['label', 'canonicalPath']) !== []
                || !self::isBoundedString($breadcrumb['label'] ?? null, 160, 1)
                || !self::isBoundedString($breadcrumb['canonicalPath'] ?? null, 2048, 1)
                || preg_match('~^/[^?#]*$~', $breadcrumb['canonicalPath']) !== 1) {
                return false;
            }
        }

        return true;
    }

    /** @param mixed $value */
    private static function isNullableDateTime(mixed $value): bool
    {
        if ($value === null) {
            return true;
        }
        if (!is_string($value) || $value === '') {
            return false;
        }
        try {
            new DateTimeImmutable($value);
            return true;
        } catch (Throwable) {
            return false;
        }
    }

    /** @param mixed $value */
    private static function isNullableYear(mixed $value): bool
    {
        return $value === null || (is_int($value) && $value >= 1900 && $value <= 2200);
    }

    /** @param mixed $value */
    private static function isNonNegativeInteger(mixed $value): bool
    {
        return is_int($value) && $value >= 0;
    }

    /** @param mixed $value */
    private static function isBoundedString(mixed $value, int $maximum, int $minimum = 0): bool
    {
        return is_string($value) && strlen($value) >= $minimum && strlen($value) <= $maximum;
    }

    /** @param mixed $value */
    private static function isNullableBoundedString(mixed $value, int $maximum): bool
    {
        return $value === null || self::isBoundedString($value, $maximum);
    }

    /** @param mixed $value */
    private static function isUniqueBoundedStringArray(mixed $value, int $maximum): bool
    {
        if (!is_array($value)) {
            return false;
        }
        $seen = [];
        foreach ($value as $item) {
            if (!self::isBoundedString($item, $maximum, 1) || isset($seen[$item])) {
                return false;
            }
            $seen[$item] = true;
        }

        return true;
    }

    /** @param array<string, mixed> $value
     *  @return list<string>
     */
    private static function validateSeoDecisionInvariants(array $value): array
    {
        $errors = [];
        $existence = $value['existence'];
        $quality = $value['quality']['status'];
        $indexability = $value['indexability']['status'];
        $resolution = $value['resolution'];
        $action = $resolution['action'];
        $hasCanonical = array_key_exists('canonical', $value);

        if ($indexability === 'INDEX' && $quality !== 'PASS') {
            $errors[] = 'INDEX requires quality PASS.';
        }
        if (in_array($quality, ['FAIL', 'NOT_EVALUATED'], true) && $indexability !== 'NOINDEX') {
            $errors[] = $quality . ' requires NOINDEX.';
        }
        if ($value['robots']['index'] !== ($indexability === 'INDEX')) {
            $errors[] = 'robots.index must match indexability status.';
        }
        if ($indexability === 'INDEX' && (!$hasCanonical || $action !== 'render' || $resolution['httpStatus'] !== 200)) {
            $errors[] = 'INDEX requires canonical render with HTTP 200.';
        }
        if ($value['sitemap']['eligible'] === true
            && ($indexability !== 'INDEX' || $action !== 'render' || $resolution['httpStatus'] !== 200 || !$hasCanonical)) {
            $errors[] = 'Eligible sitemap entry requires INDEX, canonical render and HTTP 200.';
        }
        if (in_array($existence, ['missing', 'removed'], true) && $quality !== 'NOT_EVALUATED') {
            $errors[] = $existence . ' requires quality NOT_EVALUATED.';
        }
        if (in_array($existence, ['missing', 'removed'], true) && $indexability !== 'NOINDEX') {
            $errors[] = $existence . ' requires NOINDEX.';
        }
        if ($existence === 'missing' && ($action !== 'not_found' || $resolution['httpStatus'] !== 404)) {
            $errors[] = 'missing requires not_found with HTTP 404.';
        }
        if ($existence === 'removed' && !in_array($action, ['redirect', 'gone'], true)) {
            $errors[] = 'removed requires redirect or gone.';
        }
        if ($action === 'render' && ($resolution['httpStatus'] !== 200 || $resolution['target'] !== null)) {
            $errors[] = 'render requires HTTP 200 and null target.';
        }
        if ($action === 'redirect'
            && ($hasCanonical || !in_array($resolution['httpStatus'], [301, 308], true) || !is_string($resolution['target']) || $resolution['target'] === '')) {
            $errors[] = 'redirect requires no canonical, a target and permanent redirect status.';
        }
        if ($action === 'not_found' && ($hasCanonical || $resolution['httpStatus'] !== 404 || $resolution['target'] !== null)) {
            $errors[] = 'not_found requires no canonical, HTTP 404 and null target.';
        }
        if ($action === 'gone' && ($hasCanonical || $resolution['httpStatus'] !== 410 || $resolution['target'] !== null)) {
            $errors[] = 'gone requires no canonical, HTTP 410 and null target.';
        }
        if (in_array($action, ['redirect', 'not_found', 'gone'], true) && $value['sitemap']['eligible'] !== false) {
            $errors[] = $action . ' cannot be sitemap eligible.';
        }

        return $errors;
    }

    /** @param array<string, mixed> $value
     *  @param list<string> $allowed
     *  @param list<string> $required
     *  @return list<string>
     */
    private static function validateExactKeys(array $value, array $allowed, array $required): array
    {
        $unknown = array_diff(array_keys($value), $allowed);
        $missing = array_diff($required, array_keys($value));

        return ($unknown === [] && $missing === []) ? [] : ['Object keys are invalid.'];
    }

    /** @param mixed $value */
    private static function isCanonical(mixed $value): bool
    {
        return is_array($value)
            && self::validateExactKeys($value, ['path', 'url', 'slug'], ['path', 'url', 'slug']) === []
            && is_string($value['path'])
            && preg_match('~^/[^?#]*$~', $value['path']) === 1
            && is_string($value['url'])
            && str_starts_with($value['url'], 'https://')
            && is_string($value['slug'])
            && preg_match('/^[a-z0-9]+(?:-[a-z0-9]+)*$/', $value['slug']) === 1
            && strlen($value['slug']) <= 80;
    }

    /** @param mixed $value
     *  @param list<string> $keys
     */
    private static function isBooleanObject(mixed $value, array $keys): bool
    {
        if (!is_array($value) || self::validateExactKeys($value, $keys, $keys) !== []) {
            return false;
        }
        foreach ($keys as $key) {
            if (!is_bool($value[$key])) {
                return false;
            }
        }

        return true;
    }

    /** @param mixed $value */
    private static function isNullableString(mixed $value): bool
    {
        return $value === null || is_string($value);
    }

    /** @param array<mixed> $value
     *  @param list<string> $forbiddenKeys
     */
    private static function hasForbiddenKeyDeep(array $value, array $forbiddenKeys): bool
    {
        foreach ($value as $key => $item) {
            if (is_string($key) && in_array($key, $forbiddenKeys, true)) {
                return true;
            }
            if (is_array($item) && self::hasForbiddenKeyDeep($item, $forbiddenKeys)) {
                return true;
            }
        }

        return false;
    }

    private function __construct()
    {
    }
}

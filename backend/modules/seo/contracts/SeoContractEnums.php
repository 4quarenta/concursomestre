<?php

declare(strict_types=1);

final class SeoContractEnums
{
    public const SEO_POLICY_VERSION = 'seo-policy.v1';
    public const SEO_FACTS_VERSION = 'seo-facts.v1';
    public const PUBLICATION_POLICY_VERSION = 'publication-policy.v1';

    public const RESOURCE_TYPES = ['question', 'exam', 'taxonomy', 'board', 'law', 'contest', 'article', 'page'];
    public const FACT_RESOURCE_TYPES = ['question', 'exam', 'taxonomy', 'board', 'law', 'contest', 'article'];
    public const EXISTENCE_STATES = ['exists', 'missing', 'removed'];
    public const QUALITY_STATUSES = ['PASS', 'FAIL', 'NOT_EVALUATED'];
    public const INDEXABILITY_STATUSES = ['INDEX', 'NOINDEX'];
    public const RESOLUTION_ACTIONS = ['render', 'redirect', 'not_found', 'gone'];
    public const PUBLICATION_STATUSES = ['published', 'unpublished', 'scheduled', 'blocked'];
    public const VISIBILITY_STATES = ['public', 'authenticated', 'restricted'];
    public const ACCESS_STATES = ['allowed', 'denied'];

    private function __construct()
    {
    }
}

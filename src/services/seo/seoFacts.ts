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

import {
  hasForbiddenKeyDeep,
  hasOnlyKeys,
  hasUniqueValues,
  invalidResult,
  isRecord,
  isStringArray,
  type ContractValidationResult,
  validResult,
} from './contractValidation';

export const SEO_FACTS_VERSION = 'seo-facts.v1' as const;
export const SEO_FACTS_RESOURCE_TYPES = ['question', 'exam', 'taxonomy', 'board', 'law', 'contest', 'article'] as const;
export type SeoFactsResourceType = (typeof SEO_FACTS_RESOURCE_TYPES)[number];

export interface SeoFactsIdentity {
  displayName: string;
  shortName: string | null;
}

export interface SeoFactsDates {
  publishedAt: string | null;
  updatedAt: string | null;
}

export interface SeoFactsPrimaryImage {
  url: string;
  alt: string;
  width: number | null;
  height: number | null;
}

export interface SeoFactsBreadcrumb {
  label: string;
  canonicalPath: string;
}

interface SeoFactsBase<TType extends SeoFactsResourceType> {
  factsVersion: typeof SEO_FACTS_VERSION;
  resourceType: TType;
  locale: 'pt-BR';
  identity: SeoFactsIdentity;
  dates: SeoFactsDates;
  primaryImage: SeoFactsPrimaryImage | null;
  breadcrumbs: SeoFactsBreadcrumb[];
}

export interface QuestionSeoFactsV1 extends SeoFactsBase<'question'> {
  content: {
    questionExcerpt: string;
    supportExcerpt: string;
    publicDescription: string;
  };
  classification: {
    subjectName: string | null;
    topicName: string | null;
    boardName: string | null;
    organizationName: string | null;
    roleName: string | null;
    year: number | null;
  };
}

export interface ExamSeoFactsV1 extends SeoFactsBase<'exam'> {
  content: { summaryExcerpt: string; publicDescription: string };
  classification: {
    boardName: string | null;
    organizationNames: string[];
    roleNames: string[];
    year: number | null;
    levelName: string | null;
  };
}

export interface TaxonomySeoFactsV1 extends SeoFactsBase<'taxonomy'> {
  taxonomyKind: 'discipline' | 'topic' | 'subject' | 'category' | 'tag' | 'organization' | 'role' | 'year';
  content: { publicDescription: string; editorialIntroduction: string };
  hierarchy: { parentName: string | null; rootName: string | null };
  metrics: { publicItemCount: number };
}

export interface BoardSeoFactsV1 extends SeoFactsBase<'board'> {
  content: { publicDescription: string; editorialIntroduction: string };
  board: { acronym: string | null; fullName: string | null; website: string | null };
  metrics: { publicQuestionCount: number; publicExamCount: number };
}

export interface LawSeoFactsV1 extends SeoFactsBase<'law'> {
  content: { publicDescription: string; commentaryExcerpt: string };
  law: { identifier: string | null; jurisdiction: string | null; articleCount: number };
}

export interface ContestSeoFactsV1 extends SeoFactsBase<'contest'> {
  content: { publicDescription: string; summaryExcerpt: string };
  contest: {
    organizationNames: string[];
    roleNames: string[];
    locationNames: string[];
    year: number | null;
    statusLabel: string | null;
  };
}

export interface ArticleSeoFactsV1 extends SeoFactsBase<'article'> {
  content: { headline: string; excerpt: string; publicDescription: string };
  article: { authorName: string | null; categoryNames: string[]; tagNames: string[] };
}

export type SeoFactsV1 =
  | QuestionSeoFactsV1
  | ExamSeoFactsV1
  | TaxonomySeoFactsV1
  | BoardSeoFactsV1
  | LawSeoFactsV1
  | ContestSeoFactsV1
  | ArticleSeoFactsV1;

const FORBIDDEN_PUBLIC_FACT_KEYS = new Set([
  'answer',
  'resposta',
  'correctAlternativeId',
  'correctAlternativeTempIds',
  'teacherComment',
  'detailedComment',
  'editorial',
  'questionEditorials',
  'title',
  'description',
  'openGraph',
  'twitter',
  'jsonLd',
  'robots',
  'canonical',
  'indexability',
  'sitemap',
]);

const TOP_LEVEL_KEYS: Record<SeoFactsResourceType, readonly string[]> = {
  question: ['factsVersion', 'resourceType', 'locale', 'identity', 'content', 'classification', 'dates', 'primaryImage', 'breadcrumbs'],
  exam: ['factsVersion', 'resourceType', 'locale', 'identity', 'content', 'classification', 'dates', 'primaryImage', 'breadcrumbs'],
  taxonomy: ['factsVersion', 'resourceType', 'locale', 'identity', 'taxonomyKind', 'content', 'hierarchy', 'metrics', 'dates', 'primaryImage', 'breadcrumbs'],
  board: ['factsVersion', 'resourceType', 'locale', 'identity', 'content', 'board', 'metrics', 'dates', 'primaryImage', 'breadcrumbs'],
  law: ['factsVersion', 'resourceType', 'locale', 'identity', 'content', 'law', 'dates', 'primaryImage', 'breadcrumbs'],
  contest: ['factsVersion', 'resourceType', 'locale', 'identity', 'content', 'contest', 'dates', 'primaryImage', 'breadcrumbs'],
  article: ['factsVersion', 'resourceType', 'locale', 'identity', 'content', 'article', 'dates', 'primaryImage', 'breadcrumbs'],
};

const isResourceType = (value: unknown): value is SeoFactsResourceType => (
  typeof value === 'string' && SEO_FACTS_RESOURCE_TYPES.includes(value as SeoFactsResourceType)
);

const hasExactKeys = (value: Record<string, unknown>, keys: readonly string[]): boolean => (
  hasOnlyKeys(value, keys) && keys.every((key) => Object.hasOwn(value, key))
);

const isBoundedString = (value: unknown, maximum: number, minimum = 0): value is string => (
  typeof value === 'string' && value.length >= minimum && value.length <= maximum
);

const isNullableBoundedString = (value: unknown, maximum: number): value is string | null => (
  value === null || isBoundedString(value, maximum)
);

const isNullableDateTime = (value: unknown): value is string | null => (
  value === null || (typeof value === 'string' && value.length > 0 && !Number.isNaN(Date.parse(value)))
);

const isNullableYear = (value: unknown): value is number | null => (
  value === null || (Number.isInteger(value) && Number(value) >= 1900 && Number(value) <= 2200)
);

const isNonNegativeInteger = (value: unknown): value is number => (
  Number.isInteger(value) && Number(value) >= 0
);

const isUniqueBoundedStringArray = (value: unknown, maximum = 190): value is string[] => (
  isStringArray(value)
  && value.every((item) => isBoundedString(item, maximum, 1))
  && hasUniqueValues(value)
);

const isStringObject = (
  value: unknown,
  keys: readonly string[],
  maximumByKey: Record<string, number>,
  nonEmptyKeys: ReadonlySet<string> = new Set(),
): value is Record<string, string> => (
  isRecord(value)
  && hasExactKeys(value, keys)
  && keys.every((key) => isBoundedString(value[key], maximumByKey[key], nonEmptyKeys.has(key) ? 1 : 0))
);

const validateCommonFacts = (value: Record<string, unknown>): string[] => {
  const errors: string[] = [];
  if (value.factsVersion !== SEO_FACTS_VERSION) errors.push('SeoFacts factsVersion is invalid.');
  if (value.locale !== 'pt-BR') errors.push('SeoFacts locale is invalid.');
  if (!isResourceType(value.resourceType)) errors.push('SeoFacts resourceType is invalid.');

  if (!isRecord(value.identity)
    || !hasExactKeys(value.identity, ['displayName', 'shortName'])
    || !isBoundedString(value.identity.displayName, 300, 1)
    || !isNullableBoundedString(value.identity.shortName, 160)) {
    errors.push('SeoFacts identity is invalid.');
  }

  if (!isRecord(value.dates)
    || !hasExactKeys(value.dates, ['publishedAt', 'updatedAt'])
    || !isNullableDateTime(value.dates.publishedAt)
    || !isNullableDateTime(value.dates.updatedAt)) {
    errors.push('SeoFacts dates are invalid.');
  }

  if (value.primaryImage !== null) {
    if (!isRecord(value.primaryImage)
      || !hasExactKeys(value.primaryImage, ['url', 'alt', 'width', 'height'])
      || !isBoundedString(value.primaryImage.url, 2048, 1)
      || !/^(?:https:\/\/|\/)/.test(value.primaryImage.url)
      || !isBoundedString(value.primaryImage.alt, 300)
      || !(value.primaryImage.width === null || (Number.isInteger(value.primaryImage.width) && Number(value.primaryImage.width) > 0))
      || !(value.primaryImage.height === null || (Number.isInteger(value.primaryImage.height) && Number(value.primaryImage.height) > 0))) {
      errors.push('SeoFacts primaryImage is invalid.');
    }
  }

  if (!Array.isArray(value.breadcrumbs) || value.breadcrumbs.length > 12 || value.breadcrumbs.some((item) => (
    !isRecord(item)
    || !hasExactKeys(item, ['label', 'canonicalPath'])
    || !isBoundedString(item.label, 160, 1)
    || !isBoundedString(item.canonicalPath, 2048, 1)
    || !/^\/[^?#]*$/.test(item.canonicalPath)
  ))) {
    errors.push('SeoFacts breadcrumbs are invalid.');
  }

  if (hasForbiddenKeyDeep(value, FORBIDDEN_PUBLIC_FACT_KEYS)) {
    errors.push('SeoFacts contains presentation, decision or protected-content fields.');
  }

  return errors;
};

const validateVariant = (value: Record<string, unknown>, resourceType: SeoFactsResourceType): string[] => {
  const errors: string[] = [];
  if (!hasOnlyKeys(value, TOP_LEVEL_KEYS[resourceType])) errors.push(`SeoFacts ${resourceType} contains unknown properties.`);
  if (!TOP_LEVEL_KEYS[resourceType].every((key) => Object.hasOwn(value, key))) errors.push(`SeoFacts ${resourceType} is missing required properties.`);

  if (!isRecord(value.content)) errors.push(`SeoFacts ${resourceType} content is invalid.`);

  if (resourceType === 'question') {
    const classification = value.classification;
    if (!isStringObject(value.content, ['questionExcerpt', 'supportExcerpt', 'publicDescription'], {
      questionExcerpt: 600,
      supportExcerpt: 600,
      publicDescription: 1200,
    })) {
      errors.push('Question SeoFacts content is invalid.');
    }
    if (!isRecord(classification)
      || !hasExactKeys(classification, ['subjectName', 'topicName', 'boardName', 'organizationName', 'roleName', 'year'])
      || !['subjectName', 'topicName', 'boardName', 'organizationName', 'roleName'].every((key) => isNullableBoundedString(classification[key], 190))
      || !isNullableYear(classification.year)) {
      errors.push('Question SeoFacts classification is invalid.');
    }
  }

  if (resourceType === 'exam') {
    if (!isStringObject(value.content, ['summaryExcerpt', 'publicDescription'], {
      summaryExcerpt: 600,
      publicDescription: 1200,
    })) errors.push('Exam SeoFacts content is invalid.');
    if (!isRecord(value.classification)
      || !hasExactKeys(value.classification, ['boardName', 'organizationNames', 'roleNames', 'year', 'levelName'])
      || !isNullableBoundedString(value.classification.boardName, 190)
      || !isUniqueBoundedStringArray(value.classification.organizationNames)
      || !isUniqueBoundedStringArray(value.classification.roleNames)
      || !isNullableYear(value.classification.year)
      || !isNullableBoundedString(value.classification.levelName, 100)) {
      errors.push('Exam SeoFacts classification is invalid.');
    }
  }
  if (resourceType === 'taxonomy') {
    if (!['discipline', 'topic', 'subject', 'category', 'tag', 'organization', 'role', 'year'].includes(String(value.taxonomyKind))) {
      errors.push('Taxonomy SeoFacts taxonomyKind is invalid.');
    }
    if (!isStringObject(value.content, ['publicDescription', 'editorialIntroduction'], {
      publicDescription: 1200,
      editorialIntroduction: 4000,
    })) errors.push('Taxonomy SeoFacts content is invalid.');
    if (!isRecord(value.hierarchy)
      || !hasExactKeys(value.hierarchy, ['parentName', 'rootName'])
      || !isNullableBoundedString(value.hierarchy.parentName, 190)
      || !isNullableBoundedString(value.hierarchy.rootName, 190)) errors.push('Taxonomy SeoFacts hierarchy is invalid.');
    if (!isRecord(value.metrics)
      || !hasExactKeys(value.metrics, ['publicItemCount'])
      || !isNonNegativeInteger(value.metrics.publicItemCount)) errors.push('Taxonomy SeoFacts metrics are invalid.');
  }
  if (resourceType === 'board') {
    if (!isStringObject(value.content, ['publicDescription', 'editorialIntroduction'], {
      publicDescription: 1200,
      editorialIntroduction: 4000,
    })) errors.push('Board SeoFacts content is invalid.');
    if (!isRecord(value.board)
      || !hasExactKeys(value.board, ['acronym', 'fullName', 'website'])
      || !isNullableBoundedString(value.board.acronym, 40)
      || !isNullableBoundedString(value.board.fullName, 300)
      || !isNullableBoundedString(value.board.website, 2048)
      || (typeof value.board.website === 'string' && !/^https?:\/\//.test(value.board.website))) errors.push('Board SeoFacts board is invalid.');
    if (!isRecord(value.metrics)
      || !hasExactKeys(value.metrics, ['publicQuestionCount', 'publicExamCount'])
      || !isNonNegativeInteger(value.metrics.publicQuestionCount)
      || !isNonNegativeInteger(value.metrics.publicExamCount)) errors.push('Board SeoFacts metrics are invalid.');
  }
  if (resourceType === 'law') {
    if (!isStringObject(value.content, ['publicDescription', 'commentaryExcerpt'], {
      publicDescription: 1200,
      commentaryExcerpt: 1200,
    })) errors.push('Law SeoFacts content is invalid.');
    if (!isRecord(value.law)
      || !hasExactKeys(value.law, ['identifier', 'jurisdiction', 'articleCount'])
      || !isNullableBoundedString(value.law.identifier, 190)
      || !isNullableBoundedString(value.law.jurisdiction, 190)
      || !isNonNegativeInteger(value.law.articleCount)) errors.push('Law SeoFacts law is invalid.');
  }
  if (resourceType === 'contest') {
    if (!isStringObject(value.content, ['publicDescription', 'summaryExcerpt'], {
      publicDescription: 1200,
      summaryExcerpt: 1200,
    })) errors.push('Contest SeoFacts content is invalid.');
    if (!isRecord(value.contest)
      || !hasExactKeys(value.contest, ['organizationNames', 'roleNames', 'locationNames', 'year', 'statusLabel'])
      || !isUniqueBoundedStringArray(value.contest.organizationNames)
      || !isUniqueBoundedStringArray(value.contest.roleNames)
      || !isUniqueBoundedStringArray(value.contest.locationNames)
      || !isNullableYear(value.contest.year)
      || !isNullableBoundedString(value.contest.statusLabel, 100)) {
      errors.push('Contest SeoFacts contest is invalid.');
    }
  }
  if (resourceType === 'article') {
    if (!isStringObject(value.content, ['headline', 'excerpt', 'publicDescription'], {
      headline: 300,
      excerpt: 1200,
      publicDescription: 1200,
    }, new Set(['headline']))) errors.push('Article SeoFacts content is invalid.');
    if (!isRecord(value.article)
      || !hasExactKeys(value.article, ['authorName', 'categoryNames', 'tagNames'])
      || !isNullableBoundedString(value.article.authorName, 190)
      || !isUniqueBoundedStringArray(value.article.categoryNames)
      || !isUniqueBoundedStringArray(value.article.tagNames)) {
      errors.push('Article SeoFacts article is invalid.');
    }
  }

  return errors;
};

export const validateSeoFacts = (value: unknown): ContractValidationResult<SeoFactsV1> => {
  if (!isRecord(value)) return invalidResult(['SeoFacts must be an object.']);

  const commonErrors = validateCommonFacts(value);
  if (!isResourceType(value.resourceType)) return invalidResult(commonErrors);

  const errors = [...commonErrors, ...validateVariant(value, value.resourceType)];
  return errors.length > 0
    ? invalidResult(errors)
    : validResult(value as unknown as SeoFactsV1);
};

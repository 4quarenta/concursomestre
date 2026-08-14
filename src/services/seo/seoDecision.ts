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
  hasOnlyKeys,
  invalidResult,
  isNullableString,
  isRecord,
  type ContractValidationResult,
  validResult,
} from './contractValidation';
import {
  type IndexabilityReasonCode,
  type QualityReasonCode,
  validateReasonCodes,
} from './reasonCodes';

export const SEO_POLICY_VERSION = 'seo-policy.v1' as const;
export const SEO_EXISTENCE_STATES = ['exists', 'missing', 'removed'] as const;
export const SEO_QUALITY_STATUSES = ['PASS', 'FAIL', 'NOT_EVALUATED'] as const;
export const SEO_INDEXABILITY_STATUSES = ['INDEX', 'NOINDEX'] as const;
export const SEO_RESOLUTION_ACTIONS = ['render', 'redirect', 'not_found', 'gone'] as const;
export const SEO_RESOURCE_TYPES = ['question', 'exam', 'taxonomy', 'board', 'law', 'contest', 'article', 'page'] as const;

export type SeoExistence = (typeof SEO_EXISTENCE_STATES)[number];
export type SeoQualityStatus = (typeof SEO_QUALITY_STATUSES)[number];
export type SeoIndexabilityStatus = (typeof SEO_INDEXABILITY_STATUSES)[number];
export type SeoResolutionAction = (typeof SEO_RESOLUTION_ACTIONS)[number];
export type SeoResourceType = (typeof SEO_RESOURCE_TYPES)[number];

export interface SeoDecisionV1 {
  policyVersion: typeof SEO_POLICY_VERSION;
  resource: {
    type: SeoResourceType;
    id: string;
  };
  existence: SeoExistence;
  quality: {
    status: SeoQualityStatus;
    reasonCodes: QualityReasonCode[];
  };
  indexability: {
    status: SeoIndexabilityStatus;
    reasonCodes: IndexabilityReasonCode[];
  };
  resolution: {
    action: SeoResolutionAction;
    httpStatus: 200 | 301 | 308 | 404 | 410;
    target: string | null;
  };
  canonical?: {
    path: string;
    url: string;
    slug: string;
  };
  robots: {
    index: boolean;
    follow: boolean;
    archive: boolean;
    imageIndex: boolean;
  };
  sitemap: {
    eligible: boolean;
    section: string | null;
    lastModified: string | null;
  };
}

const isOneOf = <T extends readonly string[]>(value: unknown, values: T): value is T[number] => (
  typeof value === 'string' && values.includes(value as T[number])
);

const validateShape = (value: unknown): string[] => {
  const errors: string[] = [];
  if (!isRecord(value)) return ['SeoDecision must be an object.'];

  if (!hasOnlyKeys(value, ['policyVersion', 'resource', 'existence', 'quality', 'indexability', 'resolution', 'canonical', 'robots', 'sitemap'])) {
    errors.push('SeoDecision contains unknown properties.');
  }
  if (value.policyVersion !== SEO_POLICY_VERSION) errors.push('SeoDecision policyVersion is invalid.');

  if (!isRecord(value.resource)
    || !hasOnlyKeys(value.resource, ['type', 'id'])
    || !isOneOf(value.resource.type, SEO_RESOURCE_TYPES)
    || typeof value.resource.id !== 'string'
    || value.resource.id.length === 0) {
    errors.push('SeoDecision resource is invalid.');
  }
  if (!isOneOf(value.existence, SEO_EXISTENCE_STATES)) errors.push('SeoDecision existence is invalid.');

  if (!isRecord(value.quality)
    || !hasOnlyKeys(value.quality, ['status', 'reasonCodes'])
    || !isOneOf(value.quality.status, SEO_QUALITY_STATUSES)) {
    errors.push('SeoDecision quality is invalid.');
  } else {
    errors.push(...validateReasonCodes('quality', value.quality.reasonCodes));
  }

  if (!isRecord(value.indexability)
    || !hasOnlyKeys(value.indexability, ['status', 'reasonCodes'])
    || !isOneOf(value.indexability.status, SEO_INDEXABILITY_STATUSES)) {
    errors.push('SeoDecision indexability is invalid.');
  } else {
    errors.push(...validateReasonCodes('indexability', value.indexability.reasonCodes));
  }

  if (!isRecord(value.resolution)
    || !hasOnlyKeys(value.resolution, ['action', 'httpStatus', 'target'])
    || !isOneOf(value.resolution.action, SEO_RESOLUTION_ACTIONS)
    || typeof value.resolution.httpStatus !== 'number'
    || ![200, 301, 308, 404, 410].includes(value.resolution.httpStatus)
    || !isNullableString(value.resolution.target)) {
    errors.push('SeoDecision resolution is invalid.');
  }

  if (value.canonical !== undefined) {
    const canonical = value.canonical;
    if (!isRecord(canonical)
      || !hasOnlyKeys(canonical, ['path', 'url', 'slug'])
      || typeof canonical.path !== 'string'
      || !/^\/[^?#]*$/.test(canonical.path)
      || typeof canonical.url !== 'string'
      || !/^https:\/\//.test(canonical.url)
      || typeof canonical.slug !== 'string'
      || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(canonical.slug)
      || canonical.slug.length > 80) {
      errors.push('SeoDecision canonical is invalid.');
    }
  }

  if (!isRecord(value.robots)
    || !hasOnlyKeys(value.robots, ['index', 'follow', 'archive', 'imageIndex'])
    || Object.values(value.robots).some((item) => typeof item !== 'boolean')) {
    errors.push('SeoDecision robots is invalid.');
  }

  if (!isRecord(value.sitemap)
    || !hasOnlyKeys(value.sitemap, ['eligible', 'section', 'lastModified'])
    || typeof value.sitemap.eligible !== 'boolean'
    || !isNullableString(value.sitemap.section)
    || !isNullableString(value.sitemap.lastModified)) {
    errors.push('SeoDecision sitemap is invalid.');
  }

  return errors;
};

const validateInvariants = (value: Record<string, unknown>): string[] => {
  const errors: string[] = [];
  const existence = value.existence as SeoExistence;
  const quality = (value.quality as Record<string, unknown>).status as SeoQualityStatus;
  const indexability = (value.indexability as Record<string, unknown>).status as SeoIndexabilityStatus;
  const resolution = value.resolution as Record<string, unknown>;
  const action = resolution.action as SeoResolutionAction;
  const robots = value.robots as Record<string, unknown>;
  const sitemap = value.sitemap as Record<string, unknown>;
  const hasCanonical = value.canonical !== undefined;

  if (indexability === 'INDEX' && quality !== 'PASS') errors.push('INDEX requires quality PASS.');
  if ((quality === 'FAIL' || quality === 'NOT_EVALUATED') && indexability !== 'NOINDEX') {
    errors.push(`${quality} requires NOINDEX.`);
  }
  if (robots.index !== (indexability === 'INDEX')) errors.push('robots.index must match indexability status.');

  if (indexability === 'INDEX' && (!hasCanonical || action !== 'render' || resolution.httpStatus !== 200)) {
    errors.push('INDEX requires canonical render with HTTP 200.');
  }
  if (sitemap.eligible === true && (indexability !== 'INDEX' || action !== 'render' || resolution.httpStatus !== 200 || !hasCanonical)) {
    errors.push('Eligible sitemap entry requires INDEX, canonical render and HTTP 200.');
  }

  if ((existence === 'missing' || existence === 'removed') && quality !== 'NOT_EVALUATED') {
    errors.push(`${existence} requires quality NOT_EVALUATED.`);
  }
  if ((existence === 'missing' || existence === 'removed') && indexability !== 'NOINDEX') {
    errors.push(`${existence} requires NOINDEX.`);
  }
  if (existence === 'missing' && (action !== 'not_found' || resolution.httpStatus !== 404)) {
    errors.push('missing requires not_found with HTTP 404.');
  }
  if (existence === 'removed' && !['redirect', 'gone'].includes(action)) {
    errors.push('removed requires redirect or gone.');
  }

  if (action === 'render' && (resolution.httpStatus !== 200 || resolution.target !== null)) {
    errors.push('render requires HTTP 200 and null target.');
  }
  if (action === 'redirect' && (hasCanonical || ![301, 308].includes(resolution.httpStatus as number) || typeof resolution.target !== 'string' || resolution.target.length === 0)) {
    errors.push('redirect requires no canonical, a target and permanent redirect status.');
  }
  if (action === 'not_found' && (hasCanonical || resolution.httpStatus !== 404 || resolution.target !== null)) {
    errors.push('not_found requires no canonical, HTTP 404 and null target.');
  }
  if (action === 'gone' && (hasCanonical || resolution.httpStatus !== 410 || resolution.target !== null)) {
    errors.push('gone requires no canonical, HTTP 410 and null target.');
  }
  if (['redirect', 'not_found', 'gone'].includes(action) && sitemap.eligible !== false) {
    errors.push(`${action} cannot be sitemap eligible.`);
  }

  return errors;
};

export const validateSeoDecision = (value: unknown): ContractValidationResult<SeoDecisionV1> => {
  const shapeErrors = validateShape(value);
  if (shapeErrors.length > 0 || !isRecord(value)) return invalidResult(shapeErrors);

  const invariantErrors = validateInvariants(value);
  return invariantErrors.length > 0
    ? invalidResult(invariantErrors)
    : validResult(value as unknown as SeoDecisionV1);
};

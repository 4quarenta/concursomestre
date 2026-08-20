/*
* ----------------------------------------------------
* @author: 4quarenta
* @author URI: https://github.com/4quarenta
* @copyright: (c) 2026 ConcursoMestre. All rights reserved
* ----------------------------------------------------
*
* @since 1.0.0
*/

import structuralRoutePolicyJson from '../../../config/seo/structural-route-policy.v1.json';
import {
  validateStructuralRoutePolicy,
  type StructuralRoutePolicyV1,
} from '@services/seo/structuralRoutePolicy';

export type PublicRouteQueryValue = string | number | boolean | null | undefined;
export type PublicRouteQuery = URLSearchParams | Record<
  string,
  PublicRouteQueryValue | readonly PublicRouteQueryValue[]
>;

type RouteFamily = StructuralRoutePolicyV1['families'][number];
export type PublicRouteParameterClassification =
  | StructuralRoutePolicyV1['parameterCatalog'][string]['classification']
  | 'internal'
  | 'unknown';

const policyValidation = validateStructuralRoutePolicy(structuralRoutePolicyJson);
if (!policyValidation.valid || !policyValidation.value) {
  throw new Error(`Structural Route Policy invalida: ${policyValidation.errors.join(' | ')}`);
}

const policy = policyValidation.value;
const families = new Map(policy.families.map((family) => [family.id, family]));

export const classifyPublicRouteParameter = (parameter: string): PublicRouteParameterClassification => {
  if (parameter === '_rsc') return 'internal';
  const exact = policy.parameterCatalog[parameter];
  if (exact) return exact.classification;
  const wildcard = Object.entries(policy.parameterCatalog).find(([key]) => (
    key.endsWith('*') && parameter.startsWith(key.slice(0, -1))
  ));
  return wildcard?.[1].classification || 'unknown';
};

const family = (familyId: string): RouteFamily => {
  const definition = families.get(familyId);
  if (!definition) {
    throw new Error(`Familia estrutural desconhecida: ${familyId}`);
  }
  return definition;
};

const canonicalPattern = (familyId: string): string => {
  const pattern = family(familyId).patterns[0];
  if (!pattern || pattern.includes('?') || pattern.includes('{*')) {
    throw new Error(`Familia ${familyId} nao possui pattern canonico construivel.`);
  }
  return pattern;
};

const buildPath = (familyId: string, parameters: Record<string, string | number>): string => {
  const path = canonicalPattern(familyId).replace(/\{([a-zA-Z][a-zA-Z0-9_]*)\}/g, (_match, key: string) => {
    const value = String(parameters[key] ?? '').trim();
    if (!value) {
      throw new Error(`Parametro ${key} ausente para a familia ${familyId}.`);
    }
    return encodeURIComponent(value);
  });

  if (/\{[^}]+\}/.test(path)) {
    throw new Error(`Nao foi possivel construir a familia ${familyId}.`);
  }
  return path;
};

const supportsParameter = (definition: RouteFamily, parameter: string): boolean => definition.allowedParameters.some(
  (allowed) => allowed === parameter || (allowed.endsWith('*') && parameter.startsWith(allowed.slice(0, -1))),
);

const appendValue = (searchParams: URLSearchParams, key: string, value: PublicRouteQueryValue) => {
  if (value === null || value === undefined || value === '') return;
  searchParams.append(key, String(value));
};

const withQuery = (familyId: string, path: string, query?: PublicRouteQuery): string => {
  if (!query) return path;

  const definition = family(familyId);
  const output = new URLSearchParams();
  const appendChecked = (key: string, value: PublicRouteQueryValue) => {
    if (!supportsParameter(definition, key)) {
      throw new Error(`Parametro ${key} nao permitido para a familia ${familyId}.`);
    }
    appendValue(output, key, value);
  };

  if (query instanceof URLSearchParams) {
    query.forEach((value, key) => appendChecked(key, value));
  } else {
    Object.entries(query).forEach(([key, value]) => {
      if (Array.isArray(value)) {
        value.forEach((item) => appendChecked(key, item));
        return;
      }
      appendChecked(key, value as PublicRouteQueryValue);
    });
  }

  const serialized = output.toString();
  return serialized ? `${path}?${serialized}` : path;
};

export const sanitizePublicRouteQuery = (
  familyId: string,
  query?: PublicRouteQuery,
): URLSearchParams => {
  const output = new URLSearchParams();
  if (!query) return output;

  const definition = family(familyId);
  const appendSanitized = (key: string, value: PublicRouteQueryValue) => {
    if (key === '_rsc' || !supportsParameter(definition, key)) return;
    appendValue(output, key, value);
  };

  if (query instanceof URLSearchParams) {
    query.forEach((value, key) => appendSanitized(key, value));
  } else {
    Object.entries(query).forEach(([key, value]) => {
      if (Array.isArray(value)) {
        value.forEach((item) => appendSanitized(key, item));
        return;
      }
      appendSanitized(key, value as PublicRouteQueryValue);
    });
  }

  return output;
};

const patternToRegex = (pattern: string): RegExp => {
  const escaped = pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const withWildcards = escaped
    .replace(/\\\{\\\*[^}]+\\\}/g, '.*')
    .replace(/\\\{[^}]+\\\}/g, '[^/]+');
  return new RegExp(`^${withWildcards}/?$`);
};

const pathnameOnly = (value: string): string => {
  const raw = String(value || '').trim();
  if (!raw) return '/';
  try {
    return new URL(raw, 'https://concursomestre.com').pathname;
  } catch {
    return raw.split(/[?#]/, 1)[0] || '/';
  }
};

export const matchesPublicRouteFamily = (
  familyId: string,
  path: string,
  options: { includeLegacy?: boolean } = {},
): boolean => {
  const definition = family(familyId);
  const patterns = options.includeLegacy === false
    ? definition.patterns
    : [...definition.patterns, ...(definition.legacyPatterns || [])];
  const pathname = pathnameOnly(path);
  return patterns.some((pattern) => !pattern.includes('?') && patternToRegex(pattern).test(pathname));
};

export const isQuestionsIndexPath = (path: string): boolean => (
  matchesPublicRouteFamily('questions_hub', path)
);

export const isExamPublicPath = (path: string): boolean => (
  matchesPublicRouteFamily('exam_hub', path)
  || matchesPublicRouteFamily('exam_detail', path)
);

export const publicRoutes = {
  questions: {
    index: (query?: PublicRouteQuery) => withQuery('questions_hub', buildPath('questions_hub', {}), query),
    detail: (id: string | number, slug: string, query?: PublicRouteQuery) => withQuery(
      'question_detail',
      buildPath('question_detail', { id, slug }),
      query,
    ),
  },
  exams: {
    index: (query?: PublicRouteQuery) => withQuery('exam_hub', buildPath('exam_hub', {}), query),
    detail: (slug: string, query?: PublicRouteQuery) => withQuery(
      'exam_detail',
      buildPath('exam_detail', { slug }),
      query,
    ),
  },
  disciplines: {
    detail: (slug: string, query?: PublicRouteQuery) => withQuery(
      'discipline_detail',
      buildPath('discipline_detail', { slug }),
      query,
    ),
  },
  topics: {
    detail: (slug: string, query?: PublicRouteQuery) => withQuery(
      'topic_detail',
      buildPath('topic_detail', { slug }),
      query,
    ),
  },
  subjects: {
    detail: (slug: string, query?: PublicRouteQuery) => withQuery(
      'subject_detail',
      buildPath('subject_detail', { slug }),
      query,
    ),
  },
  boards: {
    detail: (slug: string, query?: PublicRouteQuery) => withQuery(
      'board_detail',
      buildPath('board_detail', { slug }),
      query,
    ),
  },
  organizations: {
    index: (query?: PublicRouteQuery) => withQuery(
      'organizations_hub',
      buildPath('organizations_hub', {}),
      query,
    ),
    detail: (slug: string, query?: PublicRouteQuery) => withQuery(
      'organization_detail',
      buildPath('organization_detail', { slug }),
      query,
    ),
  },
  careers: {
    index: (query?: PublicRouteQuery) => withQuery('careers_hub', buildPath('careers_hub', {}), query),
    detail: (slug: string, query?: PublicRouteQuery) => withQuery(
      'career_detail', buildPath('career_detail', { slug }), query,
    ),
  },
  positions: {
    index: (query?: PublicRouteQuery) => withQuery('positions_hub', buildPath('positions_hub', {}), query),
    detail: (slug: string, query?: PublicRouteQuery) => withQuery(
      'position_detail', buildPath('position_detail', { slug }), query,
    ),
  },
  contests: {
    index: (query?: PublicRouteQuery) => withQuery('contest_hub', buildPath('contest_hub', {}), query),
    detail: (slug: string, query?: PublicRouteQuery) => withQuery(
      'contest_detail',
      buildPath('contest_detail', { slug }),
      query,
    ),
    open: (query?: PublicRouteQuery) => withQuery('open_contests', buildPath('open_contests', {}), query),
  },
} as const;

export const structuralPublicRoutePolicy = policy;

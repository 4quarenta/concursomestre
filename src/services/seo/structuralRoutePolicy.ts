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
  invalidResult,
  isRecord,
  isStringArray,
  type ContractValidationResult,
  validResult,
} from './contractValidation';

export const STRUCTURAL_ROUTE_POLICY_VERSION = 'structural-route-policy.v1' as const;
export const ROUTE_AUDIENCES = ['public', 'authenticated', 'admin', 'api'] as const;
export const ROUTE_INDEXABILITY_DEFAULTS = ['INDEX', 'NOINDEX'] as const;
export const ROUTE_PAGINATION_POLICIES = ['none', 'query_page'] as const;
export const ROUTE_PARAMETER_CLASSIFICATIONS = ['pagination', 'search', 'facet', 'sort', 'ui_state', 'tracking'] as const;

export interface StructuralRoutePolicyV1 {
  version: typeof STRUCTURAL_ROUTE_POLICY_VERSION;
  enforcement: boolean;
  parameterCatalog: Record<string, {
    classification: (typeof ROUTE_PARAMETER_CLASSIFICATIONS)[number];
    multiValue: boolean;
  }>;
  families: Array<{
    id: string;
    patterns: string[];
    legacyPatterns?: string[];
    audience: (typeof ROUTE_AUDIENCES)[number];
    supportsLanding: boolean;
    supportsEditorialPromotion: boolean;
    defaultIndexability: (typeof ROUTE_INDEXABILITY_DEFAULTS)[number];
    allowedParameters: string[];
    paginationPolicy: (typeof ROUTE_PAGINATION_POLICIES)[number];
  }>;
}

const FORBIDDEN_EDITORIAL_KEYS = new Set([
  'title',
  'description',
  'entityId',
  'entitySlug',
  'promotedEntities',
  'editorialContent',
  'metadata',
]);

export const validateStructuralRoutePolicy = (
  value: unknown,
): ContractValidationResult<StructuralRoutePolicyV1> => {
  if (!isRecord(value)) return invalidResult(['Structural Route Policy must be an object.']);

  const errors: string[] = [];
  if (value.version !== STRUCTURAL_ROUTE_POLICY_VERSION) errors.push('Structural Route Policy version is invalid.');
  if (typeof value.enforcement !== 'boolean') errors.push('Structural Route Policy enforcement must be boolean.');
  if (!isRecord(value.parameterCatalog)) errors.push('Structural Route Policy parameterCatalog is invalid.');
  if (!Array.isArray(value.families)) errors.push('Structural Route Policy families must be an array.');
  if (hasForbiddenKeyDeep(value, FORBIDDEN_EDITORIAL_KEYS)) errors.push('Structural Route Policy contains editorial or entity-specific content.');

  const parameterNames = new Set<string>();
  if (isRecord(value.parameterCatalog)) {
    Object.entries(value.parameterCatalog).forEach(([name, parameter]) => {
      parameterNames.add(name);
      if (!isRecord(parameter)
        || !ROUTE_PARAMETER_CLASSIFICATIONS.includes(parameter.classification as (typeof ROUTE_PARAMETER_CLASSIFICATIONS)[number])
        || typeof parameter.multiValue !== 'boolean') {
        errors.push(`Structural parameter ${name} is invalid.`);
      }
    });
  }

  const familyIds = new Set<string>();
  if (Array.isArray(value.families)) {
    value.families.forEach((family, index) => {
      if (!isRecord(family)) {
        errors.push(`Structural family ${index} is invalid.`);
        return;
      }
      const familyId = typeof family.id === 'string' ? family.id : '';
      if (!/^[a-z][a-z0-9_]*$/.test(familyId)) errors.push(`Structural family ${index} has invalid id.`);
      if (familyIds.has(familyId)) errors.push(`Structural family id ${familyId} is duplicated.`);
      familyIds.add(familyId);

      if (!isStringArray(family.patterns) || family.patterns.length === 0 || family.patterns.some((pattern) => !pattern.startsWith('/'))) {
        errors.push(`Structural family ${familyId} has invalid patterns.`);
      }
      if (family.legacyPatterns !== undefined
        && (!isStringArray(family.legacyPatterns) || family.legacyPatterns.some((pattern) => !pattern.startsWith('/')))) {
        errors.push(`Structural family ${familyId} has invalid legacyPatterns.`);
      }
      if (!ROUTE_AUDIENCES.includes(family.audience as (typeof ROUTE_AUDIENCES)[number])) errors.push(`Structural family ${familyId} has invalid audience.`);
      if (typeof family.supportsLanding !== 'boolean' || typeof family.supportsEditorialPromotion !== 'boolean') {
        errors.push(`Structural family ${familyId} has invalid landing flags.`);
      }
      if (!ROUTE_INDEXABILITY_DEFAULTS.includes(family.defaultIndexability as (typeof ROUTE_INDEXABILITY_DEFAULTS)[number])) {
        errors.push(`Structural family ${familyId} has invalid defaultIndexability.`);
      }
      if (!ROUTE_PAGINATION_POLICIES.includes(family.paginationPolicy as (typeof ROUTE_PAGINATION_POLICIES)[number])) {
        errors.push(`Structural family ${familyId} has invalid paginationPolicy.`);
      }
      if (!isStringArray(family.allowedParameters)) {
        errors.push(`Structural family ${familyId} has invalid allowedParameters.`);
      } else {
        family.allowedParameters.forEach((parameter) => {
          if (!parameterNames.has(parameter)) errors.push(`Structural family ${familyId} references unknown parameter ${parameter}.`);
        });
      }
    });
  }

  return errors.length > 0
    ? invalidResult(errors)
    : validResult(value as unknown as StructuralRoutePolicyV1);
};

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
  invalidResult,
  isRecord,
  type ContractValidationResult,
  validResult,
} from './contractValidation';
import { validateReasonCodes } from './reasonCodes';

export const QUALITY_GATES_VERSION = 'quality-gates.v1' as const;
export const QUALITY_RESOURCE_TYPES = ['question', 'exam', 'taxonomy', 'board', 'law', 'contest', 'article'] as const;

export interface QualityGateCheckV1 {
  id: string;
  reasonCode: string;
}

export interface QualityGateResourceV1 {
  enabled: boolean;
  hardChecks: QualityGateCheckV1[];
  softChecks: QualityGateCheckV1[];
  thresholds: Record<string, number | null>;
}

export interface QualityGatesConfigV1 {
  version: typeof QUALITY_GATES_VERSION;
  enforcement: boolean;
  resources: Record<(typeof QUALITY_RESOURCE_TYPES)[number], QualityGateResourceV1>;
}

const DISALLOWED_PUBLICATION_TERMS = /(?:rights|direitos|provenance|proveniencia|moderation|moderacao|embargo|legal_restriction|juridical_restriction|restricao_juridica)/i;

export const validateQualityGatesConfig = (
  value: unknown,
): ContractValidationResult<QualityGatesConfigV1> => {
  if (!isRecord(value)) return invalidResult(['Quality Gates configuration must be an object.']);

  const errors: string[] = [];
  if (value.version !== QUALITY_GATES_VERSION) errors.push('Quality Gates version is invalid.');
  if (typeof value.enforcement !== 'boolean') errors.push('Quality Gates enforcement must be boolean.');
  if (!isRecord(value.resources)) errors.push('Quality Gates resources must be an object.');

  if (isRecord(value.resources)) {
    const expectedResources = new Set<string>(QUALITY_RESOURCE_TYPES);
    Object.keys(value.resources).forEach((resourceType) => {
      if (!expectedResources.has(resourceType)) errors.push(`Quality Gates contains unknown resource ${resourceType}.`);
    });
    QUALITY_RESOURCE_TYPES.forEach((resourceType) => {
      const resource = value.resources[resourceType];
      if (!isRecord(resource)) {
        errors.push(`Quality Gates resource ${resourceType} is missing.`);
        return;
      }
      if (typeof resource.enabled !== 'boolean') errors.push(`Quality Gates resource ${resourceType} enabled flag is invalid.`);

      const seenChecks = new Set<string>();
      ['hardChecks', 'softChecks'].forEach((group) => {
        const checks = resource[group];
        if (!Array.isArray(checks)) {
          errors.push(`Quality Gates ${resourceType}.${group} must be an array.`);
          return;
        }
        checks.forEach((check, index) => {
          if (!isRecord(check)
            || typeof check.id !== 'string'
            || !/^[a-z][a-z0-9_]*$/.test(check.id)
            || typeof check.reasonCode !== 'string') {
            errors.push(`Quality Gates ${resourceType}.${group}[${index}] is invalid.`);
            return;
          }
          if (seenChecks.has(check.id)) errors.push(`Quality Gates ${resourceType} duplicates check ${check.id}.`);
          seenChecks.add(check.id);
          if (DISALLOWED_PUBLICATION_TERMS.test(check.id)) {
            errors.push(`Quality Gates check ${check.id} belongs to Publication Policy.`);
          }
          errors.push(...validateReasonCodes('quality', [check.reasonCode]));
        });
      });

      if (!isRecord(resource.thresholds)) {
        errors.push(`Quality Gates ${resourceType}.thresholds must be an object.`);
      } else {
        Object.entries(resource.thresholds).forEach(([threshold, thresholdValue]) => {
          if (!(thresholdValue === null || (typeof thresholdValue === 'number' && Number.isFinite(thresholdValue) && thresholdValue >= 0))) {
            errors.push(`Quality Gates threshold ${resourceType}.${threshold} is invalid.`);
          }
        });
      }
    });
  }

  return errors.length > 0
    ? invalidResult(errors)
    : validResult(value as unknown as QualityGatesConfigV1);
};

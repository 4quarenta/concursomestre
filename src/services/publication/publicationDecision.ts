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
  isRecord,
  type ContractValidationResult,
  validResult,
} from '../seo/contractValidation';
import { type PublicationReasonCode, validateReasonCodes } from '../seo/reasonCodes';

export const PUBLICATION_POLICY_VERSION = 'publication-policy.v1' as const;
export const PUBLICATION_STATUSES = ['published', 'unpublished', 'scheduled', 'blocked'] as const;
export const PUBLICATION_VISIBILITIES = ['public', 'authenticated', 'restricted'] as const;
export const PUBLICATION_ACCESS_STATES = ['allowed', 'denied'] as const;

export type PublicationStatus = (typeof PUBLICATION_STATUSES)[number];
export type PublicationVisibility = (typeof PUBLICATION_VISIBILITIES)[number];
export type PublicationAccess = (typeof PUBLICATION_ACCESS_STATES)[number];

export interface PublicationDecisionV1 {
  policyVersion: typeof PUBLICATION_POLICY_VERSION;
  status: PublicationStatus;
  visibility: PublicationVisibility;
  access: PublicationAccess;
  reasonCodes: PublicationReasonCode[];
}

export const validatePublicationDecision = (
  value: unknown,
): ContractValidationResult<PublicationDecisionV1> => {
  if (!isRecord(value)) return invalidResult(['PublicationDecision must be an object.']);

  const errors: string[] = [];
  if (!hasOnlyKeys(value, ['policyVersion', 'status', 'visibility', 'access', 'reasonCodes'])) {
    errors.push('PublicationDecision contains unknown properties.');
  }
  if (value.policyVersion !== PUBLICATION_POLICY_VERSION) errors.push('PublicationDecision policyVersion is invalid.');
  if (typeof value.status !== 'string' || !PUBLICATION_STATUSES.includes(value.status as PublicationStatus)) {
    errors.push('PublicationDecision status is invalid.');
  }
  if (typeof value.visibility !== 'string' || !PUBLICATION_VISIBILITIES.includes(value.visibility as PublicationVisibility)) {
    errors.push('PublicationDecision visibility is invalid.');
  }
  if (typeof value.access !== 'string' || !PUBLICATION_ACCESS_STATES.includes(value.access as PublicationAccess)) {
    errors.push('PublicationDecision access is invalid.');
  }
  errors.push(...validateReasonCodes('publication', value.reasonCodes));

  if (value.status === 'blocked' && value.access !== 'denied') {
    errors.push('Blocked publication requires denied access.');
  }

  return errors.length > 0
    ? invalidResult(errors)
    : validResult(value as unknown as PublicationDecisionV1);
};

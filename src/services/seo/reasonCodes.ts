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

import reasonCodeCatalog from '../../../contracts/seo/reason-codes.v1.json';

export type ReasonCodeFamily = 'publication' | 'quality' | 'indexability' | 'resolution';
export type PublicationReasonCode = string;
export type QualityReasonCode = string;
export type IndexabilityReasonCode = string;
export type ResolutionReasonCode = string;

const reasonCodeFamilies: Record<ReasonCodeFamily, string[]> = {
  publication: reasonCodeCatalog.definitions.publicationReasonCode.enum,
  quality: reasonCodeCatalog.definitions.qualityReasonCode.enum,
  indexability: reasonCodeCatalog.definitions.indexabilityReasonCode.enum,
  resolution: reasonCodeCatalog.definitions.resolutionReasonCode.enum,
};

const reasonCodeSets = Object.fromEntries(
  Object.entries(reasonCodeFamilies).map(([family, codes]) => [family, new Set(codes)]),
) as Record<ReasonCodeFamily, Set<string>>;

export const REASON_CODE_CATALOG_VERSION = reasonCodeCatalog.version;

export const isKnownReasonCode = (family: ReasonCodeFamily, value: string): boolean => (
  reasonCodeSets[family].has(value)
);

export const validateReasonCodes = (family: ReasonCodeFamily, values: unknown): string[] => {
  if (!Array.isArray(values)) {
    return [`${family}.reasonCodes must be an array.`];
  }

  const errors: string[] = [];
  const seen = new Set<string>();

  values.forEach((value, index) => {
    if (typeof value !== 'string') {
      errors.push(`${family}.reasonCodes[${index}] must be a string.`);
      return;
    }
    if (seen.has(value)) {
      errors.push(`${family}.reasonCodes contains duplicate code ${value}.`);
    }
    seen.add(value);
    if (!isKnownReasonCode(family, value)) {
      errors.push(`${family}.reasonCodes contains unknown code ${value}.`);
    }
  });

  return errors;
};

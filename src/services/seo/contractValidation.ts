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

export type ContractValidationResult<T> =
  | { valid: true; value: T; errors: [] }
  | { valid: false; errors: string[] };

export const isRecord = (value: unknown): value is Record<string, unknown> => (
  typeof value === 'object' && value !== null && !Array.isArray(value)
);

export const hasOnlyKeys = (record: Record<string, unknown>, allowed: readonly string[]): boolean => {
  const allowedKeys = new Set(allowed);
  return Object.keys(record).every((key) => allowedKeys.has(key));
};

export const isStringArray = (value: unknown): value is string[] => (
  Array.isArray(value) && value.every((item) => typeof item === 'string')
);

export const isNullableString = (value: unknown): value is string | null => (
  value === null || typeof value === 'string'
);

export const hasUniqueValues = (values: readonly string[]): boolean => (
  new Set(values).size === values.length
);

export const hasForbiddenKeyDeep = (value: unknown, forbiddenKeys: ReadonlySet<string>): boolean => {
  if (Array.isArray(value)) {
    return value.some((item) => hasForbiddenKeyDeep(item, forbiddenKeys));
  }

  if (!isRecord(value)) {
    return false;
  }

  return Object.entries(value).some(([key, item]) => (
    forbiddenKeys.has(key) || hasForbiddenKeyDeep(item, forbiddenKeys)
  ));
};

export const invalidResult = <T>(errors: string[]): ContractValidationResult<T> => ({
  valid: false,
  errors: Array.from(new Set(errors)),
});

export const validResult = <T>(value: T): ContractValidationResult<T> => ({
  valid: true,
  value,
  errors: [],
});

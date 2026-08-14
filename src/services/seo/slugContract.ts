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

export const SLUG_CONTRACT_VERSION = 'slug-contract.v1' as const;
export const SLUG_CONTRACT_MAX_LENGTH = 80;

export interface SlugFallbackIdentity {
  type: string;
  id: string | number;
}

const HTML_ENTITY_MAP: Record<string, string> = {
  amp: '&',
  apos: "'",
  gt: '>',
  lt: '<',
  nbsp: ' ',
  quot: '"',
};

const decodeHtmlEntities = (value: string): string => value.replace(
  /&(#x[0-9a-f]+|#\d+|amp|apos|gt|lt|nbsp|quot);/gi,
  (entity, token: string) => {
    const normalized = token.toLowerCase();
    if (normalized.startsWith('#x')) {
      return String.fromCodePoint(Number.parseInt(normalized.slice(2), 16));
    }
    if (normalized.startsWith('#')) {
      return String.fromCodePoint(Number.parseInt(normalized.slice(1), 10));
    }
    return HTML_ENTITY_MAP[normalized] ?? entity;
  },
);

const normalizeToAsciiSlug = (value: string): string => decodeHtmlEntities(value)
  .replace(/<\/?[a-z][^>]*>/gi, ' ')
  .replace(/º/g, 'o')
  .replace(/ª/g, 'a')
  .replace(/&/g, ' e ')
  .normalize('NFKD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/ß/g, 'ss')
  .replace(/æ/g, 'ae')
  .replace(/œ/g, 'oe')
  .replace(/ø/g, 'o')
  .replace(/ł/g, 'l')
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '');

const trimAtWordBoundary = (value: string): string => {
  if (value.length <= SLUG_CONTRACT_MAX_LENGTH) return value;

  const candidate = value.slice(0, SLUG_CONTRACT_MAX_LENGTH);
  const nextCharacter = value.charAt(SLUG_CONTRACT_MAX_LENGTH);
  if (nextCharacter && nextCharacter !== '-' && candidate.includes('-')) {
    return candidate.slice(0, candidate.lastIndexOf('-')).replace(/-+$/g, '');
  }
  return candidate.replace(/-+$/g, '');
};

export const buildContractSlugV1 = (value: string, fallback?: SlugFallbackIdentity): string => {
  const normalized = trimAtWordBoundary(normalizeToAsciiSlug(String(value ?? '')));
  if (normalized) return normalized;
  if (!fallback) return '';

  return trimAtWordBoundary(normalizeToAsciiSlug(`${fallback.type}-${fallback.id}`));
};

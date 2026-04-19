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

export type CardDisplayLike = {
  brand?: unknown;
  last_four_digits?: unknown;
  last4?: unknown;
};

const toAscii = (value: unknown): string => String(value ?? '').replace(/[^\x20-\x7E]/g, '');

export const formatCardBrandAscii = (brand: unknown): string => {
  const normalized = toAscii(brand).trim();
  if (!normalized) {
    return 'CARD';
  }
  return normalized.toUpperCase();
};

export const resolveCardLast4Ascii = (card: CardDisplayLike): string => {
  const candidate = toAscii(card?.last_four_digits ?? card?.last4).replace(/\D/g, '');
  if (!candidate) {
    return '****';
  }
  return candidate.slice(-4).padStart(4, '*');
};

export const formatMaskedCardLabelAscii = (
  card: CardDisplayLike,
  options?: { includeBrand?: boolean },
): string => {
  const includeBrand = options?.includeBrand !== false;
  const last4 = resolveCardLast4Ascii(card);

  if (!includeBrand) {
    return `**** ${last4}`;
  }

  return `${formatCardBrandAscii(card?.brand)} **** ${last4}`;
};


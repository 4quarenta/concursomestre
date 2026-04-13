import type { SavedCard } from '@/types/billing';

const toAscii = (value: unknown): string => String(value ?? '').replace(/[^\x20-\x7E]/g, '');

export const formatCardBrandAscii = (brand: unknown): string => {
  const normalized = toAscii(brand).trim();
  if (!normalized) return 'CARD';
  return normalized.toUpperCase();
};

export const resolveCardLast4Ascii = (card: SavedCard): string => {
  const candidate = toAscii(card?.last_four_digits ?? card?.last4).replace(/\D/g, '');
  if (!candidate) return '****';
  return candidate.slice(-4).padStart(4, '*');
};

export const formatMaskedCardLabelAscii = (card: SavedCard): string => {
  return `${formatCardBrandAscii(card?.brand)} **** ${resolveCardLast4Ascii(card)}`;
};

import type { LegalHighlightEntry } from '@types';

const LEGAL_HIGHLIGHTS_PREFIX = 'cm:legal-commentary:highlights:';

const normalizeHighlightEntry = (entry: any): LegalHighlightEntry | null => {
  if (!entry || typeof entry !== 'object') {
    return null;
  }

  const type = entry.type === 'selection' || entry.type === 'block' ? entry.type : null;
  const articleId = String(entry.articleId || '').trim();
  const color = String(entry.color || '').trim();
  const id = String(entry.id || '').trim();
  const createdAt = Number(entry.createdAt);

  if (!type || !articleId || !color || !id || !Number.isFinite(createdAt)) {
    return null;
  }

  return {
    id,
    type,
    articleId,
    color: color as LegalHighlightEntry['color'],
    createdAt,
    unitId: typeof entry.unitId === 'string' ? entry.unitId : undefined,
    unitLabel: typeof entry.unitLabel === 'string' ? entry.unitLabel : undefined,
    preview: typeof entry.preview === 'string' ? entry.preview : undefined,
    selectedText: typeof entry.selectedText === 'string' ? entry.selectedText : undefined,
    startAnchor: typeof entry.startAnchor === 'string' ? entry.startAnchor : undefined,
    endAnchor: typeof entry.endAnchor === 'string' ? entry.endAnchor : undefined,
    blockId: typeof entry.blockId === 'string' ? entry.blockId : undefined,
  };
};

const sanitizeHighlightEntries = (entries: unknown): LegalHighlightEntry[] => (
  Array.isArray(entries)
    ? entries
      .map(normalizeHighlightEntry)
      .filter((entry): entry is LegalHighlightEntry => Boolean(entry))
    : []
);

export const getLegalHighlightsStorageKey = (userKey: string, lawId: string, articleId: string) =>
  `${LEGAL_HIGHLIGHTS_PREFIX}${userKey}:${lawId}:${articleId}`;

export const readLegalArticleHighlights = (
  userKey: string,
  lawId: string,
  articleId: string,
): LegalHighlightEntry[] => {
  if (typeof window === 'undefined' || !userKey || !lawId || !articleId) {
    return [];
  }

  try {
    const rawValue = window.localStorage.getItem(getLegalHighlightsStorageKey(userKey, lawId, articleId));
    if (!rawValue) {
      return [];
    }

    return sanitizeHighlightEntries(JSON.parse(rawValue));
  } catch {
    return [];
  }
};

export const saveLegalArticleHighlights = (
  userKey: string,
  lawId: string,
  articleId: string,
  entries: LegalHighlightEntry[],
) => {
  if (typeof window === 'undefined' || !userKey || !lawId || !articleId) {
    return;
  }

  const storageKey = getLegalHighlightsStorageKey(userKey, lawId, articleId);

  if (!entries.length) {
    window.localStorage.removeItem(storageKey);
    return;
  }

  window.localStorage.setItem(storageKey, JSON.stringify(sanitizeHighlightEntries(entries)));
};

export const clearLegalArticleHighlights = (userKey: string, lawId: string, articleId: string) => {
  if (typeof window === 'undefined' || !userKey || !lawId || !articleId) {
    return;
  }

  window.localStorage.removeItem(getLegalHighlightsStorageKey(userKey, lawId, articleId));
};

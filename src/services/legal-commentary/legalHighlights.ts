import type { LegalHighlightEntry } from '@types';

const LEGAL_HIGHLIGHTS_PREFIX = 'cm:legal-commentary:highlights:';
const LEGAL_HIGHLIGHT_COLORS = new Set<LegalHighlightEntry['color']>(['yellow', 'blue', 'pink', 'green']);

const normalizeHighlightEntry = (entry: unknown): LegalHighlightEntry | null => {
  if (!entry || typeof entry !== 'object') {
    return null;
  }

  const payload = entry as Record<string, unknown>;
  const type = payload.type === 'selection' || payload.type === 'block' ? payload.type : null;
  const articleId = String(payload.articleId || '').trim();
  const color = String(payload.color || '').trim() as LegalHighlightEntry['color'];
  const id = String(payload.id || '').trim();
  const createdAt = Number(payload.createdAt);

  if (!type || !articleId || !LEGAL_HIGHLIGHT_COLORS.has(color) || !id || !Number.isFinite(createdAt)) {
    return null;
  }

  return {
    id,
    type,
    articleId,
    color,
    createdAt,
    unitId: typeof payload.unitId === 'string' ? payload.unitId : undefined,
    unitLabel: typeof payload.unitLabel === 'string' ? payload.unitLabel : undefined,
    preview: typeof payload.preview === 'string' ? payload.preview : undefined,
    selectedText: typeof payload.selectedText === 'string' ? payload.selectedText : undefined,
    startAnchor: typeof payload.startAnchor === 'string' ? payload.startAnchor : undefined,
    endAnchor: typeof payload.endAnchor === 'string' ? payload.endAnchor : undefined,
    blockId: typeof payload.blockId === 'string' ? payload.blockId : undefined,
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

export const LEGAL_COMMENTARY_NOTE_STORAGE_PREFIX = 'cm:legal-commentary:notes:';

export interface LegalCommentaryStoredNote {
  id: string;
  userKey: string;
  articleId: string;
  note: string;
  updatedAt: number;
  lawId?: string;
  lawSlug?: string;
  lawTitle?: string;
  lawShortTitle?: string;
  areaName?: string;
  articleNumber?: string;
  articleTitle?: string;
}

interface SaveLegalCommentaryNoteInput {
  userKey: string;
  articleId: string;
  note: string;
  lawId?: string;
  lawSlug?: string;
  lawTitle?: string;
  lawShortTitle?: string;
  areaName?: string;
  articleNumber?: string;
  articleTitle?: string;
}

const buildStoredNoteId = (userKey: string, articleId: string) => `legal-note:${userKey}:${articleId}`;

export const getLegalCommentaryNoteStorageKey = (userKey: string, articleId: string) =>
  `${LEGAL_COMMENTARY_NOTE_STORAGE_PREFIX}${userKey}:${articleId}`;

const parseLegalCommentaryStoredNote = (
  rawValue: string,
  userKey: string,
  articleId: string,
): LegalCommentaryStoredNote | null => {
  const fallbackNote = rawValue.trim();

  if (!fallbackNote) {
    return null;
  }

  try {
    const parsed = JSON.parse(rawValue);

    if (!parsed || typeof parsed !== 'object') {
      return null;
    }

    const note = typeof parsed.note === 'string' ? parsed.note.trim() : '';
    if (!note) {
      return null;
    }

    return {
      id: typeof parsed.id === 'string' && parsed.id ? parsed.id : buildStoredNoteId(userKey, articleId),
      userKey,
      articleId,
      note,
      updatedAt: Number(parsed.updatedAt) || Date.now(),
      lawId: typeof parsed.lawId === 'string' ? parsed.lawId : undefined,
      lawSlug: typeof parsed.lawSlug === 'string' ? parsed.lawSlug : undefined,
      lawTitle: typeof parsed.lawTitle === 'string' ? parsed.lawTitle : undefined,
      lawShortTitle: typeof parsed.lawShortTitle === 'string' ? parsed.lawShortTitle : undefined,
      areaName: typeof parsed.areaName === 'string' ? parsed.areaName : undefined,
      articleNumber: typeof parsed.articleNumber === 'string' ? parsed.articleNumber : undefined,
      articleTitle: typeof parsed.articleTitle === 'string' ? parsed.articleTitle : undefined,
    };
  } catch {
    return {
      id: buildStoredNoteId(userKey, articleId),
      userKey,
      articleId,
      note: fallbackNote,
      updatedAt: Date.now(),
    };
  }
};

export const readLegalCommentaryArticleNote = (
  userKey: string,
  articleId: string,
): LegalCommentaryStoredNote | null => {
  if (typeof window === 'undefined' || !userKey || !articleId) {
    return null;
  }

  const rawValue = window.localStorage.getItem(getLegalCommentaryNoteStorageKey(userKey, articleId));
  if (!rawValue) {
    return null;
  }

  return parseLegalCommentaryStoredNote(rawValue, userKey, articleId);
};

export const listLegalCommentaryNotesForUser = (userKey: string): LegalCommentaryStoredNote[] => {
  if (typeof window === 'undefined' || !userKey) {
    return [];
  }

  const notes: LegalCommentaryStoredNote[] = [];
  const prefix = `${LEGAL_COMMENTARY_NOTE_STORAGE_PREFIX}${userKey}:`;

  for (let index = 0; index < window.localStorage.length; index += 1) {
    const storageKey = window.localStorage.key(index);
    if (!storageKey || !storageKey.startsWith(prefix)) {
      continue;
    }

    const articleId = storageKey.slice(prefix.length);
    const rawValue = window.localStorage.getItem(storageKey);
    if (!rawValue) {
      continue;
    }

    const parsed = parseLegalCommentaryStoredNote(rawValue, userKey, articleId);
    if (parsed) {
      notes.push(parsed);
    }
  }

  return notes.sort((left, right) => right.updatedAt - left.updatedAt);
};

export const saveLegalCommentaryArticleNote = (
  input: SaveLegalCommentaryNoteInput,
): LegalCommentaryStoredNote | null => {
  const userKey = String(input.userKey || '').trim();
  const articleId = String(input.articleId || '').trim();

  if (typeof window === 'undefined' || !userKey || !articleId) {
    return null;
  }

  const storageKey = getLegalCommentaryNoteStorageKey(userKey, articleId);
  const note = String(input.note || '').trim();

  if (!note) {
    window.localStorage.removeItem(storageKey);
    return null;
  }

  const payload: LegalCommentaryStoredNote = {
    id: buildStoredNoteId(userKey, articleId),
    userKey,
    articleId,
    note,
    updatedAt: Date.now(),
    lawId: input.lawId,
    lawSlug: input.lawSlug,
    lawTitle: input.lawTitle,
    lawShortTitle: input.lawShortTitle,
    areaName: input.areaName,
    articleNumber: input.articleNumber,
    articleTitle: input.articleTitle,
  };

  window.localStorage.setItem(storageKey, JSON.stringify(payload));
  return payload;
};

export const removeLegalCommentaryArticleNote = (userKey: string, articleId: string) => {
  if (typeof window === 'undefined' || !userKey || !articleId) {
    return;
  }

  window.localStorage.removeItem(getLegalCommentaryNoteStorageKey(userKey, articleId));
};

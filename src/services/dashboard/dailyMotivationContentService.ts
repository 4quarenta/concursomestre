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

let cachedDailyMotivationMarkdown: string | null = null;
let pendingDailyMotivationRequest: Promise<string> | null = null;
const DAILY_MOTIVATION_CACHE_KEY = 'cm:daily-motivation:markdown:v1';
const DAILY_MOTIVATION_CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

const readCachedDailyMotivationFromStorage = (): string | null => {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    const raw = window.localStorage.getItem(DAILY_MOTIVATION_CACHE_KEY);
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw) as {
      value?: unknown;
      updatedAt?: unknown;
    };
    const value = typeof parsed?.value === 'string' ? parsed.value : '';
    const updatedAt = Number(parsed?.updatedAt || 0);
    const isFresh = Number.isFinite(updatedAt) && (Date.now() - updatedAt) <= DAILY_MOTIVATION_CACHE_TTL_MS;

    if (!value || !isFresh) {
      return null;
    }

    return value;
  } catch {
    return null;
  }
};

const persistDailyMotivationInStorage = (markdown: string) => {
  if (typeof window === 'undefined') {
    return;
  }

  try {
    window.localStorage.setItem(DAILY_MOTIVATION_CACHE_KEY, JSON.stringify({
      value: markdown,
      updatedAt: Date.now(),
    }));
  } catch {
    // Sem bloqueio: falha de storage nao deve impedir carregamento.
  }
};

/**
 * Carrega a base estatica de motivacoes diarias uma unica vez por sessao do app.
 * Isso evita fetch duplicado em hard refresh e em remounts do Strict Mode.
 *
 * @since 1.0.0
 */
export const loadDailyMotivationMarkdown = async (): Promise<string> => {
  if (cachedDailyMotivationMarkdown !== null) {
    return cachedDailyMotivationMarkdown;
  }

  const persistedMarkdown = readCachedDailyMotivationFromStorage();
  if (persistedMarkdown !== null) {
    cachedDailyMotivationMarkdown = persistedMarkdown;
    return persistedMarkdown;
  }

  if (pendingDailyMotivationRequest) {
    return pendingDailyMotivationRequest;
  }

  pendingDailyMotivationRequest = fetch('/content/motivacoes-diarias.md')
    .then(async (response) => {
      if (!response.ok) {
        throw new Error('Nao foi possivel carregar as motivacoes diarias.');
      }

      const markdown = await response.text();
      cachedDailyMotivationMarkdown = markdown;
      persistDailyMotivationInStorage(markdown);
      return markdown;
    })
    .finally(() => {
      pendingDailyMotivationRequest = null;
    });

  return pendingDailyMotivationRequest;
};

export default loadDailyMotivationMarkdown;

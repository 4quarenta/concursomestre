const TOKEN_STORAGE_KEY = 'token';
const USER_STORAGE_KEY = 'user';
const TOKEN_EXPIRY_SKEW_MS = 15_000;

const normalizeStoredString = (value: string | null): string | null => {
  if (!value) return null;

  const trimmed = value.trim();
  if (!trimmed || trimmed === 'null' || trimmed === 'undefined') {
    return null;
  }

  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    try {
      const parsed = JSON.parse(trimmed);
      return typeof parsed === 'string' ? parsed.trim() : trimmed;
    } catch {
      return trimmed.slice(1, -1).trim() || null;
    }
  }

  return trimmed;
};

const decodeJwtPayload = (token: string): Record<string, unknown> | null => {
  try {
    const [, payloadSegment] = token.split('.');
    if (!payloadSegment || typeof globalThis.atob !== 'function') {
      return null;
    }

    const normalized = payloadSegment.replace(/-/g, '+').replace(/_/g, '/');
    const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, '=');
    const binary = globalThis.atob(padded);
    const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
    const json = new TextDecoder().decode(bytes);

    return JSON.parse(json);
  } catch {
    return null;
  }
};

export const getRawStoredToken = (): string | null => {
  try {
    return normalizeStoredString(localStorage.getItem(TOKEN_STORAGE_KEY));
  } catch {
    return null;
  }
};

export const isTokenExpired = (token: string, skewMs = TOKEN_EXPIRY_SKEW_MS): boolean => {
  const payload = decodeJwtPayload(token);
  const exp = typeof payload?.exp === 'number' ? payload.exp : null;

  if (!exp) return false;

  return Date.now() >= exp * 1000 - skewMs;
};

export const getStoredToken = (): string | null => {
  const token = getRawStoredToken();
  if (!token) return null;

  if (isTokenExpired(token)) {
    clearStoredSession();
    return null;
  }

  return token;
};

export const setStoredToken = (token: string | null): void => {
  try {
    const normalizedToken = normalizeStoredString(token);

    if (!normalizedToken) {
      localStorage.removeItem(TOKEN_STORAGE_KEY);
      return;
    }

    localStorage.setItem(TOKEN_STORAGE_KEY, normalizedToken);
  } catch {
    // no-op
  }
};

export const getStoredUser = <T = unknown>(): T | null => {
  try {
    const rawUser = localStorage.getItem(USER_STORAGE_KEY);
    if (!rawUser) return null;

    return JSON.parse(rawUser) as T;
  } catch {
    return null;
  }
};

export const setStoredUser = (user: unknown): void => {
  try {
    if (!user) {
      localStorage.removeItem(USER_STORAGE_KEY);
      return;
    }

    localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(user));
  } catch {
    // no-op
  }
};

export const setStoredSession = (token: string | null, user: unknown): void => {
  setStoredToken(token);
  setStoredUser(user);
};

export const clearStoredUser = (): void => {
  try {
    localStorage.removeItem(USER_STORAGE_KEY);
  } catch {
    // no-op
  }
};

export const clearStoredSession = (): void => {
  try {
    localStorage.removeItem(TOKEN_STORAGE_KEY);
    localStorage.removeItem(USER_STORAGE_KEY);
  } catch {
    // no-op
  }
};

type RequestCacheEntry<T> = {
  promise: Promise<T>;
  value?: T;
  settled: boolean;
  expiresAt: number;
};

const requestCache = new Map<string, RequestCacheEntry<unknown>>();

const isPlainObject = (value: unknown): value is Record<string, unknown> => (
  typeof value === 'object' && value !== null && !Array.isArray(value)
);

const stableSerialize = (value: unknown): string => {
  if (value === null || value === undefined) {
    return String(value);
  }

  if (Array.isArray(value)) {
    return `[${value.map((item) => stableSerialize(item)).join(',')}]`;
  }

  if (isPlainObject(value)) {
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${stableSerialize(value[key])}`)
      .join(',')}}`;
  }

  return JSON.stringify(value);
};

export const buildRequestCacheKey = (prefix: string, payload?: unknown): string => (
  payload === undefined ? prefix : `${prefix}:${stableSerialize(payload)}`
);

export const withRequestCoalescing = async <T>(
  key: string,
  loader: () => Promise<T>,
  ttlMs = 2500,
): Promise<T> => {
  if (process.env.NODE_ENV === 'test') {
    return loader();
  }

  const now = Date.now();
  const existing = requestCache.get(key) as RequestCacheEntry<T> | undefined;

  if (existing) {
    if (!existing.settled) {
      return existing.promise;
    }

    if (existing.expiresAt > now && existing.value !== undefined) {
      return existing.value;
    }

    requestCache.delete(key);
  }

  const entry: RequestCacheEntry<T> = {
    settled: false,
    expiresAt: now + ttlMs,
    promise: Promise.resolve(undefined as T),
  };

  entry.promise = loader()
    .then((value) => {
      entry.value = value;
      entry.settled = true;
      entry.expiresAt = Date.now() + ttlMs;
      return value;
    })
    .catch((error) => {
      requestCache.delete(key);
      throw error;
    });

  requestCache.set(key, entry as RequestCacheEntry<unknown>);
  return entry.promise;
};

export const clearRequestCoalescing = (prefix?: string): void => {
  if (!prefix) {
    requestCache.clear();
    return;
  }

  Array.from(requestCache.keys()).forEach((key) => {
    if (key === prefix || key.startsWith(`${prefix}:`)) {
      requestCache.delete(key);
    }
  });
};

import { beforeEach, describe, expect, it, vi } from 'vitest';

const storage = vi.hoisted(() => new Map<string, string>());

vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: vi.fn(async (key: string) => storage.get(key) ?? null),
    setItem: vi.fn(async (key: string, value: string) => {
      storage.set(key, value);
    }),
  },
}));

vi.mock('expo-constants', () => ({
  default: { executionEnvironment: 'storeClient', appOwnership: 'expo' },
  ExecutionEnvironment: { StoreClient: 'storeClient' },
}));

describe('analytics consent contract', () => {
  beforeEach(() => {
    storage.clear();
    vi.resetModules();
  });

  it('persists usage consent even when native analytics is unavailable', async () => {
    storage.set('concursomestre.privacy', JSON.stringify({ profilePublic: true, usageData: false }));
    const { analyticsService } = await import('@/services/analytics/analyticsService');

    await expect(analyticsService.setUsageDataConsent(true)).resolves.toBe(false);
    expect(JSON.parse(storage.get('concursomestre.privacy') || '{}')).toEqual({
      profilePublic: true,
      usageData: true,
    });
  });

  it('fails closed and replaces malformed preferences without throwing', async () => {
    storage.set('concursomestre.privacy', '{invalid');
    const { analyticsService } = await import('@/services/analytics/analyticsService');

    await expect(analyticsService.setUsageDataConsent(false)).resolves.toBe(false);
    expect(JSON.parse(storage.get('concursomestre.privacy') || '{}')).toEqual({ usageData: false });
  });
});

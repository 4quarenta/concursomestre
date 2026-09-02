import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { post } = vi.hoisted(() => ({ post: vi.fn().mockResolvedValue({}) }));

vi.mock('@services/api', () => ({
  apiClient: { post },
  ENDPOINTS: { analytics: { track: 'analytics/track.php' } },
}));

vi.mock('@services/monitoring/clientLog', () => ({
  clientLog: { warn: vi.fn() },
}));

import analyticsTrackingService from '../analyticsTrackingService';

const setConsent = (analytics: boolean) => {
  const storage = new Map<string, string>([
    ['cm:cookie-consent:v1', JSON.stringify({ version: 1, necessary: true, analytics, marketing: false, updatedAt: '2026-08-30T00:00:00.000Z' })],
  ]);
  vi.stubGlobal('window', {
    localStorage: { getItem: (key: string) => storage.get(key) ?? null },
    sessionStorage: { getItem: () => null, setItem: () => undefined },
    location: { search: '', href: 'https://concursomestre.com/' },
  });
  vi.stubGlobal('document', { referrer: '' });
};

describe('analytics consent gate', () => {
  beforeEach(() => {
    post.mockClear();
    vi.unstubAllGlobals();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('does not send first-party analytics before opt-in', async () => {
    await analyticsTrackingService.trackLifecycleEvent({ eventName: 'identifiable_visit', source: 'test' });
    expect(post).not.toHaveBeenCalled();
  });

  it('sends first-party analytics after analytics opt-in', async () => {
    setConsent(true);
    await analyticsTrackingService.trackLifecycleEvent({ eventName: 'identifiable_visit', source: 'test' });
    expect(post).toHaveBeenCalledTimes(1);
  });
});

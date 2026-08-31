import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { postMock, warnMock } = vi.hoisted(() => ({
  postMock: vi.fn(),
  warnMock: vi.fn(),
}));

vi.mock('@services/api', () => ({
  apiClient: { post: postMock },
  ENDPOINTS: { analytics: { track: 'analytics/track.php' } },
}));
vi.mock('@services/monitoring/clientLog', () => ({ clientLog: { warn: warnMock } }));

import { analyticsTrackingService } from '../analyticsTrackingService';

describe('analytics tracking consent', () => {
  beforeEach(() => {
    postMock.mockReset();
    warnMock.mockReset();
    vi.unstubAllGlobals();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('does not send before analytics consent', async () => {
    await analyticsTrackingService.trackLifecycleEvent({ eventName: 'identifiable_visit', source: 'test' });
    expect(postMock).not.toHaveBeenCalled();
  });

  it('can send after analytics consent', async () => {
    const storage = new Map<string, string>();
    storage.set('cm:cookie-consent:v1', JSON.stringify({ version: 1, necessary: true, analytics: true, marketing: false, updatedAt: '' }));
    vi.stubGlobal('window', {
      localStorage: { getItem: (key: string) => storage.get(key) ?? null },
      sessionStorage: { getItem: () => null, setItem: () => undefined },
      location: { search: '', href: 'https://concursomestre.com/' },
    });
    vi.stubGlobal('document', { referrer: '' });
    postMock.mockResolvedValue({});
    await analyticsTrackingService.trackLifecycleEvent({ eventName: 'identifiable_visit', source: 'test' });
    expect(postMock).toHaveBeenCalledTimes(1);
  });

  it('sends only bounded campaign values and strips direct identity', async () => {
    const storage = new Map<string, string>([
      ['cm:cookie-consent:v1', JSON.stringify({ version: 1, necessary: true, analytics: true, marketing: false, updatedAt: '' })],
    ]);
    vi.stubGlobal('window', {
      localStorage: { getItem: (key: string) => storage.get(key) ?? null },
      location: { search: '?utm_source=newsletter&utm_campaign=spring&email=secret' },
    });
    vi.stubGlobal('document', { referrer: 'https://private.example/account?token=secret' });
    postMock.mockResolvedValue({});

    await analyticsTrackingService.trackLifecycleEvent({
      eventName: 'checkout_started',
      source: 'test',
      metadata: { step: 'plans', paymentIntentId: 'pi_secret' },
    });

    expect(postMock).toHaveBeenCalledWith('analytics/track.php', {
      eventName: 'checkout_started',
      source: 'test',
      planId: undefined,
      cycleLabel: undefined,
      utmSource: 'newsletter',
      utmMedium: undefined,
      utmCampaign: 'spring',
      metadata: { step: 'plans' },
    });
  });
});

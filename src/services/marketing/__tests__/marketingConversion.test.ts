import { describe, expect, it } from 'vitest';
import {
  getCountdownRemainingMs,
  isCampaignEligible,
  isCampaignWithinWindow,
  resolveCampaignConversionEvent,
} from '../marketingConversion';

const now = new Date('2026-09-05T12:00:00.000Z');

describe('marketing conversion contract', () => {
  it('maps campaign objectives to canonical conversion events', () => {
    expect(resolveCampaignConversionEvent('CRIAR_CONTA')).toBe('signup_completed');
    expect(resolveCampaignConversionEvent('ASSINAR_ELITE')).toBe('subscription_activated');
    expect(resolveCampaignConversionEvent('ESCOLHER_PLANO')).toBe('plan_selected');
  });

  it('does not activate campaigns outside their authoritative window', () => {
    expect(isCampaignWithinWindow({ status: 'draft' }, now)).toBe(false);
    expect(isCampaignWithinWindow({ status: 'scheduled', startsAt: '2026-09-05T12:00:01Z' }, now)).toBe(false);
    expect(isCampaignWithinWindow({ status: 'active', endsAt: '2026-09-05T12:00:00Z' }, now)).toBe(false);
    expect(isCampaignWithinWindow({ status: 'active', startsAt: '2026-09-05T11:00:00Z', endsAt: '2026-09-05T13:00:00Z' }, now)).toBe(true);
  });

  it('enforces suppression, audience, cap, cooldown and mutual exclusion', () => {
    const campaign = { status: 'active' as const };
    const policy = {
      frequencyCap: { count: 2, window: 'session' as const },
      maxImpressions: 3,
      cooldownHours: 24,
      mutualExclusionGroup: 'upgrade',
      suppressAfterConversion: true,
    };
    expect(isCampaignEligible(campaign, policy, { now, audienceEligible: true, impressions: 1, converted: false })).toBe(true);
    expect(isCampaignEligible(campaign, policy, { now, audienceEligible: false })).toBe(false);
    expect(isCampaignEligible(campaign, policy, { now, impressions: 2 })).toBe(false);
    expect(isCampaignEligible(campaign, policy, { now, converted: true })).toBe(false);
    expect(isCampaignEligible(campaign, policy, { now, competingCampaignActive: true })).toBe(false);
    expect(isCampaignEligible(campaign, policy, { now, lastInteractionAt: new Date('2026-09-05T00:00:00Z') })).toBe(false);
  });

  it('uses a fixed deadline and never resets the countdown on revisit', () => {
    expect(getCountdownRemainingMs('2026-09-05T12:01:00Z', now)).toBe(60_000);
    expect(getCountdownRemainingMs('2026-09-05T11:59:00Z', now)).toBe(0);
    expect(getCountdownRemainingMs('', now)).toBe(0);
  });
});

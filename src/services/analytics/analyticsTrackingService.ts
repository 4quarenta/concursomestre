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

import { apiClient, ENDPOINTS } from '@services/api';
import { clientLog } from '@services/monitoring/clientLog';
import { readCookieConsent } from '@services/privacy/cookieConsent';

export type LifecycleAnalyticsEventName =
  | 'identifiable_visit'
  | 'signup_started'
  | 'email_captured'
  | 'signup_completed'
  | 'checkout_started'
  | 'plan_viewed'
  | 'payment_method_started'
  | 'checkout_abandoned'
  | 'purchase_completed'
  | 'payment_failed'
  | 'renewal_upcoming'
  | 'renewal_completed'
  | 'subscription_cancelled'
  | 'subscription_reactivated';

type TrackLifecycleEventInput = {
  eventName: LifecycleAnalyticsEventName;
  source: string;
  userId?: string | null;
  email?: string | null;
  sessionKey?: string | null;
  planId?: number | string | null;
  cycleLabel?: string | null;
  originUrl?: string | null;
  referrerUrl?: string | null;
  utmSource?: string | null;
  utmMedium?: string | null;
  utmCampaign?: string | null;
  metadata?: Record<string, unknown>;
  externalHooks?: Record<string, unknown>;
};

const SESSION_STORAGE_KEY = 'cm:analytics:session-key';

const readSearchParam = (searchParams: URLSearchParams, key: string) => {
  const value = searchParams.get(key);
  return value && value.trim() !== '' ? value.trim() : null;
};

const getBrowserSessionKey = () => {
  if (typeof window === 'undefined') return 'server';

  const current = window.sessionStorage.getItem(SESSION_STORAGE_KEY);
  if (current) {
    return current;
  }

  const next = `sess_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  window.sessionStorage.setItem(SESSION_STORAGE_KEY, next);
  return next;
};

/**
 * Serviço first-party de tracking analítico.
 *
 * @since v1.0.0
 */
export const analyticsTrackingService = {
  getSessionKey(): string {
    return getBrowserSessionKey();
  },

  async trackLifecycleEvent(input: TrackLifecycleEventInput): Promise<void> {
    if (readCookieConsent()?.analytics !== true) return;

    try {
      const searchParams = typeof window !== 'undefined'
        ? new URLSearchParams(window.location.search)
        : new URLSearchParams();

      await apiClient.post(ENDPOINTS.analytics.track, {
        eventName: input.eventName,
        source: input.source,
        userId: input.userId || undefined,
        email: input.email || undefined,
        sessionKey: input.sessionKey || getBrowserSessionKey(),
        planId: input.planId ? Number(input.planId) : undefined,
        cycleLabel: input.cycleLabel || undefined,
        originUrl: input.originUrl || (typeof window !== 'undefined' ? window.location.href : undefined),
        referrerUrl: input.referrerUrl || (typeof document !== 'undefined' ? document.referrer || undefined : undefined),
        utmSource: input.utmSource || readSearchParam(searchParams, 'utm_source'),
        utmMedium: input.utmMedium || readSearchParam(searchParams, 'utm_medium'),
        utmCampaign: input.utmCampaign || readSearchParam(searchParams, 'utm_campaign'),
        metadata: input.metadata || undefined,
        externalHooks: input.externalHooks || undefined,
      });
    } catch (error) {
      clientLog.warn('[analyticsTrackingService] failed to track lifecycle event', input.eventName, error);
    }
  },
};

export default analyticsTrackingService;

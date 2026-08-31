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
  | 'signup_completed'
  | 'checkout_started'
  | 'plan_viewed'
  | 'payment_method_started'
  | 'checkout_abandoned'
  | 'payment_failed';

type TrackLifecycleEventInput = {
  eventName: LifecycleAnalyticsEventName;
  source: string;
  planId?: number | string | null;
  cycleLabel?: string | null;
  metadata?: Record<string, unknown>;
};

const SAFE_METADATA_KEYS = ['mode', 'authMode', 'step', 'stage'] as const;

const sanitizeMetadata = (metadata?: Record<string, unknown>) => {
  if (!metadata) return undefined;

  const safeEntries = SAFE_METADATA_KEYS.flatMap((key) => {
    const value = metadata[key];
    return typeof value === 'string' && /^[a-zA-Z0-9_-]{1,40}$/.test(value.trim())
      ? [[key, value.trim()] as const]
      : [];
  });

  return safeEntries.length > 0 ? Object.fromEntries(safeEntries) : undefined;
};

const readCampaignParam = (key: string, maxLength: number) => {
  if (typeof window === 'undefined') return undefined;
  const value = new URLSearchParams(window.location.search).get(key)?.trim() || '';
  return value !== '' && /^[a-zA-Z0-9._~%-]+$/.test(value)
    ? value.slice(0, maxLength)
    : undefined;
};

/**
 * Serviço first-party de tracking analítico.
 *
 * @since v1.0.0
 */
export const analyticsTrackingService = {
  async trackLifecycleEvent(input: TrackLifecycleEventInput): Promise<void> {
    if (readCookieConsent()?.analytics !== true) return;

    try {
      await apiClient.post(ENDPOINTS.analytics.track, {
        eventName: input.eventName,
        source: input.source,
        planId: input.planId ? Number(input.planId) : undefined,
        cycleLabel: input.cycleLabel || undefined,
        utmSource: readCampaignParam('utm_source', 80),
        utmMedium: readCampaignParam('utm_medium', 80),
        utmCampaign: readCampaignParam('utm_campaign', 120),
        metadata: sanitizeMetadata(input.metadata),
      });
    } catch (error) {
      clientLog.warn('[analyticsTrackingService] failed to track lifecycle event', input.eventName, error);
    }
  },
};

export default analyticsTrackingService;

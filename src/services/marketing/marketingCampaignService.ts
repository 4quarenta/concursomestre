import { apiClient, ENDPOINTS, assertApiSuccess, readApiData } from '@services/api';
import type { ApiResponse } from '@services/api';
import { readCookieConsent } from '@services/privacy/cookieConsent';

export type MarketingCampaignStatus = 'draft' | 'scheduled' | 'active' | 'paused' | 'ended' | 'archived';
export type MarketingSegmentStatus = 'draft' | 'active' | 'paused' | 'archived';

export interface MarketingSegmentRecord {
  id: string;
  name: string;
  description: string | null;
  status: MarketingSegmentStatus;
  rules_json: unknown[];
  created_at: string;
  updated_at: string;
}

export interface MarketingCampaignRecord {
  id: string;
  name: string;
  objective: string;
  status: MarketingCampaignStatus;
  priority: number;
  starts_at: string | null;
  ends_at: string | null;
  segment_id: string | null;
  segment_name?: string | null;
  rules_json: unknown[];
  channels_json: string[];
  placements_json: string[];
  content_json: Record<string, unknown>;
  landing_slug: string | null;
  offer_json: Record<string, unknown> | null;
  plan_id: number | null;
  coupon_code: string | null;
  tracking_json: Record<string, unknown> | null;
  frequency_cap: number | null;
  cooldown_hours: number | null;
  max_impressions: number | null;
  mutual_exclusion_group: string | null;
  suppress_after_conversion: boolean;
  created_at: string;
  updated_at: string;
}

export interface MarketingCampaignDraft {
  id?: string;
  name: string;
  objective: string;
  status: MarketingCampaignStatus;
  priority: number;
  starts_at: string;
  ends_at: string;
  segment_id: string;
  channels: string[];
  placements: string[];
  landing_slug: string;
  plan_id: string;
  coupon_code: string;
  frequency_cap: string;
  cooldown_hours: string;
  max_impressions: string;
  mutual_exclusion_group: string;
  suppress_after_conversion: boolean;
  content: { headline: string; description: string; ctaLabel: string };
}

export interface MarketingPublicCampaign {
  id: string;
  name: string;
  objective: string;
  priority: number;
  startsAt: string | null;
  endsAt: string | null;
  landingSlug: string | null;
  content: Record<string, unknown>;
  offer: Record<string, unknown> | null;
  planId: number | null;
  couponCode: string | null;
  channels: string[];
  placements: string[];
}

export interface MarketingSegmentDraft {
  id?: string;
  name: string;
  description: string;
  status: MarketingSegmentStatus;
  rules: Array<{ field: string; operator: string; value: string }>;
}

const request = <T>(promise: Promise<unknown>) => promise as Promise<ApiResponse<T>>;

export const marketingCampaignService = {
  async listCampaigns(search = '', status = ''): Promise<MarketingCampaignRecord[]> {
    const response = await request<MarketingCampaignRecord[]>(apiClient.get<ApiResponse<MarketingCampaignRecord[]>>(ENDPOINTS.admin.marketingCampaigns, { params: { search, status } }));
    return readApiData(response, []);
  },

  async listSegments(search = ''): Promise<MarketingSegmentRecord[]> {
    const response = await request<MarketingSegmentRecord[]>(apiClient.get<ApiResponse<MarketingSegmentRecord[]>>(ENDPOINTS.admin.marketingSegments, { params: { search } }));
    return readApiData(response, []);
  },

  async saveCampaign(draft: MarketingCampaignDraft): Promise<MarketingCampaignRecord> {
    const response = request<MarketingCampaignRecord>(apiClient.post<ApiResponse<MarketingCampaignRecord>>(ENDPOINTS.admin.marketingCampaigns, {
      action: 'save',
      ...draft,
      segment_id: draft.segment_id || null,
      plan_id: draft.plan_id || null,
      starts_at: draft.starts_at || null,
      ends_at: draft.ends_at || null,
      frequency_cap: draft.frequency_cap || null,
      cooldown_hours: draft.cooldown_hours || null,
      max_impressions: draft.max_impressions || null,
      offer: draft.plan_id || draft.coupon_code ? { plan_id: draft.plan_id || null, coupon_code: draft.coupon_code || null } : null,
      tracking: { source: 'admin_campaign' },
      rules: [],
    }));
    return readApiData(assertApiSuccess(await response, 'Nao foi possivel salvar a campanha.'), {} as MarketingCampaignRecord);
  },

  async saveSegment(draft: MarketingSegmentDraft): Promise<MarketingSegmentRecord> {
    const response = await request<MarketingSegmentRecord>(apiClient.post<ApiResponse<MarketingSegmentRecord>>(ENDPOINTS.admin.marketingSegments, {
      action: 'save', ...draft,
    }));
    return readApiData(assertApiSuccess(response, 'Nao foi possivel salvar o segmento.'), {} as MarketingSegmentRecord);
  },

  async transition(id: string, status: MarketingCampaignStatus): Promise<MarketingCampaignRecord> {
    const response = await request<MarketingCampaignRecord>(apiClient.post<ApiResponse<MarketingCampaignRecord>>(ENDPOINTS.admin.marketingCampaigns, { action: 'transition', id, status }));
    return readApiData(assertApiSuccess(response, 'Nao foi possivel atualizar o status.'), {} as MarketingCampaignRecord);
  },

  async analytics(id: string): Promise<{ interactions: Record<string, { total: number; unique: number }>; funnel: Record<string, number> }> {
    const response = await request<{ interactions: Record<string, { total: number; unique: number }>; funnel: Record<string, number> }>(apiClient.get<ApiResponse<{ interactions: Record<string, { total: number; unique: number }>; funnel: Record<string, number> }>>(ENDPOINTS.admin.marketingCampaigns, { params: { action: 'analytics', id } }));
    return readApiData(response, { interactions: {}, funnel: {} });
  },

  async listPublicCampaigns(): Promise<MarketingPublicCampaign[]> {
    const response = await request<MarketingPublicCampaign[]>(apiClient.get<ApiResponse<MarketingPublicCampaign[]>>(ENDPOINTS.analytics.campaignInteraction));
    return readApiData(response, []);
  },

  async recordPublicInteraction(payload: { campaignId: string; interactionType: 'impression' | 'dismissal' | 'cta_clicked'; sessionKey: string; landingId?: string; placement?: string; ctaId?: string }): Promise<void> {
    if (readCookieConsent()?.marketing !== true && readCookieConsent()?.analytics !== true) return;
    await apiClient.post(ENDPOINTS.analytics.campaignInteraction, { action: 'interaction', ...payload });
  },
};

export default marketingCampaignService;

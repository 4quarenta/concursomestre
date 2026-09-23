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

import { cache } from 'react';
import type { SystemSettings } from '@types';
import { resolveAbsoluteApiBaseUrl } from '@services/api/baseUrl';
import { adaptPublicSystemSettings } from '@services/admin/publicSettingsContract';
import {
  DEFAULT_SYSTEM_SETTINGS,
  resolvePersistedSystemSettings,
} from '@/state/app-config/systemSettings';

const PUBLIC_SETTINGS_FETCH_TIMEOUT_MS = 1800;

const readEnvelopeData = (payload: unknown): Record<string, unknown> => {
  if (!payload || typeof payload !== 'object') return {};
  if (Object.prototype.hasOwnProperty.call(payload, 'data')) {
    const data = (payload as { data?: unknown }).data;
    return data && typeof data === 'object' ? data as Record<string, unknown> : {};
  }
  return payload as Record<string, unknown>;
};

export const normalizeAdsenseAccountId = (value?: string | null): string => {
  const normalized = String(value || '').trim();
  return /^ca-pub-\d{8,32}$/i.test(normalized) ? normalized : '';
};

export const normalizeGoogleAnalyticsId = (value?: string | null): string => {
  const normalized = String(value || '').trim();
  return /^(G|GT|AW|DC)-[A-Z0-9-]{4,}$/i.test(normalized) ? normalized : '';
};

export type PublicMarketingSettings = {
  adsenseAccount: string;
  analyticsId: string;
  settings: SystemSettings | null;
};

const EMPTY_PUBLIC_MARKETING_SETTINGS: PublicMarketingSettings = {
  adsenseAccount: '',
  analyticsId: '',
  settings: null,
};

export const fetchPublicMarketingSettings = cache(async (): Promise<PublicMarketingSettings> => {
  if (typeof fetch !== 'function') return EMPTY_PUBLIC_MARKETING_SETTINGS;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), PUBLIC_SETTINGS_FETCH_TIMEOUT_MS);
  try {
    const apiBaseUrl = resolveAbsoluteApiBaseUrl(process.env.NEXT_PUBLIC_API_BASE_URL || process.env.API_BASE_URL || undefined);
    const response = await fetch(new URL('settings.php', apiBaseUrl).toString(), {
      headers: { Accept: 'application/json' },
      cache: 'no-store',
      signal: controller.signal,
    });
    if (!response.ok) return EMPTY_PUBLIC_MARKETING_SETTINGS;

    const publicSettings = adaptPublicSystemSettings(readEnvelopeData(await response.json()));
    const settings = resolvePersistedSystemSettings(DEFAULT_SYSTEM_SETTINGS, publicSettings) as SystemSettings;
    return {
      adsenseAccount: normalizeAdsenseAccountId(settings.adsenseClientId),
      analyticsId: normalizeGoogleAnalyticsId(settings.googleAnalyticsId),
      settings,
    };
  } catch {
    return EMPTY_PUBLIC_MARKETING_SETTINGS;
  } finally {
    clearTimeout(timeout);
  }
});

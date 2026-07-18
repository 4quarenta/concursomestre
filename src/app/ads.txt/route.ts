import { NextResponse } from 'next/server';
import { resolveAbsoluteApiBaseUrl } from '@services/api/baseUrl';
import { buildGoogleAdsTxtFallback, validateAdsTxtContent } from '@services/ads/adsTxt';
import { adaptPublicSystemSettings } from '@services/admin/publicSettingsContract';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const PUBLIC_SETTINGS_FETCH_TIMEOUT_MS = 2500;

const readEnvelopeData = (payload: unknown): Record<string, unknown> => {
  if (!payload || typeof payload !== 'object') {
    return {};
  }

  const data = (payload as { data?: unknown }).data;
  return data && typeof data === 'object'
    ? data as Record<string, unknown>
    : payload as Record<string, unknown>;
};

const fetchAdsTxtContent = async (): Promise<string> => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), PUBLIC_SETTINGS_FETCH_TIMEOUT_MS);

  try {
    const apiBaseUrl = resolveAbsoluteApiBaseUrl(
      process.env.NEXT_PUBLIC_API_BASE_URL || process.env.API_BASE_URL || undefined,
    );
    const response = await fetch(new URL('settings.php', apiBaseUrl).toString(), {
      cache: 'no-store',
      headers: {
        Accept: 'application/json',
      },
      signal: controller.signal,
    });

    if (!response.ok) {
      return '';
    }

    const settings = adaptPublicSystemSettings(readEnvelopeData(await response.json()));
    const configuredContent = validateAdsTxtContent(settings.adsTxtContent).content;

    return configuredContent || buildGoogleAdsTxtFallback(settings.adsenseClientId);
  } catch {
    return '';
  } finally {
    clearTimeout(timeout);
  }
};

export async function GET() {
  const content = await fetchAdsTxtContent();

  return new NextResponse(content, {
    status: 200,
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=300, stale-while-revalidate=3600',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}

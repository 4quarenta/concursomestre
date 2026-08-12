import 'server-only';

import { resolveAbsoluteApiBaseUrl } from '@services/api/baseUrl';
import type { PublicSuggestion } from '@services/support/supportService';

const REVALIDATE_SECONDS = 120;
const TIMEOUT_MS = 2500;

const unwrapSuggestions = (payload: unknown): PublicSuggestion[] => {
  if (!payload || typeof payload !== 'object') return [];
  const envelope = payload as { data?: unknown; suggestions?: unknown };
  const data = envelope.data && typeof envelope.data === 'object'
    ? envelope.data as { suggestions?: unknown }
    : envelope;

  return Array.isArray(data.suggestions) ? data.suggestions as PublicSuggestion[] : [];
};

export const fetchPublicSuggestionsForServer = async ({
  fetchImpl = fetch,
  apiBaseUrl,
}: {
  fetchImpl?: typeof fetch;
  apiBaseUrl?: string;
} = {}): Promise<PublicSuggestion[]> => {
  const baseUrl = resolveAbsoluteApiBaseUrl(
    apiBaseUrl || process.env.NEXT_PUBLIC_API_BASE_URL || process.env.API_BASE_URL || undefined,
  );
  const url = new URL('feedback/list.php', baseUrl);
  url.searchParams.set('public_suggestions', '1');
  url.searchParams.set('limit', '50');

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetchImpl(url, {
      headers: { Accept: 'application/json' },
      next: { revalidate: REVALIDATE_SECONDS },
      signal: controller.signal,
    });
    return response.ok ? unwrapSuggestions(await response.json()) : [];
  } catch {
    return [];
  } finally {
    clearTimeout(timeout);
  }
};


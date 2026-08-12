import 'server-only';

import { resolveAbsoluteApiBaseUrl } from '@services/api/baseUrl';
import {
  BASELINE_1_0_0_CHANGELOG,
  normalizePublicChangelogPage,
  type ChangelogPage,
} from '@services/changelog/changelogService';

const REVALIDATE_SECONDS = 300;
const TIMEOUT_MS = 2500;

const fallbackPage = (): ChangelogPage => ({
  items: [BASELINE_1_0_0_CHANGELOG],
  pageInfo: { page: 1, limit: 8, total: 1, totalPages: 1, hasMore: false },
});

const unwrapPage = (payload: unknown): ChangelogPage | null => {
  if (!payload || typeof payload !== 'object') return null;
  const envelope = payload as { data?: unknown };
  const data = envelope.data && typeof envelope.data === 'object' ? envelope.data : payload;
  if (!data || typeof data !== 'object') return null;
  const page = data as Partial<ChangelogPage>;
  return Array.isArray(page.items) && page.pageInfo && typeof page.pageInfo === 'object'
    ? page as ChangelogPage
    : null;
};

export const buildChangelogServerUrl = (page = 1, apiBaseUrl?: string): URL => {
  const baseUrl = resolveAbsoluteApiBaseUrl(
    apiBaseUrl || process.env.NEXT_PUBLIC_API_BASE_URL || process.env.API_BASE_URL || undefined,
  );
  const url = new URL('changelog/list.php', baseUrl);
  url.searchParams.set('page', String(Math.max(1, page)));
  url.searchParams.set('limit', '8');
  return url;
};

export const fetchChangelogForServer = async ({
  page = 1,
  fetchImpl = fetch,
  apiBaseUrl,
}: {
  page?: number;
  fetchImpl?: typeof fetch;
  apiBaseUrl?: string;
} = {}): Promise<ChangelogPage> => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetchImpl(buildChangelogServerUrl(page, apiBaseUrl), {
      headers: { Accept: 'application/json' },
      next: { revalidate: REVALIDATE_SECONDS },
      signal: controller.signal,
    });
    if (!response.ok) return fallbackPage();
    const result = unwrapPage(await response.json());
    return result ? normalizePublicChangelogPage(result) : fallbackPage();
  } catch {
    return fallbackPage();
  } finally {
    clearTimeout(timeout);
  }
};

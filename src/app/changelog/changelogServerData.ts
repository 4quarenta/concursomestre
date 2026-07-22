import 'server-only';

import { resolveAbsoluteApiBaseUrl } from '@services/api/baseUrl';
import {
  BASELINE_1_0_0_CHANGELOG,
  normalizePublicChangelogVersions,
  type ChangelogVersion,
} from '@services/changelog/changelogService';

const CHANGELOG_REVALIDATE_SECONDS = 300;
const CHANGELOG_TIMEOUT_MS = 2500;

type FetchLike = typeof fetch;

const unwrapVersions = (payload: unknown): ChangelogVersion[] => {
  if (Array.isArray(payload)) {
    return payload as ChangelogVersion[];
  }

  if (!payload || typeof payload !== 'object') {
    return [];
  }

  const envelope = payload as { data?: unknown; versions?: unknown };
  if (Array.isArray(envelope.versions)) {
    return envelope.versions as ChangelogVersion[];
  }

  if (Array.isArray(envelope.data)) {
    return envelope.data as ChangelogVersion[];
  }

  if (envelope.data && typeof envelope.data === 'object') {
    const data = envelope.data as { versions?: unknown };
    return Array.isArray(data.versions) ? data.versions as ChangelogVersion[] : [];
  }

  return [];
};

export const buildChangelogServerUrl = (apiBaseUrl?: string): URL => {
  const baseUrl = resolveAbsoluteApiBaseUrl(
    apiBaseUrl || process.env.NEXT_PUBLIC_API_BASE_URL || process.env.API_BASE_URL || undefined,
  );
  return new URL('changelog/list.php', baseUrl);
};

export const fetchChangelogForServer = async ({
  fetchImpl = fetch,
  apiBaseUrl,
}: {
  fetchImpl?: FetchLike;
  apiBaseUrl?: string;
} = {}): Promise<ChangelogVersion[]> => {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), CHANGELOG_TIMEOUT_MS);

  try {
    const response = await fetchImpl(buildChangelogServerUrl(apiBaseUrl), {
      headers: { Accept: 'application/json' },
      next: { revalidate: CHANGELOG_REVALIDATE_SECONDS },
      signal: controller.signal,
    });

    if (!response.ok) {
      return [BASELINE_1_0_0_CHANGELOG];
    }

    return normalizePublicChangelogVersions(unwrapVersions(await response.json()));
  } catch {
    return [BASELINE_1_0_0_CHANGELOG];
  } finally {
    clearTimeout(timeout);
  }
};

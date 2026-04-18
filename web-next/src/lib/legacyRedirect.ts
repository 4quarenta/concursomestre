const DEFAULT_LEGACY_WEB_URL = 'http://localhost:3000';

export type LegacySearchParams = Record<string, string | string[] | undefined>;

const getLegacyWebUrl = () => process.env.NEXT_PUBLIC_LEGACY_WEB_URL || DEFAULT_LEGACY_WEB_URL;

const normalizeBaseUrl = (value: string) => (value.endsWith('/') ? value : `${value}/`);

export const appendLegacySearchParams = (targetUrl: URL, searchParams: LegacySearchParams) => {
  Object.entries(searchParams).forEach(([key, rawValue]) => {
    if (typeof rawValue === 'undefined') {
      return;
    }

    if (Array.isArray(rawValue)) {
      rawValue.forEach((value) => targetUrl.searchParams.append(key, value));
      return;
    }

    targetUrl.searchParams.set(key, rawValue);
  });
};

export const buildLegacyUrl = (
  pathname: string,
  searchParams: LegacySearchParams = {},
) => {
  const normalizedPathname = pathname.replace(/^\/+/, '');
  const targetUrl = new URL(normalizedPathname, normalizeBaseUrl(getLegacyWebUrl()));

  appendLegacySearchParams(targetUrl, searchParams);

  return targetUrl.toString();
};

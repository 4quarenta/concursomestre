import { websiteManifest } from './platform';

const LOCAL_DEVELOPMENT_SITE_URL = 'http://localhost:3000/';

const readEnv = (key: string): string => {
  if (typeof process === 'undefined' || !process.env) {
    return '';
  }

  const value = process.env[key];
  return typeof value === 'string' ? value.trim() : '';
};

const getDefaultSiteUrl = () => (
  readEnv('NODE_ENV') === 'development'
    ? LOCAL_DEVELOPMENT_SITE_URL
    : websiteManifest.website.canonicalUrl
);

export const normalizeSiteUrl = (value?: string | null, fallback = LOCAL_DEVELOPMENT_SITE_URL): URL => {
  const candidate = (value || fallback || LOCAL_DEVELOPMENT_SITE_URL).trim();
  const withProtocol = /^https?:\/\//i.test(candidate) ? candidate : `https://${candidate}`;

  try {
    const url = new URL(withProtocol);
    url.hash = '';
    url.search = '';

    if (!url.pathname.endsWith('/')) {
      url.pathname = `${url.pathname}/`;
    }

    return url;
  } catch {
    if (candidate === fallback) {
      return new URL(LOCAL_DEVELOPMENT_SITE_URL);
    }

    return normalizeSiteUrl(fallback, LOCAL_DEVELOPMENT_SITE_URL);
  }
};

export const getConfiguredSiteUrl = (): URL => normalizeSiteUrl(
  readEnv('NEXT_PUBLIC_SITE_URL')
    || readEnv('NEXT_PUBLIC_APP_URL')
    || readEnv('SITE_URL')
    || readEnv('APP_URL')
    || readEnv('VERCEL_PROJECT_PRODUCTION_URL')
    || readEnv('VERCEL_URL')
    || getDefaultSiteUrl(),
  getDefaultSiteUrl(),
);

export const buildSiteUrl = (path = '/', baseUrl = getConfiguredSiteUrl()): string =>
  new URL(path.startsWith('/') ? path : `/${path}`, baseUrl).toString();

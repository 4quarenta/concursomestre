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

const joinPolicy = (directives: Record<string, string[]>) => (
  Object.entries(directives)
    .map(([directive, values]) => (values.length > 0 ? `${directive} ${values.join(' ')}` : directive))
    .join('; ')
);

export const LOCAL_FRONTEND_API_BASE_URL = 'http://localhost/questao-pro-backend/api/';
export const DEFAULT_FRONTEND_API_BASE_URL = process.env.NODE_ENV === 'production'
  ? '/api/'
  : LOCAL_FRONTEND_API_BASE_URL;

const DEFAULT_LOCAL_API_BASE_URLS = [
  LOCAL_FRONTEND_API_BASE_URL,
  'http://127.0.0.1/questao-pro-backend/api/',
];

const appendUniqueOrigin = (sources: string[], candidate?: string) => {
  if (!candidate) {
    return;
  }

  try {
    const origin = new URL(candidate).origin;
    if (!sources.includes(origin)) {
      sources.push(origin);
    }
  } catch {
    // Valores invalidos nao devem quebrar a montagem da CSP.
  }
};

export const buildFrontendContentSecurityPolicy = (apiBaseUrl?: string) => {
  const isProduction = process.env.NODE_ENV === 'production';
  const scriptSources = [
    "'self'",
    "'unsafe-inline'",
    'blob:',
    'https://js.stripe.com',
    'https://checkout.stripe.com',
    'https://accounts.google.com',
    'https://connect.facebook.net',
    'https://appleid.cdn-apple.com',
    'https://www.google.com',
    'https://www.gstatic.com',
    'https://www.googletagmanager.com',
    'https://www.google-analytics.com',
    'https://pagead2.googlesyndication.com',
    'https://securepubads.g.doubleclick.net',
    'https://static.cloudflareinsights.com',
  ];

  if (!isProduction) {
    scriptSources.splice(2, 0, "'unsafe-eval'");
  }

  const connectSources = [
    "'self'",
    'https://api.stripe.com',
    'https://checkout.stripe.com',
    'https://accounts.google.com',
    'https://graph.facebook.com',
    'https://www.facebook.com',
    'https://appleid.apple.com',
    'https://www.google.com',
    'https://www.gstatic.com',
    'https://recaptcha.google.com',
    'https://www.googleapis.com',
    'https://www.googletagmanager.com',
    'https://www.google-analytics.com',
    'https://region1.google-analytics.com',
    'https://pagead2.googlesyndication.com',
    'https://securepubads.g.doubleclick.net',
    'https://googleads.g.doubleclick.net',
    'https://tpc.googlesyndication.com',
    'https://*.adtrafficquality.google',
    'https://cloudflareinsights.com',
  ];

  const assetSources = ["'self'", 'data:', 'blob:', 'https:'];

  appendUniqueOrigin(connectSources, apiBaseUrl);
  appendUniqueOrigin(assetSources, apiBaseUrl);

  if (!isProduction) {
    DEFAULT_LOCAL_API_BASE_URLS.forEach((candidate) => {
      appendUniqueOrigin(connectSources, candidate);
      appendUniqueOrigin(assetSources, candidate);
    });
  }

  return joinPolicy({
    'default-src': ["'self'"],
    'base-uri': ["'self'"],
    'frame-ancestors': ["'none'"],
    'object-src': ["'none'"],
    'form-action': ["'self'", 'https://checkout.stripe.com', 'https://accounts.google.com', 'https://www.facebook.com', 'https://appleid.apple.com'],
    'script-src': scriptSources,
    'script-src-elem': scriptSources,
    'style-src': ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com', 'https://accounts.google.com'],
    'font-src': ["'self'", 'data:', 'https://fonts.gstatic.com'],
    'img-src': assetSources,
    'media-src': assetSources,
    'connect-src': connectSources,
    'frame-src': ["'self'", 'https://js.stripe.com', 'https://checkout.stripe.com', 'https://accounts.google.com', 'https://www.facebook.com', 'https://appleid.apple.com', 'https://www.google.com', 'https://recaptcha.google.com', 'https://googleads.g.doubleclick.net', 'https://tpc.googlesyndication.com'],
    'worker-src': ["'self'", 'blob:'],
    'manifest-src': ["'self'"],
    'upgrade-insecure-requests': [],
  });
};

export const buildFrontendSecurityHeaders = (apiBaseUrl?: string) => [
  {
    key: 'Content-Security-Policy',
    value: buildFrontendContentSecurityPolicy(apiBaseUrl),
  },
  {
    key: 'Referrer-Policy',
    value: 'strict-origin-when-cross-origin',
  },
  {
    key: 'X-Content-Type-Options',
    value: 'nosniff',
  },
  {
    key: 'X-Frame-Options',
    value: 'DENY',
  },
  {
    key: 'Permissions-Policy',
    value: 'camera=(), microphone=(), geolocation=(), payment=(self "https://checkout.stripe.com")',
  },
  {
    key: 'Cross-Origin-Opener-Policy',
    value: 'same-origin-allow-popups',
  },
];

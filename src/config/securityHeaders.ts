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

export const buildFrontendContentSecurityPolicy = (apiBaseUrl?: string) => {
  const connectSources = [
    "'self'",
    'https://api.stripe.com',
    'https://checkout.stripe.com',
    'https://accounts.google.com',
    'https://www.googleapis.com',
    'https://www.google-analytics.com',
    'https://region1.google-analytics.com',
  ];

  if (apiBaseUrl) {
    try {
      const origin = new URL(apiBaseUrl).origin;
      if (!connectSources.includes(origin)) {
        connectSources.push(origin);
      }
    } catch {
      // Invalid env values are caught by production preflight; keep CSP usable.
    }
  }

  return joinPolicy({
    'default-src': ["'self'"],
    'base-uri': ["'self'"],
    'frame-ancestors': ["'none'"],
    'object-src': ["'none'"],
    'form-action': ["'self'", 'https://checkout.stripe.com', 'https://accounts.google.com'],
    'script-src': ["'self'", "'unsafe-inline'", "'unsafe-eval'", 'https://js.stripe.com', 'https://checkout.stripe.com', 'https://accounts.google.com', 'https://www.googletagmanager.com', 'https://www.google-analytics.com'],
    'style-src': ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
    'font-src': ["'self'", 'data:', 'https://fonts.gstatic.com'],
    'img-src': ["'self'", 'data:', 'blob:', 'https:'],
    'media-src': ["'self'", 'data:', 'blob:', 'https:'],
    'connect-src': connectSources,
    'frame-src': ["'self'", 'https://js.stripe.com', 'https://checkout.stripe.com', 'https://accounts.google.com'],
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

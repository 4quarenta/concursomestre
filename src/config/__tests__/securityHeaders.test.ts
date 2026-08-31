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

import { afterEach, describe, expect, it, vi } from 'vitest';
import { buildFrontendContentSecurityPolicy, buildFrontendSecurityHeaders } from '../securityHeaders';

describe('frontend security headers', () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('builds clickjacking and MIME sniffing protections', () => {
    const headers = buildFrontendSecurityHeaders('https://api.concursomestre.com/api');

    expect(headers).toEqual(expect.arrayContaining([
      { key: 'X-Frame-Options', value: 'DENY' },
      { key: 'X-Content-Type-Options', value: 'nosniff' },
      { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
    ]));
  });

  it('allows required Stripe and Google surfaces while blocking frame ancestors', () => {
    const csp = buildFrontendContentSecurityPolicy('https://api.concursomestre.com/api');

    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain('https://checkout.stripe.com');
    expect(csp).toContain('https://hooks.stripe.com');
    expect(csp).toContain('https://m.stripe.com');
    expect(csp).toContain('https://m.stripe.network');
    expect(csp).toContain('https://accounts.google.com');
    expect(csp).toContain('https://connect.facebook.net');
    expect(csp).toContain('https://appleid.cdn-apple.com');
    expect(csp).toContain('https://graph.facebook.com');
    expect(csp).toContain('https://appleid.apple.com');
    expect(csp).toContain('https://www.google.com');
    expect(csp).toContain('https://www.gstatic.com');
    expect(csp).toContain('https://*.adtrafficquality.google');
    expect(csp).toMatch(/script-src [^;]*blob:/);
    expect(csp).toMatch(/script-src-elem [^;]*blob:/);
    expect(csp).toContain('https://api.concursomestre.com');
  });

  it('keeps local API access available in non-production fallback mode', () => {
    const csp = buildFrontendContentSecurityPolicy();

    expect(csp).toContain('connect-src');
    expect(csp).toContain('http://localhost');
    expect(csp).toContain('http://127.0.0.1');
  });

  it('allows profile and uploaded assets from the configured API origin', () => {
    const csp = buildFrontendContentSecurityPolicy('http://localhost/questao-pro-backend/api/');

    expect(csp).toContain("img-src 'self' data: blob: https: http://localhost");
    expect(csp).toContain("media-src 'self' data: blob: https: http://localhost");
  });

  it('removes development-only script privileges and local API origins in production', () => {
    vi.stubEnv('NODE_ENV', 'production');

    const csp = buildFrontendContentSecurityPolicy('https://api.concursomestre.com/api');

    expect(csp).not.toContain("'unsafe-eval'");
    expect(csp).not.toContain('http://localhost');
    expect(csp).not.toContain('http://127.0.0.1');
    expect(csp).toContain('https://www.google.com');
    expect(csp).toContain('https://www.gstatic.com');
  });
});

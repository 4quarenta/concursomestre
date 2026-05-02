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

import { describe, expect, it } from 'vitest';
import { buildFrontendContentSecurityPolicy, buildFrontendSecurityHeaders } from '../securityHeaders';

describe('frontend security headers', () => {
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
    expect(csp).toContain('https://accounts.google.com');
    expect(csp).toContain('https://api.concursomestre.com');
  });
});

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
import { resolveCanonicalAuthRedirectPath } from '../canonicalAuthRedirect';

describe('resolveCanonicalAuthRedirectPath', () => {
  it('redirects legacy activation alias with generic token to confirm-email', () => {
    const redirectPath = resolveCanonicalAuthRedirectPath('/activate', {
      token: 'abc123',
    });

    expect(redirectPath).toBe('/confirm-email?token=abc123');
  });

  it('redirects reset mode from root to reset-password with email', () => {
    const redirectPath = resolveCanonicalAuthRedirectPath('/', {
      mode: 'reset-password',
      token: 'token-xyz',
      email: 'user@example.com',
    });

    expect(redirectPath).toBe('/reset-password?token=token-xyz&email=user%40example.com');
  });

  it('redirects verification by action and custom verification token key', () => {
    const redirectPath = resolveCanonicalAuthRedirectPath('/', {
      action: 'confirm_email',
      verification_code: 'verification-001',
    });

    expect(redirectPath).toBe('/confirm-email?token=verification-001');
  });

  it('returns fallback reset route for reset aliases without token', () => {
    const redirectPath = resolveCanonicalAuthRedirectPath('/recover', {});
    expect(redirectPath).toBe('/reset-password');
  });

  it('returns null for non-auth routes', () => {
    const redirectPath = resolveCanonicalAuthRedirectPath('/dashboard', { token: 'x' });
    expect(redirectPath).toBeNull();
  });
});

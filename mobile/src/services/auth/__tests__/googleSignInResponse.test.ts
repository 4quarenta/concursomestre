import { describe, expect, it } from 'vitest';
import { readGoogleSignInResponse } from '../googleSignInResponse';

describe('readGoogleSignInResponse', () => {
  it('keeps an initial One Tap dismissal silent', () => {
    expect(readGoogleSignInResponse({ type: 'cancelled' }, false)).toBeNull();
  });

  it('surfaces a cancelled explicit account picker with actionable OAuth guidance', () => {
    expect(() => readGoogleSignInResponse({ type: 'cancelled' }, true))
      .toThrow(/configuração OAuth Android.*SHA-1/i);
  });

  it('returns the ID token and Google profile to prefill account creation', () => {
    expect(readGoogleSignInResponse({
      type: 'success',
      data: { idToken: '  test-id-token  ', user: { name: 'Joana Silva', email: 'joana@example.com' } },
    }, true)).toEqual({
      credential: 'test-id-token',
      name: 'Joana Silva',
      email: 'joana@example.com',
    });
  });

  it('rejects success responses without an ID token', () => {
    expect(() => readGoogleSignInResponse({ type: 'success', data: { idToken: null } }, true))
      .toThrow(/não retornou o ID token/i);
  });
});

import { describe, expect, it } from 'vitest';
import { hasInvalidGoogleClientIdCandidate, normalizeGoogleClientId } from '../googleAuth';

describe('Google auth configuration', () => {
  it('accepts valid OAuth web client IDs', () => {
    expect(normalizeGoogleClientId(' 1234567890-abc_DEF-123.apps.googleusercontent.com ')).toBe(
      '1234567890-abc_DEF-123.apps.googleusercontent.com',
    );
  });

  it('rejects placeholders and malformed client IDs', () => {
    expect(normalizeGoogleClientId('google-client-id')).toBe('');
    expect(normalizeGoogleClientId('1234567890.apps.googleusercontent.com')).toBe('');
    expect(hasInvalidGoogleClientIdCandidate('google-client-id')).toBe(true);
  });

  it('does not report missing optional configuration as invalid', () => {
    expect(hasInvalidGoogleClientIdCandidate('', null, undefined)).toBe(false);
  });
});

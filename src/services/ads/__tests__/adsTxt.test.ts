import { describe, expect, it } from 'vitest';
import { buildGoogleAdsTxtFallback, validateAdsTxtContent } from '../adsTxt';

describe('ads.txt', () => {
  it('normalizes valid records and comments', () => {
    expect(validateAdsTxtContent([
      '# ConcursoMestre',
      'google.com, pub-7995648525529106, DIRECT, f08c47fec0942fa0',
      'OWNERDOMAIN=concursomestre.com',
    ].join('\r\n'))).toEqual({
      content: [
        '# ConcursoMestre',
        'google.com, pub-7995648525529106, DIRECT, f08c47fec0942fa0',
        'OWNERDOMAIN=concursomestre.com',
        '',
      ].join('\n'),
      invalidLines: [],
    });
  });

  it('removes invalid lines from the public content', () => {
    expect(validateAdsTxtContent([
      '<script>alert(1)</script>',
      'google.com, pub-7995648525529106, DIRECT, f08c47fec0942fa0',
      'invalid, record',
    ].join('\n'))).toEqual({
      content: 'google.com, pub-7995648525529106, DIRECT, f08c47fec0942fa0\n',
      invalidLines: [
        { lineNumber: 1, value: '<script>alert(1)</script>' },
        { lineNumber: 3, value: 'invalid, record' },
      ],
    });
  });

  it('builds the standard Google fallback from a valid AdSense account', () => {
    expect(buildGoogleAdsTxtFallback('ca-pub-7995648525529106'))
      .toBe('google.com, pub-7995648525529106, DIRECT, f08c47fec0942fa0\n');
    expect(buildGoogleAdsTxtFallback('invalid')).toBe('');
  });
});

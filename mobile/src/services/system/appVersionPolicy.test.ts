import { describe, expect, it } from 'vitest';
import { compareAppVersions, isAppVersionBelow } from './appVersionPolicy';

describe('mobile app version policy', () => {
  it('compares numeric semantic versions instead of lexicographic strings', () => {
    expect(compareAppVersions('1.10.0', '1.9.0')).toBe(1);
    expect(compareAppVersions('2.0.0', '2.0.0')).toBe(0);
    expect(isAppVersionBelow('1.0.9', '1.1.0')).toBe(true);
  });

  it('fails open for empty or malformed versions', () => {
    expect(isAppVersionBelow('', '1.1.0')).toBe(false);
    expect(isAppVersionBelow('1.x.0', '1.1.0')).toBe(false);
  });
});

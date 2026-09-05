import { describe, expect, it } from 'vitest';
import { resolveApiResourceUrl } from '../client';

describe('resolveApiResourceUrl', () => {
  it('normalizes duplicated public upload prefixes', () => {
    expect(resolveApiResourceUrl('/uploads/uploads/profiles/avatar.png'))
      .toBe('https://concursomestre.com/uploads/profiles/avatar.png');
  });

  it('keeps canonical upload paths unchanged', () => {
    expect(resolveApiResourceUrl('/uploads/profiles/avatar.png'))
      .toBe('https://concursomestre.com/uploads/profiles/avatar.png');
  });
});

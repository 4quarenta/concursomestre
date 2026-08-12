import { describe, expect, it } from 'vitest';

import { isSupportCategoryEnabled } from '../supportFeature';

describe('support category feature gate', () => {
  it('keeps regular support categories available', () => {
    expect(isSupportCategoryEnabled('bug', false)).toBe(true);
    expect(isSupportCategoryEnabled('feedback', false)).toBe(true);
    expect(isSupportCategoryEnabled('info', false)).toBe(true);
  });

  it('hides donations when the admin setting is disabled', () => {
    expect(isSupportCategoryEnabled('donation', false)).toBe(false);
    expect(isSupportCategoryEnabled('donation', true)).toBe(true);
  });
});


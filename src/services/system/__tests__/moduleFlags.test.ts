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
import { resolveSystemFeatureFlag } from '../moduleFlags';

describe('resolveSystemFeatureFlag', () => {
  it('prioritizes nested feature flags when present', () => {
    expect(resolveSystemFeatureFlag({
      features: {
        annotatedLawsEnabled: false,
      },
      annotatedLawsEnabled: true,
    } as any, 'annotatedLawsEnabled')).toBe(false);
  });

  it('falls back to flat aliases when nested feature flags are absent', () => {
    expect(resolveSystemFeatureFlag({
      flashcardsEnabled: false,
    } as any, 'flashcardsEnabled')).toBe(false);
  });

  it('keeps fallback when value is not defined in any payload shape', () => {
    expect(resolveSystemFeatureFlag({} as any, 'rankingsEnabled', true)).toBe(true);
    expect(resolveSystemFeatureFlag({} as any, 'rankingsEnabled', false)).toBe(false);
  });
});

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
import type { SystemSettings } from '@types';
import { resolveSystemFeatureFlag } from '../moduleFlags';

const asSystemSettingsPatch = (settings: Record<string, unknown>) => settings as Partial<SystemSettings>;

describe('resolveSystemFeatureFlag', () => {
  it('prioritizes nested feature flags when present', () => {
    expect(resolveSystemFeatureFlag(asSystemSettingsPatch({
      features: {
        annotatedLawsEnabled: false,
      },
      annotatedLawsEnabled: true,
    }), 'annotatedLawsEnabled')).toBe(false);
  });

  it('falls back to flat aliases when nested feature flags are absent', () => {
    expect(resolveSystemFeatureFlag(asSystemSettingsPatch({
      flashcardsEnabled: false,
    }), 'flashcardsEnabled')).toBe(false);
  });

  it('keeps fallback when value is not defined in any payload shape', () => {
    expect(resolveSystemFeatureFlag(asSystemSettingsPatch({}), 'rankingsEnabled', true)).toBe(true);
    expect(resolveSystemFeatureFlag(asSystemSettingsPatch({}), 'rankingsEnabled', false)).toBe(false);
  });
});

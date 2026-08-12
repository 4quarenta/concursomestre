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
import {
  getModuleFeatureKeyForPath,
  isModulePathEnabled,
  resolveSystemFeatureFlag,
} from '../moduleFlags';

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

describe('module path visibility', () => {
  it('maps module routes and nested pages to their canonical feature flag', () => {
    expect(getModuleFeatureKeyForPath('/lei-comentada')).toBe('annotatedLawsEnabled');
    expect(getModuleFeatureKeyForPath('/lei-comentada/codigo-penal?tab=1')).toBe('annotatedLawsEnabled');
    expect(getModuleFeatureKeyForPath('/simulation/new')).toBe('simulationsEnabled');
    expect(getModuleFeatureKeyForPath('/support')).toBeNull();
  });

  it('hides every link of a disabled module and keeps unrelated links visible', () => {
    const settings = asSystemSettingsPatch({
      features: {
        annotatedLawsEnabled: false,
        simulationsEnabled: false,
      },
    });

    expect(isModulePathEnabled(settings, '/lei-comentada')).toBe(false);
    expect(isModulePathEnabled(settings, '/lei-comentada/codigo-penal')).toBe(false);
    expect(isModulePathEnabled(settings, '/simulation')).toBe(false);
    expect(isModulePathEnabled(settings, '/support')).toBe(true);
    expect(isModulePathEnabled({}, '/lei-comentada', false)).toBe(false);
  });
});

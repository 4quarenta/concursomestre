import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { isModulePathEnabled, getModuleFeatureKeyForPath } from '@services/system/moduleFlags';
import { resolveQuestionCollectionRouteCompatibility } from '../questionRouteCompatibility';

describe('question route compatibility', () => {
  it.each(['/practice', '/questions', '/questoes'])('applies the same login, plan, module and tracking contract to %s', (pathname) => {
    const compatibility = resolveQuestionCollectionRouteCompatibility(pathname);
    expect(compatibility).toEqual({
      requiresGlobalLoginWhenEnabled: true,
      allowsPublicServerRender: true,
      featureKey: 'practiceEnabled',
      featureLabel: 'Questoes',
      planBenefitKeys: ['module.practice'],
      planCopyKey: 'module.practice',
      planLabel: 'Prática de questões',
      studyMode: 'practice',
      heavyNotificationBootstrap: true,
    });
    expect(getModuleFeatureKeyForPath(pathname)).toBe('practiceEnabled');
    expect(isModulePathEnabled({ features: { practiceEnabled: false } }, pathname)).toBe(false);
  });

  it('does not apply practice plan gates to the public question detail route', () => {
    expect(resolveQuestionCollectionRouteCompatibility('/questoes/123/exemplo')).toBeNull();
    expect(getModuleFeatureKeyForPath('/questoes/123/exemplo')).toBeNull();
  });

  it('keeps all route-sensitive providers wired to the shared compatibility policy', () => {
    const root = process.cwd();
    for (const file of ['NextRouteFrame.tsx', 'StudyTrackerProvider.tsx', 'NotificationsProvider.tsx']) {
      const source = fs.readFileSync(path.join(root, 'src', 'providers', file), 'utf8');
      expect(source).toContain('resolveQuestionCollectionRouteCompatibility');
    }
  });
});

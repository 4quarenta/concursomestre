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
    for (const file of ['NextRouteFrame.tsx', 'StudyTrackerProvider.tsx']) {
      const source = fs.readFileSync(path.join(root, 'src', 'providers', file), 'utf8');
      expect(source).toContain('resolveQuestionCollectionRouteCompatibility');
    }
  });

  it('loads notifications on demand instead of globally polling', () => {
    const root = process.cwd();
    const provider = fs.readFileSync(path.join(root, 'src', 'providers', 'NotificationsProvider.tsx'), 'utf8');
    const layout = fs.readFileSync(path.join(root, 'src', 'components', 'shared', 'layout', 'Layout.tsx'), 'utf8');

    expect(provider).toContain('refreshNotifications');
    expect(provider).not.toContain('createVisibilityAwarePoller');
    expect(provider).not.toContain('setInterval(');
    expect(layout).toContain("href: '/notifications'");
    expect(layout).toContain('void refreshNotifications(true)');
    expect(layout).not.toContain('aria-label="Abrir notificações"');
  });
});

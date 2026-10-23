import { describe, expect, it } from 'vitest';
import { resolveNavigationSkeletonVariant } from '../navigationSkeletonRoute';

describe('resolveNavigationSkeletonVariant', () => {
  it.each([
    ['/dashboard', 'dashboard'],
    ['/questoes', 'questions'],
    ['/provas', 'exams'],
    ['/simulation', 'simulations'],
    ['/x-ray', 'xray'],
    ['/cronograma', 'schedule'],
    ['/profile/billing', 'profile'],
    ['/notifications', 'notifications'],
    ['/support', 'support'],
    ['/blog', 'editorial'],
    ['/bancas', 'directory'],
  ])('maps %s to its content skeleton', (pathname, variant) => {
    expect(resolveNavigationSkeletonVariant(pathname)).toBe(variant);
  });

  it('leaves routes without an implemented page skeleton unchanged', () => {
    expect(resolveNavigationSkeletonVariant('/auth')).toBeNull();
  });
});

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { resolveQuestionCollectionRouteCompatibility } from '../questionRouteCompatibility';

describe('NextAppProviders SSR boundary', () => {
  it('does not hide every server-rendered route behind a global Suspense fallback', () => {
    const source = readFileSync(resolve(process.cwd(), 'src/providers/NextAppProviders.tsx'), 'utf8');

    expect(source).toContain('<NextRouteFrame>{children}</NextRouteFrame>');
    expect(source).not.toContain('<Suspense');
    expect(source).not.toContain('AppShellFallback');
  });

  it('keeps public study routes renderable while authentication is bootstrapping', () => {
    const source = readFileSync(resolve(process.cwd(), 'src/providers/NextRouteFrame.tsx'), 'utf8');

    expect(source).toContain('resolveQuestionCollectionRouteCompatibility(pathname)');
    expect(resolveQuestionCollectionRouteCompatibility('/practice')?.allowsPublicServerRender).toBe(true);
    expect(resolveQuestionCollectionRouteCompatibility('/questoes')?.allowsPublicServerRender).toBe(true);
    expect(source).toContain("pathname.startsWith('/lei-comentada')");
    expect(source).toContain("pathname.startsWith('/support')");
    expect(source).toContain('!isPublicServerRenderRoute && (');
    expect(source).toContain('!(isLoading && isPublicServerRenderRoute)');
  });
});

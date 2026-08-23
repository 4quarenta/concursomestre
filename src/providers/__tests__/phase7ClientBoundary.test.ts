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
import { readFileSync } from 'node:fs';

const read = (path: string) => readFileSync(path, 'utf8');

describe('Phase 7 public client boundaries', () => {
  it('keeps study tracking outside the anonymous public startup bundle', () => {
    const source = read('src/providers/NextRouteFrame.tsx');
    expect(source).toContain("import('./StudyTrackerProvider')");
    expect(source).toContain('{currentUser ? <StudyTrackerBridge /> : null}');
    expect(source).not.toMatch(/import\s+\{\s*StudyTrackerBridge\s*\}\s+from/);
  });

  it('loads subscription checkout code only after the payment action', () => {
    const source = read('src/providers/NextRouteFrame.tsx');
    const planService = read('src/services/plans/planService.ts');
    expect(source).toContain("await import('@/services/subscriptions')");
    expect(source).not.toMatch(/import\s+\{\s*subscriptionsService\s*\}\s+from/);
    expect(planService).toContain("await import('@services/subscriptions')");
    expect(planService).not.toMatch(/import\s+\{\s*subscriptionsService\s*\}\s+from/);
  });

  it('does not preload both responsive shell logos', () => {
    const layout = read('src/components/shared/layout/Layout.tsx');
    const blogHeader = read('src/app/blog/BlogHeader.tsx');
    expect(layout).not.toMatch(/<PublicBrandLink[^>]*\bpriority\b/);
    expect(blogHeader).not.toMatch(/<BrandLogo[^>]*\bpriority\b/);
  });
});

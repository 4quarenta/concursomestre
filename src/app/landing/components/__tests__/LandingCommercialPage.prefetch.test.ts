import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const componentPath = resolve(
  process.cwd(),
  'src/app/landing/components/LandingCommercialPage.tsx',
);

describe('LandingCommercialPage navigation', () => {
  it('does not schedule automatic RSC prefetches for visible marketing links', () => {
    const source = readFileSync(componentPath, 'utf8');
    const linkCount = (source.match(/<Link\b/g) || []).length;
    const noPrefetchCount = (source.match(/prefetch=\{false\}/g) || []).length;

    expect(linkCount).toBeGreaterThan(0);
    expect(noPrefetchCount).toBeGreaterThanOrEqual(linkCount);
  });
});

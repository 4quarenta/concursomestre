import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { metadata } from './page';

describe('canonical public search route', () => {
  it('is permanently noindex with a clean self canonical', () => {
    expect(metadata.alternates?.canonical).toBe('/busca');
    expect(metadata.robots).toMatchObject({ index: false, follow: false });
  });

  it('keeps the practice-only provider local to the search route', () => {
    const layout = readFileSync(resolve(process.cwd(), 'src/app/busca/layout.tsx'), 'utf8');
    expect(layout).toContain('MarketplaceProvider');
  });
});

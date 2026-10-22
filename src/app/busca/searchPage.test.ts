import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { metadata } from './page';

describe('canonical public search route', () => {
  it('is permanently noindex with a clean self canonical', () => {
    expect(metadata.alternates?.canonical).toBe('/busca');
    expect(metadata.robots).toMatchObject({ index: false, follow: false });
  });

  it('keeps the route mounted in the platform app provider', () => {
    const layout = readFileSync(resolve(process.cwd(), 'src/app/busca/layout.tsx'), 'utf8');
    expect(layout).toContain('MarketplaceProvider');
  });

  it('searches across the public content categories', () => {
    const source = readFileSync(resolve(process.cwd(), 'src/app/busca/globalSearchServerData.ts'), 'utf8');
    for (const category of ['questions', 'exams', 'news', 'subjects', 'topics', 'boards', 'organizations', 'contests', 'materials', 'simulations']) {
      expect(source).toContain(`${category}Result`);
    }
  });
});

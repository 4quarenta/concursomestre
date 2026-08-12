import fs from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

const practiceSource = fs.readFileSync(
  path.resolve(process.cwd(), 'src/app/practice/PracticeClient.tsx'),
  'utf8',
);

describe('practice mobile question navigation', () => {
  it('keeps the counter above two equal navigation columns on mobile', () => {
    expect(practiceSource).toContain('aria-label="Navegação entre questões"');
    expect(practiceSource).toContain('grid grid-cols-2');
    expect(practiceSource).toContain('col-span-2 col-start-1 row-start-1');
    expect(practiceSource).toContain('col-start-1 row-start-2');
    expect(practiceSource).toContain('col-start-2 row-start-2');
  });

  it('restores a single-row layout on larger screens', () => {
    expect(practiceSource).toContain('sm:grid-cols-[auto_minmax(0,1fr)_auto]');
    expect(practiceSource).toContain('sm:col-start-2');
    expect(practiceSource).toContain('sm:col-start-3 sm:row-start-1');
  });
});


import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  GRAN_LAST_YEAR_STORAGE_KEY,
  persistGranCrawlerYearPreference,
} from '../granCrawlerYearPreference';

const crawlerSource = fs.readFileSync(
  path.resolve(process.cwd(), 'src/app/admin/components/import/AdminGranCrawlerSection.tsx'),
  'utf8',
);

describe('persistGranCrawlerYearPreference', () => {
  it('persists automatic year advancement and completion', () => {
    const values = new Map<string, string>();
    const storage = { setItem: (key: string, value: string) => values.set(key, value) };

    persistGranCrawlerYearPreference(2003, storage);
    persistGranCrawlerYearPreference(2026, storage);

    expect(values.get(GRAN_LAST_YEAR_STORAGE_KEY)).toBe('2026');
  });

  it('does not overwrite a valid year with an invalid value', () => {
    const values = new Map<string, string>();
    const storage = { setItem: (key: string, value: string) => values.set(key, value) };

    persistGranCrawlerYearPreference(2003, storage);
    persistGranCrawlerYearPreference(1898, storage);

    expect(values.get(GRAN_LAST_YEAR_STORAGE_KEY)).toBe('2003');
  });

  it('persists the advanced year and the final year in the automatic flow', () => {
    expect(crawlerSource).toContain('persistGranCrawlerYearPreference(cursorYear)');
    expect(crawlerSource).toContain('persistGranCrawlerYearPreference(completedYear)');
    expect(crawlerSource).toContain('setYear(String(completedYear))');
  });
});

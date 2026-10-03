export const GRAN_LAST_YEAR_STORAGE_KEY = 'admin.granCrawler.lastYear';

export const persistGranCrawlerYearPreference = (
  year: number,
  storage?: Pick<Storage, 'setItem'>,
) => {
  if (!Number.isInteger(year) || year < 1900 || year > 2200) return;

  try {
    const targetStorage = storage ?? (typeof window !== 'undefined' ? window.localStorage : null);
    targetStorage?.setItem(GRAN_LAST_YEAR_STORAGE_KEY, String(year));
  } catch {
    // A preferência é opcional; o checkpoint do servidor continua autoritativo durante a coleta.
  }
};

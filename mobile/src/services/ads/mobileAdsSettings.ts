export const normalizeMobileAdsEnabled = (payload: Record<string, unknown>): boolean => {
  const advertising = payload.advertising && typeof payload.advertising === 'object'
    ? payload.advertising as Record<string, unknown>
    : {};
  const value = advertising.mobileAdsEnabled ?? payload.mobileAdsEnabled;

  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;
  if (typeof value === 'string') {
    const normalized = value.trim().toLowerCase();
    if (['1', 'true', 'yes', 'on'].includes(normalized)) return true;
    if (['0', 'false', 'no', 'off', ''].includes(normalized)) return false;
  }

  return true;
};

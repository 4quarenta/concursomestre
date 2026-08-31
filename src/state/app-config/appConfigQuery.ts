export type SystemSettingsQueryMode = 'public' | 'admin';

export const buildSystemSettingsQueryKey = (mode: SystemSettingsQueryMode) => (
  ['system-settings', mode] as const
);

export default buildSystemSettingsQueryKey;

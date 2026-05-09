'use client';

import { create } from 'zustand';
import type { SystemSettings } from '@types';
import {
  DEFAULT_SYSTEM_SETTINGS,
  mergeSystemSettings,
} from './systemSettings';

interface AppConfigState {
  systemSettings: SystemSettings;
  isSystemSettingsLoaded: boolean;
  replaceSystemSettings: (settings: SystemSettings) => void;
  mergeSystemSettings: (settings: Partial<SystemSettings> | SystemSettings) => void;
  setSystemSettingsLoaded: (isLoaded: boolean) => void;
  resetAppConfig: () => void;
}

/**
 * Store global de configuracao do app.
 * Ele passa a ser a fonte oficial de settings, tirando essa responsabilidade do DataProvider.
 *
 * @since 1.0.0
 */
export const useAppConfigStore = create<AppConfigState>((set) => ({
  systemSettings: DEFAULT_SYSTEM_SETTINGS,
  isSystemSettingsLoaded: false,
  replaceSystemSettings: (settings) => set({ systemSettings: settings }),
  mergeSystemSettings: (settings) => set((state) => ({
    systemSettings: mergeSystemSettings(state.systemSettings, settings),
  })),
  setSystemSettingsLoaded: (isLoaded) => set({ isSystemSettingsLoaded: isLoaded }),
  resetAppConfig: () => set({
    systemSettings: DEFAULT_SYSTEM_SETTINGS,
    isSystemSettingsLoaded: false,
  }),
}));

export default useAppConfigStore;

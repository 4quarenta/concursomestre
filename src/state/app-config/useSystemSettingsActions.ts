'use client';

import { useCallback, useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { SystemSettings } from '@types';
import { adminService } from '@services/admin/adminService';
import { useToast } from '@providers/ToastProvider';
import { useAppConfigStore } from './appConfigStore';
import { buildSystemSettingsQueryKey } from './appConfigQuery';
import {
  mergeSystemSettings,
  resolvePersistedSystemSettings,
} from './systemSettings';

/**
 * System settings actions backed by Zustand + TanStack Query.
 * It keeps admin settings mutations out of DataProvider.
 *
 * @since 1.0.0
 */
export const useSystemSettingsActions = () => {
  const queryClient = useQueryClient();
  const { addToast } = useToast();

  const systemSettings = useAppConfigStore((store) => store.systemSettings);
  const isSystemSettingsLoaded = useAppConfigStore((store) => store.isSystemSettingsLoaded);
  const replaceSystemSettings = useAppConfigStore((store) => store.replaceSystemSettings);

  const settingsSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingSystemSettingsRef = useRef<SystemSettings | null>(null);
  const isSavingSystemSettingsRef = useRef(false);
  const lastSavedSystemSettingsRef = useRef<SystemSettings>(systemSettings);

  useEffect(() => {
    lastSavedSystemSettingsRef.current = systemSettings;
  }, [systemSettings]);

  const flushSystemSettingsSave = useCallback(async () => {
    const nextSettings = pendingSystemSettingsRef.current;
    if (!nextSettings) return;

    if (isSavingSystemSettingsRef.current) {
      return;
    }

    isSavingSystemSettingsRef.current = true;
    pendingSystemSettingsRef.current = null;

    try {
      const persistedSettings = await adminService.saveSystemSettings(nextSettings);
      const officialSettings = resolvePersistedSystemSettings(nextSettings, persistedSettings);

      lastSavedSystemSettingsRef.current = officialSettings;
      replaceSystemSettings(officialSettings);
      queryClient.setQueryData(buildSystemSettingsQueryKey('admin'), persistedSettings);
      void queryClient.invalidateQueries({ queryKey: buildSystemSettingsQueryKey('public') });
    } catch (error) {
      console.error('Failed to persist system settings:', error);
      replaceSystemSettings(lastSavedSystemSettingsRef.current);
      addToast('Erro ao salvar configuracoes. As alteracoes nao foram persistidas.', 'error');
      throw error;
    } finally {
      isSavingSystemSettingsRef.current = false;
      if (pendingSystemSettingsRef.current) {
        void flushSystemSettingsSave();
      }
    }
  }, [addToast, queryClient, replaceSystemSettings]);

  const updateSystemSettings = useCallback((payload: SystemSettings) => {
    const nextSettings = mergeSystemSettings(systemSettings, payload);
    replaceSystemSettings(nextSettings);
    pendingSystemSettingsRef.current = nextSettings;

    if (settingsSaveTimerRef.current) {
      clearTimeout(settingsSaveTimerRef.current);
    }

    settingsSaveTimerRef.current = setTimeout(() => {
      void flushSystemSettingsSave();
    }, 450);
  }, [flushSystemSettingsSave, replaceSystemSettings, systemSettings]);

  const saveSystemSettingsNow = useCallback(async (payload?: SystemSettings) => {
    const requestedSettings = payload ?? pendingSystemSettingsRef.current ?? systemSettings;
    const nextSettings = mergeSystemSettings(systemSettings, requestedSettings);

    if (settingsSaveTimerRef.current) {
      clearTimeout(settingsSaveTimerRef.current);
      settingsSaveTimerRef.current = null;
    }

    pendingSystemSettingsRef.current = null;

    if (isSavingSystemSettingsRef.current) {
      pendingSystemSettingsRef.current = nextSettings;
      while (isSavingSystemSettingsRef.current || pendingSystemSettingsRef.current) {
        await new Promise((resolve) => setTimeout(resolve, 25));
      }
      return lastSavedSystemSettingsRef.current;
    }

    isSavingSystemSettingsRef.current = true;

    try {
      const persistedSettings = await adminService.saveSystemSettings(nextSettings);
      const officialSettings = resolvePersistedSystemSettings(nextSettings, persistedSettings);
      lastSavedSystemSettingsRef.current = officialSettings;
      replaceSystemSettings(officialSettings);
      queryClient.setQueryData(buildSystemSettingsQueryKey('admin'), persistedSettings);
      void queryClient.invalidateQueries({ queryKey: buildSystemSettingsQueryKey('public') });
      return officialSettings;
    } catch (error) {
      console.error('Failed to persist system settings immediately:', error);
      replaceSystemSettings(lastSavedSystemSettingsRef.current);
      addToast('Erro ao salvar configuracoes. As alteracoes nao foram persistidas.', 'error');
      throw error;
    } finally {
      isSavingSystemSettingsRef.current = false;
      if (pendingSystemSettingsRef.current) {
        void flushSystemSettingsSave();
      }
    }
  }, [addToast, flushSystemSettingsSave, queryClient, replaceSystemSettings, systemSettings]);

  useEffect(() => () => {
    if (settingsSaveTimerRef.current) {
      clearTimeout(settingsSaveTimerRef.current);
      settingsSaveTimerRef.current = null;
    }
  }, []);

  return {
    systemSettings,
    isSystemSettingsLoaded,
    updateSystemSettings,
    saveSystemSettingsNow,
  };
};

export default useSystemSettingsActions;

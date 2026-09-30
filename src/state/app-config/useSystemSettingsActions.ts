'use client';

import { useCallback, useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import type { SystemSettings } from '@types';
import { adminService } from '@services/admin/adminService';
import { readApiErrorMessage } from '@services/api';
import { useToast } from '@providers/ToastProvider';
import { useAppConfigStore } from './appConfigStore';
import { buildSystemSettingsQueryKey } from './appConfigQuery';
import {
  mergeSystemSettings,
  resolvePersistedSystemSettings,
} from './systemSettings';
import { clientLog } from '@services/monitoring/clientLog';

/**
 * System settings actions backed by Zustand + TanStack Query.
 * It keeps admin settings mutations centralized in the app-config domain.
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
  const pendingSystemSettingsRef = useRef<Partial<SystemSettings> | null>(null);
  const isSavingSystemSettingsRef = useRef(false);
  const lastSavedSystemSettingsRef = useRef<SystemSettings>(systemSettings);

  useEffect(() => {
    lastSavedSystemSettingsRef.current = systemSettings;
  }, [systemSettings]);

  // eslint-disable-next-line react-hooks/preserve-manual-memoization -- callback reprocessa a fila pendente apos concluir o save atual.
  const flushSystemSettingsSave = useCallback(async () => {
    const settingsPatch = pendingSystemSettingsRef.current;
    if (!settingsPatch) return;

    if (isSavingSystemSettingsRef.current) {
      return;
    }

    isSavingSystemSettingsRef.current = true;
    pendingSystemSettingsRef.current = null;

    try {
      const optimisticSettings = mergeSystemSettings(lastSavedSystemSettingsRef.current, settingsPatch);
      const persistedSettings = await adminService.saveSystemSettings(settingsPatch);
      const officialSettings = resolvePersistedSystemSettings(optimisticSettings, persistedSettings);

      lastSavedSystemSettingsRef.current = officialSettings;
      replaceSystemSettings(officialSettings);
      queryClient.setQueryData(buildSystemSettingsQueryKey('admin'), persistedSettings);
      void queryClient.invalidateQueries({ queryKey: buildSystemSettingsQueryKey('public') });
    } catch (error) {
      clientLog.error('Failed to persist system settings:', error);
      replaceSystemSettings(lastSavedSystemSettingsRef.current);
      const message = readApiErrorMessage(error, 'Erro ao salvar configuracoes. As alteracoes nao foram persistidas.');
      addToast(message, 'error');
      throw new Error(message);
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
    pendingSystemSettingsRef.current = payload;

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
      pendingSystemSettingsRef.current = requestedSettings;
      while (isSavingSystemSettingsRef.current || pendingSystemSettingsRef.current) {
        await new Promise((resolve) => setTimeout(resolve, 25));
      }
      return lastSavedSystemSettingsRef.current;
    }

    isSavingSystemSettingsRef.current = true;

    try {
      const persistedSettings = await adminService.saveSystemSettings(requestedSettings);
      const officialSettings = resolvePersistedSystemSettings(nextSettings, persistedSettings);
      lastSavedSystemSettingsRef.current = officialSettings;
      replaceSystemSettings(officialSettings);
      queryClient.setQueryData(buildSystemSettingsQueryKey('admin'), persistedSettings);
      void queryClient.invalidateQueries({ queryKey: buildSystemSettingsQueryKey('public') });
      return officialSettings;
    } catch (error) {
      clientLog.error('Failed to persist system settings immediately:', error);
      replaceSystemSettings(lastSavedSystemSettingsRef.current);
      const message = readApiErrorMessage(error, 'Erro ao salvar configuracoes. As alteracoes nao foram persistidas.');
      addToast(message, 'error');
      throw new Error(message);
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

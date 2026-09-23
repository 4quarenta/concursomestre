'use client';

import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { usePathname } from 'next/navigation';
import { useAuth } from '@providers/AuthProvider';
import { adminService } from '@services/admin/adminService';
import { getAccessToken } from '@services/auth/session';
import { useAppConfigStore } from '@/state/app-config/appConfigStore';
import {
  DEFAULT_SYSTEM_SETTINGS,
  resolvePersistedSystemSettings,
} from '@/state/app-config/systemSettings';
import { buildSystemSettingsQueryKey } from '@/state/app-config/appConfigQuery';
import type { SystemSettings } from '@types';

interface AppConfigProviderProps {
  children: React.ReactNode;
  initialPublicSettings?: Record<string, unknown> | null;
}

const isAdminSettingsRole = (role?: string | null) => role === 'admin';
const ADMIN_PANEL_SETTINGS_DELAY_MS = 8_000;

const InitialPublicSettingsContext = React.createContext<SystemSettings | null>(null);

export const useEffectiveSystemSettings = () => {
  const initialSystemSettings = React.useContext(InitialPublicSettingsContext);
  const systemSettings = useAppConfigStore((state) => state.systemSettings);
  const isSystemSettingsLoaded = useAppConfigStore((state) => state.isSystemSettingsLoaded);

  return {
    systemSettings: isSystemSettingsLoaded
      ? systemSettings
      : (initialSystemSettings || systemSettings),
    isSystemSettingsLoaded: isSystemSettingsLoaded || initialSystemSettings !== null,
  };
};

/**
 * Bridge entre React Query e o store de configuracao.
 * Ele carrega settings publicas/admin conforme a sessao e hidrata o Zustand.
 *
 * @since 1.0.0
 */
export const AppConfigProvider: React.FC<AppConfigProviderProps> = ({ children, initialPublicSettings = null }) => {
  const { currentUser, isLoading: authIsLoading } = useAuth();
  const pathname = usePathname() || '/';
  const replaceSystemSettings = useAppConfigStore((state) => state.replaceSystemSettings);
  const setSystemSettingsLoaded = useAppConfigStore((state) => state.setSystemSettingsLoaded);

  const isAdminRoute = pathname.startsWith('/admin');
  const mode = isAdminSettingsRole(currentUser?.role) && isAdminRoute ? 'admin' : 'public';
  const shouldDeferAdminPanelSettingsBootstrap = pathname.startsWith('/admin/panel');
  const [canStartSettingsQuery, setCanStartSettingsQuery] = React.useState(
    () => !shouldDeferAdminPanelSettingsBootstrap,
  );
  const hasTokenInMemory = Boolean(getAccessToken());
  const shouldHoldPublicSettings = !authIsLoading && !currentUser && hasTokenInMemory;
  const resolvedInitialSystemSettings = React.useMemo(() => (
    initialPublicSettings
      ? resolvePersistedSystemSettings(DEFAULT_SYSTEM_SETTINGS, initialPublicSettings)
      : null
  ), [initialPublicSettings]);

  const canRunSettingsQuery = !authIsLoading && (
    Boolean(currentUser) || !shouldHoldPublicSettings
  );

  React.useEffect(() => {
    if (!shouldDeferAdminPanelSettingsBootstrap) {
      const frameId = window.requestAnimationFrame(() => {
        setCanStartSettingsQuery(true);
      });
      return () => {
        window.cancelAnimationFrame(frameId);
      };
    }

    const frameId = window.requestAnimationFrame(() => {
      setCanStartSettingsQuery(false);
    });
    const timeoutId = window.setTimeout(() => {
      setCanStartSettingsQuery(true);
    }, ADMIN_PANEL_SETTINGS_DELAY_MS);

    return () => {
      window.cancelAnimationFrame(frameId);
      window.clearTimeout(timeoutId);
    };
  }, [shouldDeferAdminPanelSettingsBootstrap]);

  const settingsQueryEnabled = React.useMemo(() => {
    if (!canRunSettingsQuery) {
      return false;
    }

    if (shouldDeferAdminPanelSettingsBootstrap && !canStartSettingsQuery) {
      return false;
    }

    return true;
  }, [canRunSettingsQuery, canStartSettingsQuery, shouldDeferAdminPanelSettingsBootstrap]);

  const systemSettingsQuery = useQuery({
    queryKey: buildSystemSettingsQueryKey(mode),
    queryFn: () => (
      mode === 'admin'
        ? adminService.getSystemSettings()
        : adminService.getPublicSystemSettings()
    ),
    enabled: settingsQueryEnabled,
    // Public campaign activation/deactivation must not remain stale for the
    // five-minute admin settings window. The server snapshot is only a
    // hydration fallback; the browser verifies the current public state.
    staleTime: mode === 'public' ? 0 : 5 * 60_000,
    refetchOnMount: mode === 'public' ? 'always' : true,
    initialData: mode === 'public' && initialPublicSettings ? initialPublicSettings : undefined,
  });

  React.useEffect(() => {
    if (!systemSettingsQuery.data) {
      return;
    }

    const nextSettings = resolvePersistedSystemSettings(DEFAULT_SYSTEM_SETTINGS, systemSettingsQuery.data);
    replaceSystemSettings(nextSettings);
    setSystemSettingsLoaded(true);
  }, [replaceSystemSettings, setSystemSettingsLoaded, systemSettingsQuery.data]);

  React.useEffect(() => {
    if (systemSettingsQuery.isError) {
      setSystemSettingsLoaded(true);
    }
  }, [setSystemSettingsLoaded, systemSettingsQuery.isError]);

  return (
    <InitialPublicSettingsContext.Provider value={resolvedInitialSystemSettings}>
      {children}
    </InitialPublicSettingsContext.Provider>
  );
};

export default AppConfigProvider;

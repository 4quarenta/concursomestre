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

interface AppConfigProviderProps {
  children: React.ReactNode;
}

const isAdminSettingsRole = (role?: string | null) => role === 'admin' || role === 'staff';
const ADMIN_PANEL_SETTINGS_DELAY_MS = 8_000;

/**
 * Bridge entre React Query e o store de configuracao.
 * Ele carrega settings publicas/admin conforme a sessao e hidrata o Zustand sem depender do DataProvider.
 *
 * @since 1.0.0
 */
export const AppConfigProvider: React.FC<AppConfigProviderProps> = ({ children }) => {
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
    staleTime: 5 * 60_000,
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

  return <>{children}</>;
};

export default AppConfigProvider;

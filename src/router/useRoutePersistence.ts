/*
* ----------------------------------------------------
* @author: 4quarenta
* @author URI: https://github.com/4quarenta
* @copyright: (c) 2026 ConcursoMestre. All rights reserved
* ----------------------------------------------------
*
* @since 1.0.0
*
*/

import React from 'react';
import type { Location, NavigateFunction } from 'react-router-dom';
import { buildAdminPath, resolveAdminRoute } from '../app/admin/config/adminPageNavigationConfig';

const LAST_STABLE_ROUTE_KEY = 'lastStableRoute';
const ROUTE_BEFORE_RELOAD_KEY = 'routeBeforeReload';

/**
 * Persiste e restaura a ultima rota valida do app quando um reload perde o hash.
 * Esse hook protege a navegacao para que o usuario continue na tela atual apos atualizar.
 * @since 1.0.0
 */
export const useRoutePersistence = (
  location: Location,
  navigate: NavigateFunction,
  isLoading: boolean,
): { isRestoringRoute: boolean; pendingPathname: string } => {
  const restoredLegacyHashRouteRef = React.useRef(false);
  const restoredReloadRouteRef = React.useRef(false);
  const currentRoute = `${location.pathname}${location.search}${location.hash}`;
  const currentPathname = location.pathname;
  const skipRouteRestore = Boolean((location.state as { skipRouteRestore?: boolean } | null)?.skipRouteRestore);
  const rawHash = window.location.hash || '';
  const isRootFallback = currentRoute === '/' && (!rawHash || rawHash === '#' || rawHash === '#/');

  const pendingLegacyPathname = React.useMemo(() => {
    if (!rawHash.startsWith('#/')) {
      return null;
    }

    const legacyRoute = rawHash.slice(1);
    if (!legacyRoute || legacyRoute === '/' || legacyRoute === '/auth') {
      return null;
    }

    if (legacyRoute.startsWith('/admin')) {
      const [legacyPath, legacyHash = ''] = legacyRoute.split('#');
      const [legacyPathname, legacySearch = ''] = legacyPath.split('?');
      const pathSegments = legacyPathname.split('/').filter(Boolean);
      const legacyParams = new URLSearchParams(legacySearch);
      const resolvedAdminRoute = resolveAdminRoute(
        pathSegments[1] || legacyParams.get('tab'),
        pathSegments[2] || legacyParams.get('section'),
      );

      return buildAdminPath(resolvedAdminRoute.tab, resolvedAdminRoute.section, legacyHash ? `#${legacyHash}` : '').split(/[?#]/)[0];
    }

    return legacyRoute.split(/[?#]/)[0] || null;
  }, [rawHash]);

  const pendingReloadPathname = React.useMemo(() => {
    if (!isRootFallback || skipRouteRestore) {
      return null;
    }

    const savedRoute = sessionStorage.getItem(ROUTE_BEFORE_RELOAD_KEY) || sessionStorage.getItem(LAST_STABLE_ROUTE_KEY);
    if (!savedRoute || savedRoute === '/' || savedRoute === '/auth') {
      return null;
    }

    return savedRoute.split(/[?#]/)[0] || null;
  }, [isRootFallback, skipRouteRestore]);

  const shouldRestoreLegacyHashRoute = React.useMemo(() => {
    if (restoredLegacyHashRouteRef.current || isLoading) {
      return false;
    }

    return Boolean(pendingLegacyPathname);
  }, [isLoading, pendingLegacyPathname]);

  const shouldRestoreReloadRoute = React.useMemo(() => {
    if (restoredReloadRouteRef.current || isLoading) {
      return false;
    }

    return Boolean(pendingReloadPathname);
  }, [isLoading, pendingReloadPathname]);

  /**
   * Converte URLs antigas em hash para o formato limpo do BrowserRouter.
   * Isso preserva links legados do admin e de outras areas sem redirecionar o usuario para a home.
   * @since 1.0.0
   */
  React.useLayoutEffect(() => {
    if (!shouldRestoreLegacyHashRoute) {
      return;
    }

    const legacyRoute = rawHash.slice(1);

    if (legacyRoute.startsWith('/admin')) {
      const [legacyPath, legacyHash = ''] = legacyRoute.split('#');
      const [legacyPathname, legacySearch = ''] = legacyPath.split('?');
      const pathSegments = legacyPathname.split('/').filter(Boolean);
      const legacyParams = new URLSearchParams(legacySearch);
      const resolvedAdminRoute = resolveAdminRoute(
        pathSegments[1] || legacyParams.get('tab'),
        pathSegments[2] || legacyParams.get('section'),
      );

      restoredLegacyHashRouteRef.current = true;
      navigate(buildAdminPath(resolvedAdminRoute.tab, resolvedAdminRoute.section, legacyHash ? `#${legacyHash}` : ''), { replace: true });
      return;
    }

    restoredLegacyHashRouteRef.current = true;
    navigate(legacyRoute, { replace: true });
  }, [navigate, rawHash, shouldRestoreLegacyHashRoute]);

  /**
   * Guarda a ultima rota estavel enquanto o usuario navega normalmente no app.
   * @since 1.0.0
   */
  React.useEffect(() => {
    sessionStorage.setItem(LAST_STABLE_ROUTE_KEY, currentRoute);
  }, [currentRoute]);

  /**
   * Persiste a rota atual imediatamente antes de reload ou fechamento da aba.
   * @since 1.0.0
   */
  React.useEffect(() => {
    const persistRouteBeforeReload = () => {
      sessionStorage.setItem(ROUTE_BEFORE_RELOAD_KEY, currentRoute);
    };

    window.addEventListener('beforeunload', persistRouteBeforeReload);
    window.addEventListener('pagehide', persistRouteBeforeReload);

    return () => {
      window.removeEventListener('beforeunload', persistRouteBeforeReload);
      window.removeEventListener('pagehide', persistRouteBeforeReload);
    };
  }, [currentRoute]);

  /**
   * Reidrata a ultima rota conhecida quando a app sobe na home por perda do hash.
   * @since 1.0.0
   */
  React.useLayoutEffect(() => {
    if (!shouldRestoreReloadRoute) {
      return;
    }

    const savedRoute = sessionStorage.getItem(ROUTE_BEFORE_RELOAD_KEY) || sessionStorage.getItem(LAST_STABLE_ROUTE_KEY);
    if (!savedRoute) {
      return;
    }

    restoredReloadRouteRef.current = true;
    navigate(savedRoute, { replace: true });
  }, [navigate, shouldRestoreReloadRoute]);

  return {
    isRestoringRoute: shouldRestoreLegacyHashRoute || shouldRestoreReloadRoute,
    pendingPathname: pendingLegacyPathname || pendingReloadPathname || currentPathname,
  };
};

export default useRoutePersistence;

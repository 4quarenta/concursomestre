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
) => {
  const restoredReloadRouteRef = React.useRef(false);

  /**
   * Guarda a ultima rota estavel enquanto o usuario navega normalmente no app.
   * @since 1.0.0
   */
  React.useEffect(() => {
    const stableRoute = `${location.pathname}${location.search}${location.hash}`;
    sessionStorage.setItem(LAST_STABLE_ROUTE_KEY, stableRoute);
  }, [location]);

  /**
   * Persiste a rota atual imediatamente antes de reload ou fechamento da aba.
   * @since 1.0.0
   */
  React.useEffect(() => {
    const persistRouteBeforeReload = () => {
      const currentRoute = `${location.pathname}${location.search}${location.hash}`;
      sessionStorage.setItem(ROUTE_BEFORE_RELOAD_KEY, currentRoute);
    };

    window.addEventListener('beforeunload', persistRouteBeforeReload);
    window.addEventListener('pagehide', persistRouteBeforeReload);

    return () => {
      window.removeEventListener('beforeunload', persistRouteBeforeReload);
      window.removeEventListener('pagehide', persistRouteBeforeReload);
    };
  }, [location]);

  /**
   * Reidrata a ultima rota conhecida quando a app sobe na home por perda do hash.
   * @since 1.0.0
   */
  React.useEffect(() => {
    if (restoredReloadRouteRef.current || isLoading) {
      return;
    }

    const currentRoute = `${location.pathname}${location.search}${location.hash}`;
    const rawHash = window.location.hash || '';
    const isRootFallback = currentRoute === '/' && (!rawHash || rawHash === '#' || rawHash === '#/');

    if (!isRootFallback) {
      return;
    }

    const savedRoute = sessionStorage.getItem(ROUTE_BEFORE_RELOAD_KEY) || sessionStorage.getItem(LAST_STABLE_ROUTE_KEY);

    if (!savedRoute || savedRoute === '/' || savedRoute === '/auth') {
      return;
    }

    restoredReloadRouteRef.current = true;
    navigate(savedRoute, { replace: true });
  }, [isLoading, location, navigate]);
};

export default useRoutePersistence;

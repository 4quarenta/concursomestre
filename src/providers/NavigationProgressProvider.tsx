'use client';

import React from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import {
  AppRouterContext,
  type AppRouterInstance,
  type NavigateOptions,
  type PrefetchOptions,
} from 'next/dist/shared/lib/app-router-context.shared-runtime';
import { useNavigationProgressStore } from '@/state/navigation-progress/navigationProgressStore';

const buildRouteKey = (pathname: string, search: string) => (
  `${pathname}${search ? `?${search}` : ''}`
);

// Barra global de progresso de navegacao: intercepta mudancas de rota e dispara estado de loading imediatamente no clique.
const normalizeInternalRoute = (href: string, currentRouteKey: string): string | null => {
  if (typeof window === 'undefined') {
    return null;
  }

  const trimmedHref = href.trim();
  if (!trimmedHref || trimmedHref.startsWith('#') || trimmedHref.startsWith('javascript:')) {
    return null;
  }

  try {
    const url = new URL(trimmedHref, window.location.href);
    if (!['http:', 'https:'].includes(url.protocol)) {
      return null;
    }

    if (url.origin !== window.location.origin) {
      return null;
    }

    const nextRouteKey = buildRouteKey(url.pathname, url.search.replace(/^\?/, ''));
    return nextRouteKey === currentRouteKey ? null : nextRouteKey;
  } catch {
    return null;
  }
};

const wrapRouter = (
  router: AppRouterInstance,
  currentRouteKey: string,
  startNavigation: (targetRoute?: string | null) => void,
): AppRouterInstance => ({
  ...router,
  back() {
    startNavigation(currentRouteKey);
    router.back();
  },
  forward() {
    startNavigation(currentRouteKey);
    router.forward();
  },
  refresh() {
    startNavigation(currentRouteKey);
    router.refresh();
  },
  push(href: string, options?: NavigateOptions) {
    const targetRoute = normalizeInternalRoute(href, currentRouteKey);
    if (targetRoute) {
      startNavigation(targetRoute);
    }

    router.push(href, options);
  },
  replace(href: string, options?: NavigateOptions) {
    const targetRoute = normalizeInternalRoute(href, currentRouteKey);
    if (targetRoute) {
      startNavigation(targetRoute);
    }

    router.replace(href, options);
  },
  prefetch(href: string, options?: PrefetchOptions) {
    router.prefetch(href, options);
  },
  experimental_gesturePush: router.experimental_gesturePush
    ? (href: string, options?: NavigateOptions) => {
        const targetRoute = normalizeInternalRoute(href, currentRouteKey);
        if (targetRoute) {
          startNavigation(targetRoute);
        }

        router.experimental_gesturePush?.(href, options);
      }
    : undefined,
});

export const NavigationProgressProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const router = React.useContext(AppRouterContext);
  const pathname = usePathname() || '/';
  const searchParams = useSearchParams();
  const search = searchParams?.toString() || '';
  const currentRouteKey = React.useMemo(() => buildRouteKey(pathname, search), [pathname, search]);
  const startNavigation = useNavigationProgressStore((store) => store.startNavigation);
  const completeNavigation = useNavigationProgressStore((store) => store.completeNavigation);

  React.useEffect(() => {
    completeNavigation(currentRouteKey);
  }, [completeNavigation, currentRouteKey]);

  React.useEffect(() => {
    if (typeof document === 'undefined') {
      return undefined;
    }

    const handleDocumentClick = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
        return;
      }

      const target = event.target;
      if (!(target instanceof Element)) {
        return;
      }

      const anchor = target.closest('a[href]');
      if (!(anchor instanceof HTMLAnchorElement)) {
        return;
      }

      if (anchor.target && anchor.target !== '_self') {
        return;
      }

      if (anchor.hasAttribute('download')) {
        return;
      }

      const targetRoute = normalizeInternalRoute(anchor.href, currentRouteKey);
      if (targetRoute) {
        startNavigation(targetRoute);
      }
    };

    document.addEventListener('click', handleDocumentClick, true);
    return () => {
      document.removeEventListener('click', handleDocumentClick, true);
    };
  }, [currentRouteKey, startNavigation]);

  const wrappedRouter = React.useMemo(() => {
    if (!router) {
      return router;
    }

    return wrapRouter(router, currentRouteKey, startNavigation);
  }, [currentRouteKey, router, startNavigation]);

  return (
    <AppRouterContext.Provider value={wrappedRouter}>
      {children}
    </AppRouterContext.Provider>
  );
};

export default NavigationProgressProvider;

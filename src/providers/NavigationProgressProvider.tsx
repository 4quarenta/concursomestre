'use client';

import React from 'react';
import { usePathname } from 'next/navigation';
import { useNavigationProgressStore } from '@/state/navigation-progress/navigationProgressStore';

const buildRouteKey = (pathname: string) => pathname;

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

    const nextRouteKey = buildRouteKey(url.pathname);
    return nextRouteKey === currentRouteKey ? null : nextRouteKey;
  } catch {
    return null;
  }
};

export const NavigationProgressProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const pathname = usePathname() || '/';
  const currentRouteKey = React.useMemo(() => buildRouteKey(pathname), [pathname]);
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

  return <>{children}</>;
};

export default NavigationProgressProvider;

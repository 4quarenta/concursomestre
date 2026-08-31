'use client';

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
import { usePathname, useRouter } from 'next/navigation';
import GlobalLoader from '@/components/GlobalLoader';
import { setupService } from '@services/setup/setupService';

interface SetupGateProps {
  children: React.ReactNode;
}

const SETUP_STATUS_CACHE_MS = 60_000;

/**
 * Bloqueia o app normal quando uma VPS nova ainda precisa de configuracao inicial.
 *
 * @since 1.0.0
 */
export const SetupGate: React.FC<SetupGateProps> = ({ children }) => {
  const pathname = usePathname() || '/';
  const router = useRouter();
  const [isChecking, setIsChecking] = React.useState(() => !pathname.startsWith('/setup'));

  React.useEffect(() => {
    let frameId: number | null = null;

    if (pathname.startsWith('/setup')) {
      frameId = window.requestAnimationFrame(() => setIsChecking(false));
      return () => {
        if (frameId !== null) {
          window.cancelAnimationFrame(frameId);
        }
      };
    }

    let cancelled = false;
    const cached = window.sessionStorage.getItem('cm_setup_status_checked_at');
    const cachedAt = cached ? Number(cached) : 0;

    if (cachedAt > 0 && Date.now() - cachedAt < SETUP_STATUS_CACHE_MS) {
      frameId = window.requestAnimationFrame(() => setIsChecking(false));
      return () => {
        if (frameId !== null) {
          window.cancelAnimationFrame(frameId);
        }
      };
    }

    frameId = window.requestAnimationFrame(() => setIsChecking(true));
    setupService.getStatus()
      .then((status) => {
        if (cancelled) return;

        if (status.needsSetup) {
          router.replace('/setup');
          return;
        }

        window.sessionStorage.setItem('cm_setup_status_checked_at', String(Date.now()));
        setIsChecking(false);
      })
      .catch(() => {
        if (!cancelled) {
          setIsChecking(false);
        }
      });

    return () => {
      cancelled = true;
      if (frameId !== null) {
        window.cancelAnimationFrame(frameId);
      }
    };
  }, [pathname, router]);

  if (isChecking) {
    return <GlobalLoader forceVisible />;
  }

  return <>{children}</>;
};

export default SetupGate;

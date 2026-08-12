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
import { usePathname } from 'next/navigation';
import { useSyncExternalStore } from 'react';
import { useAuth } from '@providers/AuthProvider';
import { useToast } from '@providers/ToastProvider';
import { getAccessToken, isAccessTokenExpired, refreshAuthSession } from '@services/auth';
import { statisticsService } from '@services/statistics';
import type { StudySessionPayload } from '@services/statistics/types';
import {
  applyStudyTrackerLiveDelta,
  getStudyTrackerSnapshot,
  hydrateStudyTrackerSession,
  recordSimulationStudyTime,
  resetStudyTrackerSession,
  resetStudyTrackerState,
  setStudyTrackerLoading,
  setStudyTrackerSaving,
  setStudyTrackerWidgetExpanded,
  subscribeToStudyTracker,
  syncPersistedStudyTotals,
} from '@services/statistics/studyTrackerStore';
import StudySessionWidget from '../components/shared/feedback/StudySessionWidget';

const IDLE_TIMEOUT_MS = 60_000;
const AUTO_STOP_IDLE_MS = 5 * 60_000;
const TICK_INTERVAL_MS = 1_000;
const PERSISTED_STATISTICS_SYNC_TTL_MS = 120_000;
const WIDGET_STORAGE_KEY = 'cm-study-widget-expanded';
const buildStudySessionStorageKey = (userId: string) => `cm-study-session:${userId}`;

const isLegalCommentaryReadingPath = (pathname: string): boolean => {
  const normalizedPathname = pathname.replace(/\/+$/, '');

  if (!normalizedPathname.startsWith('/lei-comentada/')) {
    return false;
  }

  const lawSlug = normalizedPathname.slice('/lei-comentada/'.length).split('/')[0];
  return lawSlug.trim() !== '';
};

const shouldRenderStudyWidget = (pathname: string): boolean => (
  pathname.startsWith('/practice')
  || pathname.startsWith('/simulation')
  || isLegalCommentaryReadingPath(pathname)
);

const resolveTrackedStudyMode = (pathname: string): 'practice' | 'reading' | null => {
  if (pathname.startsWith('/practice')) {
    return 'practice';
  }

  if (isLegalCommentaryReadingPath(pathname)) {
    return 'reading';
  }

  return null;
};

const shouldSyncPersistedStatistics = (pathname: string): boolean => {
  if (pathname.startsWith('/dashboard')) {
    return true;
  }

  return isLegalCommentaryReadingPath(pathname);
};

const ensureValidStatisticsSession = async (): Promise<boolean> => {
  const currentToken = getAccessToken();
  if (currentToken && !isAccessTokenExpired(currentToken, 15)) {
    return true;
  }

  const refreshedSession = await refreshAuthSession({
    reason: 'manual',
    allowAnonymousFailure: true,
    force: true,
  });

  const refreshedToken = refreshedSession?.accessToken || getAccessToken();
  return Boolean(refreshedToken && !isAccessTokenExpired(refreshedToken, 15));
};

/**
 * Hook oficial para ler o estado atual do rastreador de estudos.
 *
 * @since 1.0.0
 */
export const useStudyTracker = () => useSyncExternalStore(
  subscribeToStudyTracker,
  getStudyTrackerSnapshot,
  getStudyTrackerSnapshot,
);

/**
 * Bootstrap global do rastreador de estudos.
 * Ele observa rota, atividade do usuario, persistencia oficial e renderiza o widget discreto.
 *
 * @since 1.0.0
 */
export const StudyTrackerBridge: React.FC = () => {
  const pathname = usePathname() || '/';
  const { currentUser, isLoading: isAuthLoading } = useAuth();
  const { addToast } = useToast();
  const tracker = useStudyTracker();
  const lastInteractionAtRef = React.useRef<number>(0);
  const lastTickAtRef = React.useRef<number>(0);
  const stopStudySessionRef = React.useRef<() => Promise<void>>(async () => undefined);
  const lastStatisticsSyncKeyRef = React.useRef<string | null>(null);
  const lastStatisticsSyncAtRef = React.useRef<number>(0);
  const previousPathnameRef = React.useRef(pathname);
  const shouldLoadPersistedStatistics = shouldSyncPersistedStatistics(pathname);

  React.useEffect(() => {
    const now = Date.now();
    lastInteractionAtRef.current = now;
    lastTickAtRef.current = now;

    const storedWidgetState = window.localStorage.getItem(WIDGET_STORAGE_KEY);
    setStudyTrackerWidgetExpanded(storedWidgetState === '1');
  }, []);

  React.useEffect(() => {
    if (isAuthLoading) {
      return;
    }

    if (!currentUser?.id) {
      resetStudyTrackerState();
      lastStatisticsSyncKeyRef.current = null;
      lastStatisticsSyncAtRef.current = 0;
      return;
    }

    const storageKey = buildStudySessionStorageKey(currentUser.id);
    const storedWidgetState = window.localStorage.getItem(WIDGET_STORAGE_KEY);
    setStudyTrackerWidgetExpanded(storedWidgetState === '1');

    const storedSession = window.sessionStorage.getItem(storageKey);
    if (storedSession) {
      try {
        hydrateStudyTrackerSession(JSON.parse(storedSession));
      } catch {
        resetStudyTrackerSession();
      }
    } else {
      resetStudyTrackerSession();
    }
  }, [currentUser?.id, isAuthLoading]);

  React.useEffect(() => {
    if (isAuthLoading || !currentUser?.id) {
      return;
    }

    if (!shouldLoadPersistedStatistics) {
      setStudyTrackerLoading(false);
      return;
    }

    const syncKey = currentUser.id;
    const now = Date.now();
    const hasRecentSync = (
      lastStatisticsSyncKeyRef.current === syncKey
      && (now - lastStatisticsSyncAtRef.current) < PERSISTED_STATISTICS_SYNC_TTL_MS
    );

    if (hasRecentSync) {
      return;
    }

    lastStatisticsSyncKeyRef.current = syncKey;
    lastStatisticsSyncAtRef.current = now;

    let isActive = true;

    setStudyTrackerLoading(true);
    void (async () => {
      try {
        const hasValidSession = await ensureValidStatisticsSession();
        if (!isActive) {
          return;
        }

        if (!hasValidSession) {
          syncPersistedStudyTotals(null);
          return;
        }

        const statistics = await statisticsService.getUserStatistics(currentUser.id);
        if (isActive) {
          syncPersistedStudyTotals(statistics);
        }
      } catch {
        if (isActive) {
          lastStatisticsSyncKeyRef.current = null;
          lastStatisticsSyncAtRef.current = 0;
          syncPersistedStudyTotals(null);
        }
      } finally {
        if (isActive) {
          setStudyTrackerLoading(false);
        }
      }
    })();

    return () => {
      isActive = false;
    };
  }, [currentUser?.id, isAuthLoading, pathname, shouldLoadPersistedStatistics]);

  React.useEffect(() => {
    if (isAuthLoading || !currentUser?.id) {
      return;
    }

    const storageKey = buildStudySessionStorageKey(currentUser.id);
    const unsubscribe = subscribeToStudyTracker(() => {
      const snapshot = getStudyTrackerSnapshot();
      window.sessionStorage.setItem(storageKey, JSON.stringify(snapshot.session));
      window.localStorage.setItem(WIDGET_STORAGE_KEY, snapshot.isWidgetExpanded ? '1' : '0');
    });

    return unsubscribe;
  }, [currentUser?.id, isAuthLoading]);

  React.useEffect(() => {
    lastTickAtRef.current = Date.now();
  }, [pathname]);

  React.useEffect(() => {
    const markUserInteraction = () => {
      lastInteractionAtRef.current = Date.now();
    };

    const eventNames: Array<keyof WindowEventMap> = ['mousemove', 'keydown', 'mousedown', 'scroll', 'touchstart'];
    eventNames.forEach((eventName) => {
      window.addEventListener(eventName, markUserInteraction, { passive: true });
    });

    const handleVisibilityChange = () => {
      lastInteractionAtRef.current = Date.now();
      lastTickAtRef.current = Date.now();
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      eventNames.forEach((eventName) => {
        window.removeEventListener(eventName, markUserInteraction);
      });
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  React.useEffect(() => {
    if (isAuthLoading || !currentUser?.id) {
      return;
    }

    const tickId = window.setInterval(() => {
      if (getStudyTrackerSnapshot().isSaving) {
        lastTickAtRef.current = Date.now();
        return;
      }

      const now = Date.now();
      const deltaMs = now - lastTickAtRef.current;
      lastTickAtRef.current = now;

      if (document.visibilityState !== 'visible') {
        return;
      }

      const idleMs = now - lastInteractionAtRef.current;
      if (idleMs > AUTO_STOP_IDLE_MS && getStudyTrackerSnapshot().sessionTotals.totalSeconds > 0) {
        void stopStudySessionRef.current();
        return;
      }

      if (idleMs > IDLE_TIMEOUT_MS) {
        return;
      }

      const trackedMode = resolveTrackedStudyMode(pathname);
      if (!trackedMode) {
        return;
      }

      applyStudyTrackerLiveDelta(trackedMode, deltaMs);
    }, TICK_INTERVAL_MS);

    return () => {
      window.clearInterval(tickId);
    };
  }, [currentUser?.id, isAuthLoading, pathname]);

  const stopStudySession = React.useCallback(async () => {
    if (!currentUser?.id) {
      return;
    }

    const snapshot = getStudyTrackerSnapshot();
    if (snapshot.sessionTotals.totalSeconds <= 0) {
      addToast('Ainda nao ha tempo de estudo para registrar.', 'warning');
      return;
    }

    setStudyTrackerSaving(true);
    lastTickAtRef.current = Date.now();

    const payload: StudySessionPayload = {
      practiceSeconds: snapshot.sessionTotals.practiceSeconds,
      simulationSeconds: snapshot.sessionTotals.simulationSeconds,
      readingSeconds: snapshot.sessionTotals.readingSeconds,
      startedAt: new Date(snapshot.session.startedAt).toISOString(),
      endedAt: new Date().toISOString(),
      sourceContext: {
        pathname,
        question_sources: {
          practice_seconds: snapshot.sessionTotals.practiceSeconds,
          simulation_seconds: snapshot.sessionTotals.simulationSeconds,
        },
        reading_sources: {
          annotated_laws_seconds: snapshot.sessionTotals.readingSeconds,
        },
      },
    };

    try {
      const hasValidSession = await ensureValidStatisticsSession();
      if (!hasValidSession) {
        addToast('Sua sessão precisa ser renovada antes de salvar o tempo. Faça login novamente para registrar este estudo.', 'warning');
        return;
      }

      const result = await statisticsService.recordStudySession(payload);
      syncPersistedStudyTotals(result.statistics);
      resetStudyTrackerSession();
    } catch (error: unknown) {
      addToast(error instanceof Error ? error.message : 'Não foi possível registrar o tempo de estudo.', 'error');
    } finally {
      setStudyTrackerSaving(false);
      lastInteractionAtRef.current = Date.now();
      lastTickAtRef.current = Date.now();
    }
  }, [addToast, currentUser?.id, pathname]);

  React.useEffect(() => {
    stopStudySessionRef.current = stopStudySession;
  }, [stopStudySession]);

  React.useEffect(() => {
    const previousPathname = previousPathnameRef.current;
    previousPathnameRef.current = pathname;

    if (!currentUser?.id) {
      return;
    }

    const wasTrackingStudy = resolveTrackedStudyMode(previousPathname) !== null;
    const isTrackingStudy = resolveTrackedStudyMode(pathname) !== null;
    const hasUnsavedStudyTime = getStudyTrackerSnapshot().sessionTotals.totalSeconds > 0;

    if (wasTrackingStudy && !isTrackingStudy && hasUnsavedStudyTime) {
      void stopStudySessionRef.current();
    }
  }, [currentUser?.id, pathname]);

  const handleWidgetToggle = React.useCallback(() => {
    setStudyTrackerWidgetExpanded(!getStudyTrackerSnapshot().isWidgetExpanded);
  }, []);

  if (!currentUser || !shouldRenderStudyWidget(pathname)) {
    return null;
  }

  return (
    <StudySessionWidget
      isLoading={tracker.isLoading}
      isSaving={tracker.isSaving}
      isExpanded={tracker.isWidgetExpanded}
      persistedTotals={tracker.persisted}
      sessionTotals={tracker.sessionTotals}
      displayTotals={tracker.displayTotals}
      onToggle={handleWidgetToggle}
      onStop={stopStudySession}
    />
  );
};

/**
 * Hook utilitario para registrar o tempo autoritativo de um simulado finalizado.
 *
 * @since 1.0.0
 */
export const useStudyTrackerActions = () => ({
  registerSimulationElapsed: (simulationId: string, elapsedSeconds: number) => {
    recordSimulationStudyTime(simulationId, elapsedSeconds);
  },
});

export default StudyTrackerBridge;

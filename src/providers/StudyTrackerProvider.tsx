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
const TICK_INTERVAL_MS = 1_000;
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
  const { currentUser } = useAuth();
  const { addToast } = useToast();
  const tracker = useStudyTracker();
  const lastInteractionAtRef = React.useRef<number>(Date.now());
  const lastTickAtRef = React.useRef<number>(Date.now());

  React.useEffect(() => {
    const storedWidgetState = window.localStorage.getItem(WIDGET_STORAGE_KEY);
    setStudyTrackerWidgetExpanded(storedWidgetState === '1');
  }, []);

  React.useEffect(() => {
    if (!currentUser?.id) {
      resetStudyTrackerState();
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

    setStudyTrackerLoading(true);
    statisticsService.getUserStatistics(currentUser.id)
      .then((statistics) => {
        syncPersistedStudyTotals(statistics);
      })
      .catch(() => {
        syncPersistedStudyTotals(null);
      })
      .finally(() => {
        setStudyTrackerLoading(false);
      });
  }, [currentUser?.id]);

  React.useEffect(() => {
    if (!currentUser?.id) {
      return;
    }

    const storageKey = buildStudySessionStorageKey(currentUser.id);
    const unsubscribe = subscribeToStudyTracker(() => {
      const snapshot = getStudyTrackerSnapshot();
      window.sessionStorage.setItem(storageKey, JSON.stringify(snapshot.session));
      window.localStorage.setItem(WIDGET_STORAGE_KEY, snapshot.isWidgetExpanded ? '1' : '0');
    });

    return unsubscribe;
  }, [currentUser?.id]);

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
    if (!currentUser?.id) {
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

      if (now - lastInteractionAtRef.current > IDLE_TIMEOUT_MS) {
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
  }, [currentUser?.id, pathname]);

  const refreshPersistedTotals = React.useCallback(async () => {
    if (!currentUser?.id) {
      syncPersistedStudyTotals(null);
      return;
    }

    const statistics = await statisticsService.getUserStatistics(currentUser.id);
    syncPersistedStudyTotals(statistics);
  }, [currentUser?.id]);

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
      const result = await statisticsService.recordStudySession(payload);
      syncPersistedStudyTotals(result.statistics);
      resetStudyTrackerSession();
      addToast('Tempo de estudo registrado com sucesso.', 'success');
    } catch (error: any) {
      addToast(error?.message || 'Nao foi possivel registrar o tempo de estudo.', 'error');
    } finally {
      setStudyTrackerSaving(false);
      lastInteractionAtRef.current = Date.now();
      lastTickAtRef.current = Date.now();
    }
  }, [addToast, currentUser?.id, pathname]);

  const handleWidgetToggle = React.useCallback(() => {
    setStudyTrackerWidgetExpanded(!getStudyTrackerSnapshot().isWidgetExpanded);
  }, []);

  const registerSimulationElapsed = React.useCallback((simulationId: string, elapsedSeconds: number) => {
    recordSimulationStudyTime(simulationId, elapsedSeconds);
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

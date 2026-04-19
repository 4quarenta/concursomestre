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

import type { UserStatistics } from './types';

export interface StudyTimeTotals {
  practiceSeconds: number;
  simulationSeconds: number;
  questionSeconds: number;
  readingSeconds: number;
  totalSeconds: number;
}

export interface StudyTrackerSessionState {
  startedAt: number;
  practiceMs: number;
  simulationMs: number;
  readingMs: number;
}

export interface StudyTrackerState {
  isLoading: boolean;
  isSaving: boolean;
  isWidgetExpanded: boolean;
  persisted: StudyTimeTotals;
  session: StudyTrackerSessionState;
}

export interface StudyTrackerSnapshot extends StudyTrackerState {
  sessionTotals: StudyTimeTotals;
  displayTotals: StudyTimeTotals;
}

const buildEmptyTotals = (): StudyTimeTotals => ({
  practiceSeconds: 0,
  simulationSeconds: 0,
  questionSeconds: 0,
  readingSeconds: 0,
  totalSeconds: 0,
});

const buildEmptySession = (): StudyTrackerSessionState => ({
  startedAt: Date.now(),
  practiceMs: 0,
  simulationMs: 0,
  readingMs: 0,
});

let state: StudyTrackerState = {
  isLoading: false,
  isSaving: false,
  isWidgetExpanded: true,
  persisted: buildEmptyTotals(),
  session: buildEmptySession(),
};

let cachedSnapshot: StudyTrackerSnapshot;

const listeners = new Set<() => void>();
const recordedSimulationIds = new Set<string>();

const emitChange = () => {
  listeners.forEach((listener) => listener());
};

const toSessionTotals = (session: StudyTrackerSessionState): StudyTimeTotals => {
  const practiceSeconds = Math.max(0, Math.round(session.practiceMs / 1000));
  const simulationSeconds = Math.max(0, Math.round(session.simulationMs / 1000));
  const questionSeconds = practiceSeconds + simulationSeconds;
  const readingSeconds = Math.max(0, Math.round(session.readingMs / 1000));

  return {
    practiceSeconds,
    simulationSeconds,
    questionSeconds,
    readingSeconds,
    totalSeconds: questionSeconds + readingSeconds,
  };
};

const mergeTotals = (persisted: StudyTimeTotals, session: StudyTimeTotals): StudyTimeTotals => ({
  practiceSeconds: persisted.practiceSeconds + session.practiceSeconds,
  simulationSeconds: persisted.simulationSeconds + session.simulationSeconds,
  questionSeconds: persisted.questionSeconds + session.questionSeconds,
  readingSeconds: persisted.readingSeconds + session.readingSeconds,
  totalSeconds: persisted.totalSeconds + session.totalSeconds,
});

const rebuildSnapshot = (): void => {
  const sessionTotals = toSessionTotals(state.session);

  cachedSnapshot = {
    ...state,
    sessionTotals,
    displayTotals: mergeTotals(state.persisted, sessionTotals),
  };
};

const commitState = (nextState: StudyTrackerState): void => {
  state = nextState;
  rebuildSnapshot();
  emitChange();
};

rebuildSnapshot();

export const subscribeToStudyTracker = (listener: () => void): (() => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

export const getStudyTrackerState = (): StudyTrackerState => state;

export const getStudyTrackerSnapshot = (): StudyTrackerSnapshot => cachedSnapshot;

export const setStudyTrackerLoading = (isLoading: boolean): void => {
  commitState({
    ...state,
    isLoading,
  });
};

export const setStudyTrackerSaving = (isSaving: boolean): void => {
  commitState({
    ...state,
    isSaving,
  });
};

export const setStudyTrackerWidgetExpanded = (isWidgetExpanded: boolean): void => {
  commitState({
    ...state,
    isWidgetExpanded,
  });
};

export const resetStudyTrackerState = (): void => {
  recordedSimulationIds.clear();
  commitState({
    isLoading: false,
    isSaving: false,
    isWidgetExpanded: true,
    persisted: buildEmptyTotals(),
    session: buildEmptySession(),
  });
};

export const hydrateStudyTrackerSession = (session: Partial<StudyTrackerSessionState> | null | undefined): void => {
  commitState({
    ...state,
    session: {
      startedAt: Number(session?.startedAt || Date.now()),
      practiceMs: Math.max(0, Number(session?.practiceMs || 0)),
      simulationMs: Math.max(0, Number(session?.simulationMs || 0)),
      readingMs: Math.max(0, Number(session?.readingMs || 0)),
    },
  });
};

export const resetStudyTrackerSession = (startedAt = Date.now()): void => {
  commitState({
    ...state,
    session: {
      startedAt,
      practiceMs: 0,
      simulationMs: 0,
      readingMs: 0,
    },
  });
};

export const applyStudyTrackerLiveDelta = (mode: 'practice' | 'reading', deltaMs: number): void => {
  if (deltaMs <= 0) {
    return;
  }

  commitState({
    ...state,
    session: {
      ...state.session,
      practiceMs: mode === 'practice' ? state.session.practiceMs + deltaMs : state.session.practiceMs,
      readingMs: mode === 'reading' ? state.session.readingMs + deltaMs : state.session.readingMs,
    },
  });
};

export const recordSimulationStudyTime = (simulationId: string, elapsedSeconds: number): void => {
  if (!simulationId || elapsedSeconds <= 0 || recordedSimulationIds.has(simulationId)) {
    return;
  }

  recordedSimulationIds.add(simulationId);
  commitState({
    ...state,
    session: {
      ...state.session,
      simulationMs: state.session.simulationMs + (elapsedSeconds * 1000),
    },
  });
};

export const syncPersistedStudyTotals = (statistics: Partial<UserStatistics> | null | undefined): void => {
  commitState({
    ...state,
    persisted: {
      practiceSeconds: 0,
      simulationSeconds: 0,
      questionSeconds: Math.max(0, Number(statistics?.questionStudyTime || 0)),
      readingSeconds: Math.max(0, Number(statistics?.readingStudyTime || 0)),
      totalSeconds: Math.max(0, Number(statistics?.totalStudyTime || 0)),
    },
  });
};

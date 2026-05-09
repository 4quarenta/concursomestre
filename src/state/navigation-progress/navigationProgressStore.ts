'use client';

import { create } from 'zustand';

type NavigationProgressPhase = 'idle' | 'running' | 'completing';

interface NavigationProgressState {
  phase: NavigationProgressPhase;
  transitionId: number;
  targetRoute: string | null;
  startNavigation: (targetRoute?: string | null) => void;
  completeNavigation: (resolvedRoute?: string | null) => void;
  resetNavigation: () => void;
}

export const useNavigationProgressStore = create<NavigationProgressState>((set) => ({
  phase: 'idle',
  transitionId: 0,
  targetRoute: null,
  startNavigation: (targetRoute) => set((state) => {
    if (state.phase === 'running' && state.targetRoute === (targetRoute || null)) {
      return state;
    }

    return {
      phase: 'running',
      transitionId: state.transitionId + 1,
      targetRoute: targetRoute || null,
    };
  }),
  completeNavigation: (resolvedRoute) => set((state) => {
    if (state.phase === 'idle') {
      return state;
    }

    return {
      phase: 'completing',
      transitionId: state.transitionId + 1,
      targetRoute: resolvedRoute || state.targetRoute,
    };
  }),
  resetNavigation: () => set((state) => {
    if (state.phase === 'idle' && state.targetRoute === null) {
      return state;
    }

    return {
      phase: 'idle',
      transitionId: state.transitionId + 1,
      targetRoute: null,
    };
  }),
}));

export default useNavigationProgressStore;

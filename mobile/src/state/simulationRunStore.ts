import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import type { MobileSimulationSeed } from '@/types/simulation';

type SimulationRunState = {
  seed: MobileSimulationSeed | null;
  answers: Record<string, number>;
  currentIndex: number;
  setSeed: (seed: MobileSimulationSeed) => void;
  setAnswer: (questionId: string | number, optionIndex: number) => void;
  replaceAnswers: (answers: Record<string, number>) => void;
  setCurrentIndex: (index: number) => void;
  clearSeed: () => void;
};

/**
 * Estado local da tentativa ativa.
 * E persistido para permitir retomada apos fechamento do app, mas o backend
 * continua autoritativo para correcao, pontuacao e historico concluido.
 */
export const useSimulationRunStore = create<SimulationRunState>()(
  persist(
    (set) => ({
      seed: null,
      answers: {},
      currentIndex: 0,
      setSeed: (seed) => set({ seed, answers: {}, currentIndex: 0 }),
      setAnswer: (questionId, optionIndex) => set((state) => ({
        answers: {
          ...state.answers,
          [String(questionId)]: optionIndex,
        },
      })),
      replaceAnswers: (answers) => set({ answers }),
      setCurrentIndex: (index) => set({ currentIndex: Math.max(0, index) }),
      clearSeed: () => set({ seed: null, answers: {}, currentIndex: 0 }),
    }),
    {
      name: 'cm-simulation-run-v2',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        seed: state.seed,
        answers: state.answers,
        currentIndex: state.currentIndex,
      }),
    },
  ),
);

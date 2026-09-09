import { create } from 'zustand';
import type { MobileSimulationSeed } from '@/types/simulation';

type SimulationRunState = {
  seed: MobileSimulationSeed | null;
  setSeed: (seed: MobileSimulationSeed) => void;
  clearSeed: () => void;
};

/**
 * Estado efemero de navegacao para um simulado em execucao.
 * Nao pertence ao backend e nao deve ser serializado em URL/deep link.
 */
export const useSimulationRunStore = create<SimulationRunState>((set) => ({
  seed: null,
  setSeed: (seed) => set({ seed }),
  clearSeed: () => set({ seed: null }),
}));

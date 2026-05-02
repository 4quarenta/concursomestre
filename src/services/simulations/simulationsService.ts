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

import { apiClient, ENDPOINTS, assertApiSuccess, readApiData } from '@services/api';
import type { SimulationSession } from '@types';

type SaveSimulationResult = {
  success: boolean;
  id?: string;
  message?: string;
};

type SaveSimulationResponse = {
  id?: string | number;
  data?: {
    id?: string | number;
  };
};

type SimulationsListResponse = {
  simulations?: SimulationListItem[];
};

type SimulationListItem = {
  id?: string | number;
  config?: Record<string, unknown>;
  questionIds?: Array<string | number>;
  answers?: Record<string, StoredSimulationAnswer>;
  startTime?: string | number;
  endTime?: string | number;
  durationSeconds?: string | number;
  duration_seconds?: string | number;
  status?: string;
  score?: string | number;
};

export type StoredSimulationAnswer = {
  index?: number;
  is_correct?: boolean | number;
  time_taken?: number;
};

export type StoredSimulationSession = Omit<SimulationSession, 'questions' | 'answers'> & {
  questionIds: number[];
  answers: Record<string, StoredSimulationAnswer>;
};

/**
 * Fachada oficial do dominio de simulados.
 * Mantem o contexto desacoplado do contrato HTTP legado.
 * @since v1.0.0
 */
export const simulationsService = {
  /**
   * Lista o historico persistido de simulados do usuario autenticado.
   * @since v1.0.0
   */
  async listSimulations(): Promise<StoredSimulationSession[]> {
    const response = await apiClient.get<SimulationsListResponse | SimulationListItem[]>(ENDPOINTS.simulations.list);
    assertApiSuccess(response, 'Nao foi possivel carregar os simulados.');
    const payload = readApiData<SimulationsListResponse | SimulationListItem[]>(response, {});
    const simulations = Array.isArray(payload)
      ? payload
      : Array.isArray(payload.simulations)
        ? payload.simulations
        : [];

    return simulations.map((simulation) => {
      const durationSeconds = Number(simulation.durationSeconds ?? simulation.duration_seconds ?? 0);

      return {
        id: String(simulation.id || ''),
        config: (simulation.config as unknown as SimulationSession['config']) || {} as SimulationSession['config'],
        questionIds: Array.isArray(simulation.questionIds)
          ? simulation.questionIds.map((id) => Number(id)).filter((id) => Number.isFinite(id))
          : [],
        answers: simulation.answers && typeof simulation.answers === 'object' ? simulation.answers : {},
        startTime: Number(simulation.startTime || 0),
        endTime: simulation.endTime ? Number(simulation.endTime) : undefined,
        durationSeconds: Number.isFinite(durationSeconds) && durationSeconds > 0 ? durationSeconds : undefined,
        status: simulation.status === 'in_progress' ? 'in_progress' : 'completed',
        score: Number(simulation.score || 0),
      };
    });
  },

  /**
   * Persiste uma sessao de simulado do usuario autenticado.
   * @since v1.0.0
   */
  async saveSimulation(simulation: SimulationSession): Promise<SaveSimulationResult> {
    const payload = typeof simulation.durationSeconds === 'number'
      ? { ...simulation, duration_seconds: simulation.durationSeconds }
      : simulation;
    const response = await apiClient.post<SaveSimulationResponse>(ENDPOINTS.simulations.create, payload);
    const envelope = assertApiSuccess(response, 'Nao foi possivel salvar o simulado.');
    const result = readApiData<SaveSimulationResponse>(response, {});

    return {
      success: true,
      id: String(result.data?.id ?? result.id ?? envelope.raw.id ?? ''),
      message: envelope.message,
    };
  },
};

export default simulationsService;

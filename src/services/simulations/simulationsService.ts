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
   * O backend devolve IDs de questoes; a tela hidrata com o banco local ja carregado.
   * @since v1.0.0
   */
  async listSimulations(): Promise<StoredSimulationSession[]> {
    const response = await apiClient.get<any>(ENDPOINTS.simulations.list) as any;
    assertApiSuccess(response, 'Nao foi possivel carregar os simulados.');
    const payload = readApiData<any>(response, {});
    const simulations = Array.isArray(payload)
      ? payload
      : Array.isArray(payload?.simulations)
        ? payload.simulations
        : [];

    return simulations.map((simulation: any) => {
      const durationSeconds = Number(simulation.durationSeconds ?? simulation.duration_seconds ?? 0);

      return {
        id: String(simulation.id || ''),
        config: simulation.config || {},
        questionIds: Array.isArray(simulation.questionIds)
          ? simulation.questionIds.map((id: any) => Number(id)).filter((id: number) => Number.isFinite(id))
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
   * Persiste uma sessão de simulado do usuário autenticado.
   * O fluxo e consumido pelo encerramento do simulado para salvar score, respostas e metadados da sessão.
   * @since v1.0.0
   */
  async saveSimulation(simulation: SimulationSession): Promise<SaveSimulationResult> {
    const payload = typeof simulation.durationSeconds === 'number'
      ? { ...simulation, duration_seconds: simulation.durationSeconds }
      : simulation;
    const response = await apiClient.post<any>(ENDPOINTS.simulations.create, payload) as any;
    const envelope = assertApiSuccess(response, 'Não foi possível salvar o simulado.');

    return {
      success: true,
      id: envelope.raw?.data?.id || envelope.raw?.id,
      message: envelope.message,
    };
  },
};

export default simulationsService;

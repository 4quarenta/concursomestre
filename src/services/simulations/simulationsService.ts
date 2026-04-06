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

import { apiClient, ENDPOINTS, assertApiSuccess } from '@services/api';
import type { SimulationSession } from '@types';

type SaveSimulationResult = {
  success: boolean;
  id?: string;
  message?: string;
};

/**
 * Fachada oficial do dominio de simulados.
 * Mantem o contexto desacoplado do contrato HTTP legado.
 * @since v1.0.0
 */
export const simulationsService = {
  /**
   * Persiste uma sessão de simulado do usuário autenticado.
   * O fluxo e consumido pelo encerramento do simulado para salvar score, respostas e metadados da sessão.
   * @since v1.0.0
   */
  async saveSimulation(simulation: SimulationSession): Promise<SaveSimulationResult> {
    const response = await apiClient.post<any>(ENDPOINTS.simulations.create, simulation) as any;
    const envelope = assertApiSuccess(response, 'Não foi possível salvar o simulado.');

    return {
      success: true,
      id: envelope.raw?.data?.id || envelope.raw?.id,
      message: envelope.message,
    };
  },
};

export default simulationsService;

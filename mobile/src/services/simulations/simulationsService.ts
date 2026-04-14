import { apiClient } from '@/services/api/client';
import { ENDPOINTS } from '@/services/api/endpoints';
import { assertApiSuccess, readApiData } from '@/services/api/response';
import type { SimulationListItem } from '@/types/simulations';

const normalizeSimulationRows = (payload: unknown): SimulationListItem[] => {
  if (Array.isArray(payload)) {
    return payload as SimulationListItem[];
  }

  if (payload && typeof payload === 'object') {
    const objectPayload = payload as Record<string, unknown>;
    if (Array.isArray(objectPayload.rows)) return objectPayload.rows as SimulationListItem[];
    if (Array.isArray(objectPayload.items)) return objectPayload.items as SimulationListItem[];
    if (Array.isArray(objectPayload.simulations)) return objectPayload.simulations as SimulationListItem[];
    if (Array.isArray(objectPayload.data)) return objectPayload.data as SimulationListItem[];
  }

  return [];
};

/**
 * Servico mobile para listagem de simulados.
 * @since v1.0.0
 */
export const simulationsService = {
  async list(): Promise<SimulationListItem[]> {
    try {
      const response: any = await apiClient.get<any>(ENDPOINTS.simulations.list);
      const payload = readApiData<any>(response, []);
      return normalizeSimulationRows(payload);
    } catch (error: any) {
      if (error?.response?.status === 404) {
        return [];
      }

      throw error;
    }
  },

  async saveSimulation(simulation: Record<string, any>): Promise<{ success: boolean; id?: string; message?: string }> {
    const response: any = await apiClient.post<any>(ENDPOINTS.simulations.create, simulation);
    const envelope = assertApiSuccess(response, 'Nao foi possivel salvar o simulado.');

    return {
      success: true,
      id: envelope.raw?.data?.id || envelope.raw?.id,
      message: envelope.message,
    };
  },
};

export default simulationsService;

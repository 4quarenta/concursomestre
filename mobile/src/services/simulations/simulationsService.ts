import AsyncStorage from '@react-native-async-storage/async-storage';
import { apiClient } from '@/services/api/client';
import { ENDPOINTS } from '@/services/api/endpoints';
import { assertApiSuccess, readApiData, readApiErrorMessage } from '@/services/api/response';
import type { SimulationListItem } from '@/types/simulations';

const LOCAL_SIMULATIONS_KEY = 'cm_simulations_history_v1';
const LOCAL_SIMULATIONS_LIMIT = 120;

const parseTimestamp = (rawValue: unknown): number => {
  if (typeof rawValue === 'number' && Number.isFinite(rawValue)) {
    if (rawValue > 9999999999) return rawValue;
    if (rawValue > 0) return rawValue * 1000;
  }

  if (typeof rawValue === 'string' && rawValue.trim()) {
    const numeric = Number(rawValue);
    if (Number.isFinite(numeric) && numeric > 0) {
      if (numeric > 9999999999) return numeric;
      return numeric * 1000;
    }

    const parsedDate = new Date(rawValue);
    if (!Number.isNaN(parsedDate.getTime())) return parsedDate.getTime();
  }

  return 0;
};

const normalizeSimulationItem = (item: any): SimulationListItem | null => {
  if (!item || typeof item !== 'object') return null;

  const resolvedId = String(item.id || item.simulationId || item.uuid || '').trim();
  if (!resolvedId) return null;

  const numericScore = Number(item.score);
  const numericQuestionCount = Number(
    item.questionCount
    ?? item.questionsCount
    ?? item.totalQuestions
    ?? item.config?.questionCount
    ?? (Array.isArray(item.questions) ? item.questions.length : undefined),
  );

  return {
    id: resolvedId,
    name: String(item.name || item.title || 'Simulado mobile'),
    status: String(item.status || 'completed'),
    score: Number.isFinite(numericScore) ? numericScore : undefined,
    questionCount: Number.isFinite(numericQuestionCount) ? numericQuestionCount : undefined,
    source: item.source === 'remote' ? 'remote' : 'local',
    createdAt: item.createdAt ?? item.created_at ?? item.startTime ?? Date.now(),
    updatedAt: item.updatedAt ?? item.updated_at ?? item.endTime ?? item.createdAt ?? Date.now(),
  };
};

const normalizeSimulationRows = (payload: unknown): SimulationListItem[] => {
  const normalizeRows = (rows: unknown[]): SimulationListItem[] => (
    rows
      .map((item) => normalizeSimulationItem(item))
      .filter((item): item is SimulationListItem => item !== null)
  );

  if (Array.isArray(payload)) {
    return normalizeRows(payload);
  }

  if (payload && typeof payload === 'object') {
    const objectPayload = payload as Record<string, unknown>;
    if (Array.isArray(objectPayload.rows)) return normalizeRows(objectPayload.rows);
    if (Array.isArray(objectPayload.items)) return normalizeRows(objectPayload.items);
    if (Array.isArray(objectPayload.simulations)) return normalizeRows(objectPayload.simulations);
    if (Array.isArray(objectPayload.data)) return normalizeRows(objectPayload.data);
  }

  return [];
};

const sortSimulationRows = (rows: SimulationListItem[]): SimulationListItem[] => (
  [...rows].sort((left, right) => {
    const leftTimestamp = parseTimestamp(left.updatedAt) || parseTimestamp(left.createdAt);
    const rightTimestamp = parseTimestamp(right.updatedAt) || parseTimestamp(right.createdAt);
    return rightTimestamp - leftTimestamp;
  })
);

const readLocalRows = async (): Promise<SimulationListItem[]> => {
  const rawValue = await AsyncStorage.getItem(LOCAL_SIMULATIONS_KEY);
  if (!rawValue) return [];

  try {
    const parsed = JSON.parse(rawValue);
    if (!Array.isArray(parsed)) return [];

    return sortSimulationRows(
      parsed
        .map((item) => normalizeSimulationItem({ ...item, source: 'local' }))
        .filter((item): item is SimulationListItem => item !== null),
    );
  } catch {
    return [];
  }
};

const saveLocalRows = async (rows: SimulationListItem[]): Promise<void> => {
  if (rows.length === 0) {
    await AsyncStorage.removeItem(LOCAL_SIMULATIONS_KEY);
    return;
  }

  await AsyncStorage.setItem(
    LOCAL_SIMULATIONS_KEY,
    JSON.stringify(sortSimulationRows(rows).slice(0, LOCAL_SIMULATIONS_LIMIT)),
  );
};

const appendLocalSimulation = async (simulation: Record<string, any>, resolvedId: string): Promise<void> => {
  const existingRows = await readLocalRows();
  const fallbackNow = Date.now();
  const nextItem = normalizeSimulationItem({
    id: resolvedId,
    name: simulation?.config?.name || simulation?.name || 'Simulado mobile',
    status: simulation?.status || 'completed',
    score: simulation?.score,
    questionCount: simulation?.config?.questionCount || simulation?.questions?.length,
    createdAt: simulation?.startTime || fallbackNow,
    updatedAt: simulation?.endTime || fallbackNow,
    source: 'local',
  });

  if (!nextItem) return;

  const nextRows = [
    nextItem,
    ...existingRows.filter((item) => String(item.id) !== String(nextItem.id)),
  ];

  await saveLocalRows(nextRows);
};

const mergeRows = (remoteRows: SimulationListItem[], localRows: SimulationListItem[]): SimulationListItem[] => {
  const mergedMap = new Map<string, SimulationListItem>();

  localRows.forEach((item) => {
    mergedMap.set(String(item.id), {
      ...item,
      source: 'local',
    });
  });

  remoteRows.forEach((item) => {
    const existing = mergedMap.get(String(item.id));
    mergedMap.set(String(item.id), {
      ...existing,
      ...item,
      source: 'remote',
    });
  });

  return sortSimulationRows(Array.from(mergedMap.values()));
};

/**
 * Servico mobile para listagem de simulados.
 * @since v1.0.0
 */
export const simulationsService = {
  async list(): Promise<SimulationListItem[]> {
    const localRows = await readLocalRows();

    try {
      const response: any = await apiClient.get<any>(ENDPOINTS.simulations.list);
      const payload = readApiData<any>(response, []);
      const remoteRows = normalizeSimulationRows(payload).map((item) => ({ ...item, source: 'remote' as const }));

      if (remoteRows.length === 0) {
        return localRows;
      }

      return mergeRows(remoteRows, localRows);
    } catch (error: any) {
      if (error?.response?.status === 404) {
        return localRows;
      }

      if (localRows.length > 0) {
        return localRows;
      }

      throw new Error(readApiErrorMessage(error, 'Nao foi possivel carregar simulados.'));
    }
  },

  async saveSimulation(simulation: Record<string, any>): Promise<{ success: boolean; id?: string; message?: string }> {
    const response: any = await apiClient.post<any>(ENDPOINTS.simulations.create, simulation);
    const envelope = assertApiSuccess(response, 'Nao foi possivel salvar o simulado.');
    const resolvedId = String(envelope.raw?.data?.id || envelope.raw?.id || simulation?.id || `sim-mobile-${Date.now()}`);
    await appendLocalSimulation(simulation, resolvedId);

    return {
      success: true,
      id: resolvedId,
      message: envelope.message,
    };
  },
};

export default simulationsService;

import AsyncStorage from '@react-native-async-storage/async-storage';
import { apiClient } from '@/services/api/client';
import { ENDPOINTS } from '@/services/api/endpoints';
import { assertApiSuccess, readApiData, readApiErrorMessage } from '@/services/api/response';
import type { SimulationAnswerResult, SimulationDetail, SimulationListItem, SimulationSaveResult } from '@/types/simulations';

const LOCAL_SIMULATIONS_KEY = 'cm_simulations_history_v1';
const LOCAL_SIMULATIONS_LIMIT = 120;

const parseTimestamp = (rawValue: unknown): number => {
  if (typeof rawValue === 'number' && Number.isFinite(rawValue)) return rawValue > 9999999999 ? rawValue : rawValue > 0 ? rawValue * 1000 : 0;
  if (typeof rawValue === 'string' && rawValue.trim()) {
    const numeric = Number(rawValue);
    if (Number.isFinite(numeric) && numeric > 0) return numeric > 9999999999 ? numeric : numeric * 1000;
    const parsedDate = new Date(rawValue);
    if (!Number.isNaN(parsedDate.getTime())) return parsedDate.getTime();
  }
  return 0;
};

const normalizeSimulationDetail = (item: any, preferredSource: 'remote' | 'local' = 'local'): SimulationDetail | null => {
  if (!item || typeof item !== 'object') return null;
  const resolvedId = String(item.id || item.simulationId || item.uuid || '').trim();
  if (!resolvedId) return null;
  const numericScore = Number(item.score);
  const numericQuestionCount = Number(item.questionCount ?? item.questionsCount ?? item.totalQuestions ?? item.config?.questionCount ?? (Array.isArray(item.questions) ? item.questions.length : undefined));
  const createdAt = item.createdAt ?? item.created_at ?? item.startTime ?? Date.now();
  const updatedAt = item.updatedAt ?? item.updated_at ?? item.endTime ?? createdAt;
  return {
    id: resolvedId,
    name: String(item.name || item.title || item.config?.name || 'Simulado mobile'),
    status: String(item.status || 'completed'),
    score: Number.isFinite(numericScore) ? numericScore : undefined,
    questionCount: Number.isFinite(numericQuestionCount) ? numericQuestionCount : undefined,
    source: item.source === 'remote' ? 'remote' : preferredSource,
    createdAt, updatedAt,
    config: item.config && typeof item.config === 'object' ? item.config : undefined,
    questions: Array.isArray(item.questions) ? item.questions : undefined,
    answers: item.answers && typeof item.answers === 'object' ? item.answers : undefined,
    startTime: Number.isFinite(Number(item.startTime)) ? Number(item.startTime) : undefined,
    endTime: Number.isFinite(Number(item.endTime)) ? Number(item.endTime) : undefined,
  };
};

const extractPayloadRows = (payload: unknown): unknown[] => {
  if (Array.isArray(payload)) return payload;
  if (!payload || typeof payload !== 'object') return [];
  const objectPayload = payload as Record<string, unknown>;
  for (const key of ['rows', 'items', 'simulations', 'data']) {
    if (Array.isArray(objectPayload[key])) return objectPayload[key] as unknown[];
  }
  return [];
};

const toListItem = (detail: SimulationDetail): SimulationListItem => ({ id: detail.id, name: detail.name, status: detail.status, score: detail.score, questionCount: detail.questionCount, source: detail.source, createdAt: detail.createdAt, updatedAt: detail.updatedAt });
const normalizeSimulationRows = (payload: unknown, source: 'remote' | 'local'): SimulationListItem[] => extractPayloadRows(payload).map((item) => normalizeSimulationDetail(item, source)).filter((item): item is SimulationDetail => item !== null).map(toListItem);
const sortSimulationRows = (rows: SimulationListItem[]): SimulationListItem[] => [...rows].sort((a, b) => (parseTimestamp(b.updatedAt) || parseTimestamp(b.createdAt)) - (parseTimestamp(a.updatedAt) || parseTimestamp(a.createdAt)));

const readLocalDetails = async (): Promise<SimulationDetail[]> => {
  const rawValue = await AsyncStorage.getItem(LOCAL_SIMULATIONS_KEY);
  if (!rawValue) return [];
  try {
    const parsed = JSON.parse(rawValue);
    if (!Array.isArray(parsed)) return [];
    return parsed.map((item) => normalizeSimulationDetail({ ...item, source: 'local' }, 'local')).filter((item): item is SimulationDetail => item !== null).sort((a, b) => (parseTimestamp(b.updatedAt) || parseTimestamp(b.createdAt)) - (parseTimestamp(a.updatedAt) || parseTimestamp(a.createdAt)));
  } catch { return []; }
};

const saveLocalDetails = async (rows: SimulationDetail[]): Promise<void> => {
  if (rows.length === 0) { await AsyncStorage.removeItem(LOCAL_SIMULATIONS_KEY); return; }
  const sorted = [...rows].sort((a, b) => (parseTimestamp(b.updatedAt) || parseTimestamp(b.createdAt)) - (parseTimestamp(a.updatedAt) || parseTimestamp(a.createdAt))).slice(0, LOCAL_SIMULATIONS_LIMIT);
  await AsyncStorage.setItem(LOCAL_SIMULATIONS_KEY, JSON.stringify(sorted));
};

const readLocalRows = async () => sortSimulationRows((await readLocalDetails()).map(toListItem));
const appendLocalSimulation = async (simulation: Record<string, any>, resolvedId: string) => {
  const existingRows = await readLocalDetails();
  const now = Date.now();
  const nextItem = normalizeSimulationDetail({ id: resolvedId, name: simulation?.config?.name || simulation?.name || 'Simulado mobile', status: simulation?.status || 'completed', score: simulation?.score, questionCount: simulation?.config?.questionCount || simulation?.questions?.length, createdAt: simulation?.startTime || now, updatedAt: simulation?.endTime || now, config: simulation?.config, questions: simulation?.questions, answers: simulation?.answers, startTime: simulation?.startTime, endTime: simulation?.endTime, source: 'local' }, 'local');
  if (nextItem) await saveLocalDetails([nextItem, ...existingRows.filter((item) => String(item.id) !== String(nextItem.id))]);
};

const mergeRows = (remoteRows: SimulationListItem[], localRows: SimulationListItem[]) => {
  const map = new Map<string, SimulationListItem>();
  localRows.forEach((item) => map.set(String(item.id), { ...item, source: 'local' }));
  remoteRows.forEach((item) => map.set(String(item.id), { ...map.get(String(item.id)), ...item, source: 'remote' }));
  return sortSimulationRows(Array.from(map.values()));
};

const normalizeAnswerResults = (value: unknown): Record<string, SimulationAnswerResult> => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return Object.fromEntries(Object.entries(value as Record<string, any>).filter(([, result]) => result && typeof result === 'object').map(([questionId, result]) => [questionId, { selectedOptionIndex: Number(result.selectedOptionIndex ?? result.selected_option_index ?? -1), isCorrect: Boolean(result.isCorrect ?? result.is_correct), correctOptionIndex: Number(result.correctOptionIndex ?? result.correct_option_index ?? -1) }]));
};

export const simulationsService = {
  async list(): Promise<SimulationListItem[]> {
    const localRows = await readLocalRows();
    try {
      const response: any = await apiClient.get<any>(ENDPOINTS.simulations.list);
      const payload = readApiData<any>(response, []);
      const remoteRows = normalizeSimulationRows(payload, 'remote').map((item) => ({ ...item, source: 'remote' as const }));
      return remoteRows.length === 0 ? localRows : mergeRows(remoteRows, localRows);
    } catch (error: any) {
      if (error?.response?.status === 404 || localRows.length > 0) return localRows;
      throw new Error(readApiErrorMessage(error, 'Nao foi possivel carregar simulados.'));
    }
  },

  async getDetail(id: string): Promise<SimulationDetail | null> {
    const targetId = String(id).trim();
    if (!targetId) return null;
    const localMatch = (await readLocalDetails()).find((item) => String(item.id) === targetId);
    try {
      const response: any = await apiClient.get<any>(ENDPOINTS.simulations.list);
      const payload = readApiData<any>(response, []);
      const remoteMatch = extractPayloadRows(payload).map((item) => normalizeSimulationDetail(item, 'remote')).find((item) => item && String(item.id) === targetId) || null;
      if (remoteMatch) {
        // O servidor e a fonte de verdade; o cache local apenas complementa dados legados ausentes.
        const merged: SimulationDetail = { ...localMatch, ...remoteMatch, questions: remoteMatch.questions?.length ? remoteMatch.questions : localMatch?.questions, answers: remoteMatch.answers || localMatch?.answers, source: 'remote' };
        const localRows = await readLocalDetails();
        await saveLocalDetails([merged, ...localRows.filter((item) => String(item.id) !== targetId)]);
        return merged;
      }
      return localMatch || null;
    } catch (error: any) {
      if (error?.response?.status === 404 && localMatch) return localMatch;
      if (localMatch) return localMatch;
      throw new Error(readApiErrorMessage(error, 'Nao foi possivel carregar o detalhe do simulado.'));
    }
  },

  async saveSimulation(simulation: Record<string, any>): Promise<SimulationSaveResult> {
    const response: any = await apiClient.post<any>(ENDPOINTS.simulations.create, simulation);
    const envelope = assertApiSuccess(response, 'Nao foi possivel salvar o simulado.');
    const payload = readApiData<any>(response, {});
    const resolvedId = String(payload?.id || envelope.raw?.id || simulation?.id || `sim-mobile-${Date.now()}`);
    const score = Number(payload?.score ?? envelope.raw?.score ?? 0);
    const status = String(payload?.status || simulation?.status || 'completed');
    await appendLocalSimulation({ ...simulation, id: resolvedId, status, score, endTime: simulation?.endTime || Date.now() }, resolvedId);
    return { success: true, id: resolvedId, status, score: Number.isFinite(score) ? score : 0, answeredCount: Number(payload?.answeredCount ?? 0), correctCount: Number(payload?.correctCount ?? score ?? 0), results: normalizeAnswerResults(payload?.results), newXp: payload?.newXp ?? payload?.new_xp ?? envelope.raw?.newXp ?? envelope.raw?.new_xp, newLevel: payload?.newLevel ?? payload?.new_level ?? envelope.raw?.newLevel ?? envelope.raw?.new_level, message: envelope.message };
  },
};

export default simulationsService;

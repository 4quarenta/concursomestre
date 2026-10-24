import { apiClient, assertApiSuccess, readApiData } from '@services/api';
export type PlanSubject = { id: string; name: string; topics: string[]; questions: number; weight: number; minimum: number };
export type PlanConfig = { title: string; bank: string; area: string; organizationId?: string; positionId?: string; boardId?: string; areaId?: string; sourceUrl: string; dateConfirmed: boolean; startDate: string; examDate: string; availability: Record<string, number>; sessionMinutes: number; questionGoal: number; reservePercent: number; wrongPenalty: number; subjects: PlanSubject[] };
export type PlanSession = { id: string; date: string; subjectId: string; subject: string; topic: string; kind: 'study' | 'questions' | 'review'; minutes: number; questionGoal: number; status: 'planned' | 'started' | 'completed'; actualMinutes: number; startedAt?: string; completedAt?: string };
export type StudyPlan = { id: string; title: string; status: string; revision: number; created_at: string; config: PlanConfig; sessions: PlanSession[] };
export type PlanTemplate = { id: string; title: string; status: string; version: number; updated_at: string; config: PlanConfig };
export type Performance = Record<string, { total: number; correct: number; accuracy: number | null }>;
export type PlannerResponse = { plans?: StudyPlan[]; plan?: StudyPlan; templates?: PlanTemplate[]; performance?: Performance; sessions?: PlanSession[]; canManageTemplates?: boolean; legacy?: { form?: Record<string, unknown>; generatedPlan?: unknown } | null };
const endpoint = 'study-schedule/planner.php';
export const plannerService = {
  async read(id?: string, days = 0): Promise<PlannerResponse> {
    const response: unknown = await apiClient.get(endpoint, { params: { id, days } });
    assertApiSuccess(response, 'Não foi possível carregar os cronogramas.');
    return readApiData<PlannerResponse>(response, {});
  },
  async write(input: Record<string, unknown>): Promise<PlannerResponse> {
    const response: unknown = await apiClient.post(endpoint, input);
    assertApiSuccess(response, 'Não foi possível salvar o cronograma.');
    return readApiData<PlannerResponse>(response, {});
  },
};
export function localDate(date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
export function initialPlan(): PlanConfig {
  const end = new Date(); end.setDate(end.getDate() + 90);
  return { title: '', bank: '', area: '', sourceUrl: '', dateConfirmed: false, startDate: localDate(), examDate: localDate(end), availability: { '1': 120, '2': 120, '3': 120, '4': 120, '5': 120, '6': 0, '7': 0 }, sessionMinutes: 40, questionGoal: 20, reservePercent: 15, wrongPenalty: 0, subjects: [{ id: 's0', name: '', topics: [], questions: 10, weight: 1, minimum: 0 }] };
}

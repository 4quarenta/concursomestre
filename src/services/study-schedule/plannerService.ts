import { apiClient, assertApiSuccess, readApiData } from '@services/api';
export type PlanSubject = { id: string; taxonomyId?: string; selectedTaxonomyIds?: string[]; selfAssessment?: 'beginner' | 'studying' | 'reinforce'; evidence?: { examCount: number; questionCount: number; incidence: number | null }; name: string; topics: string[]; questions: number; weight: number; minimum: number };
export type PlannerDiagnosisItem = { id: string; name: string; level: 'materia' | 'topico' | 'subtopico' | 'assunto'; parentId: string | null; rootId: string | null; path: string; questionCount: number; examCount: number; incidence: number | null; performance: { total: number; correct: number; accuracy: number | null } };
export type PlannerDiagnosis = { examCount: number; items: PlannerDiagnosisItem[]; selectedPerformance: Record<string, { total: number; correct: number; accuracy: number | null }>; sample: 'adequate' | 'limited' | 'unavailable' };
export type AvailabilityWindow = { start: string; end: string };
export type PlanConfig = { title: string; bank: string; area: string; organizationId?: string; positionId?: string; boardId?: string; areaId?: string; sourceUrl: string; dateConfirmed: boolean; startDate: string; examDate: string; availability: Record<string, number>; availabilityWindows: Record<string, AvailabilityWindow>; sessionMinutes: number; questionGoal: number; reservePercent: number; wrongPenalty: number; subjects: PlanSubject[] };
export type PlanSession = { id: string; date: string; startTime?: string; endTime?: string; subjectId: string; subject: string; topic: string; kind: 'study' | 'questions' | 'review'; minutes: number; questionGoal: number; status: 'planned' | 'started' | 'completed'; actualMinutes: number; startedAt?: string; completedAt?: string };
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
  async diagnose(input: { organizationId: string; positionId: string; boardId?: string; areaId?: string; search?: string; level?: string; parentId?: string; selectedIds?: string[] }): Promise<PlannerDiagnosis> {
    const response: unknown = await apiClient.post(endpoint, { action: 'diagnosis', ...input });
    assertApiSuccess(response, 'Não foi possível analisar o conteúdo deste recorte.');
    return readApiData<PlannerDiagnosis>(response, { examCount: 0, items: [], selectedPerformance: {}, sample: 'unavailable' });
  },
};
export function localDate(date = new Date()): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
export function initialPlan(): PlanConfig {
  const end = new Date(); end.setDate(end.getDate() + 90);
  return { title: '', bank: '', area: '', sourceUrl: '', dateConfirmed: false, startDate: localDate(), examDate: localDate(end), availability: { '1': 120, '2': 120, '3': 120, '4': 120, '5': 120, '6': 0, '7': 0 }, availabilityWindows: { '1': { start: '19:00', end: '21:00' }, '2': { start: '19:00', end: '21:00' }, '3': { start: '19:00', end: '21:00' }, '4': { start: '19:00', end: '21:00' }, '5': { start: '19:00', end: '21:00' }, '6': { start: '19:00', end: '19:00' }, '7': { start: '19:00', end: '19:00' } }, sessionMinutes: 40, questionGoal: 20, reservePercent: 15, wrongPenalty: 0, subjects: [{ id: 's0', name: '', topics: [], questions: 10, weight: 1, minimum: 0 }] };
}

export function availabilityMinutes(window: AvailabilityWindow | undefined, fallback = 0): number {
  if (!window) return fallback;
  if (window.start === window.end) return 0;
  const parse = (value: string, endBoundary = false) => {
    const match = /^(?:([01]\d|2[0-3]):([0-5]\d)|00:00)$/.exec(value);
    if (!match) return null;
    return value === '00:00' ? (endBoundary ? 1440 : 0) : Number(match[1]) * 60 + Number(match[2]);
  };
  const start = parse(window.start);
  const end = parse(window.end, true);
  if (start === null || end === null || start === end) return 0;
  const duration = end - start;
  return duration > 0 && duration <= 600 ? duration : 0;
}

export function withAvailabilityDefaults(config: PlanConfig): PlanConfig {
  const windows = { ...config.availabilityWindows };
  const availability = { ...config.availability };
  for (let day = 1; day <= 7; day++) {
    const key = String(day);
    if (windows[key]) continue;
    const minutes = Math.max(0, Math.min(600, Number(availability[key]) || 0));
    const start = Math.min(19 * 60, 1440 - minutes);
    const end = start + minutes;
    const format = (value: number) => value === 1440 ? '00:00' : `${String(Math.floor(value / 60)).padStart(2, '0')}:${String(value % 60).padStart(2, '0')}`;
    windows[key] = { start: format(start), end: format(end) };
  }
  for (let day = 1; day <= 7; day++) availability[String(day)] = availabilityMinutes(windows[String(day)], availability[String(day)] || 0);
  return { ...config, availability, availabilityWindows: windows };
}

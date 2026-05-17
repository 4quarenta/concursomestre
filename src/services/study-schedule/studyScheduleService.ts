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

import { apiClient, assertApiSuccess, readApiData, ENDPOINTS } from '@services/api';

export type StudyScheduleSnapshot<TForm = unknown, TPlan = unknown> = {
  userId?: string;
  form: TForm;
  generatedPlan: TPlan | null;
  generatedAt?: string | null;
  savedAt?: string | null;
  createdAt?: string | null;
  updatedAt?: string | null;
};

type StudyScheduleResponse<TForm, TPlan> = {
  schedule?: StudyScheduleSnapshot<TForm, TPlan> | null;
  access?: {
    planName?: string;
    isElite?: boolean;
    featureEnabled?: boolean;
  };
};

export const studyScheduleService = {
  async get<TForm = unknown, TPlan = unknown>(): Promise<StudyScheduleSnapshot<TForm, TPlan> | null> {
    const response = await apiClient.get(ENDPOINTS.studySchedule.get) as unknown;
    assertApiSuccess(response, 'Nao foi possivel carregar o cronograma.');
    const payload = readApiData<StudyScheduleResponse<TForm, TPlan>>(response, {});
    return payload.schedule || null;
  },

  async save<TForm = unknown, TPlan = unknown>(
    form: TForm,
    generatedPlan: TPlan | null
  ): Promise<StudyScheduleSnapshot<TForm, TPlan> | null> {
    const response = await apiClient.post(ENDPOINTS.studySchedule.save, {
      form,
      generatedPlan,
      generatedAt: generatedPlan && typeof generatedPlan === 'object'
        ? (generatedPlan as Record<string, unknown>).generatedAt
        : null,
    }) as unknown;

    const envelope = assertApiSuccess(response, 'Nao foi possivel salvar o cronograma.');
    const payload = readApiData<StudyScheduleResponse<TForm, TPlan>>(response, {});

    if (payload.schedule) {
      return payload.schedule;
    }

    return (envelope.data as StudyScheduleResponse<TForm, TPlan> | undefined)?.schedule || null;
  },

  async remove(): Promise<void> {
    const response = await apiClient.post(ENDPOINTS.studySchedule.delete, {}) as unknown;
    assertApiSuccess(response, 'Nao foi possivel remover o cronograma.');
  },
};

export default studyScheduleService;

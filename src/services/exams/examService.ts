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

import type { ExamFileAttachment, ExamFileKind, Prova } from '@types';
import { apiClient } from '@services/api/client';
import { ENDPOINTS } from '@services/api/endpoints';

interface ApiEnvelope<T> {
    success?: boolean;
    message?: string;
    data?: T;
}

export interface ExamExtractionRecord {
    id: number;
    provaId?: number | null;
    arquivoId?: number | null;
    origem?: string;
    status?: string;
    parserProfile?: string | null;
    extracted?: Record<string, unknown>;
    review?: Record<string, unknown>;
    errorMessage?: string | null;
    createdAt?: string | null;
    updatedAt?: string | null;
}

const readApiData = <T>(payload: ApiEnvelope<T> | T): T => {
    if (payload && typeof payload === 'object' && 'data' in payload) {
        return (payload as ApiEnvelope<T>).data as T;
    }

    return payload as T;
};

const readErrorMessage = (error: unknown, fallback: string): string => {
    if (error && typeof error === 'object' && 'response' in error) {
        const response = (error as { response?: { data?: { message?: string } } }).response;
        return response?.data?.message || fallback;
    }

    return error instanceof Error ? error.message : fallback;
};

export const examService = {
    async list(params: Record<string, unknown> = {}): Promise<Prova[]> {
        const response = await apiClient.get<ApiEnvelope<{ items?: Prova[] }>>(ENDPOINTS.exams.list, {
            params,
        });
        const data = readApiData(response.data);
        return Array.isArray(data?.items) ? data.items : [];
    },

    async show(id: string | number): Promise<Prova | null> {
        const response = await apiClient.get<ApiEnvelope<{ exam?: Prova }>>(ENDPOINTS.exams.show, {
            params: { id },
        });
        const data = readApiData(response.data);
        return data?.exam || null;
    },

    async save(exam: Partial<Prova>): Promise<Prova> {
        try {
            const payload = { ...exam };
            if (!payload.id || String(payload.id) === '0' || String(payload.id) === 'new') {
                delete payload.id;
            }
            const response = await apiClient.post<ApiEnvelope<{ exam?: Prova }>>(ENDPOINTS.exams.save, payload);
            const data = readApiData(response.data);
            if (!data?.exam) {
                throw new Error('A API não retornou a prova salva.');
            }
            return data.exam;
        } catch (error) {
            throw new Error(readErrorMessage(error, 'Não foi possível salvar a prova.'));
        }
    },

    async remove(id: string | number): Promise<void> {
        try {
            await apiClient.post(ENDPOINTS.exams.delete, { id });
        } catch (error) {
            throw new Error(readErrorMessage(error, 'Não foi possível arquivar a prova.'));
        }
    },

    async uploadFile(file: File, kind: ExamFileKind, examId?: string | number | null): Promise<ExamFileAttachment> {
        try {
            const formData = new FormData();
            formData.append('file', file);
            formData.append('kind', kind);
            if (examId && String(examId) !== 'new') {
                formData.append('exam_id', String(examId));
            }

            const response = await apiClient.post<ApiEnvelope<{ file?: ExamFileAttachment }>>(
                ENDPOINTS.exams.fileUpload,
                formData,
                { headers: { 'Content-Type': 'multipart/form-data' } },
            );
            const data = readApiData(response.data);
            if (!data?.file) {
                throw new Error('A API não retornou o arquivo anexado.');
            }
            return data.file;
        } catch (error) {
            throw new Error(readErrorMessage(error, 'Não foi possível anexar o arquivo da prova.'));
        }
    },

    async listFiles(examId: string | number): Promise<ExamFileAttachment[]> {
        const response = await apiClient.get<ApiEnvelope<{ items?: ExamFileAttachment[] }>>(ENDPOINTS.exams.files, {
            params: { exam_id: examId },
        });
        const data = readApiData(response.data);
        return Array.isArray(data?.items) ? data.items : [];
    },

    async removeFile(examId: string | number, fileId: string | number): Promise<void> {
        try {
            await apiClient.post(ENDPOINTS.exams.fileDelete, {
                exam_id: examId,
                file_id: fileId,
            });
        } catch (error) {
            throw new Error(readErrorMessage(error, 'Não foi possível remover o arquivo da prova.'));
        }
    },

    async startExtraction(payload: Record<string, unknown>): Promise<ExamExtractionRecord> {
        try {
            const response = await apiClient.post<ApiEnvelope<{ extraction?: ExamExtractionRecord }>>(
                ENDPOINTS.exams.extractionStart,
                payload,
            );
            const data = readApiData(response.data);
            if (!data?.extraction) {
                throw new Error('A API não retornou a extração criada.');
            }
            return data.extraction;
        } catch (error) {
            throw new Error(readErrorMessage(error, 'Não foi possível iniciar a extração da prova.'));
        }
    },

    async showExtraction(id: string | number): Promise<ExamExtractionRecord | null> {
        const response = await apiClient.get<ApiEnvelope<{ extraction?: ExamExtractionRecord }>>(
            ENDPOINTS.exams.extractionShow,
            { params: { id } },
        );
        const data = readApiData(response.data);
        return data?.extraction || null;
    },

    async reviewExtraction(id: string | number, payload: Record<string, unknown>): Promise<{
        extraction?: ExamExtractionRecord;
        exam?: Prova | null;
    }> {
        try {
            const response = await apiClient.post<ApiEnvelope<{
                extraction?: ExamExtractionRecord;
                exam?: Prova | null;
            }>>(ENDPOINTS.exams.extractionReview, {
                ...payload,
                id,
            });
            return readApiData(response.data) || {};
        } catch (error) {
            throw new Error(readErrorMessage(error, 'Não foi possível revisar a extração da prova.'));
        }
    },
};

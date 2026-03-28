/**
 * Question Service
 * Handles all question-related operations with batch creation
 */

import { apiClient, ENDPOINTS } from '@core/api';
import type { ApiResponse } from '@core/api/types';
import type { Question, UserAnswer } from 'types';

export const questionService = {
    /**
     * Get questions with optional filters
     */
    async getQuestions(filters?: Record<string, any>): Promise<Question[]> {
        try {
            const response = await apiClient.get<ApiResponse<any>>(
                ENDPOINTS.questions.list,
                { params: filters }
            );

            const responseData = response.data.data;
            if (Array.isArray(responseData)) {
                return responseData;
            } else if (responseData && Array.isArray(responseData.rows)) {
                return responseData.rows;
            }

            return [];
        } catch (error) {
            console.error('Error fetching questions:', error);
            return [];
        }
    },

    /**
     * Submit an answer
     */
    async submitAnswer(answer: UserAnswer): Promise<{ success: boolean; message?: string }> {
        try {
            const response = await apiClient.post<ApiResponse>(
                ENDPOINTS.questions.submit,
                answer
            );
            return { success: response.data.success, message: response.data.message };
        } catch (error: any) {
            return { success: false, message: error.message };
        }
    },

    /**
     * Create a single question
     */
    async createQuestion(questionData: Question): Promise<{ success: boolean; question?: Question }> {
        try {
            const response = await apiClient.post<ApiResponse<Question>>(
                ENDPOINTS.questions.create,
                questionData
            );
            return { success: response.data.success, question: response.data.data };
        } catch (error: any) {
            return { success: false };
        }
    },

    /**
     * Create multiple questions (batch)
     */
    async createQuestions(questions: Question[]): Promise<{ success: boolean; count?: number; created?: Question[] }> {
        try {
            // Create questions one by one
            let successCount = 0;
            const created: Question[] = [];
            for (const question of questions) {
                const result = await this.createQuestion(question);
                if (result.success && result.question) {
                    successCount++;
                    created.push(result.question);
                }
            }
            return { success: true, count: successCount, created };
        } catch (error: any) {
            return { success: false };
        }
    },

    /**
     * Update a question
     */
    async updateQuestion(id: string, questionData: Question): Promise<{ success: boolean }> {
        try {
            const response = await apiClient.post<ApiResponse>(
                ENDPOINTS.questions.update,
                { ...questionData, id }
            );
            return { success: response.data.success };
        } catch (error: any) {
            return { success: false };
        }
    },

    /**
     * Delete a question
     */
    async deleteQuestion(id: string): Promise<{ success: boolean }> {
        try {
            const response = await apiClient.post<ApiResponse>(
                ENDPOINTS.questions.delete,
                { id }
            );
            return { success: response.data.success };
        } catch (error: any) {
            return { success: false };
        }
    },
};

export default questionService;

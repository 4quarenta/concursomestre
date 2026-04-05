import { Question, FilterResponse } from '../types';
import { api } from '../data/api';

export const questionService = {
    createQuestions: async (questions: Question[]): Promise<any> => {
        // ... (keep usage of api.post if you want to update this later)
        return api.post('api/questions/create.php', questions);
    },

    getQuestions: async (page = 1, perPage = 10, filters = {}): Promise<FilterResponse['data']> => {
        const response = await api.get<FilterResponse>('api/questions/list.php', {
            page: page.toString(),
            per_page: perPage.toString(),
            ...filters
        });

        if (response.success && response.data) {
            // The API returns { data: { total, rows... } } directly in 'data' often, 
            // but our ApiResponse wrapper puts it in 'data'. 
            // Let's assume the API returns the structure directly in 'data'.
            return response.data as any;
        }

        // Fallback
        return {
            total: 0,
            perPage,
            pages: 0,
            page,
            rows: []
        };
    }
};

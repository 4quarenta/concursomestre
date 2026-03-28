
export const API_BASE_URL = 'http://localhost/questao-pro-backend';

export interface ApiResponse<T = any> {
    success: boolean;
    data?: T;
    error?: string;
    message?: string;
}

export const api = {
    get: async <T>(endpoint: string, params?: Record<string, string>): Promise<ApiResponse<T>> => {
        try {
            const url = new URL(`${API_BASE_URL}/${endpoint}`);
            if (params) {
                Object.keys(params).forEach(key => url.searchParams.append(key, params[key]));
            }

            const response = await fetch(url.toString(), {
                method: 'GET',
                headers: {
                    'Content-Type': 'application/json',
                    // 'Authorization': `Bearer ${token}` // Add auth token later
                },
            });

            const data = await response.json();
            return data;
        } catch (error: any) {
            console.error(`API GET Error (${endpoint}):`, error);
            return { success: false, error: error.message || 'Network error' };
        }
    },

    post: async <T>(endpoint: string, body: any): Promise<ApiResponse<T>> => {
        try {
            const response = await fetch(`${API_BASE_URL}/${endpoint}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(body),
            });

            const data = await response.json();
            return data;
        } catch (error: any) {
            console.error(`API POST Error (${endpoint}):`, error);
            return { success: false, error: error.message || 'Network error' };
        }
    },

    put: async <T>(endpoint: string, body: any): Promise<ApiResponse<T>> => {
        try {
            const response = await fetch(`${API_BASE_URL}/${endpoint}`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(body),
            });

            const data = await response.json();
            return data;
        } catch (error: any) {
            console.error(`API PUT Error (${endpoint}):`, error);
            return { success: false, error: error.message || 'Network error' };
        }
    },

    delete: async <T>(endpoint: string): Promise<ApiResponse<T>> => {
        try {
            const response = await fetch(`${API_BASE_URL}/${endpoint}`, {
                method: 'DELETE',
                headers: {
                    'Content-Type': 'application/json',
                },
            });

            const data = await response.json();
            return data;
        } catch (error: any) {
            console.error(`API DELETE Error (${endpoint}):`, error);
            return { success: false, error: error.message || 'Network error' };
        }
    }
};

/**
 * API Client Configuration
 * Centralized Axios instance with interceptors
 */

import axios, { AxiosError, InternalAxiosRequestConfig, AxiosResponse } from 'axios';
import { logger } from '../debug/DebugLogger';

// Base URL from environment variable
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost/questao-pro-backend/api/';

// Create axios instance
export const apiClient = axios.create({
    baseURL: API_BASE_URL,
    timeout: 30000,
    headers: {
        'Content-Type': 'application/json',
    },
});

// Request interceptor - Add auth token
apiClient.interceptors.request.use(
    (config: InternalAxiosRequestConfig) => {
        // Get token from localStorage
        const token = localStorage.getItem('token');

        if (token && config.headers) {
            config.headers.Authorization = `Bearer ${token}`;
            // Add custom header to bypass Apache stripping
            config.headers['X-Auth-Token'] = token;
            if (import.meta.env.DEV) {
                console.log('🔹 Attaching Token:', token.substring(0, 10) + '...');
                console.log('🔹 Request URL:', config.url);
                console.log('🔹 Headers:', JSON.stringify({
                    Authorization: config.headers.Authorization?.substring(0, 20) + '...',
                    'X-Auth-Token': config.headers['X-Auth-Token']?.substring(0, 10) + '...'
                }));
            }
        } else {
            // Requisições públicas não precisam de token — sem aviso
        }

        // Handle FormData - let browser set Content-Type with boundary
        if (config.data instanceof FormData) {
            // Remove Content-Type header to let browser set it automatically with boundary
            delete config.headers['Content-Type'];
            if (import.meta.env.DEV) {
                console.log('📤 FormData detected - letting browser set Content-Type');
            }
        }

        // Log request in development
        if (import.meta.env.DEV) {
            console.log('🚀 API Request:', config.method?.toUpperCase(), config.url);
            logger.addLog('request', `${config.method?.toUpperCase()} ${config.url}`, config.data);
        }

        return config;
    },
    (error: AxiosError) => {
        console.error('❌ Request Error:', error);
        return Promise.reject(error);
    }
);

// Response interceptor - Handle errors globally
apiClient.interceptors.response.use(
    (response: AxiosResponse) => {
        // Log response in development
        if (import.meta.env.DEV) {
            console.log('✅ API Response:', response.config.url, response.data);
            logger.addLog('response', `SUCCESS: ${response.config.url}`, response.data);
        }

        return response.data;
    },
    (error: AxiosError) => {
        // Handle different error types
        if (error.response) {
            const status = error.response.status;
            const data = error.response.data as any;

            // Log error in development
            if (import.meta.env.DEV) {
                console.error('❌ API Error:', status, error.config?.url, data);
                logger.addLog('api-error', `ERROR ${status}: ${error.config?.url}`, data);
            }

            // Handle specific status codes
            switch (status) {
                case 401: {
                    // Só age se havia token salvo (sessão expirada)
                    const hadToken = !!localStorage.getItem('token');
                    const jaEstaNoAuth = window.location.hash.includes('/auth') ||
                        window.location.pathname.includes('/auth');

                    if (hadToken && !jaEstaNoAuth) {
                        // Limpa credenciais e despacha evento — App.tsx redireciona sem reload
                        localStorage.removeItem('token');
                        localStorage.removeItem('user');
                        window.dispatchEvent(new CustomEvent('auth:session-expired', { 
                            detail: { message: data.message || 'Sessão expirada' } 
                        }));
                    }
                    break;
                }

                case 403:
                    // Forbidden
                    console.error('Access forbidden:', data.message);
                    break;

                case 404:
                    // Not found
                    console.error('Resource not found:', error.config?.url);
                    break;

                case 429:
                    // Too many requests
                    console.error('Rate limit exceeded. Please try again later.');
                    break;

                case 500:
                    // Server error
                    console.error('Server error:', data.message);
                    break;

                default:
                    console.error('API Error:', data.message || 'Unknown error');
            }
        } else if (error.request) {
            // Request made but no response received
            console.error('❌ Network Error: No response from server');
        } else {
            // Error in request setup
            console.error('❌ Request Setup Error:', error.message);
            if (import.meta.env.DEV) {
                logger.addLog('error', `Setup Error: ${error.message}`);
            }
        }

        return Promise.reject(error);
    }
);

/**
 * Constrói a URL autenticada para download de PDF com marca d'água.
 * O backend valida o token e estampa os dados do usuário no arquivo.
 */
export const buildDownloadUrl = (materialId: string): string => {
    const token = localStorage.getItem('token') || '';
    const backendRoot = API_BASE_URL.replace(/\/api\/$/, '');
    return `${backendRoot}/api/materials/download.php?material_id=${encodeURIComponent(materialId)}&token=${encodeURIComponent(token)}`;
};

export const getAssetUrl = (path: string) => {
    if (!path) return '';
    if (path.startsWith('http')) return path;

    // API_BASE_URL usually ends with '/api/'
    // We want to go to the root of the backend
    let backendRoot = API_BASE_URL.replace(/\/api\/$/, '');

    // If backendRoot is relative (e.g. starts with /), make it absolute using current window.location
    // but ONLY if we are in production or if the backend is on the same server. 
    // In development (localhost:3000), we usually want to point to localhost (80)
    if (!backendRoot.startsWith('http')) {
        const origin = window.location.origin; // e.g. http://localhost:3000
        // If we are on port 3000, we probably want port 80 for the backend unless configured otherwise
        const backendOrigin = origin.replace(':3000', ''); 
        backendRoot = `${backendOrigin}${backendRoot.startsWith('/') ? '' : '/'}${backendRoot}`;
    }

    // Standardize path
    const cleanPath = path.startsWith('/') ? path.substring(1) : path;
    
    // If the path already contains the backend folder name (e.g. questao-pro-backend), 
    // and backendRoot also has it, we need to be careful not to double it.
    // However, the safest way is to just append relative to the domain if it starts with the folder.
    
    if (cleanPath.startsWith('uploads/')) {
        // Correctly append to the folder root
        return `${backendRoot}/${cleanPath}`;
    }

    return `${backendRoot}/${cleanPath}`;
};

export default apiClient;

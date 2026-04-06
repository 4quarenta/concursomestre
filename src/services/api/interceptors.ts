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

import type { AxiosError, AxiosResponse, InternalAxiosRequestConfig } from 'axios';
import { logger } from '../../utils/helpers/DebugLogger';
import { getAccessToken, refreshAuthSession } from '@services/auth/session';

export interface AuthAwareRequestConfig extends InternalAxiosRequestConfig {
    _retry?: boolean;
    _authTokenUsed?: string | null;
    _skipRefreshHandling?: boolean;
}

/**
 * Tenta converter payloads de texto que na pratica contem JSON.
 * Isso suaviza diferencas de resposta entre endpoints PHP antigos e novos.
 * @since 1.0.0
 */
const parseJsonLikePayload = <T>(payload: T): T => {
    if (typeof payload !== 'string') {
        return payload;
    }

    const normalized = payload.replace(/^\uFEFF+/, '').trim();
    if (!normalized) {
        return payload;
    }

    try {
        return JSON.parse(normalized) as T;
    } catch {
        return payload;
    }
};

/**
 * Identifica endpoints de autenticação que não devem disparar refresh recursivo.
 * Evita loops de renovação enquanto login, logout e refresh ainda estão em andamento.
 * @since 1.0.0
 */
const isAuthEndpoint = (url?: string | null): boolean => {
    if (!url) return false;

    const normalizedUrl = url.toLowerCase();
    return normalizedUrl.includes('auth/login.php')
        || normalizedUrl.includes('auth/register.php')
        || normalizedUrl.includes('auth/refresh.php')
        || normalizedUrl.includes('auth/logout.php')
        || normalizedUrl.includes('auth/forgot-password.php')
        || normalizedUrl.includes('auth/verify_2fa.php');
};

/**
 * Registra os interceptadores de request/response da camada HTTP oficial.
 * Eles ligam token em memoria, refresh automático e telemetria de debug da aplicação.
 * @since 1.0.0
 */
export const registerApiInterceptors = (apiClient: any): void => {
    apiClient.interceptors.request.use(
        (config: InternalAxiosRequestConfig) => {
            const token = getAccessToken();

            (config as AuthAwareRequestConfig)._authTokenUsed = token;

            if (token && config.headers) {
                config.headers.Authorization = `Bearer ${token}`;
                config.headers['X-Auth-Token'] = token;
            }

            if (config.data instanceof FormData) {
                delete config.headers['Content-Type'];
            }

            if (import.meta.env.DEV) {
                logger.addLog('request', `${config.method?.toUpperCase()} ${config.url}`, config.data);
            }

            return config;
        },
        (error: AxiosError) => Promise.reject(error)
    );

    apiClient.interceptors.response.use(
        (response: AxiosResponse) => {
            const data = parseJsonLikePayload(response.data);

            if (import.meta.env.DEV) {
                logger.addLog('response', `SUCCESS: ${response.config.url}`, data);
            }

            return data;
        },
        async (error: AxiosError) => {
            const requestConfig = (error.config || {}) as AuthAwareRequestConfig;

            if (error.response) {
                const status = error.response.status;
                const data = parseJsonLikePayload(error.response.data as any);
                error.response.data = data;

                if (import.meta.env.DEV) {
                    logger.addLog('api-error', `ERROR ${status}: ${error.config?.url}`, data);
                }

                const shouldAttemptRefresh =
                    status === 401 &&
                    !requestConfig._retry &&
                    !requestConfig._skipRefreshHandling &&
                    !isAuthEndpoint(error.config?.url);

                if (shouldAttemptRefresh) {
                    try {
                        requestConfig._retry = true;
                        await refreshAuthSession({
                            reason: 'http-401',
                            force: true,
                        });

                        const nextToken = getAccessToken();
                        if (nextToken && requestConfig.headers) {
                            requestConfig.headers.Authorization = `Bearer ${nextToken}`;
                            requestConfig.headers['X-Auth-Token'] = nextToken;
                        }

                        return apiClient(requestConfig);
                    } catch (refreshError) {
                        if (import.meta.env.DEV) {
                            logger.addLog('auth-refresh-failed', `401 without recovery: ${error.config?.url}`, {
                                originalError: data,
                                refreshError,
                            });
                        }
                    }
                }

                switch (status) {
                    case 401:
                        console.error('Unauthorized request:', error.config?.url, data?.message);
                        break;
                    case 403:
                        console.error('Access forbidden:', data?.message);
                        break;
                    case 404:
                        console.error('Resource not found:', error.config?.url);
                        break;
                    case 429:
                        console.error('Rate limit exceeded. Please try again later.');
                        break;
                    case 500:
                        console.error('Server error:', data?.message);
                        break;
                    default:
                        console.error('API Error:', data?.message || 'Unknown error');
                }
            } else if (error.request) {
                console.error('Network Error: No response from server');
            } else {
                console.error('Request Setup Error:', error.message);
                if (import.meta.env.DEV) {
                    logger.addLog('error', `Setup Error: ${error.message}`);
                }
            }

            return Promise.reject(error);
        }
    );
};

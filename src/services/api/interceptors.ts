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
import { getAccessToken, isAccessTokenExpired, refreshAuthSession } from '@services/auth/session';
import { dispatchAuthSessionExpiredNotice } from '@services/auth/sessionExpiredNotice';
import { clientLog } from '@services/monitoring/clientLog';

export interface AuthAwareRequestConfig extends InternalAxiosRequestConfig {
    _retry?: boolean;
    _authTokenUsed?: string | null;
    _skipRefreshHandling?: boolean;
}

type AxiosInterceptorClient = {
    interceptors: {
        request: {
            use: (
                onFulfilled: (config: InternalAxiosRequestConfig) => InternalAxiosRequestConfig | Promise<InternalAxiosRequestConfig>,
                onRejected?: (error: AxiosError) => Promise<unknown>,
            ) => unknown;
        };
        response: {
            use: (
                onFulfilled: (response: AxiosResponse) => unknown,
                onRejected?: (error: AxiosError) => Promise<unknown>,
            ) => unknown;
        };
    };
    (config: AuthAwareRequestConfig): Promise<unknown>;
};

const readResponseMessage = (payload: unknown): string | undefined => {
    if (!payload || typeof payload !== 'object') {
        return undefined;
    }

    if ('message' in payload && typeof payload.message === 'string' && payload.message.trim()) {
        return payload.message;
    }

    if ('error' in payload && typeof payload.error === 'string' && payload.error.trim()) {
        return payload.error;
    }

    return undefined;
};

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
        || normalizedUrl.includes('auth/google.php')
        || normalizedUrl.includes('auth/facebook.php')
        || normalizedUrl.includes('auth/apple.php')
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
export const registerApiInterceptors = (apiClient: AxiosInterceptorClient): void => {
    apiClient.interceptors.request.use(
        async (config: InternalAxiosRequestConfig) => {
            const authAwareConfig = config as AuthAwareRequestConfig;
            let token = getAccessToken();

            if (
                token
                && authAwareConfig._skipRefreshHandling
                && isAccessTokenExpired(token, 0)
            ) {
                token = null;
            }

            if (
                token
                && !authAwareConfig._skipRefreshHandling
                && !isAuthEndpoint(config.url)
                && isAccessTokenExpired(token, 30)
            ) {
                try {
                    await refreshAuthSession({
                        reason: 'manual',
                        allowAnonymousFailure: true,
                    });
                    token = getAccessToken();
                } catch (refreshError) {
                    if (process.env.NODE_ENV === 'development') {
                        logger.addLog('api-error', `Pre-request refresh failed: ${config.url}`, refreshError);
                    }
                }
            }

            authAwareConfig._authTokenUsed = token;

            if (token && config.headers) {
                config.headers.Authorization = `Bearer ${token}`;
                config.headers['X-Auth-Token'] = token;
            }

            if (config.data instanceof FormData) {
                delete config.headers['Content-Type'];
            }

            if (process.env.NODE_ENV === 'development') {
                logger.addLog('request', `${config.method?.toUpperCase()} ${config.url}`, config.data);
            }

            return config;
        },
        (error: AxiosError) => Promise.reject(error)
    );

    apiClient.interceptors.response.use(
        (response: AxiosResponse) => {
            const data = parseJsonLikePayload(response.data);

            if (process.env.NODE_ENV === 'development') {
                logger.addLog('response', `SUCCESS: ${response.config.url}`, data);
            }

            return data;
        },
        async (error: AxiosError) => {
            const requestConfig = (error.config || {}) as AuthAwareRequestConfig;

            if (error.response) {
                const status = error.response.status;
                const data = parseJsonLikePayload(error.response.data as unknown);
                error.response.data = data;

                if (process.env.NODE_ENV === 'development') {
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
                        const nextToken = getAccessToken();
                        if (nextToken && nextToken !== requestConfig._authTokenUsed && requestConfig.headers) {
                            requestConfig.headers.Authorization = `Bearer ${nextToken}`;
                            requestConfig.headers['X-Auth-Token'] = nextToken;
                            return apiClient(requestConfig);
                        }

                        await refreshAuthSession({
                            reason: 'http-401',
                        });

                        const refreshedToken = getAccessToken();
                        if (refreshedToken && requestConfig.headers) {
                            requestConfig.headers.Authorization = `Bearer ${refreshedToken}`;
                            requestConfig.headers['X-Auth-Token'] = refreshedToken;
                        }

                        return apiClient(requestConfig);
                    } catch (refreshError) {
                        if (process.env.NODE_ENV === 'development') {
                            logger.addLog('api-error', `401 without recovery: ${error.config?.url}`, {
                                originalError: data,
                                refreshError,
                            });
                        }
                    }
                }

                switch (status) {
                    case 401:
                        clientLog.error('Unauthorized request:', error.config?.url, readResponseMessage(data));
                        if (!isAuthEndpoint(error.config?.url)) {
                            dispatchAuthSessionExpiredNotice({
                                status,
                                url: error.config?.url,
                            });
                        }
                        break;
                    case 403:
                        clientLog.error('Access forbidden:', readResponseMessage(data));
                        break;
                    case 404:
                        clientLog.error('Resource not found:', error.config?.url);
                        break;
                    case 429:
                        clientLog.error('Rate limit exceeded. Please try again later.');
                        break;
                    case 500:
                        clientLog.error('Server error:', readResponseMessage(data));
                        break;
                    default:
                        clientLog.error('API Error:', readResponseMessage(data) || 'Unknown error');
                }
            } else if (error.request) {
                clientLog.error('Network Error: No response from server');
            } else {
                clientLog.error('Request Setup Error:', error.message);
                if (process.env.NODE_ENV === 'development') {
                    logger.addLog('error', `Setup Error: ${error.message}`);
                }
            }

            return Promise.reject(error);
        }
    );
};

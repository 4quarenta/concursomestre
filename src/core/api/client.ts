import axios, { AxiosError, AxiosResponse, InternalAxiosRequestConfig } from 'axios';
import { logger } from '../debug/DebugLogger';
import {
    getAccessToken,
    isAccessTokenExpired,
    refreshAuthSession,
} from '../auth/session';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost/questao-pro-backend/api/';

export const apiClient = axios.create({
    baseURL: API_BASE_URL,
    timeout: 30000,
    withCredentials: true,
    headers: {
        'Content-Type': 'application/json',
    },
});

interface AuthAwareRequestConfig extends InternalAxiosRequestConfig {
    _retry?: boolean;
    _authTokenUsed?: string | null;
    _skipRefreshHandling?: boolean;
}

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

const resolveApiBaseUrl = (): string => {
    let baseUrl = API_BASE_URL;

    if (!/^https?:\/\//i.test(baseUrl)) {
        const frontendOrigin = window.location.origin;
        const backendOrigin = frontendOrigin.replace(':3000', '');
        baseUrl = `${backendOrigin}${baseUrl.startsWith('/') ? '' : '/'}${baseUrl}`;
    }

    return baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
};

const resolveBackendRoot = (): string => resolveApiBaseUrl().replace(/\/api\/?$/, '');

const resolveApiResourceUrl = (resource: string): string => {
    if (/^https?:\/\//i.test(resource)) {
        return resource;
    }

    const normalizedResource = resource.replace(/^\/+/, '');

    if (normalizedResource.startsWith('api/')) {
        return `${resolveBackendRoot()}/${normalizedResource}`;
    }

    return `${resolveApiBaseUrl()}${normalizedResource}`;
};

const ensureAuthenticatedAccessToken = async (): Promise<string> => {
    const currentToken = getAccessToken();
    if (currentToken && !isAccessTokenExpired(currentToken, 10)) {
        return currentToken;
    }

    const refreshedSession = await refreshAuthSession({
        reason: 'manual',
        force: true,
    });

    const refreshedToken = refreshedSession?.accessToken ?? getAccessToken();
    if (!refreshedToken) {
        throw new Error('Sessao expirada. Faca login novamente.');
    }

    return refreshedToken;
};

const readFailedResponseMessage = async (response: Response): Promise<string> => {
    const contentType = response.headers.get('content-type') || '';

    if (contentType.includes('application/json')) {
        try {
            const payload = await response.json();
            return payload?.message || payload?.error || `Falha ao acessar o arquivo (${response.status}).`;
        } catch {
            return `Falha ao acessar o arquivo (${response.status}).`;
        }
    }

    try {
        const text = (await response.text()).trim();
        return text || `Falha ao acessar o arquivo (${response.status}).`;
    } catch {
        return `Falha ao acessar o arquivo (${response.status}).`;
    }
};

const fetchAuthenticatedResource = async (
    resource: string,
    init: RequestInit = {},
    hasRetried = false
): Promise<Response> => {
    const token = await ensureAuthenticatedAccessToken();
    const url = resolveApiResourceUrl(resource);
    const headers = new Headers(init.headers || {});

    headers.set('Authorization', `Bearer ${token}`);
    headers.set('X-Auth-Token', token);

    const response = await fetch(url, {
        ...init,
        headers,
        credentials: 'include',
    });

    if (response.status === 401 && !hasRetried) {
        await refreshAuthSession({
            reason: 'http-401',
            force: true,
        });

        return fetchAuthenticatedResource(resource, init, true);
    }

    if (!response.ok) {
        throw new Error(await readFailedResponseMessage(response));
    }

    return response;
};

const getFilenameFromDisposition = (contentDisposition: string | null, fallbackName = 'arquivo.pdf'): string => {
    if (!contentDisposition) {
        return fallbackName;
    }

    const utf8Match = contentDisposition.match(/filename\*\s*=\s*UTF-8''([^;]+)/i);
    if (utf8Match?.[1]) {
        return decodeURIComponent(utf8Match[1]).replace(/[/\\?%*:|"<>]/g, '_');
    }

    const simpleMatch = contentDisposition.match(/filename\s*=\s*"?([^"]+)"?/i);
    if (simpleMatch?.[1]) {
        return simpleMatch[1].replace(/[/\\?%*:|"<>]/g, '_');
    }

    return fallbackName;
};

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

export const buildMaterialDownloadEndpoint = (materialId: string): string =>
    `materials/download.php?material_id=${encodeURIComponent(materialId)}`;

export const buildMaterialAccessEndpoint = (materialId: string): string =>
    `materials/access.php?id=${encodeURIComponent(materialId)}`;

export const buildDownloadUrl = (materialId: string): string =>
    resolveApiResourceUrl(buildMaterialDownloadEndpoint(materialId));

export const downloadAuthenticatedFile = async (resource: string, fallbackFileName?: string): Promise<void> => {
    const response = await fetchAuthenticatedResource(resource);
    const blob = await response.blob();
    const downloadUrl = URL.createObjectURL(blob);
    const fileName = getFilenameFromDisposition(
        response.headers.get('content-disposition'),
        fallbackFileName || 'arquivo.pdf'
    );

    const anchor = document.createElement('a');
    anchor.href = downloadUrl;
    anchor.download = fileName;
    anchor.style.display = 'none';
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();

    window.setTimeout(() => URL.revokeObjectURL(downloadUrl), 1000);
};

export const openAuthenticatedFile = async (resource: string): Promise<void> => {
    const previewWindow = window.open('about:blank', '_blank');
    if (!previewWindow) {
        throw new Error('Permita a abertura de novas abas para visualizar este arquivo.');
    }

    try {
        previewWindow.document.title = 'Carregando arquivo...';

        const response = await fetchAuthenticatedResource(resource);
        const blob = await response.blob();
        const fileUrl = URL.createObjectURL(blob);

        previewWindow.location.replace(fileUrl);
        window.setTimeout(() => URL.revokeObjectURL(fileUrl), 60_000);
    } catch (error) {
        previewWindow.close();
        throw error;
    }
};

export const getAssetUrl = (path: string) => {
    if (!path) return '';
    if (path.startsWith('http')) return path;

    const backendRoot = resolveBackendRoot();
    const cleanPath = path.startsWith('/') ? path.substring(1) : path;

    if (cleanPath.startsWith('uploads/')) {
        return `${backendRoot}/${cleanPath}`;
    }

    return `${backendRoot}/${cleanPath}`;
};

export default apiClient;

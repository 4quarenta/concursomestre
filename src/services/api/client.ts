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

import axios from 'axios';
import { getAccessToken, isAccessTokenExpired, refreshAuthSession } from '@services/auth/session';
import { registerApiInterceptors } from './interceptors';
import { ENDPOINTS } from './endpoints';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost/questao-pro-backend/api/';

export const apiClient = axios.create({
    baseURL: API_BASE_URL,
    timeout: 30000,
    withCredentials: true,
    headers: {
        'Content-Type': 'application/json',
    },
});

/**
 * Resolve a URL base efetiva da API a partir do ambiente atual.
 * Essa funcao garante que frontend local e build apontem para o backend correto antes de qualquer request.
 * @since v1.0.0
 */
const resolveApiBaseUrl = (): string => {
    let baseUrl = API_BASE_URL;

    if (!/^https?:\/\//i.test(baseUrl)) {
        const frontendOrigin = window.location.origin;
        const backendOrigin = frontendOrigin.replace(':3000', '');
        baseUrl = `${backendOrigin}${baseUrl.startsWith('/') ? '' : '/'}${baseUrl}`;
    }

    return baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
};

/**
 * Resolve a raiz do backend removendo o segmento público `/api`.
 * Ela e usada quando a UI precisa abrir arquivos e assets fora do contrato JSON tradicional.
 * @since v1.0.0
 */
const resolveBackendRoot = (): string => resolveApiBaseUrl().replace(/\/api\/?$/, '');

/**
 * Converte um recurso relativo da plataforma em URL absoluta do backend.
 * Essa funcao alimenta downloads, visualizacao de PDFs e aberturas autenticadas no browser.
 * @since v1.0.0
 */
export const resolveApiResourceUrl = (resource: string): string => {
    if (/^https?:\/\//i.test(resource)) {
        return resource;
    }

    const normalizedResource = resource.replace(/^\/+/, '');
    const backendRoot = resolveBackendRoot();

    if (normalizedResource.startsWith('uploads/')) {
        return `${backendRoot}/${normalizedResource}`;
    }

    try {
        const backendRootUrl = new URL(backendRoot);
        const backendPath = backendRootUrl.pathname.replace(/^\/+|\/+$/g, '');
        if (backendPath && normalizedResource.startsWith(`${backendPath}/`)) {
            return `${backendRootUrl.origin}/${normalizedResource}`;
        }
    } catch {
        // Mantem o fallback historico abaixo quando a URL base nao puder ser parseada.
    }

    if (normalizedResource.startsWith('api/')) {
        return `${backendRoot}/${normalizedResource}`;
    }

    return `${resolveApiBaseUrl()}${normalizedResource}`;
};

/**
 * Garante que existe um access token valido antes de chamadas autenticadas fora do Axios.
 * Esse fluxo e usado nos downloads e visualizadores que dependem de `fetch` manual.
 * @since v1.0.0
 */
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
        throw new Error('Sessão expirada. Faca login novamente.');
    }

    return refreshedToken;
};

/**
 * Le uma mensagem de erro amigavel a partir de uma resposta HTTP falha.
 * Isso evita que downloads e readers exibam erros crus quando o backend devolve JSON ou texto simples.
 * @since v1.0.0
 */
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

/**
 * Executa um `fetch` autenticado com refresh automático em caso de 401.
 * Ele sustenta os fluxos de download e preview protegidos pelo backend oficial.
 * @since v1.0.0
 */
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

/**
 * Extrai o nome sugerido de arquivo a partir do header `content-disposition`.
 * Esse parser e usado para que materiais e anexos baixados mantenham nome amigavel no navegador.
 * @since v1.0.0
 */
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

registerApiInterceptors(apiClient);

/**
 * Monta o endpoint legado/oficial de download de material.
 * A UI usa essa funcao ao iniciar o fluxo de baixar PDFs comprados no marketplace.
 * @since v1.0.0
 */
export const buildMaterialDownloadEndpoint = (materialId: string): string =>
    `${ENDPOINTS.materials.download}?material_id=${encodeURIComponent(materialId)}`;

/**
 * Monta o endpoint de validação de acesso ao reader de material.
 * Ele e consumido quando a plataforma precisa abrir um PDF autenticado no visualizador.
 * @since v1.0.0
 */
export const buildMaterialAccessEndpoint = (materialId: string): string =>
    `${ENDPOINTS.materials.access}?id=${encodeURIComponent(materialId)}`;

/**
 * Converte o endpoint de download em URL absoluta pronta para uso externo.
 * Essa funcao liga o marketplace ao backend quando o link precisa sair do contexto do Axios.
 * @since v1.0.0
 */
export const buildDownloadUrl = (materialId: string): string =>
    resolveApiResourceUrl(buildMaterialDownloadEndpoint(materialId));

/**
 * Baixa um arquivo autenticado e força o navegador a salvar localmente.
 * Esse fluxo e usado principalmente em materiais comprados e anexos protegidos.
 * @since v1.0.0
 */
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

/**
 * Abre um arquivo autenticado em nova aba mantendo o controle de refresh da sessão.
 * Essa funcao sustenta o reader e visualizadores protegidos sem expor a URL real do backend.
 * @since v1.0.0
 */
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

/**
 * Resolve a URL pública de um asset salvo no backend.
 * Ele e consumido por imagens, uploads e previews espalhados pelo site e pelo admin.
 * @since v1.0.0
 */
const stripBackendPathPrefix = (resource: string, backendRoot: string): string => {
    let cleanResource = resource.replace(/\\/g, '/').trim();
    const [pathPart, suffix = ''] = cleanResource.split(/([?#].*)/, 2);
    cleanResource = pathPart.replace(/^\/+/, '');

    try {
        const backendRootUrl = new URL(backendRoot);
        const backendPath = backendRootUrl.pathname.replace(/^\/+|\/+$/g, '');

        if (backendPath) {
            const duplicatedPrefix = `${backendPath}/${backendPath}/`;
            while (cleanResource.startsWith(duplicatedPrefix)) {
                cleanResource = `${backendPath}/${cleanResource.slice(duplicatedPrefix.length)}`;
            }

            if (cleanResource.startsWith(`${backendPath}/api/`)) {
                cleanResource = cleanResource.slice(`${backendPath}/api/`.length);
            }

            if (cleanResource.startsWith(`${backendPath}/`)) {
                cleanResource = cleanResource.slice(`${backendPath}/`.length);
            }
        }
    } catch {
        // Mantem a normalizacao generica quando a base nao puder ser parseada.
    }

    if (cleanResource.startsWith('api/uploads/')) {
        cleanResource = cleanResource.slice('api/'.length);
    }

    const uploadsIndex = cleanResource.indexOf('/uploads/');
    if (uploadsIndex >= 0 && !cleanResource.startsWith('uploads/')) {
        cleanResource = cleanResource.slice(uploadsIndex + 1);
    }

    return `${cleanResource}${suffix}`;
};

export const getAssetUrl = (path: string) => {
    const rawPath = String(path || '').trim();
    if (!rawPath || ['null', 'undefined'].includes(rawPath.toLowerCase())) return '';
    if (rawPath.startsWith('data:') || rawPath.startsWith('blob:')) return rawPath;

    const backendRoot = resolveBackendRoot().replace(/\/+$/, '');

    if (/^\/\//.test(rawPath)) {
        const protocol = typeof window !== 'undefined' ? window.location.protocol : 'https:';
        return `${protocol}${rawPath}`;
    }

    if (/^https?:\/\//i.test(rawPath)) {
        try {
            const rawUrl = new URL(rawPath);
            const backendUrl = new URL(backendRoot);
            const normalizedResource = stripBackendPathPrefix(`${rawUrl.pathname}${rawUrl.search}${rawUrl.hash}`, backendRoot);

            if (rawUrl.origin === backendUrl.origin && normalizedResource.startsWith('uploads/')) {
                return `${backendRoot}/${normalizedResource}`;
            }
        } catch {
            return rawPath;
        }

        return rawPath;
    }

    const normalizedResource = stripBackendPathPrefix(rawPath, backendRoot).replace(/^\/+/, '');
    if (!normalizedResource) return '';

    return `${backendRoot}/${normalizedResource}`;
};

export const getVersionedAssetUrl = (path: string, version?: string | number | null) => {
    const assetUrl = getAssetUrl(path);
    if (!assetUrl || assetUrl.startsWith('data:') || assetUrl.startsWith('blob:')) {
        return assetUrl;
    }

    const cacheKey = String(version ?? path).trim();
    if (!cacheKey) {
        return assetUrl;
    }

    return `${assetUrl}${assetUrl.includes('?') ? '&' : '?'}v=${encodeURIComponent(cacheKey)}`;
};

export default apiClient;

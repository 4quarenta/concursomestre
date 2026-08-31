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

const PRODUCTION_API_BASE_URL = '/api/';

const readPublicApiBaseUrl = (): string => (
    typeof process !== 'undefined' && typeof process.env.NEXT_PUBLIC_API_BASE_URL === 'string'
        ? process.env.NEXT_PUBLIC_API_BASE_URL.trim()
        : ''
);

const withTrailingSlash = (value: string): string => (
    value.endsWith('/') ? value : `${value}/`
);

/**
 * Usa `/api/` como caminho publico oficial do backend.
 * Ambientes locais que precisarem de outro endpoint devem defini-lo em `.env.local`.
 */
export const normalizeApiBaseUrl = (value?: string | null): string => {
    const configuredValue = String(value || '').trim();
    const candidate = configuredValue || PRODUCTION_API_BASE_URL;

    return withTrailingSlash(candidate);
};

export const API_BASE_URL = normalizeApiBaseUrl(readPublicApiBaseUrl());

const getFrontendOriginFallback = (): string => {
    const configuredSiteUrl = process.env.NEXT_PUBLIC_SITE_URL?.trim()
        || process.env.NEXT_PUBLIC_APP_URL?.trim()
        || process.env.NEXT_PUBLIC_CANONICAL_URL?.trim()
        || process.env.SITE_URL?.trim()
        || process.env.APP_URL?.trim()
        || 'https://concursomestre.com';

    try {
        return new URL(configuredSiteUrl).origin;
    } catch {
        return 'https://concursomestre.com';
    }
};

export const resolveAbsoluteApiBaseUrl = (baseUrl = API_BASE_URL): string => {
    const normalizedBaseUrl = normalizeApiBaseUrl(baseUrl);

    if (/^https?:\/\//i.test(normalizedBaseUrl)) {
        return withTrailingSlash(normalizedBaseUrl);
    }

    const frontendOrigin = typeof window === 'undefined'
        ? getFrontendOriginFallback()
        : window.location.origin;
    const path = normalizedBaseUrl.startsWith('/') ? normalizedBaseUrl : `/${normalizedBaseUrl}`;

    return withTrailingSlash(new URL(path, frontendOrigin).toString());
};

export const resolveBackendRootFromApiBaseUrl = (baseUrl = API_BASE_URL): string => (
    resolveAbsoluteApiBaseUrl(baseUrl).replace(/\/api\/?$/i, '')
);

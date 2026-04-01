import axios from 'axios';
import type { UserProfile } from '../../../types';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost/questao-pro-backend/api/';
const AUTH_CHANNEL_NAME = 'cm-auth-session';
const AUTH_STORAGE_EVENT_KEY = 'cm-auth-event';
const REFRESH_LOCK_KEY = 'cm-auth-refresh-lock';
const REFRESH_LOCK_TTL_MS = 15000;
const EXTERNAL_REFRESH_WAIT_MS = 8000;
const PROACTIVE_REFRESH_LEEWAY_MS = 60_000;

type AuthEventType = 'login' | 'refresh-success' | 'logout';

interface AuthBroadcastEvent {
    type: AuthEventType;
    sourceTabId: string;
    accessToken?: string | null;
    user?: UserProfile | null;
    accessTokenExpMs?: number | null;
    reason?: string | null;
    at: number;
}

export interface AuthSessionSnapshot {
    accessToken: string | null;
    accessTokenExpMs: number | null;
    currentUser: UserProfile | null;
    isAuthenticated: boolean;
    isBootstrapped: boolean;
}

interface RefreshOptions {
    reason: 'bootstrap' | 'http-401' | 'scheduled' | 'manual';
    allowAnonymousFailure?: boolean;
    force?: boolean;
}

type SessionListener = (snapshot: AuthSessionSnapshot) => void;

const authHttp = axios.create({
    baseURL: API_BASE_URL,
    timeout: 30000,
    withCredentials: true,
    headers: {
        'Content-Type': 'application/json',
    },
});

let accessToken: string | null = null;
let accessTokenExpMs: number | null = null;
let currentUser: UserProfile | null = null;
let isBootstrapped = false;
let refreshPromise: Promise<AuthSessionSnapshot | null> | null = null;
let proactiveRefreshTimer: ReturnType<typeof setTimeout> | null = null;

const listeners = new Set<SessionListener>();
const tabId = typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `tab-${Math.random().toString(36).slice(2)}`;
const authChannel = typeof BroadcastChannel !== 'undefined'
    ? new BroadcastChannel(AUTH_CHANNEL_NAME)
    : null;

const normalizeToken = (value: string | null | undefined): string | null => {
    if (!value) return null;

    let normalized = value.trim();
    if (!normalized) return null;

    if (
        (normalized.startsWith('"') && normalized.endsWith('"')) ||
        (normalized.startsWith("'") && normalized.endsWith("'"))
    ) {
        normalized = normalized.slice(1, -1).trim();
    }

    if (!normalized || normalized === 'undefined' || normalized === 'null') {
        return null;
    }

    return normalized;
};

export const decodeJwtPayload = (token: string): Record<string, unknown> | null => {
    try {
        const [, payloadSegment] = token.split('.');
        if (!payloadSegment) return null;

        const base64 = payloadSegment.replace(/-/g, '+').replace(/_/g, '/');
        const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '=');
        const payload = JSON.parse(window.atob(padded));

        return payload && typeof payload === 'object' ? payload : null;
    } catch {
        return null;
    }
};

export const getAccessTokenExpirationMs = (token: string | null | undefined = accessToken): number | null => {
    const normalizedToken = normalizeToken(token);
    if (!normalizedToken) {
        return null;
    }

    const payload = decodeJwtPayload(normalizedToken);
    const exp = typeof payload?.exp === 'number' ? payload.exp : Number(payload?.exp || 0);

    if (!exp) {
        return null;
    }

    return exp * 1000;
};

export const isAccessTokenExpired = (token: string | null | undefined = accessToken, graceSeconds = 0): boolean => {
    const normalizedToken = normalizeToken(token);
    if (!normalizedToken) {
        return true;
    }

    const expirationMs = getAccessTokenExpirationMs(normalizedToken);
    if (!expirationMs) {
        return false;
    }

    return Date.now() >= (expirationMs - (graceSeconds * 1000));
};

const getCookieValue = (name: string): string | null => {
    if (typeof document === 'undefined') {
        return null;
    }

    const match = document.cookie
        .split('; ')
        .find((entry) => entry.startsWith(`${name}=`));

    if (!match) {
        return null;
    }

    const [, rawValue = ''] = match.split('=');
    const value = decodeURIComponent(rawValue);
    return value.trim() !== '' ? value.trim() : null;
};

export const getCsrfToken = (): string | null => getCookieValue('cm_csrf');

const getSnapshot = (): AuthSessionSnapshot => ({
    accessToken,
    accessTokenExpMs,
    currentUser,
    isAuthenticated: Boolean(accessToken && currentUser),
    isBootstrapped,
});

const notifyListeners = (): void => {
    const snapshot = getSnapshot();
    listeners.forEach((listener) => listener(snapshot));
};

const clearProactiveRefreshTimer = (): void => {
    if (proactiveRefreshTimer) {
        clearTimeout(proactiveRefreshTimer);
        proactiveRefreshTimer = null;
    }
};

const scheduleProactiveRefresh = (): void => {
    clearProactiveRefreshTimer();

    if (!accessToken || !accessTokenExpMs) {
        return;
    }

    const waitMs = Math.max(5000, accessTokenExpMs - Date.now() - PROACTIVE_REFRESH_LEEWAY_MS);
    proactiveRefreshTimer = setTimeout(() => {
        void refreshAuthSession({ reason: 'scheduled', allowAnonymousFailure: true });
    }, waitMs);
};

const writeAuthEventToStorage = (event: AuthBroadcastEvent): void => {
    try {
        localStorage.setItem(AUTH_STORAGE_EVENT_KEY, JSON.stringify(event));
        localStorage.removeItem(AUTH_STORAGE_EVENT_KEY);
    } catch {
        // Ignore browsers with storage disabled.
    }
};

const broadcastAuthEvent = (event: Omit<AuthBroadcastEvent, 'sourceTabId' | 'at'>): void => {
    const payload: AuthBroadcastEvent = {
        ...event,
        sourceTabId: tabId,
        at: Date.now(),
    };

    authChannel?.postMessage(payload);
    writeAuthEventToStorage(payload);
};

const applyAccessToken = (token: string | null | undefined): void => {
    accessToken = normalizeToken(token);
    accessTokenExpMs = getAccessTokenExpirationMs(accessToken);
    scheduleProactiveRefresh();
};

const updateSessionState = (
    nextToken: string | null | undefined,
    nextUser?: UserProfile | null,
    options?: { isBootstrapped?: boolean; broadcast?: boolean; eventType?: AuthEventType; reason?: string | null }
): void => {
    applyAccessToken(nextToken);

    if (nextUser !== undefined) {
        currentUser = nextUser ?? null;
    }

    if (options?.isBootstrapped !== undefined) {
        isBootstrapped = options.isBootstrapped;
    }

    notifyListeners();

    if (options?.broadcast) {
        broadcastAuthEvent({
            type: options.eventType || (nextToken ? 'refresh-success' : 'logout'),
            accessToken,
            user: currentUser,
            accessTokenExpMs,
            reason: options.reason ?? null,
        });
    }
};

export const subscribeToAuthSession = (listener: SessionListener): (() => void) => {
    listeners.add(listener);
    listener(getSnapshot());

    return () => {
        listeners.delete(listener);
    };
};

export const getAccessToken = (): string | null => accessToken;

export const getCurrentUserSnapshot = (): UserProfile | null => currentUser;

export const updateCurrentUserSnapshot = (user: UserProfile | null): void => {
    updateSessionState(accessToken, user, { isBootstrapped: true });
};

const readRefreshLock = (): { owner: string; startedAt: number } | null => {
    try {
        const raw = localStorage.getItem(REFRESH_LOCK_KEY);
        if (!raw) return null;

        const parsed = JSON.parse(raw) as { owner: string; startedAt: number };
        if (!parsed?.owner || !parsed?.startedAt) {
            return null;
        }

        return parsed;
    } catch {
        return null;
    }
};

const isLockFresh = (lock: { owner: string; startedAt: number } | null): boolean => {
    if (!lock) return false;
    return (Date.now() - lock.startedAt) < REFRESH_LOCK_TTL_MS;
};

const tryAcquireRefreshLock = (): boolean => {
    const currentLock = readRefreshLock();
    if (currentLock && currentLock.owner !== tabId && isLockFresh(currentLock)) {
        return false;
    }

    try {
        localStorage.setItem(REFRESH_LOCK_KEY, JSON.stringify({
            owner: tabId,
            startedAt: Date.now(),
        }));
    } catch {
        return true;
    }

    const confirmedLock = readRefreshLock();
    return !confirmedLock || confirmedLock.owner === tabId;
};

const releaseRefreshLock = (): void => {
    const currentLock = readRefreshLock();
    if (currentLock?.owner === tabId) {
        try {
            localStorage.removeItem(REFRESH_LOCK_KEY);
        } catch {
            // Ignore browsers with storage disabled.
        }
    }
};

const waitForExternalRefresh = (): Promise<AuthBroadcastEvent | null> => {
    return new Promise((resolve) => {
        let timeoutId: ReturnType<typeof setTimeout> | null = null;

        const cleanup = () => {
            if (timeoutId) {
                clearTimeout(timeoutId);
            }

            authChannel?.removeEventListener('message', handleBroadcastMessage);
            window.removeEventListener('storage', handleStorageEvent);
        };

        const finish = (event: AuthBroadcastEvent | null) => {
            cleanup();
            resolve(event);
        };

        const acceptEvent = (event: AuthBroadcastEvent) => {
            if (event.sourceTabId === tabId) {
                return;
            }

            if (event.type === 'refresh-success' || event.type === 'logout' || event.type === 'login') {
                finish(event);
            }
        };

        const handleBroadcastMessage = (message: MessageEvent<AuthBroadcastEvent>) => {
            if (message?.data) {
                acceptEvent(message.data);
            }
        };

        const handleStorageEvent = (event: StorageEvent) => {
            if (event.key !== AUTH_STORAGE_EVENT_KEY || !event.newValue) {
                return;
            }

            try {
                const payload = JSON.parse(event.newValue) as AuthBroadcastEvent;
                acceptEvent(payload);
            } catch {
                // Ignore malformed payloads.
            }
        };

        authChannel?.addEventListener('message', handleBroadcastMessage);
        window.addEventListener('storage', handleStorageEvent);

        timeoutId = setTimeout(() => finish(null), EXTERNAL_REFRESH_WAIT_MS);
    });
};

const finalizeExternalAuthEvent = (event: AuthBroadcastEvent): AuthSessionSnapshot | null => {
    if (event.type === 'logout') {
        updateSessionState(null, null, {
            isBootstrapped: true,
            broadcast: false,
            reason: event.reason || 'external_logout',
        });
        return null;
    }

    updateSessionState(event.accessToken ?? null, event.user ?? currentUser, {
        isBootstrapped: true,
        broadcast: false,
        eventType: event.type,
    });

    return getSnapshot();
};

const parseSuccessPayload = <T>(payload: any): T | null => {
    if (!payload) return null;
    if (payload.success && payload.data) {
        return payload.data as T;
    }
    return payload as T;
};

export const fetchAuthenticatedUser = async (): Promise<UserProfile> => {
    const token = getAccessToken();
    if (!token) {
        throw new Error('Nenhum access token em memoria.');
    }

    const response = await authHttp.get('auth/me.php', {
        headers: {
            Authorization: `Bearer ${token}`,
            'X-Auth-Token': token,
        },
        withCredentials: true,
    });

    const payload = parseSuccessPayload<{ user: UserProfile }>(response.data);
    if (!payload?.user) {
        throw new Error('Nao foi possivel obter o usuario autenticado.');
    }

    updateSessionState(token, payload.user, { isBootstrapped: true, broadcast: false });
    return payload.user;
};

export const establishAuthenticatedSession = async (token: string | null | undefined, user?: UserProfile | null): Promise<AuthSessionSnapshot> => {
    const normalizedToken = normalizeToken(token);
    if (!normalizedToken) {
        throw new Error('Token de autenticacao ausente.');
    }

    updateSessionState(normalizedToken, user ?? null, {
        isBootstrapped: true,
        broadcast: false,
    });

    if (!user) {
        await fetchAuthenticatedUser();
    }

    broadcastAuthEvent({
        type: 'login',
        accessToken,
        user: currentUser,
        accessTokenExpMs,
    });

    return getSnapshot();
};

export const clearAuthenticatedSession = (reason?: string | null, broadcast = true): void => {
    updateSessionState(null, null, {
        isBootstrapped: true,
        broadcast,
        eventType: 'logout',
        reason: reason ?? null,
    });
};

export const refreshAuthSession = async (options: RefreshOptions): Promise<AuthSessionSnapshot | null> => {
    if (refreshPromise) {
        return refreshPromise;
    }

    refreshPromise = (async () => {
        const csrfToken = getCsrfToken();
        if (!csrfToken) {
            if (options.allowAnonymousFailure) {
                clearAuthenticatedSession('missing_csrf', false);
                return null;
            }

            throw new Error('CSRF token ausente para renovar a sessao.');
        }

        if (!options.force && options.reason !== 'bootstrap' && accessToken && !isAccessTokenExpired(accessToken, 60)) {
            return getSnapshot();
        }

        const acquiredLock = tryAcquireRefreshLock();
        if (!acquiredLock) {
            const externalResult = await waitForExternalRefresh();
            if (externalResult) {
                return finalizeExternalAuthEvent(externalResult);
            }

            if (!tryAcquireRefreshLock()) {
                if (options.allowAnonymousFailure) {
                    return currentUser ? getSnapshot() : null;
                }
                throw new Error('Nao foi possivel coordenar a renovacao da sessao.');
            }
        }

        try {
            const response = await authHttp.post('auth/refresh.php', {}, {
                headers: {
                    'X-CSRF-Token': csrfToken,
                },
                withCredentials: true,
            });

            const payload = parseSuccessPayload<{ token: string }>(response.data);
            const nextToken = payload?.token ?? null;
            if (!nextToken) {
                throw new Error('Resposta de refresh sem access token.');
            }

            updateSessionState(nextToken, currentUser, {
                isBootstrapped: true,
                broadcast: true,
                eventType: 'refresh-success',
            });

            return getSnapshot();
        } catch (error: any) {
            const status = error?.response?.status;
            if (status === 401 || status === 403) {
                clearAuthenticatedSession('refresh_failed', true);
                if (options.allowAnonymousFailure) {
                    return null;
                }
            }

            throw error;
        } finally {
            releaseRefreshLock();
            refreshPromise = null;
        }
    })();

    return refreshPromise;
};

export const bootstrapAuthSession = async (): Promise<AuthSessionSnapshot> => {
    if (isBootstrapped) {
        return getSnapshot();
    }

    if (!getCsrfToken()) {
        isBootstrapped = true;
        notifyListeners();
        return getSnapshot();
    }

    try {
        const refreshed = await refreshAuthSession({
            reason: 'bootstrap',
            allowAnonymousFailure: true,
            force: true,
        });

        if (refreshed?.accessToken) {
            await fetchAuthenticatedUser();
        }
    } catch (error) {
        console.error('Auth bootstrap failed:', error);
        clearAuthenticatedSession('bootstrap_failed', false);
    } finally {
        isBootstrapped = true;
        notifyListeners();
    }

    return getSnapshot();
};

export const logoutAuthSession = async (): Promise<void> => {
    const csrfToken = getCsrfToken();
    const token = getAccessToken();

    try {
        await authHttp.post('auth/logout.php', {}, {
            headers: {
                ...(token ? {
                    Authorization: `Bearer ${token}`,
                    'X-Auth-Token': token,
                } : {}),
                ...(csrfToken ? {
                    'X-CSRF-Token': csrfToken,
                } : {}),
            },
            withCredentials: true,
        });
    } catch (error) {
        console.error('Logout request failed:', error);
    } finally {
        clearAuthenticatedSession('logout', true);
    }
};

const handleIncomingAuthEvent = (event: AuthBroadcastEvent): void => {
    if (!event || event.sourceTabId === tabId) {
        return;
    }

    finalizeExternalAuthEvent(event);
};

authChannel?.addEventListener('message', (message: MessageEvent<AuthBroadcastEvent>) => {
    if (message?.data) {
        handleIncomingAuthEvent(message.data);
    }
});

window.addEventListener('storage', (event) => {
    if (event.key !== AUTH_STORAGE_EVENT_KEY || !event.newValue) {
        return;
    }

    try {
        const payload = JSON.parse(event.newValue) as AuthBroadcastEvent;
        handleIncomingAuthEvent(payload);
    } catch {
        // Ignore malformed payloads.
    }
});

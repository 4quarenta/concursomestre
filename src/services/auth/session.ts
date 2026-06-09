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
import type { UserProfile } from '@types';
import { clientLog } from '@services/monitoring/clientLog';
import { canAccessAdminPanel, canAccessPartnerArea, normalizeUserRole } from './userAccess';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost/questao-pro-backend/api/';
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

interface RefreshSessionResponsePayload {
    token?: string | null;
    user?: UserProfile | null;
}

type SessionListener = (snapshot: AuthSessionSnapshot) => void;

type AuthRawUserProfile = Partial<UserProfile> & {
    photo_url?: string | null;
    profilePhotoUrl?: string | null;
    profile_photo_url?: string | null;
    userPhotoUrl?: string | null;
    user_photo_url?: string | null;
    avatarUrl?: string | null;
    avatar_url?: string | null;
    email_verified?: boolean | number | string;
    comments_count?: number | string;
    target_exam?: string;
    is_admin?: boolean | number | string;
    is_staff?: boolean | number | string;
    is_partner?: boolean | number | string;
    can_access_admin?: boolean | number | string;
};

const authHttp = axios.create({
    baseURL: API_BASE_URL,
    timeout: 30000,
    withCredentials: true,
    headers: {
        'Content-Type': 'application/json',
    },
});

const parseBooleanLike = (value: unknown, fallback = false): boolean => {
    if (typeof value === 'boolean') {
        return value;
    }

    if (typeof value === 'number') {
        return value !== 0;
    }

    if (typeof value === 'string') {
        const normalized = value.trim().toLowerCase();
        if (['1', 'true', 'yes', 'on'].includes(normalized)) return true;
        if (['0', 'false', 'no', 'off', ''].includes(normalized)) return false;
    }

    return fallback;
};

const normalizeAuthUserProfile = (rawUser: UserProfile | null | undefined): UserProfile | null => {
    if (!rawUser) {
        return null;
    }

    const user = rawUser as AuthRawUserProfile;
    const role = normalizeUserRole(user.role);
    const photoUrl = String(
        user.photoUrl
        || user.photo_url
        || user.profilePhotoUrl
        || user.profile_photo_url
        || user.userPhotoUrl
        || user.user_photo_url
        || user.avatarUrl
        || user.avatar_url
        || ''
    ).trim() || undefined;

    const normalizedProfile = {
        ...user,
        role,
        photoUrl,
        emailVerified: parseBooleanLike(user.emailVerified ?? user.email_verified, false),
        commentsCount: Number(user.commentsCount ?? user.comments_count ?? 0),
        targetExam: String(user.targetExam ?? user.target_exam ?? ''),
        savedQuestionIds: Array.isArray(user.savedQuestionIds) ? user.savedQuestionIds : [],
        simulations: Array.isArray(user.simulations) ? user.simulations : [],
        purchasedMaterialIds: Array.isArray(user.purchasedMaterialIds) ? user.purchasedMaterialIds : [],
    } as UserProfile;

    normalizedProfile.isAdmin = parseBooleanLike(
        user.isAdmin ?? user.is_admin,
        role === 'admin',
    );
    normalizedProfile.isStaff = parseBooleanLike(
        user.isStaff ?? user.is_staff,
        role === 'staff',
    );
    normalizedProfile.isPartner = parseBooleanLike(
        user.isPartner ?? user.is_partner,
        role === 'partner',
    ) || canAccessPartnerArea(normalizedProfile);
    normalizedProfile.canAccessAdmin = parseBooleanLike(
        user.canAccessAdmin ?? user.can_access_admin,
        canAccessAdminPanel(normalizedProfile),
    );

    return normalizedProfile;
};

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

/**
 * Normaliza tokens vindos de cookies, memoria ou payloads legados.
 * Remove aspas e valores sentinela para evitar falso-positivo de autenticação.
 * @since 1.0.0
 */
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

/**
 * Decodifica o payload de um JWT sem validar assinatura.
 * Serve para ler expiracao e metadados locais usados pelo controle de sessão.
 * @since 1.0.0
 */
export const decodeJwtPayload = (token: string): Record<string, unknown> | null => {
    try {
        const [, payloadSegment] = token.split('.');
        if (!payloadSegment) return null;

        const base64 = payloadSegment.replace(/-/g, '+').replace(/_/g, '/');
        const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '=');
        const payload = JSON.parse(globalThis.atob(padded));

        return payload && typeof payload === 'object' ? payload : null;
    } catch {
        return null;
    }
};

/**
 * Calcula a expiracao absoluta do access token em milissegundos.
 * O provider usa esse valor para refresh proativo e renovação por demanda.
 * @since 1.0.0
 */
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

/**
 * Informa se o token atual já expirou ou esta dentro da janela de tolerancia.
 * Essa verificacao guia retries HTTP, bootstrap e refresh programado.
 * @since 1.0.0
 */
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

/**
 * Le um cookie especifico do navegador atual.
 * Hoje ele sustenta principalmente a leitura do CSRF emitido pelo backend.
 * @since 1.0.0
 */
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

/**
 * Devolve o token CSRF oficial da sessão web atual.
 * O frontend usa esse valor em refresh, logout e outros POSTs sensiveis.
 * @since 1.0.0
 */
export const getCsrfToken = (): string | null => getCookieValue('cm_csrf');

/**
 * Materializa um retrato consistente do estado de autenticação em memoria.
 * Ele e entregue aos listeners e providers sem expor variaveis globais soltas.
 * @since 1.0.0
 */
const getSnapshot = (): AuthSessionSnapshot => ({
    accessToken,
    accessTokenExpMs,
    currentUser,
    isAuthenticated: Boolean(accessToken && currentUser),
    isBootstrapped,
});

/**
 * Propaga o snapshot atual para todos os listeners inscritos.
 * Assim o AuthProvider e telas derivadas reagem a login, logout e refresh.
 * @since 1.0.0
 */
const notifyListeners = (): void => {
    const snapshot = getSnapshot();
    listeners.forEach((listener) => listener(snapshot));
};

/**
 * Cancela o agendamento de refresh proativo pendente.
 * Evita timers duplicados quando o token muda ou a sessão e limpa.
 * @since 1.0.0
 */
const clearProactiveRefreshTimer = (): void => {
    if (proactiveRefreshTimer) {
        clearTimeout(proactiveRefreshTimer);
        proactiveRefreshTimer = null;
    }
};

/**
 * Agenda a renovação do token antes da expiracao real.
 * Esse timer reduz a chance de 401 em navegacao normal do site.
 * @since 1.0.0
 */
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

/**
 * Replica eventos de auth via localStorage para navegadores sem BroadcastChannel estavel.
 * Isso mantém as abas sincronizadas mesmo em ambientes mais restritos.
 * @since 1.0.0
 */
const writeAuthEventToStorage = (event: AuthBroadcastEvent): void => {
    if (typeof localStorage === 'undefined') {
        return;
    }

    try {
        localStorage.setItem(AUTH_STORAGE_EVENT_KEY, JSON.stringify(event));
        localStorage.removeItem(AUTH_STORAGE_EVENT_KEY);
    } catch {
        // Ignore browsers with storage disabled.
    }
};

/**
 * Pública um evento de autenticação para as outras abas abertas.
 * Login, logout e refresh usam esse fluxo para manter o shell do site coerente.
 * @since 1.0.0
 */
const broadcastAuthEvent = (event: Omit<AuthBroadcastEvent, 'sourceTabId' | 'at'>): void => {
    const payload: AuthBroadcastEvent = {
        ...event,
        sourceTabId: tabId,
        at: Date.now(),
    };

    authChannel?.postMessage(payload);
    writeAuthEventToStorage(payload);
};

/**
 * Atualiza o token em memoria e reprograma o refresh futuro.
 * Serve como ponto unico para troca do access token em toda a sessão web.
 * @since 1.0.0
 */
const applyAccessToken = (token: string | null | undefined): void => {
    accessToken = normalizeToken(token);
    accessTokenExpMs = getAccessTokenExpirationMs(accessToken);
    scheduleProactiveRefresh();
};

/**
 * Aplica token, usuário e metadados de bootstrap no estado global de auth.
 * Esse metodo costura o provider do site com os eventos vindos do backend e de outras abas.
 * @since 1.0.0
 */
const updateSessionState = (
    nextToken: string | null | undefined,
    nextUser?: UserProfile | null,
    options?: { isBootstrapped?: boolean; broadcast?: boolean; eventType?: AuthEventType; reason?: string | null }
): void => {
    applyAccessToken(nextToken);

    if (nextUser !== undefined) {
        currentUser = normalizeAuthUserProfile(nextUser);
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

/**
 * Inscreve um listener reativo para mudancas de sessão.
 * O retorno remove a inscrição, padrao usado por providers e hooks do app.
 * @since 1.0.0
 */
export const subscribeToAuthSession = (listener: SessionListener): (() => void) => {
    listeners.add(listener);
    listener(getSnapshot());

    return () => {
        listeners.delete(listener);
    };
};

/**
 * Exibe o token atualmente carregado em memoria.
 * Interceptadores HTTP e downloads autenticados consultam essa funcao.
 * @since 1.0.0
 */
export const getAccessToken = (): string | null => accessToken;

/**
 * Exibe o snapshot do usuário autenticado mantido localmente.
 * Componentes usam esse atalho quando não precisam esperar um refresh completo.
 * @since 1.0.0
 */
export const getCurrentUserSnapshot = (): UserProfile | null => currentUser;

/**
 * Atualiza apenas o perfil em memoria, preservando o token corrente.
 * Isso e usado quando o usuário edita dados sem refazer o login no site.
 * @since 1.0.0
 */
export const updateCurrentUserSnapshot = (user: UserProfile | null): void => {
    updateSessionState(accessToken, user, { isBootstrapped: true });
};

/**
 * Le o lock de refresh compartilhado entre abas.
 * Esse registro evita que varias guias tentem renovar o token ao mesmo tempo.
 * @since 1.0.0
 */
const readRefreshLock = (): { owner: string; startedAt: number } | null => {
    if (typeof localStorage === 'undefined') {
        return null;
    }

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

/**
 * Informa se o lock de refresh ainda esta dentro da validade.
 * Locks velhos sao ignorados para não deixar a sessão presa por erro de aba.
 * @since 1.0.0
 */
const isLockFresh = (lock: { owner: string; startedAt: number } | null): boolean => {
    if (!lock) return false;
    return (Date.now() - lock.startedAt) < REFRESH_LOCK_TTL_MS;
};

/**
 * Tenta assumir a responsabilidade pelo refresh desta rodada.
 * Se outra aba ainda estiver com lock valido, a atual aguarda o resultado externo.
 * @since 1.0.0
 */
const tryAcquireRefreshLock = (): boolean => {
    if (typeof localStorage === 'undefined') {
        return true;
    }

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

/**
 * Libera o lock de refresh da aba atual.
 * A liberacao acontece no finally para não deixar outras abas bloqueadas.
 * @since 1.0.0
 */
const releaseRefreshLock = (): void => {
    if (typeof localStorage === 'undefined') {
        return;
    }

    const currentLock = readRefreshLock();
    if (currentLock?.owner === tabId) {
        try {
            localStorage.removeItem(REFRESH_LOCK_KEY);
        } catch {
            // Ignore browsers with storage disabled.
        }
    }
};

/**
 * Aguarda que outra aba conclua login, logout ou refresh.
 * Esse fallback reduz chamadas concorrentes ao endpoint de renovação.
 * @since 1.0.0
 */
const waitForExternalRefresh = (): Promise<AuthBroadcastEvent | null> => {
    if (typeof window === 'undefined') {
        return Promise.resolve(null);
    }

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

/**
 * Aplica localmente um evento de autenticação vindo de outra aba.
 * O resultado devolvido alimenta fluxos que estavam esperando um refresh externo.
 * @since 1.0.0
 */
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

/**
 * Normaliza payloads de sucesso que as vezes chegam envelopados e as vezes crus.
 * Isso simplifica os endpoints de auth enquanto o backend mantem compatibilidade legada.
 * @since 1.0.0
 */
const parseSuccessPayload = <T>(payload: unknown): T | null => {
    if (!payload) return null;
    if (typeof payload === 'object' && payload !== null) {
        const responsePayload = payload as { success?: unknown; data?: unknown };
        if (responsePayload.success && responsePayload.data) {
            return responsePayload.data as T;
        }
    }
    return payload as T;
};

/**
 * Busca o usuário autenticado usando o token atualmente carregado.
 * Essa chamada completa a montagem da sessão depois de login, refresh ou bootstrap.
 * @since 1.0.0
 */
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
        throw new Error('Não foi possível obter o usuário autenticado.');
    }

    updateSessionState(token, payload.user, { isBootstrapped: true, broadcast: false });
    return payload.user;
};

/**
 * Monta uma sessão autenticada em memoria a partir de token e usuário opcionais.
 * O fluxo e usado por login, 2FA e integrações que liberam sessão imediatamente.
 * @since 1.0.0
 */
export const establishAuthenticatedSession = async (token: string | null | undefined, user?: UserProfile | null): Promise<AuthSessionSnapshot> => {
    const normalizedToken = normalizeToken(token);
    if (!normalizedToken) {
        throw new Error('Token de autenticação ausente.');
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

/**
 * Limpa completamente a sessão autenticada do navegador atual.
 * Opcionalmente também replica o logout para as demais abas da plataforma.
 * @since 1.0.0
 */
export const clearAuthenticatedSession = (reason?: string | null, broadcast = true): void => {
    updateSessionState(null, null, {
        isBootstrapped: true,
        broadcast,
        eventType: 'logout',
        reason: reason ?? null,
    });
};

/**
 * Renova a sessão com coordenacao entre abas e protecao por CSRF.
 * Esse e o nucleo que sustenta bootstrap, retry de 401 e refresh proativo do site.
 * @since 1.0.0
 */
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

            throw new Error('CSRF token ausente para renovar a sessão.');
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
                throw new Error('Não foi possível coordenar a renovação da sessão.');
            }
        }

        try {
            const includeUser = options.reason === 'bootstrap' || !currentUser || !currentUser.photoUrl;
            const response = await authHttp.post('auth/refresh.php', {
                includeUser,
            }, {
                headers: {
                    'X-CSRF-Token': csrfToken,
                },
                withCredentials: true,
            });

            const payload = parseSuccessPayload<RefreshSessionResponsePayload>(response.data);
            const nextToken = payload?.token ?? null;
            if (!nextToken) {
                throw new Error('Resposta de refresh sem access token.');
            }

            const nextUser = payload?.user ?? currentUser;
            const hasResolvedUser = Boolean(nextUser);
            const shouldPublishReadySession = options.reason !== 'bootstrap' || hasResolvedUser;

            updateSessionState(nextToken, nextUser, {
                isBootstrapped: shouldPublishReadySession,
                broadcast: shouldPublishReadySession,
                eventType: 'refresh-success',
            });

            return getSnapshot();
        } catch (error: unknown) {
            const status = axios.isAxiosError(error) ? error.response?.status : undefined;
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

/**
 * Inicializa a sessão quando a aplicação sobe no navegador.
 * Ele tenta reaproveitar cookies existentes e deixar o provider pronto para o shell do site.
 * @since 1.0.0
 */
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

        if (refreshed?.accessToken && !refreshed.currentUser) {
            await fetchAuthenticatedUser();
        }
    } catch (error) {
        clientLog.warn('Auth bootstrap failed:', error);
        clearAuthenticatedSession('bootstrap_failed', false);
    } finally {
        isBootstrapped = true;
        notifyListeners();
    }

    return getSnapshot();
};

/**
 * Executa logout remoto e limpa o estado local independentemente do resultado da rede.
 * Isso garante que a UI não fique presa autenticada quando o backend falha no encerramento.
 * @since 1.0.0
 */
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
        clientLog.warn('Logout request failed:', error);
    } finally {
        clearAuthenticatedSession('logout', true);
    }
};

/**
 * Trata eventos de autenticação recebidos de outras abas abertas.
 * Mantem menus, guards e providers sincronizados sem exigir recarga manual.
 * @since 1.0.0
 */
const handleIncomingAuthEvent = (event: AuthBroadcastEvent): void => {
    if (!event || event.sourceTabId === tabId) {
        return;
    }

    finalizeExternalAuthEvent(event);
};

if (typeof window !== 'undefined') {
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
}

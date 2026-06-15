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

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { UserProfile } from '@types';

const mockPost = vi.fn();
const mockGet = vi.fn();

const storageState = new Map<string, string>();
let cookieJar = '';
type MockWindowEvent = Event | MessageEvent | StorageEvent | { type: string; [key: string]: unknown };
type MockWindowWithStorageEmitter = Window & {
  __emitStorage: (event: MockWindowEvent) => void;
};
const windowListeners = new Map<string, Set<(event: MockWindowEvent) => void>>();

class MockBroadcastChannel {
  public onmessage: ((event: MessageEvent) => void) | null = null;
  private listeners = new Set<(event: MessageEvent) => void>();

  constructor(name: string) {
    void name;
  }

  postMessage(data: unknown) {
    void data;
  }

  addEventListener(_type: string, listener: (event: MessageEvent) => void) {
    this.listeners.add(listener);
  }

  removeEventListener(_type: string, listener: (event: MessageEvent) => void) {
    this.listeners.delete(listener);
  }

  close() {}
}

vi.mock('axios', () => {
  return {
    default: {
      create: vi.fn(() => ({
        post: mockPost,
        get: mockGet,
      })),
    },
  };
});

const importSessionModule = async () => {
  vi.resetModules();
  return import('../session');
};

describe('auth session manager', () => {
  beforeEach(() => {
    mockPost.mockReset();
    mockGet.mockReset();

    storageState.clear();
    cookieJar = '';
    windowListeners.clear();

    const emitWindowEvent = (type: string, event: MockWindowEvent) => {
      const listeners = windowListeners.get(type);
      listeners?.forEach((listener) => listener(event));
    };

    const localStorageMock = {
      getItem: vi.fn((key: string) => storageState.get(key) ?? null),
      setItem: vi.fn((key: string, value: string) => {
        storageState.set(key, value);
      }),
      removeItem: vi.fn((key: string) => {
        storageState.delete(key);
      }),
      clear: vi.fn(() => {
        storageState.clear();
      }),
    };

    const documentMock = {
      get cookie() {
        return cookieJar;
      },
      set cookie(value: string) {
        const [pair] = value.split(';');
        const [name, rawCookieValue = ''] = pair.split('=');
        const cookies = cookieJar
          .split('; ')
          .filter(Boolean)
          .reduce<Record<string, string>>((acc, entry) => {
            const [cookieName, cookieValue = ''] = entry.split('=');
            acc[cookieName] = cookieValue;
            return acc;
          }, {});

        cookies[name] = rawCookieValue;
        cookieJar = Object.entries(cookies)
          .map(([cookieName, cookieValue]) => `${cookieName}=${cookieValue}`)
          .join('; ');
      },
    };

    const windowMock = {
      addEventListener: vi.fn((type: string, listener: (event: MockWindowEvent) => void) => {
        const listeners = windowListeners.get(type) ?? new Set();
        listeners.add(listener);
        windowListeners.set(type, listeners);
      }),
      removeEventListener: vi.fn((type: string, listener: (event: MockWindowEvent) => void) => {
        windowListeners.get(type)?.delete(listener);
      }),
      dispatchEvent: vi.fn((event: { type: string }) => {
        emitWindowEvent(event.type, event);
        return true;
      }),
      location: {
        hash: '',
        pathname: '/',
      },
      atob: (value: string) => Buffer.from(value, 'base64').toString('binary'),
      __emitStorage: (event: MockWindowEvent) => emitWindowEvent('storage', event),
    };

    vi.stubGlobal('localStorage', localStorageMock);
    vi.stubGlobal('document', documentMock);
    vi.stubGlobal('window', windowMock);
    vi.stubGlobal('BroadcastChannel', MockBroadcastChannel);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('não tenta bootstrap refresh quando não existe cookie CSRF', async () => {
    const session = await importSessionModule();

    const snapshot = await session.bootstrapAuthSession();

    expect(snapshot.isBootstrapped).toBe(true);
    expect(snapshot.isAuthenticated).toBe(false);
    expect(mockPost).not.toHaveBeenCalled();
  });

  it('garante single-flight no refresh simultaneo', async () => {
    cookieJar = 'cm_csrf=test-csrf';
    const futureExp = Math.floor(Date.now() / 1000) + 1800;
 
    const encodedPayload = Buffer.from(JSON.stringify({
      exp: futureExp,
      iat: futureExp - 600,
      nbf: futureExp - 605,
    })).toString('base64url');
    const refreshedToken =
      'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.' +
      encodedPayload +
      '.signature';

    let resolveRefresh: ((value: unknown) => void) | null = null;
    const refreshPromise = new Promise((resolve) => {
      resolveRefresh = resolve;
    });

    mockPost.mockReturnValue(refreshPromise);

    const session = await importSessionModule();

    const pendingA = session.refreshAuthSession({ reason: 'http-401', force: true });
    const pendingB = session.refreshAuthSession({ reason: 'http-401', force: true });

    expect(mockPost).toHaveBeenCalledTimes(1);

    resolveRefresh?.({
      data: {
        success: true,
        data: {
          token: refreshedToken,
          session: {
            id: 'session-1',
            accessExpiresIn: 900,
          },
        },
      },
    });

    const [resultA, resultB] = await Promise.all([pendingA, pendingB]);

    expect(resultA?.accessToken).toBe(refreshedToken);
    expect(resultB?.accessToken).toBe(refreshedToken);
    expect(session.getAccessToken()).toBe(refreshedToken);
  });

  it('não tenta bootstrap refresh quando existe apenas CSRF publico sem sinal de sessão', async () => {
    cookieJar = 'cm_csrf=test-csrf';
    const session = await importSessionModule();

    const snapshot = await session.bootstrapAuthSession();

    expect(snapshot.isBootstrapped).toBe(true);
    expect(snapshot.isAuthenticated).toBe(false);
    expect(mockPost).not.toHaveBeenCalled();
  });

  it('faz bootstrap só com refresh quando a API já devolve o usuário', async () => {
    cookieJar = 'cm_csrf=test-csrf';
    storageState.set('cm-auth-session-present', '1');
    const futureExp = Math.floor(Date.now() / 1000) + 1800;

    const refreshedToken =
      'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.' +
      Buffer.from(JSON.stringify({
        exp: futureExp,
        iat: futureExp - 600,
        nbf: futureExp - 605,
      })).toString('base64url') +
      '.signature';

    mockPost.mockResolvedValue({
      data: {
        success: true,
        data: {
          token: refreshedToken,
          user: {
            id: 'user-bootstrap',
            name: 'Bootstrap',
            email: 'bootstrap@teste.com',
          },
          session: {
            id: 'session-bootstrap',
            accessExpiresIn: 900,
          },
        },
      },
    });

    const session = await importSessionModule();
    const snapshot = await session.bootstrapAuthSession();

    expect(mockPost).toHaveBeenCalledTimes(1);
    expect(mockPost.mock.calls[0]?.[0]).toBe('auth/refresh.php');
    expect(mockPost.mock.calls[0]?.[1]).toMatchObject({ includeUser: true });
    expect(mockGet).not.toHaveBeenCalled();
    expect(snapshot.isAuthenticated).toBe(true);
    expect(snapshot.currentUser?.id).toBe('user-bootstrap');
    expect(session.getAccessToken()).toBe(refreshedToken);
  });

  it('limpa hint antigo quando bootstrap encontra CSRF sem refresh token', async () => {
    cookieJar = 'cm_csrf=test-csrf';
    storageState.set('cm-auth-session-present', '1');
    mockPost.mockRejectedValue({
      isAxiosError: true,
      response: {
        status: 401,
        data: {
          success: false,
          message: 'Refresh token ausente.',
          error_code: 'unauthorized',
        },
      },
    });

    const session = await importSessionModule();
    const snapshot = await session.bootstrapAuthSession();

    expect(mockPost).toHaveBeenCalledTimes(1);
    expect(snapshot.isBootstrapped).toBe(true);
    expect(snapshot.isAuthenticated).toBe(false);
    expect(session.getAccessToken()).toBeNull();
    expect(storageState.get('cm-auth-session-present')).toBeUndefined();
  });

  it('aguarda refresh de outra aba quando encontra lock externo ativo', async () => {
    cookieJar = 'cm_csrf=test-csrf';
    storageState.set('cm-auth-refresh-lock', JSON.stringify({
      owner: 'other-tab',
      startedAt: Date.now(),
    }));

    const futureExp = Math.floor(Date.now() / 1000) + 1800;
    const sharedToken =
      'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.' +
      Buffer.from(JSON.stringify({
        exp: futureExp,
        iat: futureExp - 600,
        nbf: futureExp - 605,
      })).toString('base64url') +
      '.signature';

    const session = await importSessionModule();

    const pending = session.refreshAuthSession({ reason: 'http-401', force: true });

    (window as MockWindowWithStorageEmitter).__emitStorage({
      key: 'cm-auth-event',
      newValue: JSON.stringify({
        type: 'refresh-success',
        sourceTabId: 'other-tab',
        accessToken: sharedToken,
        accessTokenExpMs: futureExp * 1000,
        user: {
          id: 'user-shared',
          name: 'Outra Aba',
          email: 'shared@teste.com',
        },
        at: Date.now(),
      }),
    });

    const snapshot = await pending;

    expect(mockPost).not.toHaveBeenCalled();
    expect(snapshot?.isAuthenticated).toBe(true);
    expect(snapshot?.currentUser?.id).toBe('user-shared');
    expect(session.getAccessToken()).toBe(sharedToken);
  });

  it('limpa a sessão local no logout', async () => {
    cookieJar = 'cm_csrf=test-csrf';
    const futureExp = Math.floor(Date.now() / 1000) + 1800;

    const validToken =
      'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.' +
      Buffer.from(JSON.stringify({
        exp: futureExp,
        iat: futureExp - 600,
        nbf: futureExp - 605,
      })).toString('base64url') +
      '.signature';

    mockPost.mockResolvedValue({
      data: {
        success: true,
      },
    });

    const session = await importSessionModule();
    await session.establishAuthenticatedSession(validToken, {
      id: 'user-1',
      name: 'Teste',
      email: 'teste@teste.com',
    } as UserProfile);

    expect(session.getAccessToken()).toBe(validToken);

    await session.logoutAuthSession();

    expect(session.getAccessToken()).toBeNull();
  });
});

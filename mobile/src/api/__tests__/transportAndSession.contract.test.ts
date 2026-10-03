import { beforeEach, describe, expect, it, vi } from 'vitest';

type MockConfig = {
  method?: string;
  url?: string;
  data?: unknown;
  headers?: Record<string, string>;
  _retry?: boolean;
};

type MockAxiosInstance = {
  (config: MockConfig): Promise<unknown>;
  get: (url: string, config?: MockConfig) => Promise<unknown>;
  post: (url: string, data?: unknown, config?: MockConfig) => Promise<unknown>;
  interceptors: {
    request: { use: (handler: (config: MockConfig) => MockConfig) => void };
    response: {
      use: (fulfilled: (response: { data: unknown }) => unknown, rejected: (error: any) => Promise<unknown>) => void;
    };
  };
};

const instances: MockAxiosInstance[] = [];
const apiDispatches: Array<() => Promise<unknown>> = [];
const authDispatches: Array<() => Promise<unknown>> = [];

const createMockAxios = (): MockAxiosInstance => {
  let requestHandler: ((config: MockConfig) => MockConfig) | undefined;
  let fulfilledHandler: ((response: { data: unknown }) => unknown) | undefined;
  let rejectedHandler: ((error: any) => Promise<unknown>) | undefined;
  const instance = (async (input: MockConfig) => {
    const config = requestHandler ? requestHandler(input) : input;
    // client.ts cria authHttp primeiro e apiClient em seguida.
    const queue = instances.indexOf(instance) === 0 ? authDispatches : apiDispatches;
    
    try {
      const response = await queue.shift()!();
      return fulfilledHandler ? fulfilledHandler(response as { data: unknown }) : response;
    } catch (error) {
      if (!rejectedHandler) throw error;
      return rejectedHandler({ ...(error as object), config });
    }
  }) as MockAxiosInstance;
  instance.get = (url, config = {}) => instance({ headers: {}, ...config, method: 'GET', url });
  instance.post = (url, data, config = {}) => instance({ headers: {}, ...config, method: 'POST', url, data });
  instance.interceptors = {
    request: { use: (handler) => { requestHandler = handler; } },
    response: { use: (fulfilled, rejected) => { fulfilledHandler = fulfilled; rejectedHandler = rejected; } },
  };
  instances.push(instance);
  return instance;
};

vi.mock('axios', () => ({
  default: { create: createMockAxios },
}));

vi.mock('@/config/runtime', () => ({
  runtimeConfig: { apiBaseUrl: 'https://mock.invalid/api/', distributionChannel: 'direct' },
}));

vi.mock('expo-secure-store', () => ({
  getItemAsync: vi.fn(async () => null),
  setItemAsync: vi.fn(async () => undefined),
  deleteItemAsync: vi.fn(async () => undefined),
}));

const enqueueError = (queue: Array<() => Promise<unknown>>, status: number, data: Record<string, string> = {}) => {
  queue.push(async () => Promise.reject({ response: { status, data }, message: `HTTP ${status}` }));
};

const enqueueSuccess = (queue: Array<() => Promise<unknown>>, data: unknown) => {
  queue.push(async () => ({ data }));
};

describe('mobile transport and session contracts', () => {
  beforeEach(async () => {
    vi.resetModules();
    instances.length = 0;
    apiDispatches.length = 0;
    authDispatches.length = 0;
  });

  it('allows one retry for a 5xx and rejects the second automatic retry', async () => {
    const { shouldRetryApiFailure } = await import('@/api/transportPolicy');
    const serverError = { response: { status: 503, data: { message: 'temporariamente indisponivel' } } };

    expect(shouldRetryApiFailure(0, serverError)).toBe(true);
    expect(shouldRetryApiFailure(1, serverError)).toBe(false);
    expect(shouldRetryApiFailure(0, { response: { status: 403 } })).toBe(false);
  });

  it('does not describe rejected login credentials as an expired session', async () => {
    const { normalizeApiFailure } = await import('@/api/errors');
    const failure = normalizeApiFailure({
      config: { url: 'auth/login.php' },
      response: { status: 401, data: { message: 'Invalid email or password' } },
    });

    expect(failure.message).toBe('E-mail ou senha inválidos.');
  });

  it('does not describe a rejected Google credential as an expired app session', async () => {
    const { normalizeApiFailure } = await import('@/api/errors');
    const failure = normalizeApiFailure({
      config: { url: 'auth/google.php' },
      response: { status: 401, data: { message: 'Conta Google sem e-mail verificado.' } },
    });

    expect(failure.message).toBe('Conta Google sem e-mail verificado.');
  });

  it('preserves the API message when the selected Google account has no platform account', async () => {
    const { normalizeApiFailure } = await import('@/api/errors');
    const failure = normalizeApiFailure({
      config: { url: 'auth/google.php' },
      response: { status: 404, data: { message: 'Conta nao encontrada. Crie sua conta antes de entrar com Google.' } },
    });

    expect(failure.message).toBe('Conta nao encontrada. Crie sua conta antes de entrar com Google.');
  });

  it('does not describe a rejected registration as an expired session', async () => {
    const { normalizeApiFailure } = await import('@/api/errors');
    const failure = normalizeApiFailure({
      config: { url: 'auth/register.php' },
      response: { status: 401 },
    });

    expect(failure.message).toBe('Não foi possível validar o cadastro. Confira os dados e tente novamente.');
  });

  it('does not describe an endpoint-specific 401 as a globally expired session', async () => {
    const { normalizeApiFailure } = await import('@/api/errors');
    const failure = normalizeApiFailure({
      config: { url: 'statistics/user.php', _retry: true },
      response: { status: 401 },
    });

    expect(failure.message).toBe('Não foi possível carregar estes dados com a sessão atual. Tente novamente.');
  });

  it('continues to describe an unauthorized current-user session check as expired', async () => {
    const { normalizeApiFailure } = await import('@/api/errors');
    const failure = normalizeApiFailure({
      config: { url: 'auth/me.php' },
      response: { status: 401 },
    });

    expect(failure.message).toBe('Sua sessao expirou. Entre novamente para continuar.');
  });

  it('shares one refresh among concurrent 401 responses and retries both requests', async () => {
    const [{ apiClient }, { sessionStorage }] = await Promise.all([
      import('@/api/client'),
      import('@/storage/sessionStorage'),
    ]);
    await sessionStorage.setSession('old-token', null, 'refresh-token', 'csrf-token');

    let refreshCalls = 0;
    enqueueError(apiDispatches, 401);
    enqueueError(apiDispatches, 401);
    authDispatches.push(async () => {
      refreshCalls += 1;
      await new Promise((resolve) => setTimeout(resolve, 20));
      return { data: { success: true, data: { token: 'new-token', refreshToken: 'new-refresh', csrfToken: 'new-csrf' } } };
    });
    enqueueSuccess(apiDispatches, { success: true, data: { id: 1 } });
    enqueueSuccess(apiDispatches, { success: true, data: { id: 2 } });

    const [first, second] = await Promise.all([
      apiClient.get('protected/one'),
      apiClient.get('protected/two'),
    ]);

    expect(first).toEqual({ success: true, data: { id: 1 } });
    expect(second).toEqual({ success: true, data: { id: 2 } });
    expect(refreshCalls).toBe(1);
    expect(sessionStorage.getAccessToken()).toBe('new-token');
  });

  it('preserves the session for 403 and transient refresh failures', async () => {
    const [{ apiClient }, { sessionStorage }] = await Promise.all([
      import('@/api/client'),
      import('@/storage/sessionStorage'),
    ]);
    await sessionStorage.setSession('old-token', null, 'refresh-token', 'csrf-token');

    enqueueError(apiDispatches, 403);
    await expect(apiClient.get('forbidden')).rejects.toMatchObject({ response: { status: 403 } });
    expect(sessionStorage.getAccessToken()).toBe('old-token');

    enqueueError(apiDispatches, 401);
    enqueueError(authDispatches, 503);
    await expect(apiClient.get('temporary-refresh-failure')).rejects.toMatchObject({ response: { status: 503 } });
    expect(sessionStorage.getAccessToken()).toBe('old-token');
  });

  it('clears the session only after refresh returns 401', async () => {
    const [{ apiClient }, { sessionStorage }] = await Promise.all([
      import('@/api/client'),
      import('@/storage/sessionStorage'),
    ]);
    await sessionStorage.setSession('old-token', null, 'refresh-token', 'csrf-token');

    enqueueError(apiDispatches, 401);
    enqueueError(authDispatches, 401);
    await expect(apiClient.get('expired')).rejects.toMatchObject({ response: { status: 401 } });
    expect(sessionStorage.getAccessToken()).toBeNull();
    expect(sessionStorage.getRefreshToken()).toBeNull();
    expect(sessionStorage.getCsrfToken()).toBeNull();
  });

  it('preserves the authenticated session when a resource returns 401 after retry', async () => {
    const [{ apiClient }, { sessionStorage }] = await Promise.all([
      import('@/api/client'),
      import('@/storage/sessionStorage'),
    ]);
    await sessionStorage.setSession('access-token', null, 'refresh-token', 'csrf-token');

    enqueueError(apiDispatches, 401);
    authDispatches.push(async () => ({
      data: { success: true, data: { token: 'renewed-token', refreshToken: 'renewed-refresh', csrfToken: 'renewed-csrf' } },
    }));
    enqueueError(apiDispatches, 401);

    await expect(apiClient.get('simulationsList')).rejects.toMatchObject({
      response: { status: 401 },
      message: 'Não foi possível carregar estes dados com a sessão atual. Tente novamente.',
    });
    expect(sessionStorage.getAccessToken()).toBe('renewed-token');
  });

  it('clears the session when the canonical current-user endpoint remains unauthorized', async () => {
    const [{ apiClient }, { sessionStorage }] = await Promise.all([
      import('@/api/client'),
      import('@/storage/sessionStorage'),
    ]);
    await sessionStorage.setSession('access-token', null);

    enqueueError(apiDispatches, 401);
    await expect(apiClient.get('auth/me.php')).rejects.toMatchObject({ response: { status: 401 } });
    expect(sessionStorage.getAccessToken()).toBeNull();
  });
});

export type ApiFailureKind = 'timeout' | 'offline' | 'unauthorized' | 'rate_limit' | 'server' | 'request' | 'unknown';

export type NormalizedApiFailure = {
  kind: ApiFailureKind;
  message: string;
  status?: number;
  retryable: boolean;
};

const getStatus = (error: any): number | undefined => {
  const status = Number(error?.response?.status);
  return Number.isFinite(status) ? status : undefined;
};

export const normalizeApiFailure = (error: any, fallbackMessage = 'Nao foi possivel concluir a operacao.'): NormalizedApiFailure => {
  const status = getStatus(error);
  const code = String(error?.code || '').toUpperCase();

  if (code === 'ECONNABORTED' || code === 'ETIMEDOUT' || /timeout/i.test(String(error?.message || ''))) {
    return {
      kind: 'timeout',
      message: 'A conexao demorou mais que o esperado. Verifique sua internet e tente novamente.',
      status,
      retryable: true,
    };
  }

  if (!error?.response && (code === 'ERR_NETWORK' || code === 'ENETUNREACH' || code === 'ECONNREFUSED' || error?.request)) {
    return {
      kind: 'offline',
      message: 'Nao foi possivel conectar ao ConcursoMestre. Verifique sua internet e tente novamente.',
      retryable: true,
    };
  }

  if (status === 401) {
    return {
      kind: 'unauthorized',
      message: 'Sua sessao expirou. Entre novamente para continuar.',
      status,
      retryable: false,
    };
  }

  if (status === 429) {
    return {
      kind: 'rate_limit',
      message: 'Muitas tentativas em pouco tempo. Aguarde alguns instantes e tente novamente.',
      status,
      retryable: true,
    };
  }

  const responseMessage = typeof error?.response?.data?.message === 'string'
    ? error.response.data.message.trim()
    : '';
  const responseError = typeof error?.response?.data?.error === 'string'
    ? error.response.data.error.trim()
    : '';

  // Algumas rotas antigas da produção ainda devolvem 500 para uma sessão
  // inválida. O cliente trata esse payload como autenticação para conseguir
  // renovar o token e repetir a requisição sem exigir novo login.
  if (status === 500 && /sess[aã]o.*(inv[aá]lida|expirada)/i.test(`${responseMessage} ${responseError}`)) {
    return {
      kind: 'unauthorized',
      message: 'Sua sessao expirou. Entre novamente para continuar.',
      status,
      retryable: false,
    };
  }

  if (status !== undefined && status >= 500) {
    return {
      kind: 'server',
      message: responseMessage || responseError || 'O servidor esta temporariamente indisponivel. Tente novamente em instantes.',
      status,
      retryable: true,
    };
  }

  if (status !== undefined && status >= 400) {
    return {
      kind: 'request',
      message: responseMessage || responseError || fallbackMessage,
      status,
      retryable: false,
    };
  }

  const originalMessage = typeof error?.message === 'string' ? error.message.trim() : '';
  return {
    kind: 'unknown',
    message: originalMessage || fallbackMessage,
    status,
    retryable: false,
  };
};

export const isRetryableApiFailure = (error: unknown): boolean => normalizeApiFailure(error).retryable;

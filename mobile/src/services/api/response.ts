export type NormalizedApiEnvelope<T = unknown> = {
  success: boolean;
  message?: string;
  data?: T;
  raw: any;
};

/**
 * Normaliza respostas da API PHP (com e sem envelope).
 * @since v1.0.0
 */
export const normalizeApiEnvelope = <T = unknown>(response: any): NormalizedApiEnvelope<T> => {
  if (response && typeof response === 'object' && typeof response.success === 'boolean') {
    return {
      success: response.success,
      message: typeof response.message === 'string' ? response.message : undefined,
      data: response.data as T | undefined,
      raw: response,
    };
  }

  return {
    success: true,
    data: response as T,
    raw: response,
  };
};

export const readApiData = <T>(response: any, fallback: T): T => {
  const envelope = normalizeApiEnvelope<T>(response);

  if (envelope.data !== undefined) return envelope.data;
  if (envelope.raw !== undefined && envelope.raw !== null) return envelope.raw as T;

  return fallback;
};

export const assertApiSuccess = <T = unknown>(response: any, fallbackMessage: string): NormalizedApiEnvelope<T> => {
  const envelope = normalizeApiEnvelope<T>(response);

  if (!envelope.success) {
    const rawMessage = typeof envelope.raw?.error === 'string' ? envelope.raw.error : undefined;
    throw new Error(envelope.message || rawMessage || fallbackMessage);
  }

  return envelope;
};

export const readApiErrorMessage = (error: any, fallbackMessage: string): string => {
  if (typeof error?.response?.data?.message === 'string' && error.response.data.message.trim()) {
    return error.response.data.message;
  }

  if (typeof error?.response?.data?.error === 'string' && error.response.data.error.trim()) {
    return error.response.data.error;
  }

  if (typeof error?.message === 'string' && error.message.trim()) {
    return error.message;
  }

  return fallbackMessage;
};

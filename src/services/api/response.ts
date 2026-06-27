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

/**
 * Normaliza envelopes heterogeneos da API PHP enquanto o backend ainda mistura
 * respostas cruas, `{ success, data }` e payloads parcialmente achatados.
 * @since 1.0.0
 */
type ApiEnvelopeObject = Record<string, unknown>;

export type NormalizedApiEnvelope<T = unknown> = {
  success: boolean;
  message?: string;
  data?: T;
  raw: ApiEnvelopeObject;
};

/**
 * Detecta e padroniza o shape principal da resposta para os serviços.
 * @since 1.0.0
 */
export const normalizeApiEnvelope = <T = unknown>(response: unknown): NormalizedApiEnvelope<T> => {
  if (response && typeof response === 'object' && 'success' in response && typeof response.success === 'boolean') {
    return {
      success: response.success,
      message: 'message' in response && typeof response.message === 'string' ? response.message : undefined,
      data: 'data' in response ? response.data as T | undefined : undefined,
      raw: response as ApiEnvelopeObject,
    };
  }

  return {
    success: true,
    data: response as T,
    raw: response && typeof response === 'object' ? response as ApiEnvelopeObject : {},
  };
};

/**
 * Extrai o payload util independentemente de a resposta vir envelopada ou não.
 * @since 1.0.0
 */
export const readApiData = <T>(response: unknown, fallback: T): T => {
  const envelope = normalizeApiEnvelope<T>(response);

  if (envelope.data !== undefined) {
    return envelope.data;
  }

  if (envelope.raw !== undefined && envelope.raw !== null) {
    return envelope.raw as T;
  }

  return fallback;
};

/**
 * Garante sucesso logico da mutação sem obrigar cada serviço a repetir a
 * mesma regra de mensagem/erro.
 * @since 1.0.0
 */
export const assertApiSuccess = <T = unknown>(response: unknown, fallbackMessage: string): NormalizedApiEnvelope<T> => {
  const envelope = normalizeApiEnvelope<T>(response);

  if (!envelope.success) {
    const rawMessage =
      envelope.raw && typeof envelope.raw === 'object' && 'error' in envelope.raw && typeof envelope.raw.error === 'string'
        ? envelope.raw.error
        : undefined;
    throw new Error(envelope.message || rawMessage || fallbackMessage);
  }

  return envelope;
};

/**
 * Le a mensagem mais util de um erro vindo do axios/interceptor ou de uma
 * excecao simples, evitando parsing manual repetido na UI.
 * @since 1.0.0
 */
export const readApiErrorMessage = (error: unknown, fallbackMessage: string): string => {
  if (error && typeof error === 'object') {
    const message = 'message' in error && typeof error.message === 'string' ? error.message.trim() : '';
    const code = 'code' in error && typeof error.code === 'string' ? error.code.trim() : '';
    const hasRequestWithoutResponse = 'request' in error && !('response' in error);

    if (
      code === 'ERR_NETWORK'
      || message === 'Network Error'
      || message.includes('ERR_INTERNET_DISCONNECTED')
      || message.includes('ERR_NAME_NOT_RESOLVED')
      || hasRequestWithoutResponse
    ) {
      return 'Não foi possível conectar ao servidor. Verifique sua internet e tente novamente.';
    }

    const response = 'response' in error ? error.response : undefined;
    const responseData = response && typeof response === 'object' && 'data' in response ? response.data : undefined;

    if (responseData && typeof responseData === 'object') {
      if ('message' in responseData && typeof responseData.message === 'string' && responseData.message.trim()) {
        return responseData.message;
      }

      if ('error' in responseData && typeof responseData.error === 'string' && responseData.error.trim()) {
        return responseData.error;
      }
    }

    if (message) {
      return message;
    }
  }

  return fallbackMessage;
};

/**
 * Extrai codigos técnicos usados por alguns fluxos legados enquanto o backend
 * ainda não esta 100% padronizado.
 * @since 1.0.0
 */
export const readApiErrorCode = (error: unknown): string | number | undefined => {
  if (!error || typeof error !== 'object' || !('response' in error)) {
    return undefined;
  }

  const response = error.response;
  if (!response || typeof response !== 'object' || !('data' in response)) {
    return undefined;
  }

  const responseData = response.data;
  if (!responseData || typeof responseData !== 'object' || !('error_code' in responseData)) {
    return undefined;
  }

  return typeof responseData.error_code === 'string' || typeof responseData.error_code === 'number'
    ? responseData.error_code
    : undefined;
};

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
export type NormalizedApiEnvelope<T = unknown> = {
  success: boolean;
  message?: string;
  data?: T;
  raw: any;
};

/**
 * Detecta e padroniza o shape principal da resposta para os serviços.
 * @since 1.0.0
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

/**
 * Extrai o payload util independentemente de a resposta vir envelopada ou não.
 * @since 1.0.0
 */
export const readApiData = <T>(response: any, fallback: T): T => {
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
export const assertApiSuccess = <T = unknown>(response: any, fallbackMessage: string): NormalizedApiEnvelope<T> => {
  const envelope = normalizeApiEnvelope<T>(response);

  if (!envelope.success) {
    const rawMessage = typeof envelope.raw?.error === 'string' ? envelope.raw.error : undefined;
    throw new Error(envelope.message || rawMessage || fallbackMessage);
  }

  return envelope;
};

/**
 * Le a mensagem mais util de um erro vindo do axios/interceptor ou de uma
 * excecao simples, evitando parsing manual repetido na UI.
 * @since 1.0.0
 */
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

/**
 * Extrai codigos técnicos usados por alguns fluxos legados enquanto o backend
 * ainda não esta 100% padronizado.
 * @since 1.0.0
 */
export const readApiErrorCode = (error: any): string | number | undefined => {
  return error?.response?.data?.error_code;
};

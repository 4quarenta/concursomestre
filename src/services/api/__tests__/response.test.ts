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

import { describe, expect, it } from 'vitest';

import {
  assertApiSuccess,
  normalizeApiEnvelope,
  readApiData,
  readApiErrorCode,
  readApiErrorMessage,
} from '../response';

describe('api response helpers', () => {
  it('normalizes enveloped responses with success/data', () => {
    const envelope = normalizeApiEnvelope<{ id: number }>({
      success: true,
      message: 'ok',
      data: { id: 10 },
    });

    expect(envelope.success).toBe(true);
    expect(envelope.message).toBe('ok');
    expect(envelope.data?.id).toBe(10);
  });

  it('reads raw payloads without forcing legacy callers to know the envelope', () => {
    const data = readApiData([{ id: 1 }], []);
    expect(data).toEqual([{ id: 1 }]);
  });

  it('throws using the backend message when a mutation fails', () => {
    expect(() => assertApiSuccess({
      success: false,
      message: 'Falha validada',
    }, 'fallback')).toThrow('Falha validada');
  });

  it('reads the most specific error message from axios-like responses', () => {
    expect(readApiErrorMessage({
      response: {
        data: {
          message: 'Mensagem do backend',
        },
      },
    }, 'fallback')).toBe('Mensagem do backend');
  });

  it('turns network failures into a helpful user message', () => {
    expect(readApiErrorMessage({
      code: 'ERR_NETWORK',
      message: 'Network Error',
      request: {},
    }, 'fallback')).toBe('Não foi possível conectar ao servidor. Verifique sua internet e tente novamente.');
  });

  it('reads technical error codes from axios-like responses', () => {
    expect(readApiErrorCode({
      response: {
        data: {
          error_code: 2010,
        },
      },
    })).toBe(2010);
  });
});

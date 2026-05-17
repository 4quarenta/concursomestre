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

import { beforeEach, describe, expect, it, vi } from 'vitest';

type MockApiResponse = {
  data?: unknown;
  success?: boolean;
  message?: string;
} | null | undefined;

type MockApiError = {
  message?: unknown;
} | null | undefined;

const { mockGet, mockPost } = vi.hoisted(() => ({
  mockGet: vi.fn(),
  mockPost: vi.fn(),
}));

vi.mock('@services/api', () => ({
  apiClient: {
    get: mockGet,
    post: mockPost,
  },
  ENDPOINTS: {
    payments: {
      installments: 'payments/get-installments.php',
      processMaterial: 'payments/process-payment.php',
    },
  },
  assertApiSuccess: (response: MockApiResponse) => ({
    success: response?.success !== false,
    raw: response,
  }),
  readApiData: (response: MockApiResponse, fallback: unknown) => {
    if (response?.data !== undefined) return response.data;
    return response ?? fallback;
  },
  readApiErrorMessage: (error: MockApiError, fallback: string) => {
    if (typeof error?.message === 'string') return error.message;
    return fallback;
  },
}));

import { paymentsService } from '../paymentsService';

describe('paymentsService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('normalizes installment lists from enveloped responses', async () => {
    mockGet.mockResolvedValueOnce({
      success: true,
      data: [
        {
          payment_method_id: 'visa',
          payer_costs: [{ installments: 1 }],
        },
      ],
    });

    const response = await paymentsService.getInstallments({
      amount: 99.9,
      bin: '411111',
      paymentMethodId: 'visa',
    });

    expect(mockGet).toHaveBeenCalledWith('payments/get-installments.php', {
      params: {
        amount: 99.9,
        bin: '411111',
        payment_method_id: 'visa',
      },
    });
    expect(response[0].payment_method_id).toBe('visa');
  });

  it('falls back to an empty list when the payload is not an array', async () => {
    mockGet.mockResolvedValueOnce({
      success: true,
      data: {
        unexpected: true,
      },
    });

    const response = await paymentsService.getInstallments({
      amount: 42,
    });

    expect(response).toEqual([]);
  });

  it('normalizes the material payment result for marketplace checkout', async () => {
    mockPost.mockResolvedValueOnce({
      status: 'approved',
      message: 'Pagamento aprovado.',
    });

    const response = await paymentsService.processMaterialPayment({
      token: 'tok_123',
      transaction_amount: 19.9,
      description: 'Material premium',
      installments: 1,
      payment_method_id: 'visa',
      material_id: 'mat-1',
      seller_id: 'seller-1',
      payer: {
        email: 'teste@example.com',
        identification: {
          type: 'CPF',
          number: '19119119100',
        },
      },
    });

    expect(mockPost).toHaveBeenCalledWith('payments/process-payment.php', {
      token: 'tok_123',
      transaction_amount: 19.9,
      description: 'Material premium',
      installments: 1,
      payment_method_id: 'visa',
      material_id: 'mat-1',
      seller_id: 'seller-1',
      payer: {
        email: 'teste@example.com',
        identification: {
          type: 'CPF',
          number: '19119119100',
        },
      },
    });
    expect(response.status).toBe('approved');
    expect(response.message).toBe('Pagamento aprovado.');
  });
});

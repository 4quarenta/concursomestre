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
  error?: string;
} | null | undefined;

const { mockGet, mockPost, mockDelete } = vi.hoisted(() => ({
  mockGet: vi.fn(),
  mockPost: vi.fn(),
  mockDelete: vi.fn(),
}));

vi.mock('@services/api', () => ({
  apiClient: {
    get: mockGet,
    post: mockPost,
    delete: mockDelete,
  },
  readApiData: (response: MockApiResponse, fallback: unknown) => {
    if (response?.data !== undefined) return response.data;
    return response ?? fallback;
  },
  assertApiSuccess: (response: MockApiResponse, fallbackMessage: string) => {
    if (!response?.success) {
      throw new Error(response?.message || response?.error || fallbackMessage);
    }

    return {
      success: true,
      message: response?.message,
      data: response?.data,
      raw: response,
    };
  },
  ENDPOINTS: {
    transactions: {
      list: 'transactionsList',
      create: 'transactions/create.php',
      refund: 'transactions/refund.php',
      approveRefund: 'transactions/approve_refund.php',
      rejectRefund: 'transactions/reject_refund.php',
    },
  },
}));

import { transactionsService } from '../transactionsService';

describe('transactionsService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('loads transactions from the official endpoint', async () => {
    mockGet.mockResolvedValueOnce({
      success: true,
      data: {
        rows: [{ id: 10, status: 'completed' }],
      },
    });

    const rows = await transactionsService.list({ userId: 'usr-1', scope: 'buyer' });

    expect(mockGet).toHaveBeenCalledWith('transactionsList', {
      params: {
        user_id: 'usr-1',
        scope: 'buyer',
      },
    });
    expect(rows).toHaveLength(1);
  });

  it('creates a material purchase through the official endpoint', async () => {
    mockPost.mockResolvedValueOnce({
      success: true,
      data: {
        transaction: {
          id: 44,
          materialId: 9,
          status: 'completed',
        },
      },
    });

    const transaction = await transactionsService.createMaterialPurchase(9);

    expect(mockPost).toHaveBeenCalledWith('transactions/create.php', {
      material_id: 9,
    });
    expect(transaction.id).toBe(44);
  });

  it('routes refund approval to the dedicated admin endpoint', async () => {
    mockPost.mockResolvedValueOnce({
      success: true,
      message: 'Estorno realizado com sucesso.',
    });

    const response = await transactionsService.resolveRefund('tx-1', 'approved', 'Aprovado');

    expect(mockPost).toHaveBeenCalledWith('transactions/approve_refund.php', {
      transaction_id: 'tx-1',
      reason: 'Aprovado',
    });
    expect(response.message).toBe('Estorno realizado com sucesso.');
  });

  it('routes retention offers through the dedicated admin refund endpoint', async () => {
    mockPost.mockResolvedValueOnce({
      success: true,
      message: 'Proposta enviada ao usuario.',
    });

    const response = await transactionsService.resolveRefund('tx-2', 'retention_offer');

    expect(mockPost).toHaveBeenCalledWith('transactions/reject_refund.php', {
      transaction_id: 'tx-2',
      reason: undefined,
    });
    expect(response.message).toBe('Proposta enviada ao usuario.');
  });

  it('cancels refund requests through the official transactions facade', async () => {
    mockDelete.mockResolvedValueOnce({
      success: true,
      message: 'Solicitacao cancelada.',
    });

    const response = await transactionsService.cancelRefundRequest('tx-9');

    expect(mockDelete).toHaveBeenCalledWith('transactions/refund.php', {
      data: {
        transaction_id: 'tx-9',
      },
    });
    expect(response.message).toBe('Solicitacao cancelada.');
  });
});

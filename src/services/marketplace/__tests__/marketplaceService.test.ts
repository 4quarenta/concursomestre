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

const { mockGet, mockPost, mockTransactionsList, mockCreateMaterialPurchase, mockCancelRefundRequest } = vi.hoisted(() => ({
  mockGet: vi.fn(),
  mockPost: vi.fn(),
  mockTransactionsList: vi.fn(),
  mockCreateMaterialPurchase: vi.fn(),
  mockCancelRefundRequest: vi.fn(),
}));

vi.mock('@services/api', () => ({
  apiClient: {
    get: mockGet,
    post: mockPost,
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
    materials: {
      list: 'materialsList',
      create: 'materialsCreate',
      update: 'materialsUpdate',
      moderate: 'materialsModerate',
      delete: 'materialsDelete',
      rate: 'materialsRate',
      upload: 'upload.php',
    },
    users: {
      materials: 'users/materials.php',
    },
    transactions: {
      list: 'transactionsList',
    },
  },
}));

vi.mock('@services/transactions', () => ({
  transactionsService: {
    list: mockTransactionsList,
    createMaterialPurchase: mockCreateMaterialPurchase,
    cancelRefundRequest: mockCancelRefundRequest,
    requestRefund: vi.fn(),
    resolveRefund: vi.fn(),
  },
}));

import { marketplaceService } from '../marketplaceService';

describe('marketplaceService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('loads materials from the official endpoint', async () => {
    mockGet.mockResolvedValueOnce({
      success: true,
      data: {
        items: [{ id: 'mat-1', title: 'Material teste' }],
        pageInfo: { limit: 24, hasMore: false, nextCursor: null },
      },
    });

    const materials = await marketplaceService.listMaterials();

    expect(mockGet).toHaveBeenCalledWith('materialsList', { params: { limit: 24 } });
    expect(materials[0].id).toBe('mat-1');
  });

  it('creates a material through the official endpoint', async () => {
    mockPost.mockResolvedValueOnce({
      success: true,
      data: {
        material: {
          id: 'mat-2',
          title: 'Novo material',
        },
      },
    });

    const material = await marketplaceService.createMaterial({
      title: 'Novo material',
    });

    expect(mockPost).toHaveBeenCalledWith('materialsCreate', {
      title: 'Novo material',
    });
    expect(material.id).toBe('mat-2');
  });

  it('rates a material through the official endpoint', async () => {
    mockPost.mockResolvedValueOnce({
      success: true,
      data: {
        newRating: 4.8,
        totalRatings: 12,
      },
    });

    const rating = await marketplaceService.rateMaterial('mat-9', 5);

    expect(mockPost).toHaveBeenCalledWith('materialsRate', {
      materialId: 'mat-9',
      rating: 5,
    });
    expect(rating).toEqual({
      newRating: 4.8,
      totalRatings: 12,
    });
  });

  it('loads marketplace transactions through the official transaction facade', async () => {
    mockTransactionsList.mockResolvedValueOnce([
      { id: 'tx-1', amount: 19.9 },
    ]);

    const rows = await marketplaceService.listTransactions({ userId: 'usr-1', scope: 'buyer' });

    expect(mockTransactionsList).toHaveBeenCalledWith({ userId: 'usr-1', scope: 'buyer' });
    expect(rows[0].id).toBe('tx-1');
  });

  it('loads user materials through the official marketplace facade', async () => {
    mockGet.mockResolvedValueOnce({
      success: true,
      materials: [
        { id: 'mat-lib-1', title: 'Material comprado' },
      ],
    });

    const materials = await marketplaceService.listUserMaterials('usr-2');

    expect(mockGet).toHaveBeenCalledWith('users/materials.php', {
      params: { userId: 'usr-2' },
    });
    expect(materials[0].id).toBe('mat-lib-1');
  });

  it('creates a material purchase through the official transaction facade', async () => {
    mockCreateMaterialPurchase.mockResolvedValueOnce({
      id: 'tx-9',
      materialId: 'mat-9',
    });

    const transaction = await marketplaceService.createMaterialPurchase('mat-9');

    expect(mockCreateMaterialPurchase).toHaveBeenCalledWith('mat-9');
    expect(transaction.id).toBe('tx-9');
  });

  it('cancels refund requests through the marketplace facade', async () => {
    mockCancelRefundRequest.mockResolvedValueOnce({
      message: 'Solicitacao cancelada.',
    });

    const response = await marketplaceService.cancelRefundRequest('tx-20');

    expect(mockCancelRefundRequest).toHaveBeenCalledWith('tx-20');
    expect(response.message).toBe('Solicitacao cancelada.');
  });

  it('normalizes file upload responses from the upload endpoint', async () => {
    mockPost.mockResolvedValueOnce({
      success: true,
      data: {
        fileRef: 'private://materials/file.pdf',
        pageCount: 42,
      },
    });

    const file = new File(['conteúdo'], 'arquivo.pdf', { type: 'application/pdf' });
    const result = await marketplaceService.uploadFile(file);

    expect(mockPost).toHaveBeenCalledWith('upload.php', expect.any(FormData), expect.objectContaining({
      onUploadProgress: expect.any(Function),
    }));
    expect(result).toEqual({
      fileRef: 'private://materials/file.pdf',
      pageCount: 42,
    });
  });
});

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

import { readApiData, requestApi } from '@/lib/browserApi';
import { requestAuthenticatedApi } from '@/lib/authSession';
import type { Material, Transaction } from '@/types';

type MarketplaceFilters = {
  subject?: string;
};

type MarketplaceTransactionListParams = {
  userId?: string;
  scope?: 'buyer' | 'seller' | 'all';
};

type UploadMaterialFileParams = {
  password?: string;
};

type UploadMaterialFileResult = {
  pageCount?: number;
  url: string;
};

const MARKETPLACE_ENDPOINTS = {
  materials: 'materialsList',
  createMaterial: 'materialsCreate',
  transactions: 'transactionsList',
  createTransaction: 'transactions/create.php',
  upload: 'upload.php',
} as const;

const buildEndpoint = (endpoint: string, params: Record<string, string | number | undefined> = {}) => {
  const searchParams = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== '') {
      searchParams.set(key, String(value));
    }
  });

  const query = searchParams.toString();
  return query ? `${endpoint}?${query}` : endpoint;
};

const normalizeMaterialList = (response: any): Material[] => {
  const payload = readApiData<any>(response, []);

  if (Array.isArray(payload)) {
    return payload;
  }

  if (Array.isArray(payload?.rows)) {
    return payload.rows;
  }

  if (Array.isArray(payload?.materials)) {
    return payload.materials;
  }

  if (Array.isArray(response?.rows)) {
    return response.rows;
  }

  if (Array.isArray(response?.materials)) {
    return response.materials;
  }

  return [];
};

const normalizeTransactionList = (response: any): Transaction[] => {
  const payload = readApiData<any>(response, {});

  if (Array.isArray(payload)) {
    return payload;
  }

  if (Array.isArray(payload?.rows)) {
    return payload.rows;
  }

  if (Array.isArray(payload?.transactions)) {
    return payload.transactions;
  }

  if (Array.isArray(response?.rows)) {
    return response.rows;
  }

  if (Array.isArray(response?.transactions)) {
    return response.transactions;
  }

  return [];
};

export const marketplaceService = {
  async listMaterials(filters: MarketplaceFilters = {}): Promise<Material[]> {
    const response = await requestApi<any>(buildEndpoint(MARKETPLACE_ENDPOINTS.materials, {
      subject: filters.subject,
    }), {
      method: 'GET',
    });

    return normalizeMaterialList(response);
  },

  async listTransactions(params: MarketplaceTransactionListParams = {}): Promise<Transaction[]> {
    const response = await requestAuthenticatedApi<any>(buildEndpoint(MARKETPLACE_ENDPOINTS.transactions, {
      user_id: params.userId,
      scope: params.scope || 'buyer',
    }), {
      method: 'GET',
    });

    return normalizeTransactionList(response);
  },

  async acquireFreeMaterial(materialId: string | number): Promise<Transaction | null> {
    const response = await requestAuthenticatedApi<any>(MARKETPLACE_ENDPOINTS.createTransaction, {
      method: 'POST',
      body: {
        material_id: materialId,
      },
    });

    const payload = readApiData<any>(response, {});
    return payload?.transaction || response?.transaction || null;
  },

  async uploadFile(file: File, options: UploadMaterialFileParams = {}): Promise<UploadMaterialFileResult | null> {
    const formData = new FormData();
    formData.append('file', file);

    if (options.password) {
      formData.append('password', options.password);
    }

    const response = await requestAuthenticatedApi<any>(MARKETPLACE_ENDPOINTS.upload, {
      method: 'POST',
      body: formData,
    });

    const payload = readApiData<any>(response, {});
    const url = payload?.url || response?.url || '';

    if (!url) {
      return null;
    }

    return {
      url,
      pageCount: Number(payload?.pageCount || response?.pageCount || 0) || undefined,
    };
  },

  async createMaterial(material: Partial<Material>): Promise<Material> {
    const response = await requestAuthenticatedApi<any>(MARKETPLACE_ENDPOINTS.createMaterial, {
      method: 'POST',
      body: material,
    });

    const payload = readApiData<any>(response, {});
    return payload?.material || response?.material || material as Material;
  },
};

export default marketplaceService;

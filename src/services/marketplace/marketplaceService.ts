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

import { apiClient, ENDPOINTS, assertApiSuccess, readApiData } from '@services/api';
import { buildRequestCacheKey, withRequestCoalescing } from '@services/api/requestCoalescer';
import { transactionsService } from '@services/transactions';
import type { Material, Transaction } from '@types';

type MarketplaceTransactionListParams = {
  userId?: string;
  scope?: 'buyer' | 'seller' | 'all';
  page?: number;
  limit?: number;
  startDate?: string;
  endDate?: string;
  status?: string;
  type?: string;
};

type UploadMaterialFileParams = {
  onProgress?: (progress: number) => void;
};

type UploadMaterialFileResult = {
  fileRef?: string;
  publicUrl?: string;
  pageCount?: number;
};

type MaterialMutationResponse = {
  material?: Material;
  data?: {
    material?: Material;
  };
};

type UserMaterialsResponse = {
  materials?: Material[];
};

type MaterialRatingResponse = {
  userRating?: number | string;
  newRating?: number | string;
  totalRatings?: number | string;
};

type MaterialsListResponse = {
  items?: Material[];
  rows?: Material[];
  pageInfo?: {
    limit?: number;
    hasMore?: boolean;
    nextCursor?: string | null;
  };
};

type UploadMaterialResponse = {
  success?: boolean;
  fileRef?: string;
  publicUrl?: string;
  pageCount?: number;
};

/**
 * Fachada oficial do dominio de marketplace e materiais.
 * Centraliza os contratos ativos para evitar chamadas cruas espalhadas.
 * @since 1.0.0
 */
export const marketplaceService = {
  /**
   * Lista materiais publicados com filtros opcionais do marketplace.
   * @since 1.0.0
   */
  async listMaterials(filters?: { subject?: string }): Promise<Material[]> {
    return withRequestCoalescing(
      buildRequestCacheKey('marketplace:materials:list', filters || {}),
      async () => {
        const params = filters ? { ...filters, limit: 24 } : { limit: 24 };
        const response = await apiClient.get<Material[] | MaterialsListResponse>(ENDPOINTS.materials.list, {
          params,
        });

        const payload = readApiData<Material[] | MaterialsListResponse>(response, []);
        return Array.isArray(payload) ? payload : payload.items || payload.rows || [];
      },
      4000,
    );
  },

  /**
   * Busca um material publico especifico pela listagem oficial.
   * @since 1.0.0
   */
  async getMaterialById(materialId: string): Promise<Material | null> {
    const materials = await this.listMaterials();
    return materials.find((material) => String(material.id) === String(materialId)) || null;
  },

  /**
   * Publica um novo material no backend oficial.
   * @since 1.0.0
   */
  async createMaterial(material: Partial<Material>): Promise<Material> {
    const response = await apiClient.post<MaterialMutationResponse>(ENDPOINTS.materials.create, material);
    const envelope = assertApiSuccess(response, 'Erro ao publicar material.');
    const payload = readApiData<MaterialMutationResponse>(response, {});

    return payload.data?.material
      ?? payload.material
      ?? envelope.raw.material as Material
      ?? material as Material;
  },

  /**
   * Atualiza um material existente pelo fluxo do autor ou do admin.
   * @since 1.0.0
   */
  async updateMaterial(materialId: string, updates: Partial<Material>): Promise<Material> {
    const response = await apiClient.post<MaterialMutationResponse>(ENDPOINTS.materials.update, {
      id: materialId,
      ...updates,
    });
    const envelope = assertApiSuccess(response, 'Erro ao atualizar material.');
    const payload = readApiData<MaterialMutationResponse>(response, {});

    return payload.data?.material
      ?? payload.material
      ?? envelope.raw.material as Material
      ?? { id: materialId, ...updates } as Material;
  },

  /**
   * Executa a moderacao administrativa de um material denunciado.
   * @since 1.0.0
   */
  async moderateMaterial(
    materialId: string,
    status: 'approved' | 'rejected',
    reason?: string,
    evidenceUrl?: string,
  ): Promise<Partial<Material>> {
    const response = await apiClient.post<MaterialMutationResponse>(ENDPOINTS.materials.moderate, {
      id: materialId,
      status,
      reason,
      evidence_url: evidenceUrl,
    });
    const envelope = assertApiSuccess(response, 'Erro ao moderar material.');
    const payload = readApiData<MaterialMutationResponse>(response, {});

    return payload.data?.material
      ?? payload.material
      ?? envelope.raw.material as Partial<Material>
      ?? {
        id: materialId,
        status,
        rejectionReason: reason,
      };
  },

  /**
   * Remove um material da base pelo endpoint oficial.
   * @since 1.0.0
   */
  async deleteMaterial(materialId: string): Promise<void> {
    const response = await apiClient.post(ENDPOINTS.materials.delete, { id: materialId });
    assertApiSuccess(response, 'Erro ao excluir material.');
  },

  /**
   * Lista transacoes do marketplace.
   * @since 1.0.0
   */
  async listTransactions(params: MarketplaceTransactionListParams = {}): Promise<Transaction[]> {
    return withRequestCoalescing(
      buildRequestCacheKey('marketplace:transactions:list', params),
      async () => transactionsService.list(params),
      3000,
    );
  },

  /**
   * Busca a avaliacao do usuario atual para um material especifico.
   * @since 1.0.0
   */
  async getUserMaterialRating(materialId: string): Promise<number> {
    const response = await apiClient.get<MaterialRatingResponse>(ENDPOINTS.materials.rate, {
      params: { material_id: materialId },
    });

    const payload = readApiData<MaterialRatingResponse>(response, {});
    return Number(payload.userRating || 0);
  },

  /**
   * Registra uma avaliacao de material e devolve o agregado atualizado.
   * @since 1.0.0
   */
  async rateMaterial(materialId: string, rating: number): Promise<{ newRating: number; totalRatings: number }> {
    const response = await apiClient.post<MaterialRatingResponse>(ENDPOINTS.materials.rate, {
      materialId,
      rating,
    });

    assertApiSuccess(response, 'Erro ao registrar avaliacao.');
    const payload = readApiData<MaterialRatingResponse>(response, {});

    return {
      newRating: Number(payload.newRating || 0),
      totalRatings: Number(payload.totalRatings || 0),
    };
  },

  /**
   * Compatibiliza chamadas antigas que ainda passam number como id de usuario.
   * @since 1.0.0
   */
  async getTransactions(userId: number): Promise<Transaction[]> {
    return this.listTransactions({ userId: userId.toString() });
  },

  /**
   * Lista transacoes relacionadas a um usuario especifico.
   * @since 1.0.0
   */
  async getUserTransactions(userId: string): Promise<Transaction[]> {
    return this.listTransactions({ userId });
  },

  /**
   * Busca os materiais publicados por um usuario no fluxo de perfil/admin.
   * @since 1.0.0
   */
  async listUserMaterials(userId: string): Promise<Material[]> {
    const response = await apiClient.get<UserMaterialsResponse>(ENDPOINTS.users.materials, {
      params: { userId },
    });
    const envelope = assertApiSuccess(response, 'Erro ao carregar os materiais do usuario.');
    const payload = readApiData<UserMaterialsResponse>(response, {});

    return Array.isArray(payload.materials)
      ? payload.materials
      : Array.isArray(envelope.raw.materials)
        ? envelope.raw.materials as Material[]
        : [];
  },

  /**
   * Solicita estorno de uma compra do marketplace.
   * @since 1.0.0
   */
  async requestRefund(transactionId: string, reason: string): Promise<{ message?: string }> {
    return transactionsService.requestRefund(transactionId, reason);
  },

  /**
   * Cancela uma solicitacao de estorno ainda pendente.
   * @since 1.0.0
   */
  async cancelRefundRequest(transactionId: string | number): Promise<{ message?: string }> {
    return transactionsService.cancelRefundRequest(transactionId);
  },

  /**
   * Resolve administrativamente uma solicitacao de estorno.
   * @since 1.0.0
   */
  async processRefund(transactionId: string, resolution: 'approved' | 'retention_offer'): Promise<{ message?: string }> {
    return transactionsService.resolveRefund(transactionId, resolution);
  },

  /**
   * Mantem a compra oficial dentro do dominio de marketplace.
   * @since 1.0.0
   */
  async createMaterialPurchase(materialId: string | number, couponCode?: string): Promise<Transaction> {
    return couponCode
      ? transactionsService.createMaterialPurchase(materialId, couponCode)
      : transactionsService.createMaterialPurchase(materialId);
  },

  /**
   * Ponte booleana mantida por compatibilidade com fluxos legados de compra.
   * @since 1.0.0
   */
  async purchaseMaterial(materialId: number, couponCode?: string): Promise<boolean> {
    const transaction = await this.createMaterialPurchase(materialId, couponCode);
    return Boolean(transaction?.id);
  },

  /**
   * Publica material usando a ponte antiga esperada por alguns fluxos da UI.
   * @since 1.0.0
   */
  async uploadMaterial(material: Partial<Material>): Promise<boolean> {
    const response = await apiClient.post<MaterialMutationResponse>(ENDPOINTS.materials.create, material);
    return assertApiSuccess(response, 'Erro ao publicar material pela ponte legada.').success;
  },

  /**
   * Centraliza o upload de materiais/capas e a normalizacao do retorno do endpoint legado.
   * @since 1.0.0
   */
  async uploadFile(
    file: File,
    options: UploadMaterialFileParams = {},
  ): Promise<UploadMaterialFileResult | null> {
    const formData = new FormData();
    formData.append('file', file);

    const response = await apiClient.post<UploadMaterialResponse>(ENDPOINTS.materials.upload, formData, {
      onUploadProgress: (progressEvent) => {
        if (!options.onProgress) {
          return;
        }

        const percentCompleted = Math.round(
          (progressEvent.loaded * 100) / (progressEvent.total || 100),
        );
        options.onProgress(percentCompleted);
      },
    });

    const payload = readApiData<UploadMaterialResponse>(response, {});
    const uploadSucceeded = Boolean(payload.success ?? payload.fileRef ?? payload.publicUrl);
    if (!uploadSucceeded) {
      return null;
    }

    assertApiSuccess({ success: true, data: payload }, 'Erro ao enviar arquivo.');

    return {
      fileRef: payload.fileRef,
      publicUrl: payload.publicUrl,
      pageCount: payload.pageCount,
    };
  },

  /**
   * Placeholder mantido para o futuro painel de parceiros.
   * @since 1.0.0
   */
  async getPartnerTransactions(_partnerId: string): Promise<Transaction[]> {
    void _partnerId;
    return [];
  },

  /**
   * Bridge legado mantido apenas para compatibilidade de interface.
   * @since 1.0.0
   */
  setTransactions(_transactions: Transaction[]) {
    void _transactions;
    // Bridge mantido por compatibilidade com chamadas legadas.
  },

  /**
   * Alias legado para a listagem oficial de materiais.
   * @since 1.0.0
   */
  async getMaterials(filters?: { subject?: string }): Promise<Material[]> {
    return this.listMaterials(filters);
  },
};

export default marketplaceService;

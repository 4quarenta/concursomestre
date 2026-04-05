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
  password?: string;
  onProgress?: (progress: number) => void;
};

type UploadMaterialFileResult = {
  url: string;
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
   * Essa consulta alimenta vitrines, busca e listagens administrativas.
   * @since 1.0.0
   */
  async listMaterials(filters?: { subject?: string }): Promise<Material[]> {
    const response = await apiClient.get<any>(ENDPOINTS.materials.list, {
      params: filters,
    }) as any;

    const payload = readApiData<any[]>(response, []);
    return Array.isArray(payload) ? payload : payload?.rows || [];
  },

  /**
   * Publica um novo material no backend oficial.
   * O retorno normalizado permite que o contexto atualize a vitrine sem parsing extra.
   * @since 1.0.0
   */
  async createMaterial(material: Partial<Material>): Promise<Material> {
    const response = await apiClient.post<any>(ENDPOINTS.materials.create, material) as any;
    const raw = assertApiSuccess(response, 'Erro ao publicar material.').raw;
    return raw?.data?.material ?? raw?.material ?? material;
  },

  /**
   * Atualiza um material existente pelo fluxo do autor ou do admin.
   * @since 1.0.0
   */
  async updateMaterial(materialId: string, updates: Partial<Material>): Promise<Material> {
    const response = await apiClient.post<any>(ENDPOINTS.materials.update, {
      id: materialId,
      ...updates,
    }) as any;

    const raw = assertApiSuccess(response, 'Erro ao atualizar material.').raw;
    return raw?.data?.material ?? raw?.material ?? { id: materialId, ...updates };
  },

  /**
   * Executa a moderacao administrativa de um material denunciado.
   * Esse resultado alimenta os modais de aprovacao, rejeicao e bloqueio no painel.
   * @since 1.0.0
   */
  async moderateMaterial(
    materialId: string,
    status: 'approved' | 'rejected',
    reason?: string,
    evidenceUrl?: string,
  ): Promise<Partial<Material>> {
    const response = await apiClient.post<any>(ENDPOINTS.materials.moderate, {
      id: materialId,
      status,
      reason,
      evidence_url: evidenceUrl,
    }) as any;

    const raw = assertApiSuccess(response, 'Erro ao moderar material.').raw;
    return raw?.data?.material ?? raw?.material ?? {
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
    const response = await apiClient.post<any>(ENDPOINTS.materials.delete, { id: materialId }) as any;
    assertApiSuccess(response, 'Erro ao excluir material.');
  },

  /**
   * Centraliza a leitura de transacoes do marketplace para que contexts e telas
   * nao precisem conhecer o endpoint bruto de transacoes.
   * @since 1.0.0
   */
  async listTransactions(params: MarketplaceTransactionListParams = {}): Promise<Transaction[]> {
    return transactionsService.list(params);
  },

  /**
   * Busca a avaliacao do usuario atual para um material especifico.
   * @since 1.0.0
   */
  async getUserMaterialRating(materialId: string): Promise<number> {
    const response = await apiClient.get<any>(ENDPOINTS.materials.rate, {
      params: { material_id: materialId },
    }) as any;

    const payload = readApiData<any>(response, {});
    return Number(payload?.userRating || 0);
  },

  /**
   * Registra uma avaliacao de material e devolve o agregado atualizado.
   * @since 1.0.0
   */
  async rateMaterial(materialId: string, rating: number): Promise<{ newRating: number; totalRatings: number }> {
    const response = await apiClient.post<any>(ENDPOINTS.materials.rate, {
      materialId,
      rating,
    }) as any;

    const raw = assertApiSuccess(response, 'Erro ao registrar avaliacao.').raw;
    const payload = readApiData<any>(raw, {});

    return {
      newRating: Number(payload?.newRating || 0),
      totalRatings: Number(payload?.totalRatings || 0),
    };
  },

  /**
   * Compatibiliza chamadas antigas que ainda passam `number` como id de usuario.
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
  async listUserMaterials(userId: string): Promise<any[]> {
    const response = await apiClient.get<any>(ENDPOINTS.users.materials, {
      params: { userId },
    }) as any;

    const raw = assertApiSuccess(response, 'Erro ao carregar os materiais do usuario.').raw;
    const payload = readApiData<any>(raw, {});
    return Array.isArray(payload?.materials)
      ? payload.materials
      : Array.isArray(raw?.materials)
        ? raw.materials
        : [];
  },

  /**
   * Solicita estorno de uma compra do marketplace.
   * @since 1.0.0
   */
  async requestRefund(transactionId: string, reason: string): Promise<any> {
    return transactionsService.requestRefund(transactionId, reason);
  },

  /**
   * Cancela uma solicitacao de estorno ainda pendente.
   * @since 1.0.0
   */
  async cancelRefundRequest(transactionId: string | number): Promise<any> {
    return transactionsService.cancelRefundRequest(transactionId);
  },

  /**
   * Resolve administrativamente uma solicitacao de estorno.
   * @since 1.0.0
   */
  async processRefund(transactionId: string, approved: boolean): Promise<any> {
    return transactionsService.resolveRefund(transactionId, approved ? 'approved' : 'rejected');
  },

  /**
   * Mantem a compra oficial dentro do dominio de marketplace e devolve a
   * transacao criada para o contexto sincronizar estado local e notificacoes.
   * @since 1.0.0
   */
  async createMaterialPurchase(materialId: string | number): Promise<Transaction> {
    return transactionsService.createMaterialPurchase(materialId);
  },

  /**
   * Ponte booleana mantida por compatibilidade com fluxos legados de compra.
   * @since 1.0.0
   */
  async purchaseMaterial(materialId: number): Promise<boolean> {
    const transaction = await this.createMaterialPurchase(materialId);
    return Boolean(transaction?.id);
  },

  /**
   * Publica material usando a ponte antiga esperada por alguns fluxos da UI.
   * @since 1.0.0
   */
  async uploadMaterial(material: Partial<Material>): Promise<boolean> {
    const response = await apiClient.post<any>(ENDPOINTS.materials.create, material) as any;
    return assertApiSuccess(response, 'Erro ao publicar material pela ponte legada.').success;
  },

  /**
   * Centraliza o upload de materiais/capas e a normalizacao do retorno do
   * endpoint legado de upload.
   * @since 1.0.0
   */
  async uploadFile(
    file: File,
    options: UploadMaterialFileParams = {},
  ): Promise<UploadMaterialFileResult | null> {
    const formData = new FormData();
    formData.append('file', file);

    if (options.password) {
      formData.append('password', options.password);
    }

    const response: any = await apiClient.post(ENDPOINTS.materials.upload, formData, {
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

    const payload = readApiData<any>(response, {});
    const uploadSucceeded = Boolean(response?.success ?? payload?.success ?? payload?.url);
    if (!uploadSucceeded) {
      return null;
    }

    assertApiSuccess({ success: true, data: payload, raw: response }, 'Erro ao enviar arquivo.');

    return {
      url: payload?.url || response?.url,
      pageCount: payload?.pageCount || response?.pageCount,
    };
  },

  /**
   * Placeholder mantido para o futuro painel de parceiros.
   * Hoje nao ha backend dedicado para esta listagem no frontend atual.
   * @since 1.0.0
   */
  async getPartnerTransactions(_partnerId: string): Promise<Transaction[]> {
    return [];
  },

  /**
   * Bridge legado mantido apenas para compatibilidade de interface.
   * O estado real das transacoes hoje vive nos contexts e services oficiais.
   * @since 1.0.0
   */
  setTransactions(_transactions: Transaction[]) {
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

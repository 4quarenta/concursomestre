import { Material, Transaction, UserProfile } from '../types';
import { api } from '../data/api';

export const marketplaceService = {

  // Fetch materials from API
  getMaterials: async (): Promise<Material[]> => {
    const response = await api.get<any>('api/materials/list.php');
    if (response.success && response.data) {
      return response.data;
    }
    return [];
  },

  // Processar Compra (Simulação de Gateway)
  processTransaction: async (user: UserProfile, material: Material): Promise<Transaction> => {
    // For now, we still mock the transaction processing part as we don't have a real gateway
    // But we should at least support the interface
    await new Promise(resolve => setTimeout(resolve, 1500));

    if (!user.cpf && !user.address) { // relaxed check for demo
      // throw new Error("KYC_REQUIRED");
    }

    const transaction: Transaction = {
      id: `txn-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      buyerId: user.id,
      buyerName: user.name,
      materialId: material.id,
      materialTitle: material.title,
      sellerId: material.authorId,
      amount: material.price,
      platformFee: material.price * 0.20,
      status: 'completed',
      timestamp: Date.now()
    };

    return transaction;
  },

  // Solicitar Reembolso
  requestRefund: async (transactionId: string, reason: string): Promise<Transaction> => {
    // Mock logic maintained for now
    await new Promise(resolve => setTimeout(resolve, 800));
    return {
      id: transactionId,
      buyerId: '', materialId: '', sellerId: '', buyerName: '', materialTitle: '', amount: 0, platformFee: 0, timestamp: 0,
      status: 'refund_requested',
      refundReason: reason
    };
  },

  // Processar/Aprovar Reembolso (Admin/Sistema)
  processRefund: async (transactionId: string, approved: boolean): Promise<Transaction> => {
    await new Promise(resolve => setTimeout(resolve, 1000));
    return {
      id: transactionId,
      buyerId: '', materialId: '', sellerId: '', buyerName: '', materialTitle: '', amount: 0, platformFee: 0, timestamp: 0,
      status: approved ? 'refunded' : 'completed'
    };
  },

  getUserTransactions: async (userId: string): Promise<Transaction[]> => {
    return []; // TODO: Implement API Endpoint
  },

  getPartnerTransactions: async (partnerId: string): Promise<Transaction[]> => {
    return []; // TODO: Implement API Endpoint
  },

  setTransactions: (txs: Transaction[]) => { }
};

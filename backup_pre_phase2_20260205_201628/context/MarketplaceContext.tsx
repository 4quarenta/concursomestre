
import React, { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import { Material, Transaction, Comment } from '../types';
import { useAuth } from './AuthContext';
import { marketplaceService } from '../services/marketplaceService';
import { useData } from './DataContext';
import { reputationService } from '../services/reputationService';
import { commentService } from '../services/commentService';
import { api } from '../data/api';

import { useToast } from './ToastContext';

interface MarketplaceContextType {
  materials: Material[];
  transactions: Transaction[];
  purchaseMaterial: (material: Material) => void;
  publishMaterial: (material: Material) => void;
  moderateMaterial: (id: string, status: 'approved' | 'rejected', reason?: string, evidenceUrl?: string) => void;
  addMaterialComment: (materialId: string, text: string, parentId?: string) => void;
  likeMaterialComment: (materialId: string, commentId: string) => void;
  requestRefund: (transactionId: string, reason: string) => void;
  fetchUserTransactions: () => void;
  deleteMaterial: (id: string) => void;
  generateMockTransactions: () => void;
  resolveRefund: (transactionId: string, resolution: 'approved' | 'rejected') => void;
}

const MarketplaceContext = createContext<MarketplaceContextType | undefined>(undefined);

export const MarketplaceProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [materials, setMaterials] = useState<Material[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const { currentUser, purchaseMaterial: authPurchase, removeMaterialAccess } = useAuth();
  const { sendNotification, users, updateUserStatus } = useData();
  const { addToast } = useToast();

  // Carregar dados iniciais
  useEffect(() => {
    // 1. Fetch Materials
    api.get<Material[]>('api/materials/list.php')
      .then(data => {
        if (Array.isArray(data)) setMaterials(data);
      })
      .catch(err => console.error("Failed to load materials:", err));

    // 2. Fetch User Transactions
    if (currentUser) {
      if (currentUser.role === 'admin') {
        // Fetch all for admin
        api.get<Transaction[]>('api/transactions/list.php')
          .then(data => {
            if (Array.isArray(data)) setTransactions(data);
          })
          .catch(err => console.error("Failed to load all transactions:", err));
      } else {
        fetchUserTransactions();
      }
    }
  }, [currentUser]);

  const fetchUserTransactions = async () => {
    if (currentUser) {
      const txs = await marketplaceService.getUserTransactions(currentUser.id);
      setTransactions(txs);

      // AUTO-GENERATE MOCK DATA IF EMPTY (FOR DEV)
      if (txs.length === 0) {
        generateMockTransactions();
      }
    }
  };

  const generateMockTransactions = () => {
    const mockTxs: Transaction[] = [];
    const statuses: Transaction['status'][] = ['completed', 'completed', 'completed', 'completed', 'refunded', 'refund_requested']; // added refund_requested
    const refundReasons = [
      "Material incompleto",
      "Qualidade abaixo do esperado",
      "Compra acidental",
      "Conteúdo desatualizado",
      "Formatação incorreta"
    ];
    const now = Date.now();
    const DAY_MS = 86400000;

    for (let i = 0; i < 50; i++) {
      const randomMaterial = materials[Math.floor(Math.random() * materials.length)];
      const randomBuyer = users[Math.floor(Math.random() * users.length)];
      const isOld = Math.random() > 0.5; // 50% chance of being > 7 days old
      const daysAgo = isOld ? Math.floor(Math.random() * 20) + 8 : Math.floor(Math.random() * 7);
      const timestamp = now - (daysAgo * DAY_MS);

      if (randomMaterial && randomBuyer) {
        const status = statuses[Math.floor(Math.random() * statuses.length)];
        const hasReason = status === 'refund_requested' || status === 'refunded';

        mockTxs.push({
          id: crypto.randomUUID(),
          buyerId: randomBuyer.id,
          buyerName: randomBuyer.name,
          materialId: randomMaterial.id,
          materialTitle: randomMaterial.title,
          sellerId: randomMaterial.authorId,
          amount: randomMaterial.price,
          platformFee: randomMaterial.price * 0.20,
          status: status,
          refundReason: hasReason ? refundReasons[Math.floor(Math.random() * refundReasons.length)] : undefined,
          timestamp: timestamp
        });
      }
    }
    marketplaceService.setTransactions([...transactions, ...mockTxs]); // Sync with service
    setTransactions(prev => [...prev, ...mockTxs]);
    // alert("50 transações de teste geradas com sucesso!"); // Removed alert for auto-generation
  };

  const purchaseMaterial = async (material: Material) => {
    if (!currentUser) return;

    try {
      const transaction: Transaction = {
        id: crypto.randomUUID(),
        buyerId: currentUser.id,
        buyerName: currentUser.name,
        materialId: material.id,
        materialTitle: material.title,
        sellerId: material.authorId,
        amount: material.price,
        platformFee: material.price * 0.20, // 20% fee
        status: 'completed',
        timestamp: Date.now()
      };



      // Sync with service since we are bypassing processTransaction for this mock context flow
      // OR better yet, call processTransaction which handles it.
      // But adhering to existing pattern:
      marketplaceService.setTransactions([transaction, ...transactions]);

      setTransactions(prev => [transaction, ...prev]);

      // Add access
      // In a real app, this would update backend
      currentUser.purchasedMaterialIds = [...(currentUser.purchasedMaterialIds || []), material.id];

      // Atualizar stats do material
      setMaterials(prev => prev.map(m => m.id === material.id ? { ...m, salesCount: m.salesCount + 1 } : m));

      // 1. Notificar Comprador
      sendNotification(currentUser.id, "Compra Realizada", `Você adquiriu "${material.title}". Protocolo: ${transaction.id.substring(0, 12)}`, 'success', 'marketplace');

      // 2. Notificar Vendedor
      if (material.authorId) {
        sendNotification(material.authorId, "Venda Realizada", `Você vendeu "${material.title}" para ${currentUser.name}. Protocolo: ${transaction.id.substring(0, 12)}`, 'success', 'marketplace');
      }

      // 3. Notificar Admin (Nova Venda)
      sendNotification('admin', "Nova Transação no Marketplace", `Venda realizada: "${material.title}" por ${currentUser.name}.`, 'success', 'marketplace');

      addToast("Compra realizada com sucesso! O material foi adicionado à sua biblioteca.", "success");
    } catch (error: any) {
      if (error.message === 'KYC_REQUIRED') {
        // Handled by UI
      } else {
        addToast(`Erro na compra: ${error.message}`, "error");
      }
    }
  };

  const requestRefund = async (transactionId: string, reason: string) => {
    try {
      const updatedTxn = await marketplaceService.requestRefund(transactionId, reason);
      setTransactions(prev => prev.map(t => t.id === transactionId ? updatedTxn : t));

      // Se for aprovado automaticamente ou em lógica futura
      if (updatedTxn.status === 'refunded') {
        removeMaterialAccess?.(updatedTxn.materialId);
      }

      sendNotification(currentUser!.id, "Reembolso Solicitado", "Sua solicitação está em análise.", 'info', 'marketplace');
      alert("Solicitação enviada.");
    } catch (error: any) {
      alert(error.message);
    }
  };

  const publishMaterial = (newMaterial: Material) => {
    setMaterials(prev => [newMaterial, ...prev]);
    sendNotification('admin', "Novo Material", `Material "${newMaterial.title}" aguardando aprovação.`, 'info', 'marketplace');
  };

  const moderateMaterial = (id: string, status: 'approved' | 'rejected', reason?: string, evidenceUrl?: string) => {
    setMaterials(prev => prev.map(m => m.id === id ? { ...m, status, rejectionReason: reason } : m));
    const mat = materials.find(m => m.id === id);
    if (mat) {
      sendNotification(mat.authorId, `Material ${status === 'approved' ? 'Aprovado' : 'Rejeitado'}`, `Seu material "${mat.title}" foi ${status}. ${reason ? `Motivo: ${reason}` : ''}`, status === 'approved' ? 'success' : 'error', 'marketplace', undefined, evidenceUrl);

      // Atualizar Reputação do Autor
      const action = status === 'approved' ? 'ignored' : 'resolved';
      const impact = reputationService.calculateImpact(action, 'author');
      const author = users.find(u => u.id === mat.authorId);
      if (author) {
        const newRep = reputationService.updateScore(author.reputation, impact);
        updateUserStatus(author.id, {
          reputation: newRep,
          status: reputationService.checkAccountStatus(newRep)
        });
      }
    }
  };

  const resolveRefund = (transactionId: string, resolution: 'approved' | 'rejected') => {
    setTransactions(prev => prev.map(t => {
      if (t.id === transactionId) {
        return {
          ...t,
          status: resolution === 'approved' ? 'refunded' : 'completed',
          refundReason: resolution === 'approved' ? t.refundReason : undefined // Clear reason if rejected (optional)
        };
      }
      return t;
    }));

    const tx = transactions.find(t => t.id === transactionId);
    if (tx) {
      if (resolution === 'approved') {
        sendNotification(tx.buyerId, "Reembolso Aprovado", `Seu reembolso para ${tx.materialTitle} foi aprovado.`, 'success', 'marketplace');
        removeMaterialAccess?.(tx.materialId); // Remove access
      } else {
        sendNotification(tx.buyerId, "Reembolso Negado", `Sua solicitação de reembolso para ${tx.materialTitle} foi negada.`, 'error', 'marketplace');
      }
    }
  };

  const addMaterialComment = (materialId: string, text: string, parentId?: string) => {
    if (!currentUser) return;
    const newComment: Comment = {
      id: `mc-${Date.now()}`,
      userId: currentUser.id,
      userName: currentUser.name,
      userPlan: currentUser.billing?.plan || 'Gratuito',
      text: text,
      date: 'Agora',
      likes: 0,
      replies: []
    };

    setMaterials(prev => prev.map(m => {
      if (m.id === materialId) {
        if (parentId) {
          return { ...m, comments: commentService.addReplyToComments(m.comments || [], parentId, newComment) };
        } else {
          return { ...m, comments: [newComment, ...(m.comments || [])] };
        }
      }
      return m;
    }));

    // Notificações Sociais para Materiais
    if (parentId) {
      const mat = materials.find(m => m.id === materialId);
      if (mat) {
        const ownerId = commentService.findCommentOwner(mat.comments || [], parentId);
        if (ownerId && ownerId !== currentUser.id) {
          sendNotification(ownerId, "Nova Resposta no Material", `${currentUser.name} respondeu seu comentário em "${mat.title}".`, 'info', 'social');
        }
      }
    } else {
      // Notificar autor do material sobre novo comentário
      const mat = materials.find(m => m.id === materialId);
      if (mat && mat.authorId && mat.authorId !== currentUser.id) {
        sendNotification(mat.authorId, "Novo Comentário", `${currentUser.name} comentou em seu material "${mat.title}".`, 'info', 'social');
      }
    }
  };

  const likeMaterialComment = (materialId: string, commentId: string) => {
    if (!currentUser) return;
    setMaterials(prev => prev.map(m => {
      if (m.id === materialId) {
        return { ...m, comments: commentService.likeCommentInTree(m.comments || [], commentId) };
      }
      return m;
    }));

    const mat = materials.find(m => m.id === materialId);
    if (mat) {
      const ownerId = commentService.findCommentOwner(mat.comments || [], commentId);
      if (ownerId && ownerId !== currentUser.id) {
        sendNotification(ownerId, "Curtiram seu comentário", `${currentUser.name} curtiu seu comentário em "${mat.title}".`, 'success', 'social');
      }
    }
  };

  const deleteMaterial = (id: string) => {
    const materialToDelete = materials.find(m => m.id === id);
    if (!materialToDelete) return;

    if (window.confirm(`Tem certeza que deseja excluir o material "${materialToDelete.title}"? Esta ação é irreversível.`)) {
      setMaterials(prev => prev.filter(m => m.id !== id));
      sendNotification(materialToDelete.authorId, "Material Excluído", `Seu material "${materialToDelete.title}" foi removido da plataforma pelo administrador.`, 'error', 'marketplace');
    }
  };

  return (
    <MarketplaceContext.Provider value={{
      materials, transactions, purchaseMaterial, publishMaterial,
      moderateMaterial, addMaterialComment, likeMaterialComment, requestRefund, fetchUserTransactions, deleteMaterial, generateMockTransactions, resolveRefund
    }}>
      {children}
    </MarketplaceContext.Provider>
  );
};

export const useMarketplace = () => {
  const context = useContext(MarketplaceContext);
  if (context === undefined) {
    throw new Error('useMarketplace must be used within a MarketplaceProvider');
  }
  return context;
};

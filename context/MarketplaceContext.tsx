
import React, { createContext, useContext, useState, ReactNode, useEffect, useRef } from 'react';
import { Material, Transaction, QuestaoComentario as Comment } from '../types';
import { useAuth } from './AuthContext';
import { marketplaceService } from '@features/marketplace';
import { useData } from './DataContext';
import { reputationService } from '@features/auth';
import { commentService } from '@features/comments';
import { apiClient, ENDPOINTS } from '@core/api';

import { useToast } from './ToastContext';

interface MarketplaceContextType {
  materials: Material[];
  transactions: Transaction[];
  isLoadingMaterials: boolean;
  isLoadingTransactions: boolean;
  purchaseMaterial: (material: Material) => void;
  publishMaterial: (material: Material) => Promise<boolean>;
  updateMaterial: (id: string, updates: Partial<Material>) => Promise<boolean>;
  moderateMaterial: (id: string, status: 'approved' | 'rejected', reason?: string, evidenceUrl?: string) => void;
  addMaterialComment: (materialId: string, text: string, parentId?: string) => Promise<any>;
  likeMaterialComment: (materialId: string, commentId: string) => Promise<void>;
  requestRefund: (transactionId: string, reason: string) => void;
  fetchUserTransactions: () => void;
  deleteMaterial: (id: string) => void;
  deleteMaterialComment: (materialId: string, commentId: string) => Promise<void>;
  resolveRefund: (transactionId: string, resolution: 'approved' | 'rejected') => void;
  uploadFile: (file: File, password?: string) => Promise<{ url: string, pageCount?: number } | null>;
  uploadProgress: number;
}

const MarketplaceContext = createContext<MarketplaceContextType | undefined>(undefined);

export const MarketplaceProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [materials, setMaterials] = useState<Material[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isLoadingMaterials, setIsLoadingMaterials] = useState(true);
  const [isLoadingTransactions, setIsLoadingTransactions] = useState(true);
  const { currentUser, isLoading: authLoading, purchaseMaterial: authPurchase, removeMaterialAccess } = useAuth();
  const { sendNotification, users, updateUserStatus } = useData();
  const { addToast } = useToast();

  // 1. Carregar materiais (Público/Independente de usuário)
  const materialsInitRef = useRef(false);
  useEffect(() => {
    if (materialsInitRef.current) return;
    materialsInitRef.current = true;

    apiClient.get<any>(ENDPOINTS.materials.list)
      .then(response => {
        const data = response.data?.data || response.data || response;
        const materialsArray = Array.isArray(data) ? data : (data.rows || []);
        if (Array.isArray(materialsArray)) setMaterials(materialsArray);
      })
      .catch(err => console.error("Failed to load materials:", err))
      .finally(() => setIsLoadingMaterials(false));
  }, []);

  // 2. Carregar transações (Dependente de usuário)
  useEffect(() => {
    if (authLoading) return; // Aguarda a resolução da autenticação para não soltar transactions previas nulas.

    if (currentUser) {
      setIsLoadingTransactions(true);
      if (currentUser.role === 'admin' || currentUser.isAdmin) {
        console.log('🛡️ Admin detected, loading all transactions...');
        apiClient.get<any>(ENDPOINTS.transactions.list)
          .then(response => {
            const data = response.data?.data || response.data || response;
            const transactionsArray = data.rows || (Array.isArray(data) ? data : []);
            console.log('✅ Admin transactions loaded:', transactionsArray.length);
            setTransactions(transactionsArray);
          })
          .catch(err => console.error("Failed to load all transactions:", err))
          .finally(() => setIsLoadingTransactions(false));
      } else {
        console.log('👤 Regular user detected, loading user transactions...');
        fetchUserTransactions().finally(() => setIsLoadingTransactions(false));
      }
    } else {
      setTransactions([]);
      setIsLoadingTransactions(false);
    }
  }, [currentUser?.id, currentUser?.role, currentUser?.isAdmin, authLoading]);

  const fetchUserTransactions = async () => {
    if (currentUser) {
      console.log('🔄 Fetching user transactions for:', currentUser.id, currentUser.name);
      try {
        const txs = await marketplaceService.getUserTransactions(currentUser.id);
        console.log('✅ Transactions fetched:', txs.length, 'transactions');
        setTransactions(txs);
      } catch (error) {
        console.error('❌ Error fetching user transactions:', error);
      }
    }
  };


  const purchaseMaterial = async (material: Material) => {
    if (!currentUser) return;

    try {
      console.log('💳 Purchasing material:', material.id, material.title);

      // Create transaction in database
      const response: any = await apiClient.post<any>(ENDPOINTS.transactions.create, {
        material_id: material.id
      });

      console.log('✅ Transaction created:', response);

      if (!response.success || !response.data?.transaction) {
        throw new Error(response.error || 'Falha ao criar transação');
      }

      const transaction: Transaction = response.data.transaction;

      // Update local state
      setTransactions(prev => [transaction, ...prev]);

      // Add access to purchased materials
      authPurchase(material.id);

      // Update material stats
      setMaterials(prev => prev.map(m => m.id === material.id ? { ...m, salesCount: m.salesCount + 1 } : m));

      // 1. Notify Buyer
      sendNotification(currentUser.id, "Compra Realizada", `Você adquiriu "${material.title}". Protocolo: ${String(transaction.id).substring(0, 12)}`, 'success', 'marketplace');

      // 2. Notify Seller
      if (material.authorId) {
        sendNotification(material.authorId, "Venda Realizada", `Você vendeu "${material.title}" para ${currentUser.name}. Protocolo: ${String(transaction.id).substring(0, 12)}`, 'success', 'marketplace');
      }

      // 3. Notify Admin
      sendNotification('admin', "Nova Transação no Marketplace", `Venda realizada: "${material.title}" por ${currentUser.name}.`, 'success', 'marketplace');

      addToast("Compra realizada com sucesso! O material foi adicionado à sua biblioteca.", "success");
    } catch (error: any) {
      console.error('❌ Error purchasing material:', error);
      if (error.message === 'KYC_REQUIRED') {
        // Handled by UI
      } else {
        addToast(`Erro na compra: ${error.message}`, "error");
      }
    }
  };

  const requestRefund = async (transactionId: string, reason: string) => {
    try {
      const response = await marketplaceService.requestRefund(transactionId, reason);
      const data = response.data || response;
      if (data.success) {
        setTransactions(prev => prev.map(t => {
          if (t.id === transactionId) {
            return { ...t, status: 'refund_requested', refundReason: reason };
          }
          return t;
        }));
        sendNotification(currentUser!.id, "Reembolso Solicitado", "Sua solicitação está em análise.", 'info', 'marketplace');
        addToast("Solicitação de reembolso enviada.", "success");
      } else {
        addToast(data.error || "Erro ao solicitar reembolso.", "error");
      }
    } catch (error: any) {
      console.error("Refund request error:", error);
      addToast(error.message || "Erro ao processar solicitação.", "error");
    }
  };

  const publishMaterial = async (newMaterial: Material): Promise<boolean> => {
    try {
      // Omit generated ID to let backend generate it, or use it if provided
      const response: any = await apiClient.post(ENDPOINTS.materials.create, newMaterial);

      if (response.success || response.data?.success) {
        const serverMaterial = response.data?.material || response.material || newMaterial;
        setMaterials(prev => [serverMaterial, ...prev]);
        sendNotification('admin', "Novo Material", `Material "${newMaterial.title}" aguardando aprovação.`, 'info', 'marketplace');
        addToast("Material enviado para aprovação com sucesso!", "success");
        return true;
      }
      return false;
    } catch (error) {
      console.error("Error publishing material:", error);
      addToast("Erro ao publicar material. Verifique sua conexão.", "error");
      return false;
    }
  };

  const [uploadProgress, setUploadProgress] = useState<number>(0);

  const uploadFile = async (file: File, password?: string): Promise<{ url: string, pageCount?: number } | null> => {
    try {
      setUploadProgress(0);
      const formData = new FormData();
      formData.append('file', file);
      if (password) {
        formData.append('password', password);
      }

      const response: any = await apiClient.post('upload.php', formData, {
        onUploadProgress: (progressEvent) => {
          const percentCompleted = Math.round((progressEvent.loaded * 100) / (progressEvent.total || 100));
          setUploadProgress(percentCompleted);
        }
      });

      if (response.success || response.data?.success) {
        return {
          url: response.url || response.data?.url,
          pageCount: response.pageCount || response.data?.pageCount
        };
      }
      return null;
    } catch (error) {
      console.error("Upload error:", error);
      addToast("Erro no upload do arquivo.", "error");
      return null;
    } finally {
      setTimeout(() => setUploadProgress(0), 1000); // Reset progress after a short delay
    }
  };

  const updateMaterial = async (id: string, updates: Partial<Material>): Promise<boolean> => {
    try {
      const response: any = await apiClient.post(ENDPOINTS.materials.update, {
        id,
        ...updates
      });

      if (response.success || response.data?.success) {
        const updatedMaterial = response.data?.material || response.material;
        setMaterials(prev => prev.map(m => m.id === id ? { ...m, ...updatedMaterial } : m));
        addToast("Material atualizado com sucesso!", "success");
        return true;
      }
      return false;
    } catch (error: any) {
      console.error("Update material error:", error);
      const errorMsg = error.response?.data?.message || "Erro ao atualizar material.";
      addToast(errorMsg, "error");
      return false;
    }
  };

  const moderateMaterial = async (id: string, status: 'approved' | 'rejected', reason?: string, evidenceUrl?: string) => {
    try {
      const response: any = await apiClient.post(ENDPOINTS.materials.moderate, {
        id,
        status,
        reason
      });

      if (response.success || response.data?.success) {
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
        addToast("Moderação aplicada com sucesso!", "success");
      }
    } catch (error) {
      console.error("Moderation error:", error);
      addToast("Erro ao processar moderação.", "error");
    }
  };

  const resolveRefund = async (transactionId: string, resolution: 'approved' | 'rejected') => {
    try {
      const response = await marketplaceService.processRefund(transactionId, resolution === 'approved');
      const data = response.data || response;

      if (data.success) {
        setTransactions(prev => prev.map(t => {
          if (t.id === transactionId) {
            return {
              ...t,
              status: resolution === 'approved' ? 'refunded' : 'approved',
              refundReason: resolution === 'approved' ? t.refundReason : undefined
            };
          }
          return t;
        }));

        const tx = transactions.find(t => t.id === transactionId);
        if (tx) {
          if (resolution === 'approved') {
            sendNotification(tx.buyerId, "Reembolso Aprovado", `Seu reembolso para ${tx.materialTitle || 'sua assinatura'} foi aprovado.`, 'success', 'marketplace');
            removeMaterialAccess?.(tx.materialId);
          } else {
            sendNotification(tx.buyerId, "Reembolso Negado", `Sua solicitação de reembolso para ${tx.materialTitle || 'sua assinatura'} foi negada.`, 'error', 'marketplace');
          }
        }
        addToast(`Reembolso ${resolution === 'approved' ? 'aprovado' : 'negado'} com sucesso!`, "success");
      } else {
        addToast(data.error || "Erro ao processar reembolso.", "error");
      }
    } catch (error) {
      console.error("Resolve refund error:", error);
      addToast("Erro ao processar reembolso.", "error");
    }
  };

  const addMaterialComment = async (materialId: string, text: string, parentId?: string) => {
    if (!currentUser) return null;

    try {
      const newComment = await commentService.addComment({
        questionId: materialId,
        content: text,
        userId: currentUser.id,
        userName: currentUser.name,
        parentId,
        targetType: 'material'
      });

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

      // Retorna o comentário criado para atualização otimista no caller
      return newComment;
    } catch (error) {
      console.error("Failed to add comment:", error);
      addToast("Erro ao adicionar comentário.", "error");
      return null;
    }
  };

  const likeMaterialComment = async (materialId: string, commentId: string) => {
    if (!currentUser) return;

    // Chamada ao backend para persistir o like/unlike (toggle)
    try {
      await apiClient.post(ENDPOINTS.comments.handle, {
        action: 'like',
        commentId,
        userId: currentUser.id
      });
    } catch (error) {
      console.error('Falha ao curtir comentário:', error);
      return;
    }

    // Atualizar estado local do materials (para outros componentes que usam o context)
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

  const deleteMaterialComment = async (materialId: string, commentId: string) => {
    if (!currentUser) return;
    try {
      // Chamar backend para persistir a deleção no banco de dados
      await commentService.deleteComment(commentId, currentUser.id);
    } catch (error) {
      console.error('Falha ao deletar comentário no backend:', error);
      addToast('Erro ao deletar comentário.', 'error');
      return;
    }
    // Remover do estado local após confirmação do backend
    setMaterials(prev => prev.map(m => {
      if (m.id === materialId) {
        return { ...m, comments: commentService.deleteCommentFromTree(m.comments || [], commentId) };
      }
      return m;
    }));
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
      materials, transactions, isLoadingMaterials, isLoadingTransactions, purchaseMaterial, publishMaterial, updateMaterial,
      moderateMaterial, addMaterialComment, likeMaterialComment, deleteMaterialComment, requestRefund, fetchUserTransactions, deleteMaterial, resolveRefund, uploadFile, uploadProgress
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

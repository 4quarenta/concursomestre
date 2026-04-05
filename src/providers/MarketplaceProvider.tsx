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

import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import type { Material, Transaction } from '@types';
import { useAuth } from './AuthProvider';
import { useData } from './DataProvider';
import { useToast } from './ToastProvider';
import { readApiErrorMessage } from '@services/api';
import { marketplaceService } from '@services/marketplace';
import { reputationService } from '@services/auth';
import { commentService } from '@services/comments';

interface MarketplaceContextType {
  materials: Material[];
  transactions: Transaction[];
  isLoadingMaterials: boolean;
  isLoadingTransactions: boolean;
  purchaseMaterial: (material: Material) => void;
  publishMaterial: (material: Material) => Promise<boolean>;
  updateMaterial: (id: string, updates: Partial<Material>) => Promise<boolean>;
  moderateMaterial: (
    id: string,
    status: 'approved' | 'rejected',
    reason?: string,
    evidenceUrl?: string,
  ) => Promise<void>;
  addMaterialComment: (materialId: string, text: string, parentId?: string) => Promise<any>;
  likeMaterialComment: (materialId: string, commentId: string) => Promise<void>;
  requestRefund: (transactionId: string, reason: string) => void;
  fetchUserTransactions: () => void;
  deleteMaterial: (id: string) => Promise<void>;
  deleteMaterialComment: (materialId: string, commentId: string) => Promise<void>;
  resolveRefund: (transactionId: string, resolution: 'approved' | 'rejected') => Promise<void>;
  uploadFile: (file: File, password?: string) => Promise<{ url: string; pageCount?: number } | null>;
  uploadProgress: number;
}

const MarketplaceContext = createContext<MarketplaceContextType | undefined>(undefined);

/**
 * Atualiza um material pelo id sem repetir mapeamentos manuais pelo provider.
 */
const mapMaterialById = (
  list: Material[],
  materialId: string,
  updater: (material: Material) => Material,
): Material[] => list.map((material) => (
  material.id === materialId ? updater(material) : material
));

/**
 * Atualiza uma transacao pelo id mantendo a transformacao centralizada.
 */
const mapTransactionById = (
  list: Transaction[],
  transactionId: string,
  updater: (transaction: Transaction) => Transaction,
): Transaction[] => list.map((transaction) => (
  transaction.id === transactionId ? updater(transaction) : transaction
));

/**
 * Provider oficial do dominio de marketplace.
 * Ele coordena estado, notificacoes e atualizacoes otimistas enquanto a
 * camada `src/services` concentra os contratos HTTP do dominio.
 */
export const MarketplaceProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [materials, setMaterials] = useState<Material[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isLoadingMaterials, setIsLoadingMaterials] = useState(true);
  const [isLoadingTransactions, setIsLoadingTransactions] = useState(true);
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const { currentUser, isLoading: authLoading, purchaseMaterial: authPurchase, removeMaterialAccess } = useAuth();
  const { sendNotification, users, updateUserStatus } = useData();
  const { addToast } = useToast();

  // Carrega os materiais uma unica vez para abastecer vitrine, dashboard do parceiro e administracao.
  const materialsInitRef = useRef(false);
  useEffect(() => {
    if (materialsInitRef.current) return;
    materialsInitRef.current = true;

    marketplaceService.listMaterials()
      .then((materialsList) => {
        if (Array.isArray(materialsList)) {
          setMaterials(materialsList);
        }
      })
      .catch((error) => console.error('Failed to load materials:', error))
      .finally(() => setIsLoadingMaterials(false));
  }, []);

  const fetchUserTransactions = async () => {
    if (!currentUser) return;

    try {
      const txs = await marketplaceService.getUserTransactions(currentUser.id);
      setTransactions(txs);
    } catch (error) {
      console.error('Error fetching user transactions:', error);
    }
  };

  // Carrega transacoes do usuario atual ou todas as transacoes quando o admin abre o painel.
  useEffect(() => {
    if (authLoading) return;

    if (currentUser) {
      setIsLoadingTransactions(true);

      if (currentUser.role === 'admin' || currentUser.isAdmin) {
        marketplaceService.listTransactions()
          .then((transactionsList) => {
            setTransactions(transactionsList);
          })
          .catch((error) => console.error('Failed to load all transactions:', error))
          .finally(() => setIsLoadingTransactions(false));
      } else {
        fetchUserTransactions().finally(() => setIsLoadingTransactions(false));
      }
    } else {
      setTransactions([]);
      setIsLoadingTransactions(false);
    }
  }, [authLoading, currentUser?.id, currentUser?.isAdmin, currentUser?.role]);

  const purchaseMaterial = async (material: Material) => {
    if (!currentUser) return;

    try {
      const transaction = await marketplaceService.createMaterialPurchase(material.id);

      setTransactions((prev) => [transaction, ...prev]);
      authPurchase(material.id);
      setMaterials((prev) => mapMaterialById(prev, material.id, (item) => ({
        ...item,
        salesCount: item.salesCount + 1,
      })));

      sendNotification(
        currentUser.id,
        'Compra Realizada',
        `Voce adquiriu "${material.title}". Protocolo: ${String(transaction.id).substring(0, 12)}`,
        'success',
        'marketplace',
      );

      if (material.authorId) {
        sendNotification(
          material.authorId,
          'Venda Realizada',
          `Voce vendeu "${material.title}" para ${currentUser.name}. Protocolo: ${String(transaction.id).substring(0, 12)}`,
          'success',
          'marketplace',
        );
      }

      sendNotification(
        'admin',
        'Nova Transacao no Marketplace',
        `Venda realizada: "${material.title}" por ${currentUser.name}.`,
        'success',
        'marketplace',
      );

      addToast('Compra realizada com sucesso! O material foi adicionado a sua biblioteca.', 'success');
    } catch (error: any) {
      console.error('Error purchasing material:', error);
      if (error.message !== 'KYC_REQUIRED') {
        addToast(`Erro na compra: ${error.message}`, 'error');
      }
    }
  };

  const requestRefund = async (transactionId: string, reason: string) => {
    try {
      await marketplaceService.requestRefund(transactionId, reason);
      setTransactions((prev) => mapTransactionById(prev, transactionId, (transaction) => ({
        ...transaction,
        status: 'refund_requested',
        refundReason: reason,
      })));
      sendNotification(currentUser!.id, 'Reembolso Solicitado', 'Sua solicitacao esta em analise.', 'info', 'marketplace');
      addToast('Solicitacao de reembolso enviada.', 'success');
    } catch (error: any) {
      console.error('Refund request error:', error);
      addToast(error.message || 'Erro ao processar solicitacao.', 'error');
    }
  };

  const publishMaterial = async (newMaterial: Material): Promise<boolean> => {
    try {
      const createdMaterial = await marketplaceService.createMaterial(newMaterial);
      setMaterials((prev) => [createdMaterial, ...prev]);
      sendNotification('admin', 'Novo Material', `Material "${newMaterial.title}" aguardando aprovacao.`, 'info', 'marketplace');
      addToast('Material enviado para aprovacao com sucesso!', 'success');
      return true;
    } catch (error) {
      console.error('Error publishing material:', error);
      addToast('Erro ao publicar material. Verifique sua conexao.', 'error');
      return false;
    }
  };

  const uploadFile = async (file: File, password?: string): Promise<{ url: string; pageCount?: number } | null> => {
    try {
      setUploadProgress(0);
      return await marketplaceService.uploadFile(file, {
        password,
        onProgress: (progress) => {
          setUploadProgress(progress);
        },
      });
    } catch (error) {
      console.error('Upload error:', error);
      addToast('Erro no upload do arquivo.', 'error');
      return null;
    } finally {
      setTimeout(() => setUploadProgress(0), 1000);
    }
  };

  const updateMaterial = async (id: string, updates: Partial<Material>): Promise<boolean> => {
    try {
      const updatedMaterial = await marketplaceService.updateMaterial(id, updates);
      setMaterials((prev) => mapMaterialById(prev, id, (material) => ({
        ...material,
        ...updatedMaterial,
      })));
      addToast('Material atualizado com sucesso!', 'success');
      return true;
    } catch (error: any) {
      console.error('Update material error:', error);
      addToast(readApiErrorMessage(error, 'Erro ao atualizar material.'), 'error');
      return false;
    }
  };

  const moderateMaterial = async (
    id: string,
    status: 'approved' | 'rejected',
    reason?: string,
    evidenceUrl?: string,
  ) => {
    try {
      const updatedMaterial = await marketplaceService.moderateMaterial(id, status, reason, evidenceUrl);
      setMaterials((prev) => mapMaterialById(prev, id, (material) => ({
        ...material,
        ...updatedMaterial,
      })));

      const material = materials.find((item) => item.id === id);
      if (material) {
        const action = status === 'approved' ? 'ignored' : 'resolved';
        const impact = reputationService.calculateImpact(action, 'author');
        const author = users.find((user) => user.id === material.authorId);
        if (author) {
          const newRep = reputationService.updateScore(author.reputation, impact);
          updateUserStatus(author.id, {
            reputation: newRep,
            status: reputationService.checkAccountStatus(newRep),
          });
        }
      }

      addToast('Moderacao aplicada com sucesso!', 'success');
    } catch (error) {
      console.error('Moderation error:', error);
      addToast('Erro ao processar moderacao.', 'error');
    }
  };

  const resolveRefund = async (transactionId: string, resolution: 'approved' | 'rejected') => {
    try {
      await marketplaceService.processRefund(transactionId, resolution === 'approved');
      setTransactions((prev) => mapTransactionById(prev, transactionId, (transaction) => ({
        ...transaction,
        status: resolution === 'approved' ? 'refunded' : 'approved',
        refundReason: resolution === 'approved' ? transaction.refundReason : undefined,
      })));

      const transaction = transactions.find((item) => item.id === transactionId);
      if (transaction && resolution === 'approved') {
        removeMaterialAccess?.(transaction.materialId);
      }

      addToast(`Reembolso ${resolution === 'approved' ? 'aprovado' : 'negado'} com sucesso!`, 'success');
    } catch (error) {
      console.error('Resolve refund error:', error);
      addToast('Erro ao processar reembolso.', 'error');
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
        targetType: 'material',
      });

      setMaterials((prev) => mapMaterialById(prev, materialId, (material) => {
        if (parentId) {
          return {
            ...material,
            comments: commentService.addReplyToComments(material.comments || [], parentId, newComment),
          };
        }

        return {
          ...material,
          comments: [newComment, ...(material.comments || [])],
        };
      }));

      return newComment;
    } catch (error) {
      console.error('Failed to add comment:', error);
      addToast('Erro ao adicionar comentario.', 'error');
      return null;
    }
  };

  const likeMaterialComment = async (materialId: string, commentId: string) => {
    if (!currentUser) return;

    try {
      await commentService.likeComment(commentId, currentUser.id);
    } catch (error) {
      console.error('Falha ao curtir comentario:', error);
      return;
    }

    setMaterials((prev) => mapMaterialById(prev, materialId, (material) => ({
      ...material,
      comments: commentService.likeCommentInTree(material.comments || [], commentId),
    })));

    const material = materials.find((item) => item.id === materialId);
    if (material) {
      const ownerId = commentService.findCommentOwner(material.comments || [], commentId);
      if (ownerId && ownerId !== currentUser.id) {
        sendNotification(
          ownerId,
          'Curtiram seu comentario',
          `${currentUser.name} curtiu seu comentario em "${material.title}".`,
          'success',
          'social',
        );
      }
    }
  };

  const deleteMaterialComment = async (materialId: string, commentId: string) => {
    if (!currentUser) return;

    try {
      await commentService.deleteComment(commentId, currentUser.id);
    } catch (error) {
      console.error('Falha ao deletar comentario no backend:', error);
      addToast('Erro ao deletar comentario.', 'error');
      return;
    }

    setMaterials((prev) => mapMaterialById(prev, materialId, (material) => ({
      ...material,
      comments: commentService.deleteCommentFromTree(material.comments || [], commentId),
    })));
  };

  const deleteMaterial = async (id: string) => {
    const materialToDelete = materials.find((material) => material.id === id);
    if (!materialToDelete) return;

    if (window.confirm(`Tem certeza que deseja excluir o material "${materialToDelete.title}"? Esta acao e irreversivel.`)) {
      try {
        await marketplaceService.deleteMaterial(id);
        setMaterials((prev) => prev.filter((material) => material.id !== id));
        addToast('Material removido com sucesso!', 'success');
      } catch (error) {
        console.error('Delete material error:', error);
        addToast('Erro ao remover material.', 'error');
      }
    }
  };

  return (
    <MarketplaceContext.Provider
      value={{
        materials,
        transactions,
        isLoadingMaterials,
        isLoadingTransactions,
        purchaseMaterial,
        publishMaterial,
        updateMaterial,
        moderateMaterial,
        addMaterialComment,
        likeMaterialComment,
        deleteMaterialComment,
        requestRefund,
        fetchUserTransactions,
        deleteMaterial,
        resolveRefund,
        uploadFile,
        uploadProgress,
      }}
    >
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

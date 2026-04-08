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
 * @since 1.0.0
 */
const mapMaterialById = (
  list: Material[],
  materialId: string,
  updater: (material: Material) => Material,
): Material[] => list.map((material) => (
  material.id === materialId ? updater(material) : material
));

/**
 * Atualiza uma transação pelo id mantendo a transformação centralizada.
 * @since 1.0.0
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
 * Ele coordena estado, notificações e atualizacoes otimistas enquanto a
 * camada `src/services` concentra os contratos HTTP do dominio.
 * @since 1.0.0
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
  /**
   * Carrega a vitrine inicial de materiais uma unica vez por montagem do provider.
   * @since 1.0.0
   */
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

  /**
   * Recarrega as transações do usuário autenticado para biblioteca e histórico.
   * @since 1.0.0
   */
  const fetchUserTransactions = async () => {
    if (!currentUser) return;

    try {
      const txs = await marketplaceService.getUserTransactions(currentUser.id);
      setTransactions(txs);
    } catch (error) {
      console.error('Error fetching user transactions:', error);
    }
  };

  // Carrega transações do usuário atual ou todas as transações quando o admin abre o painel.
  /**
   * Mantem o histórico de transações alinhado ao papel do usuário atual.
   * Admins veem tudo; usuários comuns veem apenas suas proprias compras.
   * @since 1.0.0
   */
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

  /**
   * Efetiva a compra local de um material e dispara as notificações relacionadas.
   * Esse fluxo conecta checkout, biblioteca do usuário e telemetria do marketplace.
   * @since 1.0.0
   */
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
        `Você adquiriu "${material.title}". Protocolo: ${String(transaction.id).substring(0, 12)}`,
        'success',
        'marketplace',
      );

      if (material.authorId) {
        sendNotification(
          material.authorId,
          'Venda Realizada',
          `Você vendeu "${material.title}" para ${currentUser.name}. Protocolo: ${String(transaction.id).substring(0, 12)}`,
          'success',
          'marketplace',
        );
      }

      sendNotification(
        'admin',
        'Nova Transação no Marketplace',
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

  /**
   * Solicita reembolso de uma compra no marketplace.
   * @since 1.0.0
   */
  const requestRefund = async (transactionId: string, reason: string) => {
    try {
      await marketplaceService.requestRefund(transactionId, reason);
      setTransactions((prev) => mapTransactionById(prev, transactionId, (transaction) => ({
        ...transaction,
        status: 'refund_requested',
        refundReason: reason,
      })));
      sendNotification(currentUser!.id, 'Reembolso Solicitado', 'Sua solicitacao esta em análise.', 'info', 'marketplace');
      addToast('Solicitacao de reembolso enviada.', 'success');
    } catch (error: any) {
      console.error('Refund request error:', error);
      addToast(error.message || 'Erro ao processar solicitacao.', 'error');
    }
  };

  /**
   * Pública um novo material e atualiza a vitrine localmente.
   * @since 1.0.0
   */
  const publishMaterial = async (newMaterial: Material): Promise<boolean> => {
    try {
      const createdMaterial = await marketplaceService.createMaterial(newMaterial);
      setMaterials((prev) => [createdMaterial, ...prev]);
      sendNotification('admin', 'Novo Material', `Material "${newMaterial.title}" aguardando aprovação.`, 'info', 'marketplace');
      addToast('Material enviado para aprovação com sucesso!', 'success');
      return true;
    } catch (error) {
      console.error('Error publishing material:', error);
      addToast('Erro ao publicar material. Verifique sua conexão.', 'error');
      return false;
    }
  };

  /**
   * Envia arquivo de material ou capa exibindo progresso no provider.
   * @since 1.0.0
   */
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

  /**
   * Atualiza metadados de um material existente.
   * @since 1.0.0
   */
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

  /**
   * Executa a moderação administrativa de um material e recalcula reputação do autor.
   * @since 1.0.0
   */
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

      addToast('Moderação aplicada com sucesso!', 'success');
    } catch (error) {
      console.error('Moderation error:', error);
      addToast('Erro ao processar moderação.', 'error');
    }
  };

  /**
   * Resolve administrativamente um pedido de estorno.
   * Quando aprovado, também remove o acesso local ao material comprado.
   * @since 1.0.0
   */
  const resolveRefund = async (transactionId: string, resolution: 'approved' | 'rejected') => {
    const previousTransactions = [...transactions];
    try {
      await marketplaceService.processRefund(transactionId, resolution === 'approved');
      const transaction = previousTransactions.find((item) => item.id === transactionId);
      if (transaction && resolution === 'approved') {
        removeMaterialAccess?.(transaction.materialId);
      }

      if (currentUser?.role === 'admin' || currentUser?.isAdmin) {
        const refreshedTransactions = await marketplaceService.listTransactions();
        setTransactions(refreshedTransactions);
      } else if (currentUser?.id) {
        const refreshedTransactions = await marketplaceService.getUserTransactions(currentUser.id);
        setTransactions(refreshedTransactions);
      } else {
        setTransactions((prev) => mapTransactionById(prev, transactionId, (currentTransaction) => ({
          ...currentTransaction,
          status: resolution === 'approved' ? 'refunded' : 'approved',
          refundReason: resolution === 'approved' ? currentTransaction.refundReason : undefined,
        })));
      }

      addToast(`Reembolso ${resolution === 'approved' ? 'aprovado' : 'negado'} com sucesso!`, 'success');
    } catch (error) {
      console.error('Resolve refund error:', error);
      setTransactions(previousTransactions);
      addToast('Erro ao processar reembolso.', 'error');
    }
  };

  /**
   * Adiciona um comentário em um material e atualiza a arvore local.
   * @since 1.0.0
   */
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
      addToast('Erro ao adicionar comentário.', 'error');
      return null;
    }
  };

  /**
   * Registra a curtida de comentário em material e notifica o dono quando aplicavel.
   * @since 1.0.0
   */
  const likeMaterialComment = async (materialId: string, commentId: string) => {
    if (!currentUser) return;

    try {
      await commentService.likeComment(commentId, currentUser.id);
    } catch (error) {
      console.error('Falha ao curtir comentário:', error);
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
          'Curtiram seu comentário',
          `${currentUser.name} curtiu seu comentário em "${material.title}".`,
          'success',
          'social',
        );
      }
    }
  };

  /**
   * Remove um comentário de material no backend e no estado local.
   * @since 1.0.0
   */
  const deleteMaterialComment = async (materialId: string, commentId: string) => {
    if (!currentUser) return;

    try {
      await commentService.deleteComment(commentId, currentUser.id);
    } catch (error) {
      console.error('Falha ao deletar comentário no backend:', error);
      addToast('Erro ao deletar comentário.', 'error');
      return;
    }

    setMaterials((prev) => mapMaterialById(prev, materialId, (material) => ({
      ...material,
      comments: commentService.deleteCommentFromTree(material.comments || [], commentId),
    })));
  };

  /**
   * Exclui definitivamente um material apos confirmacao do usuário.
   * @since 1.0.0
   */
  const deleteMaterial = async (id: string) => {
    const materialToDelete = materials.find((material) => material.id === id);
    if (!materialToDelete) return;

    if (window.confirm(`Tem certeza que deseja excluir o material "${materialToDelete.title}"? Esta ação e irreversivel.`)) {
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

/**
 * Hook público para consumo do estado do marketplace.
 * @since 1.0.0
 */
export const useMarketplace = () => {
  const context = useContext(MarketplaceContext);
  if (context === undefined) {
    throw new Error('useMarketplace must be used within a MarketplaceProvider');
  }
  return context;
};

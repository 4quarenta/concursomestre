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

import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import type { Material, Transaction } from '@types';
import { useAuth } from './AuthProvider';
import { useToast } from './ToastProvider';
import { readApiErrorMessage } from '@services/api';
import { marketplaceService } from '@services/marketplace';
import { reputationService } from '@services/auth';
import { commentService } from '@services/comments';
import { notificationService } from '@services/notifications';
import { useAdminDataActions } from '@/state/admin-data/useAdminDataActions';
import { useAdminDataStore } from '@/state/admin-data/adminDataStore';

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
  resolveRefund: (transactionId: string, resolution: 'approved' | 'retention_offer') => Promise<void>;
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

const ADMIN_TRANSACTION_LIST_LIMIT = 100;
const MATERIAL_ROUTE_PREFIXES = [
  '/marketplace',
  '/material',
  '/read',
  '/partner-dashboard',
  '/admin/marketplace',
  '/admin/finance',
] as const;
const TRANSACTION_ROUTE_PREFIXES = [
  '/profile',
  '/checkout',
  '/marketplace',
  '/partner-dashboard',
  '/admin/finance',
  '/admin/marketplace',
] as const;

const routeMatchesAnyPrefix = (pathname: string, prefixes: readonly string[]) => (
  prefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`))
);

/**
 * Identifica papeis que podem auditar transacoes globais no painel.
 * @since 1.0.0
 */
const isPrivilegedTransactionViewer = (
  user?: { role?: string; isAdmin?: boolean } | null,
): boolean => Boolean(user?.isAdmin || user?.role === 'admin' || user?.role === 'staff');

/**
 * Mescla consultas complementares de transacoes sem duplicar registros.
 * @since 1.0.0
 */
const mergeTransactionsById = (transactionGroups: Transaction[][]): Transaction[] => {
  const merged = new Map<string, Transaction>();

  transactionGroups.flat().forEach((transaction, index) => {
    const transactionLike = transaction as any;
    const key = String(
      transactionLike.id
      || transactionLike.internalId
      || transactionLike.providerTransactionId
      || transactionLike.providerInvoiceId
      || `transaction-${index}`,
    );

    merged.set(key, transaction);
  });

  return Array.from(merged.values()).sort((left, right) => (
    Number((right as any).timestamp || 0) - Number((left as any).timestamp || 0)
  ));
};

/**
 * Provider oficial do dominio de marketplace.
 * Ele coordena estado, notificações e atualizacoes otimistas enquanto a
 * camada `src/services` concentra os contratos HTTP do dominio.
 * @since 1.0.0
 */
export const MarketplaceProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const pathname = usePathname() || '/';
  const [materials, setMaterials] = useState<Material[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isLoadingMaterials, setIsLoadingMaterials] = useState(true);
  const [isLoadingTransactions, setIsLoadingTransactions] = useState(true);
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const { currentUser, isLoading: authLoading, purchaseMaterial: authPurchase, removeMaterialAccess } = useAuth();
  const currentUserId = currentUser?.id ?? null;
  const currentUserRole = currentUser?.role ?? null;
  const currentUserIsAdmin = Boolean(currentUser?.isAdmin);
  const canViewAllTransactions = isPrivilegedTransactionViewer({
    role: currentUserRole ?? undefined,
    isAdmin: currentUserIsAdmin,
  });
  const { addToast } = useToast();
  const users = useAdminDataStore((store) => store.users);
  const { updateUserStatus, ensureUsersLoaded } = useAdminDataActions();
  const shouldLoadMaterials = routeMatchesAnyPrefix(pathname, MATERIAL_ROUTE_PREFIXES);
  const shouldLoadTransactions = routeMatchesAnyPrefix(pathname, TRANSACTION_ROUTE_PREFIXES);

  const sendNotification = useCallback((
    userId: string,
    title: string,
    message: string,
    type: 'success' | 'error' | 'info' | 'warning' = 'info',
    category: 'system' | 'social' | 'marketplace' | 'moderation' = 'system',
    actionUrl?: string,
    evidenceUrl?: string,
  ) => {
    void notificationService.sendNotification(
      userId,
      title,
      message,
      type,
      category,
      actionUrl,
      evidenceUrl,
    );
  }, []);

  // Carrega os materiais uma unica vez para abastecer vitrine, dashboard do parceiro e administracao.
  const materialsInitRef = useRef(false);
  /**
   * Carrega a vitrine inicial de materiais uma unica vez por montagem do provider.
   * @since 1.0.0
   */
  useEffect(() => {
    if (!shouldLoadMaterials) {
      const frameId = window.requestAnimationFrame(() => {
        setIsLoadingMaterials(false);
      });
      return () => window.cancelAnimationFrame(frameId);
    }

    if (materialsInitRef.current) return;
    materialsInitRef.current = true;
    setIsLoadingMaterials(true);

    marketplaceService.listMaterials()
      .then((materialsList) => {
        if (Array.isArray(materialsList)) {
          setMaterials(materialsList);
        }
      })
      .catch((error) => console.error('Failed to load materials:', error))
      .finally(() => setIsLoadingMaterials(false));
  }, [shouldLoadMaterials]);

  /**
   * Recarrega as transações do usuário autenticado para biblioteca e histórico.
   * @since 1.0.0
   */
  const fetchUserTransactions = useCallback(async () => {
    if (!currentUserId) return;

    try {
      const txs = await marketplaceService.getUserTransactions(currentUserId);
      setTransactions(txs);
    } catch (error) {
      console.error('Error fetching user transactions:', error);
    }
  }, [currentUserId]);

  // Carrega transações do usuário atual ou todas as transações quando o admin abre o painel.
  /**
   * Mantem o histórico de transações alinhado ao papel do usuário atual.
   * Admins veem tudo; usuários comuns veem apenas suas proprias compras.
   * @since 1.0.0
   */
  useEffect(() => {
    if (authLoading) return;

    if (!shouldLoadTransactions) {
      const frameId = window.requestAnimationFrame(() => {
        setIsLoadingTransactions(false);
      });
      return () => window.cancelAnimationFrame(frameId);
    }

    let isCancelled = false;
    const frameId = window.requestAnimationFrame(() => {
      if (currentUserId) {
        setIsLoadingTransactions(true);

        if (canViewAllTransactions) {
          Promise.all([
            marketplaceService.listTransactions({ scope: 'all', limit: ADMIN_TRANSACTION_LIST_LIMIT }),
            marketplaceService.listTransactions({
              scope: 'all',
              status: 'refund_requested',
              limit: ADMIN_TRANSACTION_LIST_LIMIT,
            }),
          ])
            .then(([latestTransactions, pendingRefundTransactions]) => {
              if (!isCancelled) {
                setTransactions(mergeTransactionsById([latestTransactions, pendingRefundTransactions]));
              }
            })
            .catch((error) => console.error('Failed to load all transactions:', error))
            .finally(() => {
              if (!isCancelled) {
                setIsLoadingTransactions(false);
              }
            });
        } else {
          fetchUserTransactions().finally(() => {
            if (!isCancelled) {
              setIsLoadingTransactions(false);
            }
          });
        }
      } else {
        setTransactions([]);
        setIsLoadingTransactions(false);
      }
    });

    return () => {
      isCancelled = true;
      window.cancelAnimationFrame(frameId);
    };
  }, [authLoading, canViewAllTransactions, currentUserId, fetchUserTransactions, shouldLoadTransactions]);

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
        let author = users.find((user) => user.id === material.authorId);
        if (!author) {
          await ensureUsersLoaded();
          author = useAdminDataStore.getState().users.find((user) => user.id === material.authorId);
        }
        if (author) {
          const newRep = reputationService.updateScore(author.reputation, impact);
          await updateUserStatus(author.id, {
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
  const resolveRefund = async (transactionId: string, resolution: 'approved' | 'retention_offer') => {
    const previousTransactions = [...transactions];
    try {
      await marketplaceService.processRefund(transactionId, resolution);
      const transaction = previousTransactions.find((item) => item.id === transactionId);
      if (transaction && resolution === 'approved') {
        removeMaterialAccess?.(transaction.materialId);
      }

      if (canViewAllTransactions) {
        const [latestTransactions, pendingRefundTransactions] = await Promise.all([
          marketplaceService.listTransactions({ scope: 'all', limit: ADMIN_TRANSACTION_LIST_LIMIT }),
          marketplaceService.listTransactions({
            scope: 'all',
            status: 'refund_requested',
            limit: ADMIN_TRANSACTION_LIST_LIMIT,
          }),
        ]);
        setTransactions(mergeTransactionsById([latestTransactions, pendingRefundTransactions]));
      } else if (currentUserId) {
        const refreshedTransactions = await marketplaceService.getUserTransactions(currentUserId);
        setTransactions(refreshedTransactions);
      } else {
        setTransactions((prev) => mapTransactionById(prev, transactionId, (currentTransaction) => ({
          ...currentTransaction,
          status: resolution === 'approved' ? 'refunded' : currentTransaction.status,
        })));
      }

      addToast(
        resolution === 'approved'
          ? 'Reembolso aprovado com sucesso!'
          : 'Proposta de permanencia enviada ao usuario.',
        'success',
      );
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
      const result = await commentService.addComment({
        questionId: materialId,
        content: text,
        userId: currentUser.id,
        userName: currentUser.name,
        parentId,
        targetType: 'material',
      });

      if (result.comment) {
        setMaterials((prev) => mapMaterialById(prev, materialId, (material) => {
          if (parentId) {
            return {
              ...material,
              comments: commentService.addReplyToComments(material.comments || [], parentId, result.comment),
            };
          }

          return {
            ...material,
            comments: [result.comment, ...(material.comments || [])],
          };
        }));
      }

      addToast(
        result.message || (result.requiresModeration ? 'Comentário enviado para moderação.' : 'Comentário publicado com sucesso.'),
        'success',
      );

      return result.comment ?? result;
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

    try {
      await marketplaceService.deleteMaterial(id);
      setMaterials((prev) => prev.filter((material) => material.id !== id));
      addToast('Material removido com sucesso!', 'success');
    } catch (error) {
      console.error('Delete material error:', error);
      addToast('Erro ao remover material.', 'error');
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

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

'use client';

import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { usePathname } from 'next/navigation';
import type { Material, QuestaoComentario, Transaction } from '@types';
import { useAuth } from './AuthProvider';
import { useToast } from './ToastProvider';
import { readApiErrorMessage } from '@services/api';
import { marketplaceService } from '@services/marketplace';
import { reputationService } from '@services/auth';
import { commentService } from '@services/comments';
import { notificationService } from '@services/notifications';
import { clientLog } from '@services/monitoring/clientLog';
import { shouldLoadMarketplaceTransactionsForPath } from './marketplaceRouting';
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
  addMaterialComment: (materialId: string, text: string, parentId?: string) => Promise<QuestaoComentario | null>;
  likeMaterialComment: (materialId: string, commentId: string) => Promise<void>;
  requestRefund: (transactionId: string, reason: string) => void;
  fetchUserTransactions: () => void;
  deleteMaterial: (id: string) => Promise<void>;
  deleteMaterialComment: (materialId: string, commentId: string) => Promise<void>;
  resolveRefund: (transactionId: string, resolution: 'approved' | 'retention_offer') => Promise<void>;
  uploadFile: (file: File) => Promise<{ fileRef?: string; publicUrl?: string; pageCount?: number } | null>;
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
 * Provider oficial do dominio de marketplace.
 * Ele coordena estado, notificações e atualizacoes otimistas enquanto a
 * camada `src/services` concentra os contratos HTTP do dominio.
 * @since 1.0.0
 */
export const MarketplaceProvider: React.FC<{ children: React.ReactNode; initialMaterials?: Material[] }> = ({ children, initialMaterials }) => {
  const pathname = usePathname() || '/';
  const hasPublicInitialMaterials = initialMaterials !== undefined;
  const [materials, setMaterials] = useState<Material[]>(initialMaterials ?? []);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isLoadingMaterials, setIsLoadingMaterials] = useState(!hasPublicInitialMaterials);
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
  const shouldLoadTransactions = shouldLoadMarketplaceTransactionsForPath(pathname);

  const sendNotification = useCallback((
    userId: string,
    title: string,
    message: string,
    type: 'success' | 'error' | 'info' | 'warning' = 'info',
    category: 'system' | 'social' | 'marketplace' | 'moderation' = 'system',
    actionUrl?: string,
    evidenceUrl?: string,
    eventKey?: string,
  ) => {
    void notificationService.sendNotification(
      userId,
      title,
      message,
      type,
      category,
      actionUrl,
      evidenceUrl,
      eventKey,
    );
  }, []);

  // Carrega os materiais uma unica vez para abastecer vitrine, dashboard do parceiro e administracao.
  const materialsInitRef = useRef(hasPublicInitialMaterials);
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
      .catch((error) => clientLog.warn('Failed to load materials:', error))
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
      clientLog.warn('Error fetching user transactions:', error);
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
          marketplaceService.listTransactions({ scope: 'all', limit: ADMIN_TRANSACTION_LIST_LIMIT })
            .then((latestTransactions) => {
              if (!isCancelled) {
                setTransactions(latestTransactions);
              }
            })
            .catch((error) => clientLog.warn('Failed to load all transactions:', error))
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
        '/profile?tab=materials',
        undefined,
        'material_released',
      );

      if (material.authorId) {
        sendNotification(
          material.authorId,
          'Venda Realizada',
          `Você vendeu "${material.title}" para ${currentUser.name}. Protocolo: ${String(transaction.id).substring(0, 12)}`,
          'success',
          'marketplace',
          '/partner',
          undefined,
          'marketplace_sale',
        );
      }

      sendNotification(
        'admin',
        'Nova Transação no Marketplace',
        `Venda realizada: "${material.title}" por ${currentUser.name}.`,
        'success',
        'marketplace',
        '/admin/finance/transactions',
        undefined,
        'marketplace_purchase_admin',
      );

      addToast('Compra realizada com sucesso! O material foi adicionado a sua biblioteca.', 'success');
    } catch (error: unknown) {
      clientLog.error('Error purchasing material:', error);
      const errorMessage = readApiErrorMessage(error, 'Erro ao processar compra.');
      if (errorMessage !== 'KYC_REQUIRED') {
        addToast(`Erro na compra: ${errorMessage}`, 'error');
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
      sendNotification(
        currentUser!.id,
        'Reembolso Solicitado',
        'Sua solicitacao esta em análise.',
        'info',
        'marketplace',
        '/profile?tab=billing',
        undefined,
        'refund_requested',
      );
      addToast('Solicitacao de reembolso enviada.', 'success');
    } catch (error: unknown) {
      clientLog.error('Refund request error:', error);
      addToast(readApiErrorMessage(error, 'Erro ao processar solicitacao.'), 'error');
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
      sendNotification(
        'admin',
        'Novo Material',
        `Material "${newMaterial.title}" aguardando aprovação.`,
        'info',
        'marketplace',
        '/admin/marketplace/materials',
        undefined,
        'material_pending_admin',
      );
      addToast('Material enviado para aprovação com sucesso!', 'success');
      return true;
    } catch (error) {
      clientLog.error('Error publishing material:', error);
      addToast('Erro ao publicar material. Verifique sua conexão.', 'error');
      return false;
    }
  };

  /**
   * Envia arquivo de material ou capa exibindo progresso no provider.
   * @since 1.0.0
   */
  const uploadFile = async (file: File): Promise<{ fileRef?: string; publicUrl?: string; pageCount?: number } | null> => {
    try {
      setUploadProgress(0);
      return await marketplaceService.uploadFile(file, {
        onProgress: (progress) => {
          setUploadProgress(progress);
        },
      });
    } catch (error) {
      clientLog.error('Upload error:', error);
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
    } catch (error: unknown) {
      clientLog.error('Update material error:', error);
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
      clientLog.error('Moderation error:', error);
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
        const latestTransactions = await marketplaceService.listTransactions({
          scope: 'all',
          limit: ADMIN_TRANSACTION_LIST_LIMIT,
        });
        setTransactions(latestTransactions);
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
      clientLog.error('Resolve refund error:', error);
      setTransactions(previousTransactions);
      addToast('Erro ao processar reembolso.', 'error');
    }
  };

  /**
   * Adiciona um comentário em um material e atualiza a arvore local.
   * @since 1.0.0
   */
  const addMaterialComment = async (materialId: string, text: string, parentId?: string): Promise<QuestaoComentario | null> => {
    if (!currentUser) return null;

    try {
      const result = await commentService.addComment({
        questionId: materialId,
        content: text,
        userId: currentUser.id,
        userName: currentUser.name,
        userAvatar: currentUser.photoUrl,
        userPlan: currentUser.planDisplayName || currentUser.plan,
        userRole: currentUser.role,
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

      return result.comment ?? null;
    } catch (error) {
      clientLog.error('Failed to add comment:', error);
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
      clientLog.error('Falha ao curtir comentario:', error);
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
          undefined,
          undefined,
          'comment_like_received',
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
      clientLog.error('Falha ao deletar comentario no backend:', error);
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
      clientLog.error('Delete material error:', error);
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

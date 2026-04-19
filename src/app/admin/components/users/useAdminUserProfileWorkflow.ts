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

import { useEffect, useState } from 'react';
import { adminService } from '@services/admin/adminService';
import { readApiErrorMessage } from '@services/api';

type ToastHandler = (message: string, type?: string) => void;
export type DetailTab = 'overview' | 'subscription' | 'transactions' | 'comments';

export type EditUserForm = {
  name: string;
  email: string;
  cpf: string;
  phone: string;
  targetExam: string;
  role: 'user' | 'staff' | 'partner' | 'admin';
  status: 'active' | 'suspended' | 'banned' | 'pending';
  reputation: string;
};

interface UseAdminUserProfileWorkflowOptions {
  addToast: ToastHandler;
  reloadUsers?: () => Promise<void> | void;
}

interface HandleUserActionOptions {
  actionKey?: string;
  successMessage?: string;
}

const normalizeEditableRole = (value: unknown): EditUserForm['role'] => {
  if (value === 'staff' || value === 'partner' || value === 'admin') {
    return value;
  }

  // Converte o papel legado apenas dentro da tela de edicao.
  if (value === 'tester') {
    return 'staff';
  }

  return 'user';
};

const normalizeEditableStatus = (value: unknown): EditUserForm['status'] => {
  if (value === 'suspended' || value === 'banned' || value === 'pending') {
    return value;
  }

  return 'active';
};

const createEmptyEditUserForm = (): EditUserForm => ({
  name: '',
  email: '',
  cpf: '',
  phone: '',
  targetExam: '',
  role: 'user',
  status: 'active',
  reputation: '100',
});

const buildEditUserForm = (detailedUser: any): EditUserForm => ({
  name: detailedUser?.profile?.name || '',
  email: detailedUser?.profile?.email || '',
  cpf: detailedUser?.profile?.cpf || '',
  phone: detailedUser?.profile?.phone || '',
  targetExam: detailedUser?.profile?.target_exam || '',
  role: normalizeEditableRole(detailedUser?.profile?.role),
  status: normalizeEditableStatus(detailedUser?.profile?.status),
  reputation: String(Number(detailedUser?.profile?.reputation ?? 100)),
});

/**
 * Orquestra o modal detalhado de usuarios do admin.
 * O hook centraliza carregamento, refresh, edicao e mutacoes operacionais sem deixar regra na tela.
 *
 * @since 1.0.0
 */
export const useAdminUserProfileWorkflow = ({
  addToast,
  reloadUsers,
}: UseAdminUserProfileWorkflowOptions) => {
  const [viewingProfileId, setViewingProfileId] = useState<string | null>(null);
  const [detailedUser, setDetailedUser] = useState<any>(null);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);
  const [detailTab, setDetailTab] = useState<DetailTab>('overview');
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [isEditingUser, setIsEditingUser] = useState(false);
  const [editUserForm, setEditUserForm] = useState<EditUserForm>(createEmptyEditUserForm);

  const refreshDetailedUser = async (userId: string) => {
    const response = await adminService.getUserDetails(userId);
    setDetailedUser(response);
    return response;
  };

  useEffect(() => {
    if (!viewingProfileId) {
      setDetailedUser(null);
      setDetailTab('overview');
      setIsEditingUser(false);
      setEditUserForm(createEmptyEditUserForm());
      setActionLoading(null);
      return;
    }

    setIsEditingUser(false);
    setIsLoadingDetail(true);

    refreshDetailedUser(String(viewingProfileId))
      .catch((error) => {
        console.error(error);
        addToast(readApiErrorMessage(error, 'Erro ao carregar detalhes do usuario.'), 'error');
        setDetailedUser(null);
      })
      .finally(() => setIsLoadingDetail(false));
  }, [viewingProfileId, addToast]);

  const openUserProfile = (userId: string | number | null | undefined) => {
    if (userId === null || userId === undefined || userId === '') {
      return;
    }

    setViewingProfileId(String(userId));
  };

  const closeUserProfile = () => {
    setViewingProfileId(null);
  };

  const handleUserAction = async (
    action: string,
    data: any,
    options?: HandleUserActionOptions,
  ) => {
    if (!detailedUser?.profile?.id) {
      addToast('Usuario nao carregado para esta acao.', 'error');
      return null;
    }

    const payload = {
      user_id: String(detailedUser.profile.id),
      action,
      ...data,
    };

    const actionKey = options?.actionKey || action;
    setActionLoading(actionKey);

    try {
      const result = await adminService.performUserActionWithResult(payload);

      if (action === 'update_profile') {
        setIsEditingUser(false);
      }

      const nextUser = await refreshDetailedUser(String(viewingProfileId));
      await reloadUsers?.();

      addToast(
        result.message
        || options?.successMessage
        || 'Acao realizada com sucesso.',
        'success',
      );

      return {
        result,
        user: nextUser,
      };
    } catch (error) {
      console.error(error);
      addToast(readApiErrorMessage(error, 'Erro ao realizar a acao.'), 'error');
      throw error;
    } finally {
      setActionLoading(null);
    }
  };

  const startEditingUser = () => {
    if (!detailedUser) {
      return;
    }

    setEditUserForm(buildEditUserForm(detailedUser));
    setIsEditingUser(true);
  };

  const cancelEditingUser = () => {
    setEditUserForm(detailedUser ? buildEditUserForm(detailedUser) : createEmptyEditUserForm());
    setIsEditingUser(false);
  };

  return {
    viewingProfileId,
    detailedUser,
    isLoadingDetail,
    detailTab,
    setDetailTab,
    actionLoading,
    isEditingUser,
    editUserForm,
    setEditUserForm,
    openUserProfile,
    closeUserProfile,
    startEditingUser,
    cancelEditingUser,
    handleUserAction,
  };
};

export default useAdminUserProfileWorkflow;

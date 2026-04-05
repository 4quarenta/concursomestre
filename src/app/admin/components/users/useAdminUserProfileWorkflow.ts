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
type DetailTab = 'overview' | 'subscription' | 'transactions' | 'comments';

type EditUserForm = {
  name: string;
  email: string;
  cpf: string;
  phone: string;
  targetExam: string;
  role?: string;
};

interface UseAdminUserProfileWorkflowOptions {
  addToast: ToastHandler;
}

const createEmptyEditUserForm = (): EditUserForm => ({
  name: '',
  email: '',
  cpf: '',
  phone: '',
  targetExam: '',
});

export const useAdminUserProfileWorkflow = ({
  addToast,
}: UseAdminUserProfileWorkflowOptions) => {
  const [viewingProfileId, setViewingProfileId] = useState<string | null>(null);
  const [detailedUser, setDetailedUser] = useState<any>(null);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);
  const [detailTab, setDetailTab] = useState<DetailTab>('overview');
  const [actionLoading, setActionLoading] = useState(false);
  const [isEditingUser, setIsEditingUser] = useState(false);
  const [editUserForm, setEditUserForm] = useState<EditUserForm>(createEmptyEditUserForm);

  useEffect(() => {
    if (!viewingProfileId) {
      setDetailedUser(null);
      setDetailTab('overview');
      setIsEditingUser(false);
      setEditUserForm(createEmptyEditUserForm());
      return;
    }

    setIsEditingUser(false);
    setIsLoadingDetail(true);

    adminService
      .getUserDetails(String(viewingProfileId))
      .then((response) => {
        setDetailedUser(response);
      })
      .catch((error) => {
        console.error(error);
        addToast(readApiErrorMessage(error, 'Erro ao carregar detalhes do usuario.'), 'error');
        setDetailedUser(null);
      })
      .finally(() => setIsLoadingDetail(false));
  }, [viewingProfileId]);

  const openUserProfile = (userId: string | number | null | undefined) => {
    if (userId === null || userId === undefined || userId === '') return;
    setViewingProfileId(String(userId));
  };

  const closeUserProfile = () => {
    setViewingProfileId(null);
  };

  const handleUserAction = async (action: string, data: any) => {
    if (!detailedUser) return;

    setActionLoading(true);

    const payload = {
      user_id: detailedUser.profile?.id,
      action,
      ...data,
    };

    if (!payload.user_id && action !== 'refund_transaction') {
      console.error('Cannot perform action: user_id is missing', detailedUser);
      addToast('Erro: ID do usuario faltando para esta acao.', 'error');
      setActionLoading(false);
      return;
    }

    try {
      await adminService.performUserAction(payload);
      addToast('Acao realizada com sucesso!', 'success');

      if (action === 'update_profile') {
        setIsEditingUser(false);
      }

      const refreshedUser = await adminService.getUserDetails(String(viewingProfileId));
      setDetailedUser(refreshedUser);
    } catch (error) {
      console.error(error);
      addToast(readApiErrorMessage(error, 'Erro ao realizar a acao.'), 'error');
    } finally {
      setActionLoading(false);
    }
  };

  const startEditingUser = () => {
    if (!detailedUser) return;

    setEditUserForm({
      name: detailedUser.profile?.name || '',
      email: detailedUser.profile?.email || '',
      cpf: detailedUser.profile?.cpf || '',
      phone: detailedUser.profile?.phone || '',
      targetExam: detailedUser.profile?.target_exam || '',
      role: detailedUser.profile?.role || 'user',
    });
    setIsEditingUser(true);
  };

  const cancelEditingUser = () => {
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

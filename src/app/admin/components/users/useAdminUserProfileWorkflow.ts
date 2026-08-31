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
import { clientLog } from '@services/monitoring/clientLog';
import { planService } from '@services/plans';
import type { AdminUserActionResult, AdminUserDetailsPayload } from '@services/admin/adminService';
import type { Plan } from '@types';

type ToastHandler = (message: string, type?: string) => void;
export type DetailTab = 'overview' | 'subscription' | 'transactions' | 'comments' | 'support';

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

const buildEditUserForm = (detailedUser: AdminUserDetailsPayload | null): EditUserForm => ({
  name: detailedUser?.profile?.name || '',
  email: detailedUser?.profile?.email || '',
  cpf: detailedUser?.profile?.cpf || '',
  phone: detailedUser?.profile?.phone || '',
  targetExam: detailedUser?.profile?.target_exam || '',
  role: normalizeEditableRole(detailedUser?.profile?.role),
  status: normalizeEditableStatus(detailedUser?.profile?.status),
  reputation: String(Number(detailedUser?.profile?.reputation ?? 100)),
});

type AdminAvailablePlanItem = {
  id?: string | number;
  name?: string;
  price?: number | string | null;
  active?: number | string | boolean;
  is_active?: number | string | boolean;
};

const mergeDetailedUserWithCatalogPlans = (
  detailedUser: AdminUserDetailsPayload,
  catalogPlans: Plan[],
): AdminUserDetailsPayload => {
  const existingPlans = Array.isArray(detailedUser?.available_plans)
    ? (detailedUser.available_plans as AdminAvailablePlanItem[])
    : [];
  const mergedById = new Map<string, AdminAvailablePlanItem>();

  existingPlans.forEach((plan) => {
    const key = String(plan?.id || '').trim();
    if (!key) return;
    mergedById.set(key, plan);
  });

  catalogPlans.forEach((plan) => {
    const key = String(plan?.id || '').trim();
    if (!key) return;

    const catalogAsAvailablePlan: AdminAvailablePlanItem = {
      id: plan.id,
      name: plan.name,
      price: plan.price,
      active: plan.is_active === false ? 0 : 1,
      is_active: plan.is_active === false ? 0 : 1,
    };
    const current = mergedById.get(key);

    mergedById.set(key, current
      ? {
          ...catalogAsAvailablePlan,
          ...current,
          id: current.id ?? catalogAsAvailablePlan.id,
          name: current.name || catalogAsAvailablePlan.name,
          price: current.price ?? catalogAsAvailablePlan.price,
          active: current.active ?? catalogAsAvailablePlan.active,
          is_active: current.is_active ?? catalogAsAvailablePlan.is_active,
        }
      : catalogAsAvailablePlan);
  });

  return {
    ...detailedUser,
    available_plans: Array.from(mergedById.values()),
  };
};

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
  const [detailedUser, setDetailedUser] = useState<AdminUserDetailsPayload | null>(null);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);
  const [detailTab, setDetailTab] = useState<DetailTab>('overview');
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [isEditingUser, setIsEditingUser] = useState(false);
  const [editUserForm, setEditUserForm] = useState<EditUserForm>(createEmptyEditUserForm);

  const refreshDetailedUser = async (userId: string, options?: { syncState?: boolean }) => {
    const [response, catalogPlans] = await Promise.all([
      adminService.getUserDetails(userId),
      planService.getPlans(),
    ]);
    const mergedResponse = mergeDetailedUserWithCatalogPlans(response, catalogPlans);
    if (options?.syncState !== false) {
      setDetailedUser(mergedResponse);
    }
    return mergedResponse;
  };

  useEffect(() => {
    if (!viewingProfileId) {
      const frame = requestAnimationFrame(() => {
        setDetailedUser(null);
        setDetailTab('overview');
        setIsEditingUser(false);
        setEditUserForm(createEmptyEditUserForm());
        setActionLoading(null);
      });

      return () => cancelAnimationFrame(frame);
    }

    const frame = requestAnimationFrame(() => {
      setIsEditingUser(false);
      setIsLoadingDetail(true);
    });

    let isCancelled = false;

    void Promise.all([
      adminService.getUserDetails(String(viewingProfileId)),
      planService.getPlans(),
    ])
      .then(([response, catalogPlans]) => {
        if (!isCancelled) {
          setDetailedUser(mergeDetailedUserWithCatalogPlans(response, catalogPlans));
        }
      })
      .catch((error) => {
        clientLog.warn('Error loading user details:', error);
        addToast(readApiErrorMessage(error, 'Erro ao carregar detalhes do usuario.'), 'error');
        if (!isCancelled) {
          setDetailedUser(null);
        }
      })
      .finally(() => {
        if (!isCancelled) {
          setIsLoadingDetail(false);
        }
      });

    return () => {
      isCancelled = true;
      cancelAnimationFrame(frame);
    };
  }, [viewingProfileId, addToast]);

  const handleUserAction = async (
    action: string,
    data: Record<string, unknown>,
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
      const result: AdminUserActionResult = await adminService.performUserActionWithResult(payload);

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
      clientLog.warn('Error performing admin user action:', error);
      addToast(readApiErrorMessage(error, 'Erro ao realizar a acao.'), 'error');
      throw error;
    } finally {
      setActionLoading(null);
    }
  };

  const openUserProfile = (userId: string | number | null | undefined) => {
    if (userId === null || userId === undefined || userId === '') {
      return;
    }

    setViewingProfileId(String(userId));
  };

  const closeUserProfile = () => {
    setViewingProfileId(null);
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

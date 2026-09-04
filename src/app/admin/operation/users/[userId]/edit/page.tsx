'use client';

/*
* ----------------------------------------------------
* @author: 4quarenta
* @author URI: https://github.com/4quarenta
* @copyright: (c) 2026 ConcursoMestre. All rights reserved.
* ----------------------------------------------------
*
* @since 1.0.0
*
*/

import React from 'react';
import { AlertTriangle } from 'lucide-react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@providers/AuthProvider';
import { useToast } from '@providers/ToastProvider';
import { useAdminDataActions } from '@/state/admin-data/useAdminDataActions';
import { canAccessAdminPanel } from '@services/auth';
import { planService } from '@services/plans';
import { adminService, type AdminUserDetailsPayload } from '@services/admin/adminService';
import { readApiErrorMessage } from '@services/api';
import type { Plan } from '@types';
import AdminStandaloneShell from '../../../../components/shared/AdminStandaloneShell';
import AdminUserEditorPage, { type AdminUserEditorForm } from '../../../../components/users/AdminUserEditorPage';
import { buildAdminPath, buildAdminUserEditPath } from '../../../../config/adminPageNavigationConfig';
import {
  ADMIN_PRIMARY_BUTTON_CLASS,
  ADMIN_SECONDARY_BUTTON_CLASS,
  ADMIN_SURFACE_CLASS,
} from '../../../../components/shared/adminPanelStyles';
import RouteContentSkeleton from '@/components/shared/feedback/RouteContentSkeleton';

const resolveUserId = (value?: string | string[]) =>
  Array.isArray(value) ? value[0] : value;

const createEmptyUserForm = (): AdminUserEditorForm => ({
  name: '',
  email: '',
  password: '',
  cpf: '',
  phone: '',
  targetExam: '',
  role: 'user',
  status: 'active',
  reputation: '100',
});

const normalizeAdminEditorRole = (value: unknown): AdminUserEditorForm['role'] => {
  if (value === 'staff' || value === 'partner' || value === 'admin') {
    return value;
  }

  return 'user';
};

const normalizeAdminEditorStatus = (value: unknown): AdminUserEditorForm['status'] => {
  if (value === 'suspended' || value === 'banned' || value === 'pending') {
    return value;
  }

  return 'active';
};

const buildUserFormFromDetails = (details: AdminUserDetailsPayload | null): AdminUserEditorForm => {
  const profile = details?.profile || {};

  return {
    name: String(profile.name || ''),
    email: String(profile.email || ''),
    password: '',
    cpf: String(profile.cpf || ''),
    phone: String(profile.phone || ''),
    targetExam: String(profile.target_exam || profile.targetExam || ''),
    role: normalizeAdminEditorRole(profile.role),
    status: normalizeAdminEditorStatus(profile.status),
    reputation: String(Number(profile.reputation ?? 100)),
  };
};

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

const AdminUserEditPage = () => {
  const params = useParams<{ userId?: string | string[] }>();
  const router = useRouter();
  const userId = resolveUserId(params.userId) || 'new';
  const isNew = userId === 'new';

  const { currentUser, isLoading: isAuthLoading } = useAuth();
  const { ensureUsersLoaded } = useAdminDataActions();
  const { addToast } = useToast();
  const [details, setDetails] = React.useState<AdminUserDetailsPayload | null>(null);
  const [form, setForm] = React.useState<AdminUserEditorForm>(createEmptyUserForm);
  const formRef = React.useRef<AdminUserEditorForm>(form);
  const [isLoadingDetail, setIsLoadingDetail] = React.useState(false);
  const [isSaving, setIsSaving] = React.useState(false);
  const [actionLoading, setActionLoading] = React.useState<string | null>(null);
  const [loadError, setLoadError] = React.useState('');

  const updateForm = React.useCallback((nextForm: AdminUserEditorForm) => {
    formRef.current = nextForm;
    setForm(nextForm);
  }, []);

  React.useEffect(() => {
    if (!isAuthLoading && !canAccessAdminPanel(currentUser)) {
      router.replace('/');
    }
  }, [currentUser, isAuthLoading, router]);

  React.useEffect(() => {
    if (isAuthLoading || !canAccessAdminPanel(currentUser)) {
      return;
    }

    if (isNew) {
      const frame = requestAnimationFrame(() => {
        setDetails(null);
        setLoadError('');
        updateForm(createEmptyUserForm());
      });

      return () => cancelAnimationFrame(frame);
    }

    let cancelled = false;
    const loadingFrame = requestAnimationFrame(() => {
      setIsLoadingDetail(true);
      setLoadError('');
    });

    Promise.all([
      adminService.getUserDetails(String(userId)),
      planService.getPlans(),
    ])
      .then(([payload, catalogPlans]) => {
        if (cancelled) return;
        const mergedPayload = mergeDetailedUserWithCatalogPlans(payload, catalogPlans);
        setDetails(mergedPayload);
        updateForm(buildUserFormFromDetails(mergedPayload));
      })
      .catch((error) => {
        if (cancelled) return;
        setDetails(null);
        setLoadError(readApiErrorMessage(error, 'Nao foi possivel carregar o usuario.'));
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoadingDetail(false);
        }
      });

    return () => {
      cancelled = true;
      cancelAnimationFrame(loadingFrame);
    };
  }, [currentUser, isAuthLoading, isNew, updateForm, userId]);

  const closeEditor = React.useCallback(() => {
    router.push(buildAdminPath('operation', 'users'));
  }, [router]);

  const saveUser = React.useCallback(async () => {
    if (isSaving) {
      return;
    }

    const formToSave = formRef.current;
    setIsSaving(true);

    try {
      const payload = {
        action: isNew ? 'create_user' : 'update_profile',
        user_id: isNew ? undefined : String(userId),
        name: formToSave.name,
        email: formToSave.email,
        password: formToSave.password,
        cpf: formToSave.cpf,
        phone: formToSave.phone,
        targetExam: formToSave.targetExam,
        role: formToSave.role,
        status: formToSave.status,
        reputation: Math.max(0, Math.min(100, Number(formToSave.reputation || 0))),
      };

      const result = await adminService.performUserActionWithResult(payload);
      await ensureUsersLoaded(true);

      if (isNew) {
        const nextUserId = String(result.data?.user_id || '');
        addToast(result.message || 'Usuario criado com sucesso.', 'success');
        if (nextUserId) {
          router.replace(buildAdminUserEditPath(nextUserId));
        }
        return;
      }

      const [nextDetailsRaw, catalogPlans] = await Promise.all([
        adminService.getUserDetails(String(userId)),
        planService.getPlans(),
      ]);
      const nextDetails = mergeDetailedUserWithCatalogPlans(nextDetailsRaw, catalogPlans);
      setDetails(nextDetails);
      updateForm(buildUserFormFromDetails(nextDetails));
      addToast(result.message || 'Usuario atualizado com sucesso.', 'success');
    } catch (error) {
      addToast(readApiErrorMessage(error, isNew ? 'Nao foi possivel criar o usuario.' : 'Nao foi possivel salvar o usuario.'), 'error');
    } finally {
      setIsSaving(false);
    }
  }, [addToast, ensureUsersLoaded, isNew, isSaving, router, updateForm, userId]);

  const runUserAction = React.useCallback(async (
    action: string,
    data: Record<string, unknown>,
    options?: { actionKey?: string; successMessage?: string },
  ) => {
    if (!details?.profile?.id || isNew) {
      addToast('Usuario nao carregado para esta acao.', 'error');
      return null;
    }

    const actionKey = options?.actionKey || action;
    setActionLoading(actionKey);

    try {
      const result = await adminService.performUserActionWithResult({
        user_id: String(details.profile.id),
        action,
        ...data,
      });
      const [nextDetailsRaw, catalogPlans] = await Promise.all([
        adminService.getUserDetails(String(details.profile.id)),
        planService.getPlans(),
      ]);
      const nextDetails = mergeDetailedUserWithCatalogPlans(nextDetailsRaw, catalogPlans);

      setDetails(nextDetails);
      updateForm(buildUserFormFromDetails(nextDetails));
      await ensureUsersLoaded(true);

      addToast(
        result.message || options?.successMessage || 'Acao realizada com sucesso.',
        'success',
      );

      return {
        result,
        user: nextDetails,
      };
    } catch (error) {
      addToast(readApiErrorMessage(error, 'Erro ao realizar a acao.'), 'error');
      throw error;
    } finally {
      setActionLoading(null);
    }
  }, [addToast, details, ensureUsersLoaded, isNew, updateForm]);

  const renderShell = (children: React.ReactNode) => (
    <AdminStandaloneShell
      activeTab="operation"
      activeSectionKey="users"
      pageTitle="Usuarios"
      showPageHeader={false}
    >
      {children}
    </AdminStandaloneShell>
  );

  if (isAuthLoading || isLoadingDetail) {
    return renderShell(<RouteContentSkeleton variant="admin" />);
  }

  if (!canAccessAdminPanel(currentUser)) {
    return null;
  }

  if (loadError && !isNew) {
    return renderShell(
      <div className={`${ADMIN_SURFACE_CLASS} p-8`}>
        <div className="flex items-start gap-3">
          <div className="rounded-sm bg-amber-50 p-3 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300">
            <AlertTriangle size={16} />
          </div>
          <div className="space-y-3">
            <div>
              <h1 className="text-xl font-semibold text-slate-900 dark:text-slate-100">Usuario nao encontrado</h1>
              <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{loadError}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button type="button" onClick={closeEditor} className={ADMIN_SECONDARY_BUTTON_CLASS}>
                Voltar
              </button>
              <button type="button" onClick={() => router.push(buildAdminUserEditPath('new'))} className={ADMIN_PRIMARY_BUTTON_CLASS}>
                Novo usuario
              </button>
            </div>
          </div>
        </div>
      </div>,
    );
  }

  return renderShell(
    <AdminUserEditorPage
      form={form}
      onFormChange={updateForm}
      detailedUser={details || undefined}
      isNew={isNew}
      isSaving={isSaving}
      actionLoading={actionLoading}
      onSave={() => void saveUser()}
      onUserAction={runUserAction}
      onClose={closeEditor}
    />,
  );
};

export default AdminUserEditPage;

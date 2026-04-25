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
import { AlertTriangle, Loader2 } from 'lucide-react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@providers/AuthProvider';
import { useData } from '@providers/DataProvider';
import { useToast } from '@providers/ToastProvider';
import { canAccessAdminPanel } from '@services/auth';
import { adminService, type AdminUserDetailsPayload } from '@services/admin/adminService';
import { readApiErrorMessage } from '@services/api';
import AdminStandaloneShell from '../../../../components/shared/AdminStandaloneShell';
import AdminUserEditorPage, { type AdminUserEditorForm } from '../../../../components/users/AdminUserEditorPage';
import { buildAdminPath, buildAdminUserEditPath } from '../../../../config/adminPageNavigationConfig';
import {
  ADMIN_PRIMARY_BUTTON_CLASS,
  ADMIN_SECONDARY_BUTTON_CLASS,
  ADMIN_SURFACE_CLASS,
} from '../../../../components/shared/adminPanelStyles';

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

const buildUserFormFromDetails = (details: AdminUserDetailsPayload | null): AdminUserEditorForm => {
  const profile = details?.profile || {};

  return {
    name: String(profile.name || ''),
    email: String(profile.email || ''),
    password: '',
    cpf: String(profile.cpf || ''),
    phone: String(profile.phone || ''),
    targetExam: String(profile.target_exam || profile.targetExam || ''),
    role: ['staff', 'partner', 'admin'].includes(String(profile.role || '')) ? profile.role : 'user',
    status: ['suspended', 'banned', 'pending'].includes(String(profile.status || '')) ? profile.status : 'active',
    reputation: String(Number(profile.reputation ?? 100)),
  };
};

const AdminUserEditPage = () => {
  const params = useParams<{ userId?: string | string[] }>();
  const router = useRouter();
  const userId = resolveUserId(params.userId) || 'new';
  const isNew = userId === 'new';

  const { currentUser, isLoading: isAuthLoading } = useAuth();
  const { ensureUsersLoaded } = useData();
  const { addToast } = useToast();
  const [details, setDetails] = React.useState<AdminUserDetailsPayload | null>(null);
  const [form, setForm] = React.useState<AdminUserEditorForm>(createEmptyUserForm);
  const [isLoadingDetail, setIsLoadingDetail] = React.useState(false);
  const [isSaving, setIsSaving] = React.useState(false);
  const [actionLoading, setActionLoading] = React.useState<string | null>(null);
  const [loadError, setLoadError] = React.useState('');

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
      setDetails(null);
      setLoadError('');
      setForm(createEmptyUserForm());
      return;
    }

    let cancelled = false;
    setIsLoadingDetail(true);
    setLoadError('');

    adminService.getUserDetails(String(userId))
      .then((payload) => {
        if (cancelled) return;
        setDetails(payload);
        setForm(buildUserFormFromDetails(payload));
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
    };
  }, [currentUser, isAuthLoading, isNew, userId]);

  const closeEditor = React.useCallback(() => {
    router.push(buildAdminPath('operation', 'users'));
  }, [router]);

  const saveUser = React.useCallback(async () => {
    if (isSaving) {
      return;
    }

    setIsSaving(true);

    try {
      const payload = {
        action: isNew ? 'create_user' : 'update_profile',
        user_id: isNew ? undefined : String(userId),
        name: form.name,
        email: form.email,
        password: form.password,
        cpf: form.cpf,
        phone: form.phone,
        targetExam: form.targetExam,
        role: form.role,
        status: form.status,
        reputation: Math.max(0, Math.min(100, Number(form.reputation || 0))),
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

      const nextDetails = await adminService.getUserDetails(String(userId));
      setDetails(nextDetails);
      setForm(buildUserFormFromDetails(nextDetails));
      addToast(result.message || 'Usuario atualizado com sucesso.', 'success');
    } catch (error) {
      addToast(readApiErrorMessage(error, isNew ? 'Nao foi possivel criar o usuario.' : 'Nao foi possivel salvar o usuario.'), 'error');
    } finally {
      setIsSaving(false);
    }
  }, [addToast, ensureUsersLoaded, form, isNew, isSaving, router, userId]);

  const runUserAction = React.useCallback(async (
    action: string,
    data: Record<string, any>,
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
      const nextDetails = await adminService.getUserDetails(String(details.profile.id));

      setDetails(nextDetails);
      setForm(buildUserFormFromDetails(nextDetails));
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
  }, [addToast, details?.profile?.id, ensureUsersLoaded, isNew]);

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
    return renderShell(
      <div className={`${ADMIN_SURFACE_CLASS} flex min-h-[360px] items-center justify-center p-12 text-slate-500 dark:text-slate-400`}>
        <Loader2 className="mr-3 animate-spin" size={18} /> Carregando editor do usuario...
      </div>,
    );
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
      onFormChange={setForm}
      detailedUser={details}
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

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

import React from 'react';
import { ArrowLeft, ArrowUpCircle, Clock, Crown, DollarSign, Mail, MessageCircle, MessageSquare, PlusCircle, RefreshCcw, Save, Shield, ShoppingBag, UserRound } from 'lucide-react';
import Link from 'next/link';
import { getAssetUrl } from '@services/api';
import UserAvatar from '@/components/shared/ui/UserAvatar';
import type { AdminUserDetailsPayload } from '@services/admin/adminService';
import { publicRoutes } from '@services/routes/publicRoutes';
import AdminConfirmDialog from '../ui/AdminConfirmDialog';
import {
  AdminEditorHeader,
  AdminFormSection,
  AdminFormField,
} from '../shared/AdminDesignSystem';
import {
  ADMIN_FIELD_CLASS,
  ADMIN_MUTED_SURFACE_CLASS,
  ADMIN_PRIMARY_BUTTON_CLASS,
  ADMIN_SECONDARY_BUTTON_CLASS,
  ADMIN_SURFACE_CLASS,
  ADMIN_SURFACE_HEADER_CLASS,
} from '../shared/adminPanelStyles';
import {
  ADMIN_USER_ROLE_OPTIONS,
  ADMIN_USER_STATUS_OPTIONS,
  getAdminUserRoleBadgeClass,
  getAdminUserRoleLabel,
  getAdminUserStatusBadgeClass,
  getAdminUserStatusLabel,
} from './userAdminOptions';

export type AdminUserEditorForm = {
  name: string;
  email: string;
  password: string;
  cpf: string;
  phone: string;
  targetExam: string;
  role: 'user' | 'staff' | 'partner' | 'admin';
  status: 'active' | 'suspended' | 'banned' | 'pending';
  reputation: string;
};

type DetailTab = 'overview' | 'subscription' | 'transactions' | 'comments' | 'materials';
type AdminUserProfileSummary = {
  id?: string | number;
  name?: string;
  email?: string;
  cpf?: string;
  phone?: string;
  target_exam?: string;
  targetExam?: string;
  role?: string;
  status?: string;
  reputation?: number | string | null;
  email_verified?: boolean;
  has_saved_card?: boolean;
  photo_url?: string | null;
  plan?: string;
  created_at?: string | null;
  createdAt?: string | null;
};

type AdminUserSubscriptionItem = {
  id: string | number;
  status?: string;
  plan_id?: string | number;
  plan_name?: string;
  current_period_start?: string | null;
  current_period_end?: string | null;
  auto_renew?: boolean;
  payment_provider?: string | null;
};

type AdminUserTransactionItem = {
  id: string | number;
  created_at?: string | null;
  type?: string;
  amount?: number | string | null;
  status?: string;
};

type AdminUserCommentItem = {
  id: string | number;
  created_at?: string | null;
  question_id?: string | number;
  comment?: string;
};

type AdminUserMaterialItem = {
  id: string | number;
  title?: string;
  name?: string;
  status?: string;
  price?: number | string | null;
};

type AdminAvailablePlanItem = {
  id: string | number;
  name?: string;
  price?: number | string | null;
  active?: number | string | boolean;
};

type ConfirmState = null | {
  action: string;
  actionKey: string;
  title: string;
  description: string;
  confirmLabel: string;
  tone: 'primary' | 'danger';
  payload: Record<string, unknown>;
};

interface AdminUserEditorPageProps {
  form: AdminUserEditorForm;
  onFormChange: (form: AdminUserEditorForm) => void;
  detailedUser?: AdminUserDetailsPayload;
  isNew: boolean;
  isSaving: boolean;
  actionLoading?: string | null;
  onSave: (form?: AdminUserEditorForm) => void;
  onUserAction?: (action: string, data: Record<string, unknown>, options?: { actionKey?: string; successMessage?: string }) => Promise<unknown>;
  onClose: () => void;
}

const formatDate = (value?: string | null) => {
  if (!value) return '-';
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? '-' : parsed.toLocaleDateString('pt-BR');
};

const formatDateTime = (value?: string | null) => {
  if (!value) return '-';
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? '-' : parsed.toLocaleString('pt-BR');
};

const formatCurrency = (value?: string | number | null) => Number(value || 0).toLocaleString('pt-BR', {
  style: 'currency',
  currency: 'BRL',
});

const getTransactionStatusClass = (status: string | null | undefined) => {
  switch (String(status || '').toLowerCase()) {
    case 'approved':
    case 'completed':
    case 'paid':
    case 'active':
      return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300';
    case 'refunded':
    case 'failed':
    case 'past_due':
    case 'canceled':
      return 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300';
    case 'refund_requested':
    case 'pending':
      return 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300';
    default:
      return 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300';
  }
};

const FieldLabel = ({ children }: { children: React.ReactNode }) => (
  <label className="text-[11px] font-semibold text-slate-700 dark:text-slate-200">{children}</label>
);

const sectionCardClass = `${ADMIN_SURFACE_CLASS} p-5`;
const metricCardClass = `${ADMIN_MUTED_SURFACE_CLASS} p-4`;

const AdminUserEditorPage = ({
  form,
  onFormChange,
  detailedUser,
  isNew,
  isSaving,
  actionLoading = null,
  onSave,
  onUserAction,
  onClose,
}: AdminUserEditorPageProps) => {
  const formRef = React.useRef(form);
  const editorRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    formRef.current = form;
  }, [form]);

  const updateForm = (patch: Partial<AdminUserEditorForm>) => {
    const nextForm = { ...formRef.current, ...patch };
    formRef.current = nextForm;
    onFormChange(nextForm);
  };
  const getCurrentForm = () => {
    const currentForm = formRef.current;
    const readValue = (field: string) => editorRef.current?.querySelector<HTMLInputElement>(`[data-admin-user-field="${field}"]`)?.value ?? currentForm[field as keyof AdminUserEditorForm];
    const readSelectValue = <T extends string>(field: string, fallback: T) => (editorRef.current?.querySelector<HTMLSelectElement>(`[data-admin-user-field="${field}"]`)?.value || fallback) as T;

    return {
      ...currentForm,
      name: readValue('name'),
      email: readValue('email'),
      password: readValue('password'),
      cpf: readValue('cpf'),
      phone: readValue('phone'),
      targetExam: readValue('targetExam'),
      role: readSelectValue('role', currentForm.role),
      status: readSelectValue('status', currentForm.status),
      reputation: readValue('reputation'),
    };
  };
  const profile = (detailedUser?.profile || {}) as AdminUserProfileSummary;
  const subscriptions = (detailedUser?.subscriptions ?? []) as AdminUserSubscriptionItem[];
  const transactions = (detailedUser?.transactions ?? []) as AdminUserTransactionItem[];
  const comments = (detailedUser?.last_comments ?? []) as AdminUserCommentItem[];
  const materials = (detailedUser?.materials ?? []) as AdminUserMaterialItem[];
  const activeSubscription = subscriptions.find((subscription) => String(subscription.status || '').toLowerCase() === 'active') || null;
  const availablePlans = React.useMemo(
    () => ((detailedUser?.available_plans ?? []) as AdminAvailablePlanItem[]).filter((plan) => Number(plan.active ?? 1) !== 0),
    [detailedUser?.available_plans],
  );
  const [detailTab, setDetailTab] = React.useState<DetailTab>('overview');
  const [daysToAdd, setDaysToAdd] = React.useState('30');
  const [compensationTicket, setCompensationTicket] = React.useState('');
  const [compensationReason, setCompensationReason] = React.useState('');
  const [selectedPlanIdOverride, setSelectedPlanIdOverride] = React.useState('');
  const [confirmState, setConfirmState] = React.useState<ConfirmState>(null);
  const title = isNew ? 'Adicionar novo usuario' : profile.name || form.name || 'Editar usuario';

  const selectedPlanId = React.useMemo(() => {
    if (!availablePlans.length) {
      return '';
    }

    if (selectedPlanIdOverride && availablePlans.some((plan) => String(plan.id) === selectedPlanIdOverride)) {
      return selectedPlanIdOverride;
    }

    const fallbackPlan = availablePlans.find((plan) => String(plan.id) !== String(activeSubscription?.plan_id));
    return String((fallbackPlan || availablePlans[0]).id);
  }, [activeSubscription?.plan_id, availablePlans, selectedPlanIdOverride]);

  const openAddDaysConfirm = () => {
    const days = Number(daysToAdd || 0);
    if (!Number.isFinite(days) || days === 0) return;
    const isRemovingDays = days < 0;
    const absoluteDays = Math.abs(days);
    const isManualGrant = String(activeSubscription?.payment_provider || '').toLowerCase() === 'manual_admin';
    if (isRemovingDays && !isManualGrant) return;

    setConfirmState({
      action: 'add_days',
      actionKey: 'add_days',
      title: isRemovingDays ? 'Remover dias da cortesia' : 'Adicionar dias de cortesia',
      description: isRemovingDays
        ? `O periodo de cortesia sera reduzido em ${absoluteDays} dia(s).`
        : `O periodo ativo sera estendido em ${absoluteDays} dia(s) como cortesia manual.`,
      confirmLabel: isRemovingDays ? 'Remover dias' : 'Aplicar cortesia',
      tone: isRemovingDays ? 'danger' : 'primary',
      payload: {
        days,
        ticket_reference: compensationTicket.trim(),
        reason: compensationReason.trim(),
      },
    });
  };

  const openUpgradeConfirm = () => {
    if (!selectedPlanId) return;
    const plan = availablePlans.find((item) => String(item.id) === selectedPlanId);

    setConfirmState({
      action: 'upgrade_plan',
      actionKey: 'upgrade_plan',
      title: 'Aplicar upgrade manual',
      description: `O usuario sera movido para o plano "${plan?.name || 'selecionado'}".`,
      confirmLabel: 'Aplicar upgrade',
      tone: 'primary',
      payload: {
        plan_id: Number(selectedPlanId),
        ticket_reference: compensationTicket.trim(),
        reason: compensationReason.trim(),
      },
    });
  };

  const openRefundConfirm = (transaction: AdminUserTransactionItem) => {
    setConfirmState({
      action: 'refund_transaction',
      actionKey: `refund_transaction:${transaction.id}`,
      title: 'Estornar transacao',
      description: `A transacao ${transaction.id} sera enviada para estorno e sincronizada no painel.`,
      confirmLabel: 'Estornar',
      tone: 'danger',
      payload: { transaction_id: transaction.id },
    });
  };

  const confirmAction = async () => {
    if (!confirmState || !onUserAction) return;

    try {
      await onUserAction(confirmState.action, confirmState.payload, { actionKey: confirmState.actionKey });
      setConfirmState(null);
    } catch {
      // O chamador ja exibe o toast de erro.
    }
  };

  return (
    <div ref={editorRef} className="space-y-5">
      <AdminEditorHeader
        title={title}
        description="Dados cadastrais, papel operacional, status da conta e sinais internos do usuario."
        leading={(
          <div className="flex items-center gap-3">
            <button type="button" onClick={onClose} className={`${ADMIN_SECONDARY_BUTTON_CLASS} mt-0.5 h-9 w-9 justify-center p-0`} aria-label="Voltar para usuarios">
              <ArrowLeft size={16} />
            </button>
            {!isNew ? (
              <UserAvatar
                name={profile.name || form.name}
                src={getAssetUrl(profile.photo_url || '')}
                alt="Foto de perfil"
                className="h-12 w-12 shrink-0 rounded-sm bg-sky-50 text-sm font-black text-sky-700 dark:bg-sky-900/30 dark:text-sky-300"
                fallbackClassName="leading-none"
              />
            ) : null}
          </div>
        )}
        actions={(
          <button type="button" onClick={() => onSave(getCurrentForm())} disabled={isSaving} className={ADMIN_PRIMARY_BUTTON_CLASS}>
            <Save size={14} />
            {isSaving ? 'Salvando...' : isNew ? 'Adicionar usuário' : 'Salvar alterações'}
          </button>
        )}
      />

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
        <main className="space-y-5">
          <AdminFormSection title="Identificacao">
            <div className="grid gap-4 p-5 md:grid-cols-2">
              <AdminFormField label="Nome" controlId="admin-user-name" required>
                <input
                  data-admin-user-field="name"
                  value={form.name}
                  onChange={(event) => updateForm({ name: event.target.value })}
                  className={`${ADMIN_FIELD_CLASS} h-10 w-full`}
                  placeholder="Nome completo"
                />
              </AdminFormField>
              <AdminFormField label="E-mail" controlId="admin-user-email" required>
                <input
                  data-admin-user-field="email"
                  type="email"
                  value={form.email}
                  onChange={(event) => updateForm({ email: event.target.value })}
                  className={`${ADMIN_FIELD_CLASS} h-10 w-full`}
                  placeholder="usuario@email.com"
                />
              </AdminFormField>
              {isNew ? (
                <div className="space-y-2 md:col-span-2">
                  <FieldLabel>Senha temporaria</FieldLabel>
                  <input
                    data-admin-user-field="password"
                    type="password"
                    value={form.password}
                    onChange={(event) => updateForm({ password: event.target.value })}
                    className={`${ADMIN_FIELD_CLASS} h-10 w-full`}
                    placeholder="Minimo de 8 caracteres"
                  />
                </div>
              ) : null}
              <div className="space-y-2">
                <FieldLabel>CPF</FieldLabel>
                <input
                  data-admin-user-field="cpf"
                  value={form.cpf}
                  onChange={(event) => updateForm({ cpf: event.target.value })}
                  className={`${ADMIN_FIELD_CLASS} h-10 w-full`}
                  placeholder="Opcional"
                />
              </div>
              <div className="space-y-2">
                <FieldLabel>Telefone</FieldLabel>
                <input
                  data-admin-user-field="phone"
                  value={form.phone}
                  onChange={(event) => updateForm({ phone: event.target.value })}
                  className={`${ADMIN_FIELD_CLASS} h-10 w-full`}
                  placeholder="Opcional"
                />
              </div>
              <div className="space-y-2 md:col-span-2">
                <FieldLabel>Concurso alvo</FieldLabel>
                <input
                  data-admin-user-field="targetExam"
                  value={form.targetExam}
                  onChange={(event) => updateForm({ targetExam: event.target.value })}
                  className={`${ADMIN_FIELD_CLASS} h-10 w-full`}
                  placeholder="Ex: TJ-SP, PF, Receita Federal..."
                />
              </div>
            </div>
          </AdminFormSection>

          <section className={`${ADMIN_SURFACE_CLASS} overflow-hidden`}>
            <div className={ADMIN_SURFACE_HEADER_CLASS}>
              <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">Permissoes e saude da conta</p>
            </div>
            <div className="grid gap-4 p-5 md:grid-cols-3">
              <div className="space-y-2">
                <FieldLabel>Papel</FieldLabel>
                <select data-admin-user-field="role" value={form.role} onChange={(event) => updateForm({ role: event.target.value as AdminUserEditorForm['role'] })} className={`${ADMIN_FIELD_CLASS} h-10 w-full`}>
                  {ADMIN_USER_ROLE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                </select>
              </div>
              <div className="space-y-2">
                <FieldLabel>Status</FieldLabel>
                <select data-admin-user-field="status" value={form.status} onChange={(event) => updateForm({ status: event.target.value as AdminUserEditorForm['status'] })} className={`${ADMIN_FIELD_CLASS} h-10 w-full`}>
                  {ADMIN_USER_STATUS_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                </select>
              </div>
              <div className="space-y-2">
                <FieldLabel>Reputacao</FieldLabel>
                <input
                  data-admin-user-field="reputation"
                  type="number"
                  min={0}
                  max={100}
                  value={form.reputation}
                  onChange={(event) => updateForm({ reputation: event.target.value })}
                  className={`${ADMIN_FIELD_CLASS} h-10 w-full`}
                />
              </div>
            </div>
          </section>

          {!isNew ? (
            <section className={`${ADMIN_SURFACE_CLASS} overflow-hidden`}>
              <div className={ADMIN_SURFACE_HEADER_CLASS}>
                <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">Resumo operacional</p>
              </div>
              <div className="grid gap-4 p-5 md:grid-cols-3">
                <div className={`${ADMIN_MUTED_SURFACE_CLASS} p-4`}>
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Plano</p>
                  <p className="mt-2 text-lg font-black text-slate-900 dark:text-slate-100">{profile.plan || 'Gratuito'}</p>
                </div>
                <div className={`${ADMIN_MUTED_SURFACE_CLASS} p-4`}>
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Email confirmado</p>
                  <p className="mt-2 text-lg font-black text-slate-900 dark:text-slate-100">{profile.email_verified ? 'Sim' : 'Nao'}</p>
                </div>
                <div className={`${ADMIN_MUTED_SURFACE_CLASS} p-4`}>
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Cadastro</p>
                  <p className="mt-2 text-sm font-black text-slate-900 dark:text-slate-100">{formatDateTime(profile.created_at || profile.createdAt)}</p>
                </div>
              </div>
            </section>
          ) : null}
        </main>

        <aside className="space-y-5">
          <section className={`${ADMIN_SURFACE_CLASS} overflow-hidden`}>
            <div className={ADMIN_SURFACE_HEADER_CLASS}>
              <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">Salvar</p>
            </div>
            <div className="space-y-4 p-4">
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm font-medium text-slate-500 dark:text-slate-400">Papel</span>
                <span className={`rounded-sm px-2 py-1 text-[10px] font-black uppercase tracking-widest ${getAdminUserRoleBadgeClass(form.role)}`}>
                  {getAdminUserRoleLabel(form.role)}
                </span>
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="text-sm font-medium text-slate-500 dark:text-slate-400">Status</span>
                <span className={`rounded-sm px-2 py-1 text-[10px] font-black uppercase tracking-widest ${getAdminUserStatusBadgeClass(form.status)}`}>
                  {getAdminUserStatusLabel(form.status)}
                </span>
              </div>
              {!isNew ? (
                <div className="rounded-sm border border-slate-200 bg-slate-50 p-3 text-xs font-medium text-slate-500 dark:border-slate-800 dark:bg-slate-950/40 dark:text-slate-400">
                  ID: <span className="font-mono text-slate-700 dark:text-slate-200">{profile.id}</span>
                </div>
              ) : null}
              <button type="button" onClick={() => onSave(getCurrentForm())} disabled={isSaving} className={`${ADMIN_PRIMARY_BUTTON_CLASS} w-full justify-center`}>
                <Save size={14} />
                {isSaving ? 'Salvando...' : isNew ? 'Adicionar usuário' : 'Salvar alterações'}
              </button>
              <button type="button" onClick={onClose} className={`${ADMIN_SECONDARY_BUTTON_CLASS} w-full justify-center`}>
                <ArrowLeft size={14} /> Voltar
              </button>
            </div>
          </section>

          <section className={`${ADMIN_SURFACE_CLASS} p-4`}>
            <div className="flex gap-3">
              <div className="rounded-sm bg-sky-50 p-3 text-sky-700 dark:bg-sky-900/20 dark:text-sky-300">
                {isNew ? <UserRound size={18} /> : <Shield size={18} />}
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                  {isNew ? 'Conta criada pelo admin' : 'Edicao administrativa'}
                </p>
                <p className="mt-1 text-sm leading-6 text-slate-500 dark:text-slate-400">
                  {isNew
                    ? 'Use uma senha temporaria e oriente o usuario a alterar a senha depois do primeiro acesso.'
                    : 'Mudancas de papel e status afetam acesso ao painel, marketplace e funcionalidades autenticadas.'}
                </p>
              </div>
            </div>
          </section>

          {!isNew && profile.email ? (
            <a href={`mailto:${profile.email}`} className={`${ADMIN_SECONDARY_BUTTON_CLASS} w-full justify-center`}>
              <Mail size={14} /> Enviar email
            </a>
          ) : null}
        </aside>
      </div>

      {!isNew ? (
        <section className={`${ADMIN_SURFACE_CLASS} overflow-hidden`}>
          <div className={`${ADMIN_SURFACE_HEADER_CLASS} flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between`}>
            <div>
              <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">Perfil detalhado</p>
              <p className="mt-1 text-xs font-medium text-slate-500 dark:text-slate-400">
                Assinatura, financeiro, comentarios, materiais e sinais de acesso no mesmo editor.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {([
                ['overview', 'Visao geral'],
                ['subscription', 'Assinatura'],
                ['transactions', 'Financeiro'],
                ['comments', `Comentarios (${comments.length})`],
                ['materials', `Materiais (${materials.length})`],
              ] as [DetailTab, string][]).map(([tab, label]) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => setDetailTab(tab)}
                  className={[
                    'rounded-sm border px-3 py-2 text-[11px] font-semibold uppercase tracking-widest transition-colors',
                    detailTab === tab
                      ? 'border-sky-700 bg-sky-700 text-white'
                      : 'border-slate-300 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800',
                  ].join(' ')}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          <div className="p-5">
            {detailTab === 'overview' ? (
              <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                  <div className={metricCardClass}>
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Tipo</p>
                    <p className="mt-2 text-lg font-black text-slate-900 dark:text-slate-100">{getAdminUserRoleLabel(profile.role)}</p>
                  </div>
                  <div className={metricCardClass}>
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Status</p>
                    <p className="mt-2 text-lg font-black text-slate-900 dark:text-slate-100">{getAdminUserStatusLabel(profile.status)}</p>
                  </div>
                  <div className={metricCardClass}>
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Reputacao</p>
                    <p className="mt-2 text-lg font-black text-slate-900 dark:text-slate-100">{Number(profile.reputation ?? 0)}/100</p>
                  </div>
                  <div className={metricCardClass}>
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Plano atual</p>
                    <p className="mt-2 text-lg font-black text-sky-700 dark:text-sky-300">{activeSubscription?.plan_name || profile.plan || 'Gratuito'}</p>
                  </div>
                  <div className={`${ADMIN_MUTED_SURFACE_CLASS} p-4 md:col-span-2 xl:col-span-4`}>
                    <div className="grid gap-3 text-sm font-medium text-slate-600 dark:text-slate-300 md:grid-cols-2 xl:grid-cols-3">
                      <p>Email: <strong className="text-slate-900 dark:text-slate-100">{profile.email || '-'}</strong></p>
                      <p>Telefone: <strong className="text-slate-900 dark:text-slate-100">{profile.phone || 'Nao informado'}</strong></p>
                      <p>CPF: <strong className="text-slate-900 dark:text-slate-100">{profile.cpf || 'Nao informado'}</strong></p>
                      <p>Concurso alvo: <strong className="text-slate-900 dark:text-slate-100">{profile.target_exam || profile.targetExam || 'Nao informado'}</strong></p>
                      <p>Email confirmado: <strong className="text-slate-900 dark:text-slate-100">{profile.email_verified ? 'Sim' : 'Nao'}</strong></p>
                      <p>Cartao salvo: <strong className="text-slate-900 dark:text-slate-100">{profile.has_saved_card ? 'Sim' : 'Nao'}</strong></p>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className={sectionCardClass}>
                    <div className="mb-4 flex items-center gap-2 border-b border-slate-200 pb-4 dark:border-slate-800">
                      <Shield size={16} className="text-sky-700 dark:text-sky-300" />
                      <h4 className="text-xs font-black uppercase tracking-[0.18em] text-slate-900 dark:text-slate-100">Acessos</h4>
                    </div>
                    <div className="space-y-3 text-sm font-medium text-slate-600 dark:text-slate-300">
                      <div className={`${metricCardClass} flex justify-between gap-3`}><span>Painel admin</span><strong>{['admin', 'staff'].includes(String(profile.role || '')) ? 'Liberado' : 'Nao'}</strong></div>
                      <div className={`${metricCardClass} flex justify-between gap-3`}><span>Parceiro</span><strong>{['admin', 'partner'].includes(String(profile.role || '')) ? 'Liberado' : 'Nao'}</strong></div>
                      <div className={`${metricCardClass} flex justify-between gap-3`}><span>Renovacao</span><strong>{activeSubscription?.auto_renew ? 'Ligada' : 'Desligada'}</strong></div>
                    </div>
                  </div>

                  <div className={sectionCardClass}>
                    <div className="mb-4 flex items-center gap-2 border-b border-slate-200 pb-4 dark:border-slate-800">
                      <Mail size={16} className="text-sky-700 dark:text-sky-300" />
                      <h4 className="text-xs font-black uppercase tracking-[0.18em] text-slate-900 dark:text-slate-100">Contato rapido</h4>
                    </div>
                    <div className="space-y-2">
                      {profile.email ? (
                        <a href={`mailto:${profile.email}`} className={`${ADMIN_SECONDARY_BUTTON_CLASS} w-full justify-center`}>
                          <Mail size={14} /> Email
                        </a>
                      ) : null}
                      {profile.phone ? (
                        <a
                          href={`https://wa.me/55${String(profile.phone).replace(/\D/g, '')}`}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex w-full items-center justify-center gap-2 rounded-sm border border-emerald-600 bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
                        >
                          <MessageCircle size={14} /> WhatsApp
                        </a>
                      ) : null}
                    </div>
                  </div>
                </div>
              </div>
            ) : null}

            {detailTab === 'subscription' ? (
              <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
                <div className={sectionCardClass}>
                  <div className="mb-5 flex items-center gap-2 border-b border-slate-200 pb-4 dark:border-slate-800">
                    <Crown size={16} className="text-sky-700 dark:text-sky-300" />
                    <h4 className="text-xs font-black uppercase tracking-[0.18em] text-slate-900 dark:text-slate-100">Assinatura atual</h4>
                  </div>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className={metricCardClass}>
                      <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Plano</p>
                      <p className="mt-2 text-lg font-black text-sky-700 dark:text-sky-300">{activeSubscription?.plan_name || 'Gratuito'}</p>
                    </div>
                    <div className={metricCardClass}>
                      <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Fim do ciclo</p>
                      <p className="mt-2 text-lg font-black text-slate-900 dark:text-slate-100">{formatDate(activeSubscription?.current_period_end)}</p>
                    </div>
                  </div>

                  <div className="mt-5 grid gap-4 md:grid-cols-2">
                    <div className={`${ADMIN_MUTED_SURFACE_CLASS} space-y-2 p-4`}>
                      <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Ajustar dias de cortesia</p>
                      <AdminFormField label="Dias de compensação" controlId="admin-editor-compensation-days" required><input id="admin-editor-compensation-days" type="number" value={daysToAdd} onChange={(event) => setDaysToAdd(event.target.value)} className={`${ADMIN_FIELD_CLASS} w-full`} /></AdminFormField>
                      <AdminFormField label="Ticket ou referência" controlId="admin-editor-compensation-ticket" required><input id="admin-editor-compensation-ticket" type="text" value={compensationTicket} onChange={(event) => setCompensationTicket(event.target.value)} className={`${ADMIN_FIELD_CLASS} w-full`} placeholder="Ex.: SUP-2026-001" /></AdminFormField>
                      <AdminFormField label="Motivo" controlId="admin-editor-compensation-reason" required><textarea id="admin-editor-compensation-reason" value={compensationReason} onChange={(event) => setCompensationReason(event.target.value)} className={`${ADMIN_FIELD_CLASS} min-h-20 w-full`} placeholder="Descreva a compensação" /></AdminFormField>
                      <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                        Use valor positivo para adicionar e negativo para remover dias de uma cortesia.
                      </p>
                      <button type="button" onClick={openAddDaysConfirm} disabled={!activeSubscription || actionLoading === 'add_days' || !onUserAction || !compensationTicket.trim() || !compensationReason.trim()} className={`${ADMIN_PRIMARY_BUTTON_CLASS} w-full justify-center`}>
                        <PlusCircle size={14} /> {actionLoading === 'add_days' ? 'Aplicando...' : 'Aplicar ajuste'}
                      </button>
                    </div>
                    <div className={`${ADMIN_MUTED_SURFACE_CLASS} space-y-2 p-4`}>
                      <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Upgrade manual</p>
                      <select value={selectedPlanId} onChange={(event) => setSelectedPlanIdOverride(event.target.value)} className={`${ADMIN_FIELD_CLASS} w-full`}>
                        <option value="">Selecione um plano</option>
                        {availablePlans.map((plan) => <option key={plan.id} value={plan.id}>{plan.name} - {formatCurrency(plan.price)}</option>)}
                      </select>
                      <p className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">Use a mesma referência e motivo para manter a operação idempotente.</p>
                      <button type="button" onClick={openUpgradeConfirm} disabled={!selectedPlanId || actionLoading === 'upgrade_plan' || !onUserAction || !compensationTicket.trim() || !compensationReason.trim()} className="inline-flex w-full items-center justify-center gap-2 rounded-sm border border-emerald-600 bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60">
                        <ArrowUpCircle size={14} /> {actionLoading === 'upgrade_plan' ? 'Aplicando...' : 'Confirmar upgrade'}
                      </button>
                    </div>
                  </div>
                </div>

                <div className={sectionCardClass}>
                  <div className="mb-5 flex items-center gap-2 border-b border-slate-200 pb-4 dark:border-slate-800">
                    <Clock size={16} className="text-sky-700 dark:text-sky-300" />
                    <h4 className="text-xs font-black uppercase tracking-[0.18em] text-slate-900 dark:text-slate-100">Historico de assinaturas</h4>
                  </div>
                  <div className="max-h-[420px] space-y-3 overflow-y-auto pr-1">
                    {subscriptions.length ? subscriptions.map((subscription) => (
                      <div key={subscription.id} className="rounded-sm border border-slate-300 p-4 dark:border-slate-700">
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <p className="text-sm font-black text-slate-900 dark:text-slate-100">{subscription.plan_name}</p>
                            <p className="mt-1 text-[11px] font-medium text-slate-500 dark:text-slate-400">{formatDate(subscription.current_period_start)} ate {formatDate(subscription.current_period_end)}</p>
                          </div>
                          <span className={`rounded-sm px-2.5 py-1 text-[10px] font-black uppercase tracking-widest ${getTransactionStatusClass(subscription.status)}`}>{subscription.status}</span>
                        </div>
                      </div>
                    )) : <p className="text-sm italic text-slate-400 dark:text-slate-500">Nenhuma assinatura encontrada.</p>}
                  </div>
                </div>
              </div>
            ) : null}

            {detailTab === 'transactions' ? (
              <div className={sectionCardClass}>
                <div className="mb-5 flex items-center justify-between gap-4 border-b border-slate-200 pb-4 dark:border-slate-800">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Financeiro</p>
                    <h4 className="mt-2 flex items-center gap-2 text-lg font-black text-slate-900 dark:text-slate-100"><DollarSign size={18} className="text-sky-700 dark:text-sky-300" /> Historico financeiro</h4>
                  </div>
                  <span className="rounded-sm bg-slate-100 px-3 py-2 text-[11px] font-medium text-slate-500 dark:bg-slate-950 dark:text-slate-400">{transactions.length} registros</span>
                </div>
                {transactions.length ? (
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[780px] text-left text-xs">
                      <thead className="bg-slate-100 text-slate-500 dark:bg-slate-950 dark:text-slate-500">
                        <tr>
                          <th className="p-4 text-[10px] font-black uppercase tracking-widest">Data</th>
                          <th className="p-4 text-[10px] font-black uppercase tracking-widest">Tipo</th>
                          <th className="p-4 text-[10px] font-black uppercase tracking-widest">Valor</th>
                          <th className="p-4 text-[10px] font-black uppercase tracking-widest">Status</th>
                          <th className="p-4 text-center text-[10px] font-black uppercase tracking-widest">Acoes</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                        {transactions.map((transaction) => {
                          const canRefund = ['approved', 'completed', 'paid'].includes(String(transaction.status || '').toLowerCase()) && Number(transaction.amount || 0) > 0;
                          const actionKey = `refund_transaction:${transaction.id}`;

                          return (
                            <tr key={transaction.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                              <td className="p-4 font-mono text-[11px] text-slate-500 dark:text-slate-400">{formatDateTime(transaction.created_at)}</td>
                              <td className="p-4 font-bold text-slate-900 dark:text-slate-100">{transaction.type === 'plan' ? 'Assinatura' : transaction.type === 'material_purchase' ? 'Compra de material' : 'Venda de material'}</td>
                              <td className="p-4 text-sm font-black text-slate-900 dark:text-slate-100">{formatCurrency(transaction.amount)}</td>
                              <td className="p-4"><span className={`rounded-sm px-2.5 py-1 text-[10px] font-black uppercase tracking-widest ${getTransactionStatusClass(transaction.status)}`}>{transaction.status}</span></td>
                              <td className="p-4 text-center">
                                {canRefund ? (
                                  <button type="button" onClick={() => openRefundConfirm(transaction)} disabled={actionLoading === actionKey || !onUserAction} className="inline-flex items-center gap-2 rounded-sm border border-rose-300 bg-rose-50 px-3 py-2 text-[10px] font-black uppercase tracking-widest text-rose-700 hover:bg-rose-100 disabled:opacity-60 dark:border-rose-900/30 dark:bg-rose-900/20 dark:text-rose-300">
                                    <RefreshCcw size={12} /> {actionLoading === actionKey ? 'Estornando...' : 'Estornar'}
                                  </button>
                                ) : (
                                  <span className="rounded-sm bg-slate-100 px-3 py-2 text-[10px] font-black uppercase tracking-widest text-slate-400 dark:bg-slate-800 dark:text-slate-500">Sem acao</span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                ) : <p className="py-8 text-center text-sm italic text-slate-400 dark:text-slate-500">Nenhuma transacao registrada.</p>}
              </div>
            ) : null}

            {detailTab === 'comments' ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between gap-4">
                  <h4 className="flex items-center gap-2 text-lg font-black text-slate-900 dark:text-slate-100"><MessageSquare size={18} className="text-sky-700 dark:text-sky-300" /> Comentarios recentes</h4>
                  <span className="rounded-sm border border-sky-200 bg-sky-50 px-4 py-2 text-[10px] font-black uppercase tracking-widest text-sky-700 dark:border-sky-900/30 dark:bg-sky-900/20 dark:text-sky-300">Total: {detailedUser?.stats?.comments_count || 0}</span>
                </div>
                {comments.length ? comments.map((comment) => (
                  <div key={comment.id} className={`${ADMIN_SURFACE_CLASS} p-4`}>
                    <div className="mb-3 flex items-start justify-between gap-4">
                      <span className="flex items-center gap-1 text-[10px] font-black uppercase tracking-widest text-slate-400"><Clock size={10} /> {formatDateTime(comment.created_at)}</span>
                      <Link href={publicRoutes.questions.index({ questionId: comment.question_id })} target="_blank" className="rounded-sm bg-slate-100 px-3 py-1.5 text-[10px] font-black uppercase tracking-widest text-slate-500 hover:bg-sky-50 hover:text-sky-700 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-sky-900/20 dark:hover:text-sky-300">Questao {comment.question_id}</Link>
                    </div>
                    <p className="border-l-2 border-slate-200 pl-4 text-sm font-medium leading-relaxed text-slate-700 dark:border-slate-700 dark:text-slate-300">&quot;{comment.comment}&quot;</p>
                  </div>
                )) : <div className="rounded-sm border border-dashed border-slate-300 bg-slate-50 py-12 text-center dark:border-slate-700 dark:bg-slate-900"><p className="text-xs font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500">Nenhum comentario encontrado</p></div>}
              </div>
            ) : null}

            {detailTab === 'materials' ? (
              <div className={sectionCardClass}>
                <div className="mb-5 flex items-center justify-between gap-4 border-b border-slate-200 pb-4 dark:border-slate-800">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Marketplace</p>
                    <h4 className="mt-2 flex items-center gap-2 text-lg font-black text-slate-900 dark:text-slate-100"><ShoppingBag size={18} className="text-sky-700 dark:text-sky-300" /> Materiais vinculados</h4>
                  </div>
                  <span className="rounded-sm bg-slate-100 px-3 py-2 text-[11px] font-medium text-slate-500 dark:bg-slate-950 dark:text-slate-400">{materials.length} materiais</span>
                </div>
                {materials.length ? (
                  <div className="grid gap-3 md:grid-cols-2">
                    {materials.map((material) => (
                      <div key={material.id} className={`${ADMIN_MUTED_SURFACE_CLASS} p-4`}>
                        <p className="text-sm font-black text-slate-900 dark:text-slate-100">{material.title || material.name || `Material ${material.id}`}</p>
                        <p className="mt-1 text-xs font-medium text-slate-500 dark:text-slate-400">{material.status || 'Sem status'} - {formatCurrency(material.price)}</p>
                      </div>
                    ))}
                  </div>
                ) : <p className="py-8 text-center text-sm italic text-slate-400 dark:text-slate-500">Nenhum material vinculado a este usuario.</p>}
              </div>
            ) : null}
          </div>
        </section>
      ) : null}

      <AdminConfirmDialog
        isOpen={Boolean(confirmState)}
        title={confirmState?.title || ''}
        description={confirmState?.description || ''}
        confirmLabel={confirmState?.confirmLabel || 'Confirmar'}
        cancelLabel="Cancelar"
        tone={confirmState?.tone || 'primary'}
        loading={actionLoading === confirmState?.actionKey}
        onConfirm={confirmAction}
        onCancel={() => setConfirmState(null)}
      />
    </div>
  );
};

export default AdminUserEditorPage;

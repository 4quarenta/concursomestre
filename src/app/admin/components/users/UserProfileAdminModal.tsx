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
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { ArrowUpCircle, Clock, Crown, DollarSign, Loader2, Mail, MessageCircle, MessageSquare, PlusCircle, RefreshCcw, Shield, User, X } from 'lucide-react';
import { getAssetUrl } from '@services/api';
import AdminConfirmDialog from '../ui/AdminConfirmDialog';
import { ADMIN_USER_ROLE_OPTIONS, ADMIN_USER_STATUS_OPTIONS, getAdminUserRoleBadgeClass, getAdminUserRoleLabel, getAdminUserStatusBadgeClass, getAdminUserStatusLabel } from './userAdminOptions';
import {
  ADMIN_FIELD_CLASS,
  ADMIN_MODAL_HEADER_CLASS,
  ADMIN_MODAL_PANEL_CLASS,
  ADMIN_MUTED_SURFACE_CLASS,
  ADMIN_PRIMARY_BUTTON_CLASS,
  ADMIN_SECONDARY_BUTTON_CLASS,
  ADMIN_SURFACE_CLASS,
} from '../shared/adminPanelStyles';

type DetailTab = 'overview' | 'subscription' | 'transactions' | 'comments';
type ConfirmState = null | {
  action: string;
  actionKey: string;
  title: string;
  description: string;
  confirmLabel: string;
  tone: 'primary' | 'danger';
  payload: Record<string, any>;
};

interface UserProfileAdminModalProps {
  viewingProfileId: string;
  detailedUser: any;
  isLoadingDetail: boolean;
  detailTab: DetailTab;
  onDetailTabChange: (tab: DetailTab) => void;
  isEditingUser: boolean;
  editUserForm: any;
  onEditUserFormChange: (next: any) => void;
  onStartEditingUser: () => void;
  onCancelEditingUser: () => void;
  onUserAction: (action: string, data: any, options?: { actionKey?: string; successMessage?: string }) => Promise<any>;
  actionLoading: string | null;
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

const formatCurrency = (value?: string | number | null) => Number(value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

const getTransactionStatusClass = (status: string | null | undefined) => {
  switch (String(status || '').toLowerCase()) {
    case 'approved':
    case 'completed':
      return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300';
    case 'refunded':
      return 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300';
    case 'refund_requested':
      return 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300';
    default:
      return 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300';
  }
};

const sectionCardClass = `${ADMIN_SURFACE_CLASS} p-5`;
const metricCardClass = `${ADMIN_MUTED_SURFACE_CLASS} p-4`;

const UserProfileAdminModal = ({
  viewingProfileId,
  detailedUser,
  isLoadingDetail,
  detailTab,
  onDetailTabChange,
  isEditingUser,
  editUserForm,
  onEditUserFormChange,
  onStartEditingUser,
  onCancelEditingUser,
  onUserAction,
  actionLoading,
  onClose,
}: UserProfileAdminModalProps) => {
  const activeSubscription = detailedUser?.subscriptions?.find((subscription: any) => String(subscription.status || '').toLowerCase() === 'active') || null;
  const subscriptions = detailedUser?.subscriptions ?? [];
  const transactions = detailedUser?.transactions ?? [];
  const comments = detailedUser?.last_comments ?? [];
  const availablePlans = (detailedUser?.available_plans ?? []).filter((plan: any) => Number(plan?.active ?? 1) !== 0);
  const [daysToAdd, setDaysToAdd] = React.useState('30');
  const [selectedPlanId, setSelectedPlanId] = React.useState('');
  const [confirmState, setConfirmState] = React.useState<ConfirmState>(null);

  React.useEffect(() => {
    if (!availablePlans.length) {
      setSelectedPlanId('');
      return;
    }

    setSelectedPlanId((current) => {
      if (current && availablePlans.some((plan: any) => String(plan.id) === current)) {
        return current;
      }
      const fallbackPlan = availablePlans.find((plan: any) => String(plan.id) !== String(activeSubscription?.plan_id));
      return String((fallbackPlan || availablePlans[0]).id);
    });
  }, [availablePlans, activeSubscription?.plan_id]);

  const saveProfile = async () => {
    await onUserAction('update_profile', {
      ...editUserForm,
      reputation: Math.max(0, Math.min(100, Number(editUserForm.reputation || 0))),
    }, {
      actionKey: 'update_profile',
    });
  };

  const openAddDaysConfirm = () => {
    const days = Number(daysToAdd || 0);
    if (!Number.isFinite(days) || days <= 0) return;
    setConfirmState({
      action: 'add_days',
      actionKey: 'add_days',
      title: 'Adicionar dias',
      description: `O periodo ativo sera estendido em ${days} dias.`,
      confirmLabel: 'Aplicar dias',
      tone: 'primary',
      payload: { days },
    });
  };

  const openUpgradeConfirm = () => {
    if (!selectedPlanId) return;
    const plan = availablePlans.find((item: any) => String(item.id) === selectedPlanId);
    setConfirmState({
      action: 'upgrade_plan',
      actionKey: 'upgrade_plan',
      title: 'Aplicar upgrade manual',
      description: `O usuario sera movido para o plano "${plan?.name || 'selecionado'}".`,
      confirmLabel: 'Aplicar upgrade',
      tone: 'primary',
      payload: { plan_id: Number(selectedPlanId) },
    });
  };

  const openRefundConfirm = (transaction: any) => {
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
    if (!confirmState) return;
    try {
      await onUserAction(confirmState.action, confirmState.payload, { actionKey: confirmState.actionKey });
      setConfirmState(null);
    } catch {
      // o hook ja tratou o erro
    }
  };

  const renderOverview = () => (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.2fr_1fr]">
      <div className={sectionCardClass}>
        <div className="mb-5 flex items-start justify-between gap-4 border-b border-slate-100 pb-4 dark:border-slate-800">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">Conta</p>
            <h4 className="mt-2 text-lg font-black text-slate-900 dark:text-slate-100">Cadastro, permissao e status</h4>
          </div>
          {!isEditingUser && <button type="button" onClick={onStartEditingUser} className={ADMIN_PRIMARY_BUTTON_CLASS}>Editar</button>}
        </div>

        {isEditingUser ? (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <input type="text" value={editUserForm.name} onChange={(event) => onEditUserFormChange({ ...editUserForm, name: event.target.value })} placeholder="Nome" className={ADMIN_FIELD_CLASS} />
            <input type="email" value={editUserForm.email} onChange={(event) => onEditUserFormChange({ ...editUserForm, email: event.target.value })} placeholder="Email" className={ADMIN_FIELD_CLASS} />
            <input type="text" value={editUserForm.cpf} onChange={(event) => onEditUserFormChange({ ...editUserForm, cpf: event.target.value })} placeholder="CPF" className={ADMIN_FIELD_CLASS} />
            <input type="text" value={editUserForm.phone} onChange={(event) => onEditUserFormChange({ ...editUserForm, phone: event.target.value })} placeholder="Telefone" className={ADMIN_FIELD_CLASS} />
            <input type="text" value={editUserForm.targetExam} onChange={(event) => onEditUserFormChange({ ...editUserForm, targetExam: event.target.value })} placeholder="Concurso alvo" className={`${ADMIN_FIELD_CLASS} md:col-span-2`} />
            <select value={editUserForm.role} onChange={(event) => onEditUserFormChange({ ...editUserForm, role: event.target.value })} className={ADMIN_FIELD_CLASS}>
              {ADMIN_USER_ROLE_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
            <select value={editUserForm.status} onChange={(event) => onEditUserFormChange({ ...editUserForm, status: event.target.value })} className={ADMIN_FIELD_CLASS}>
              {ADMIN_USER_STATUS_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
            <input type="number" min={0} max={100} value={editUserForm.reputation} onChange={(event) => onEditUserFormChange({ ...editUserForm, reputation: event.target.value })} placeholder="Reputacao" className={ADMIN_FIELD_CLASS} />
            <div className="md:col-span-2 flex gap-3">
              <button type="button" onClick={onCancelEditingUser} className={`flex-1 justify-center ${ADMIN_SECONDARY_BUTTON_CLASS}`}>Cancelar</button>
              <button type="button" onClick={saveProfile} disabled={actionLoading === 'update_profile'} className={`flex-1 justify-center ${ADMIN_PRIMARY_BUTTON_CLASS}`}>{actionLoading === 'update_profile' ? 'Salvando...' : 'Salvar alteracoes'}</button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <div className={metricCardClass}><p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Tipo</p><p className="mt-2 text-lg font-black text-slate-900 dark:text-slate-100">{getAdminUserRoleLabel(detailedUser?.profile?.role)}</p></div>
            <div className={metricCardClass}><p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Status</p><p className="mt-2 text-lg font-black text-slate-900 dark:text-slate-100">{getAdminUserStatusLabel(detailedUser?.profile?.status)}</p></div>
            <div className={metricCardClass}><p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Reputacao</p><p className="mt-2 text-lg font-black text-slate-900 dark:text-slate-100">{Number(detailedUser?.profile?.reputation ?? 0)}/100</p></div>
            <div className={metricCardClass}><p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Plano atual</p><p className="mt-2 text-lg font-black text-sky-700 dark:text-sky-300">{activeSubscription?.plan_name || 'Gratuito'}</p></div>
            <div className={`${ADMIN_MUTED_SURFACE_CLASS} p-4 md:col-span-2`}>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2 text-sm font-medium text-slate-600 dark:text-slate-300">
                <p>Email: {detailedUser?.profile?.email}</p>
                <p>Telefone: {detailedUser?.profile?.phone || 'Nao informado'}</p>
                <p>CPF: {detailedUser?.profile?.cpf || 'Nao informado'}</p>
                <p>Concurso alvo: {detailedUser?.profile?.target_exam || 'Nao informado'}</p>
                <p>Email confirmado: {detailedUser?.profile?.email_verified ? 'Sim' : 'Nao'}</p>
                <p>Cartao salvo: {detailedUser?.profile?.has_saved_card ? 'Sim' : 'Nao'}</p>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="space-y-6">
        <div className={sectionCardClass}>
          <div className="mb-4 flex items-center gap-2 border-b border-slate-100 pb-4 dark:border-slate-800"><Shield size={16} className="text-indigo-500" /><h4 className="text-xs font-black uppercase tracking-[0.18em] text-slate-900 dark:text-slate-100">Acessos</h4></div>
          <div className="space-y-3 text-sm font-medium text-slate-600 dark:text-slate-300">
            <div className={`${metricCardClass} flex justify-between`}><span>Painel admin</span><strong>{['admin', 'staff'].includes(String(detailedUser?.profile?.role || '')) ? 'Liberado' : 'Nao'}</strong></div>
            <div className={`${metricCardClass} flex justify-between`}><span>Parceiro</span><strong>{['admin', 'partner'].includes(String(detailedUser?.profile?.role || '')) ? 'Liberado' : 'Nao'}</strong></div>
            <div className={`${metricCardClass} flex justify-between`}><span>Auto renew</span><strong>{activeSubscription?.auto_renew ? 'Ligado' : 'Desligado'}</strong></div>
          </div>
        </div>

        <div className={sectionCardClass}>
          <div className="mb-4 flex items-center gap-2 border-b border-slate-100 pb-4 dark:border-slate-800"><Mail size={16} className="text-indigo-500" /><h4 className="text-xs font-black uppercase tracking-[0.18em] text-slate-900 dark:text-slate-100">Contato rapido</h4></div>
          <div className="space-y-3">
            <a href={`mailto:${detailedUser?.profile?.email || ''}`} className={`justify-center ${ADMIN_SECONDARY_BUTTON_CLASS}`}><Mail size={14} /> Email</a>
            {detailedUser?.profile?.phone ? <a href={`https://wa.me/55${String(detailedUser.profile.phone).replace(/\D/g, '')}`} target="_blank" rel="noreferrer" className="inline-flex items-center justify-center gap-2 rounded-sm border border-emerald-600 bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700"><MessageCircle size={14} /> WhatsApp</a> : null}
          </div>
        </div>
      </div>
    </div>
  );

  const renderSubscription = () => (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-[1.1fr_1fr]">
      <div className={sectionCardClass}>
        <div className="mb-5 flex items-center gap-2 border-b border-slate-100 pb-4 dark:border-slate-800"><Crown size={16} className="text-indigo-500" /><h4 className="text-xs font-black uppercase tracking-[0.18em] text-slate-900 dark:text-slate-100">Assinatura atual</h4></div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className={metricCardClass}><p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Plano</p><p className="mt-2 text-lg font-black text-sky-700 dark:text-sky-300">{activeSubscription?.plan_name || 'Gratuito'}</p></div>
          <div className={metricCardClass}><p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Fim do ciclo</p><p className="mt-2 text-lg font-black text-slate-900 dark:text-slate-100">{formatDate(activeSubscription?.current_period_end)}</p></div>
        </div>
        <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-2">
          <div className={`${ADMIN_MUTED_SURFACE_CLASS} space-y-2 p-4`}>
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Adicionar dias</p>
            <input type="number" min={1} value={daysToAdd} onChange={(event) => setDaysToAdd(event.target.value)} className={ADMIN_FIELD_CLASS} />
            <button type="button" onClick={openAddDaysConfirm} disabled={!activeSubscription || actionLoading === 'add_days'} className={`w-full justify-center ${ADMIN_PRIMARY_BUTTON_CLASS}`}><PlusCircle size={14} /> {actionLoading === 'add_days' ? 'Aplicando...' : 'Aplicar dias'}</button>
          </div>
          <div className={`${ADMIN_MUTED_SURFACE_CLASS} space-y-2 p-4`}>
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Upgrade manual</p>
            <select value={selectedPlanId} onChange={(event) => setSelectedPlanId(event.target.value)} className={ADMIN_FIELD_CLASS}>
              <option value="">Selecione um plano</option>
              {availablePlans.map((plan: any) => <option key={plan.id} value={plan.id}>{plan.name} - {formatCurrency(plan.price)}</option>)}
            </select>
            <button type="button" onClick={openUpgradeConfirm} disabled={!selectedPlanId || actionLoading === 'upgrade_plan'} className="inline-flex w-full items-center justify-center gap-2 rounded-sm border border-emerald-600 bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"><ArrowUpCircle size={14} /> {actionLoading === 'upgrade_plan' ? 'Aplicando...' : 'Confirmar upgrade'}</button>
          </div>
        </div>
      </div>

      <div className={sectionCardClass}>
        <div className="mb-5 flex items-center gap-2 border-b border-slate-100 pb-4 dark:border-slate-800"><Clock size={16} className="text-indigo-500" /><h4 className="text-xs font-black uppercase tracking-[0.18em] text-slate-900 dark:text-slate-100">Historico de assinaturas</h4></div>
        <div className="max-h-[420px] space-y-3 overflow-y-auto pr-1">
          {subscriptions.length ? subscriptions.map((subscription: any) => (
            <div key={subscription.id} className="rounded-2xl border border-slate-200 p-4 dark:border-slate-700">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-black text-slate-900 dark:text-slate-100">{subscription.plan_name}</p>
                  <p className="mt-1 text-[11px] font-medium text-slate-500 dark:text-slate-400">{formatDate(subscription.current_period_start)} ate {formatDate(subscription.current_period_end)}</p>
                </div>
                <span className={`rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-widest ${getTransactionStatusClass(subscription.status)}`}>{subscription.status}</span>
              </div>
            </div>
          )) : <p className="text-sm italic text-slate-400 dark:text-slate-500">Nenhuma assinatura encontrada.</p>}
        </div>
      </div>
    </div>
  );

  const renderTransactions = () => (
    <div className={sectionCardClass}>
      <div className="mb-5 flex items-center justify-between gap-4 border-b border-slate-100 pb-4 dark:border-slate-800">
        <div><p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Financeiro</p><h4 className="mt-2 flex items-center gap-2 text-lg font-black text-slate-900 dark:text-slate-100"><DollarSign size={18} className="text-indigo-500" /> Historico financeiro</h4></div>
        <span className="rounded-sm bg-slate-100 px-3 py-2 text-[11px] font-medium text-slate-500 dark:bg-slate-950 dark:text-slate-400">{transactions.length} registros</span>
      </div>
      {transactions.length ? (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[780px] text-left text-xs">
            <thead className="bg-slate-100 text-slate-500 dark:bg-slate-950 dark:text-slate-500"><tr><th className="p-4 text-[10px] font-black uppercase tracking-widest">Data</th><th className="p-4 text-[10px] font-black uppercase tracking-widest">Tipo</th><th className="p-4 text-[10px] font-black uppercase tracking-widest">Valor</th><th className="p-4 text-[10px] font-black uppercase tracking-widest">Status</th><th className="p-4 text-center text-[10px] font-black uppercase tracking-widest">Acoes</th></tr></thead>
            <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
              {transactions.map((transaction: any) => {
                const canRefund = ['approved', 'completed'].includes(String(transaction.status || '').toLowerCase()) && Number(transaction.amount || 0) > 0;
                const actionKey = `refund_transaction:${transaction.id}`;
                return (
                  <tr key={transaction.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                    <td className="p-4 font-mono text-[11px] text-slate-500 dark:text-slate-400">{formatDateTime(transaction.created_at)}</td>
                    <td className="p-4 font-bold text-slate-900 dark:text-slate-100">{transaction.type === 'plan' ? 'Assinatura' : transaction.type === 'material_purchase' ? 'Compra de material' : 'Venda de material'}</td>
                    <td className="p-4 text-sm font-black text-slate-900 dark:text-slate-100">{formatCurrency(transaction.amount)}</td>
                    <td className="p-4"><span className={`rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-widest ${getTransactionStatusClass(transaction.status)}`}>{transaction.status}</span></td>
                    <td className="p-4 text-center">{canRefund ? <button type="button" onClick={() => openRefundConfirm(transaction)} disabled={actionLoading === actionKey} className="inline-flex items-center gap-2 rounded-sm border border-rose-300 bg-rose-50 px-3 py-2 text-[10px] font-black uppercase tracking-widest text-rose-700 hover:bg-rose-100 disabled:opacity-60 dark:border-rose-900/30 dark:bg-rose-900/20 dark:text-rose-300"><RefreshCcw size={12} /> {actionLoading === actionKey ? 'Estornando...' : 'Estornar'}</button> : <span className="rounded-sm bg-slate-100 px-3 py-2 text-[10px] font-black uppercase tracking-widest text-slate-400 dark:bg-slate-800 dark:text-slate-500">Sem acao</span>}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : <p className="py-8 text-center text-sm italic text-slate-400 dark:text-slate-500">Nenhuma transacao registrada.</p>}
    </div>
  );

  const renderComments = () => (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <h4 className="flex items-center gap-2 text-lg font-black text-slate-900 dark:text-slate-100"><MessageSquare size={18} className="text-indigo-500" /> Comentarios recentes</h4>
        <span className="rounded-sm border border-sky-200 bg-sky-50 px-4 py-2 text-[10px] font-black uppercase tracking-widest text-sky-700 dark:border-sky-900/30 dark:bg-sky-900/20 dark:text-sky-300">Total: {detailedUser?.stats?.comments_count || 0}</span>
      </div>
      {comments.length ? comments.map((comment: any) => (
        <div key={comment.id} className={`${ADMIN_SURFACE_CLASS} p-4`}>
          <div className="mb-3 flex items-start justify-between gap-4">
            <span className="flex items-center gap-1 text-[10px] font-black uppercase tracking-widest text-slate-400"><Clock size={10} /> {formatDateTime(comment.created_at)}</span>
            <Link href="/practice" target="_blank" className="rounded-sm bg-slate-100 px-3 py-1.5 text-[10px] font-black uppercase tracking-widest text-slate-500 hover:bg-sky-50 hover:text-sky-700 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-sky-900/20 dark:hover:text-sky-300">Questao {comment.question_id}</Link>
          </div>
          <p className="border-l-2 border-slate-100 pl-4 text-sm font-medium leading-relaxed text-slate-700 dark:border-slate-700 dark:text-slate-300">"{comment.comment}"</p>
        </div>
      )) : <div className="rounded-sm border border-dashed border-slate-300 bg-slate-50 py-12 text-center dark:border-slate-700 dark:bg-slate-900"><p className="text-xs font-bold uppercase tracking-widest text-slate-400 dark:text-slate-500">Nenhum comentario encontrado</p></div>}
    </div>
  );

  return createPortal(
    <>
      <div className="fixed inset-0 z-[9999] flex flex-col overflow-hidden bg-slate-50 p-4 dark:bg-slate-950">
        <div className={`${ADMIN_MODAL_PANEL_CLASS} flex flex-1 flex-col overflow-hidden`}>
          <div className={`${ADMIN_MODAL_HEADER_CLASS} z-10`}>
            <div className="flex items-center gap-6">
              <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-sm bg-sky-50 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300">
                {detailedUser?.profile?.photo_url ? <img src={getAssetUrl(detailedUser.profile.photo_url)} alt="Perfil" className="h-full w-full object-cover" /> : <User size={40} />}
              </div>
              <div>
                <h3 className="text-xl font-bold text-slate-900 dark:text-slate-100">{detailedUser?.profile?.name || 'Carregando...'}</h3>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <span className="rounded-sm bg-slate-100 px-3 py-1 text-[10px] font-semibold uppercase tracking-widest text-slate-500 dark:bg-slate-800 dark:text-slate-400">{detailedUser?.profile?.email || 'Sem email'}</span>
                  <span className={`rounded-sm px-3 py-1 text-[10px] font-semibold uppercase tracking-widest ${getAdminUserRoleBadgeClass(detailedUser?.profile?.role)}`}>{getAdminUserRoleLabel(detailedUser?.profile?.role)}</span>
                  <span className={`rounded-sm px-3 py-1 text-[10px] font-semibold uppercase tracking-widest ${getAdminUserStatusBadgeClass(detailedUser?.profile?.status)}`}>{getAdminUserStatusLabel(detailedUser?.profile?.status)}</span>
                  <span className="rounded-sm bg-sky-50 px-3 py-1 text-[10px] font-semibold uppercase tracking-widest text-sky-700 dark:bg-sky-900/20 dark:text-sky-300">ID: {viewingProfileId}</span>
                </div>
              </div>
            </div>
            <button type="button" onClick={onClose} className="flex h-10 w-10 items-center justify-center rounded-sm bg-slate-100 text-slate-500 hover:bg-rose-50 hover:text-rose-600 dark:bg-slate-800 dark:text-slate-400 dark:hover:bg-rose-900/20 dark:hover:text-rose-300"><X size={20} /></button>
          </div>

          {isLoadingDetail ? (
            <div className="flex flex-1 items-center justify-center"><Loader2 className="animate-spin text-indigo-600" size={48} /></div>
          ) : (
            <div className="flex flex-1 flex-col overflow-hidden bg-slate-50 dark:bg-slate-950">
              <div className="flex gap-2 overflow-x-auto border-b border-slate-300 bg-slate-100 px-5 py-3 dark:border-slate-700 dark:bg-slate-950/50">
                {(['overview', 'subscription', 'transactions', 'comments'] as DetailTab[]).map((tab) => (
                  <button key={tab} type="button" onClick={() => onDetailTabChange(tab)} className={`rounded-sm border px-3 py-2 text-[11px] font-semibold uppercase tracking-widest ${detailTab === tab ? 'border-sky-700 bg-sky-700 text-white' : 'border-slate-300 bg-white text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800'}`}>
                    {tab === 'overview' ? 'Visao geral' : tab === 'subscription' ? 'Assinatura e acesso' : tab === 'transactions' ? 'Financeiro' : `Comentarios (${comments.length})`}
                  </button>
                ))}
              </div>
              <div className="flex-1 overflow-y-auto p-5">
                {detailTab === 'overview' && renderOverview()}
                {detailTab === 'subscription' && renderSubscription()}
                {detailTab === 'transactions' && renderTransactions()}
                {detailTab === 'comments' && renderComments()}
              </div>
            </div>
          )}
        </div>
      </div>

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
    </>,
    document.body,
  );
};

export default UserProfileAdminModal;

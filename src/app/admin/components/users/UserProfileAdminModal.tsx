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
import { Link } from 'react-router-dom';
import {
  Activity,
  ArrowUpCircle,
  Clock,
  Crown,
  DollarSign,
  FileText,
  Link as LinkIcon,
  Loader2,
  Mail,
  MapPin,
  MessageCircle,
  MessageSquare,
  PlusCircle,
  RefreshCcw,
  Settings,
  User,
  X,
} from 'lucide-react';
import { getAssetUrl } from '@services/api';

type DetailTab = 'overview' | 'subscription' | 'transactions' | 'comments';

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
  onUserAction: (action: string, data: any) => void;
  actionLoading: boolean;
  onClose: () => void;
}

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
  const activeSubscription = detailedUser?.subscriptions?.find((subscription: any) => subscription.status === 'active');
  const subscriptions = detailedUser?.subscriptions ?? [];
  const transactions = detailedUser?.transactions ?? [];
  const lastComments = detailedUser?.last_comments ?? [];

  const formatDate = (value?: string | null) => {
    if (!value) return '-';
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? '-' : parsed.toLocaleDateString();
  };

  const formatDateTime = (value?: string | null) => {
    if (!value) return '-';
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? '-' : parsed.toLocaleString();
  };

  const renderOverviewContent = () => {
    if (!detailedUser) return null;

    return (
      <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
        <div className="space-y-4 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-800">
          <h4 className="flex items-center gap-2 border-b border-slate-50 pb-3 text-xs font-black uppercase tracking-widest text-slate-900 dark:border-slate-700/50 dark:text-slate-100">
            <Activity size={14} /> Estatisticas
          </h4>
          <div className="grid grid-cols-2 gap-4">
            <div className="rounded-2xl bg-slate-50 p-3 dark:bg-slate-900/50">
              <p className="text-[10px] font-bold uppercase text-slate-400">Nivel</p>
              <p className="text-xl font-black text-slate-800 dark:text-slate-200">{detailedUser.profile?.level || 0}</p>
            </div>
            <div className="rounded-2xl bg-slate-50 p-3 dark:bg-slate-900/50">
              <p className="text-[10px] font-bold uppercase text-slate-400">XP Total</p>
              <p className="text-xl font-black text-indigo-600 dark:text-indigo-400">{detailedUser.profile?.xp || 0}</p>
            </div>
            <div className="rounded-2xl bg-slate-50 p-3 dark:bg-slate-900/50">
              <p className="text-[10px] font-bold uppercase text-slate-400">Comentários</p>
              <p className="text-xl font-black text-slate-800 dark:text-slate-200">{detailedUser.stats?.comments_count || 0}</p>
            </div>
            <div className="rounded-2xl bg-slate-50 p-3 dark:bg-slate-900/50">
              <p className="text-[10px] font-bold uppercase text-slate-400">Compras</p>
              <p className="text-xl font-black text-emerald-600 dark:text-emerald-400">{detailedUser.materials?.length || 0}</p>
            </div>
          </div>
        </div>

        <div className="space-y-4 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-800">
          <div className="flex items-center justify-between border-b border-slate-50 pb-3 dark:border-slate-700/50">
            <h4 className="font-display flex items-center gap-2 text-xs font-black uppercase tracking-widest text-slate-900 dark:text-slate-100">
              <Settings size={14} /> Dados da Conta
            </h4>
            <button
              type="button"
              onClick={onStartEditingUser}
              className="flex items-center gap-1 text-[10px] font-black uppercase text-indigo-600 transition-colors hover:text-indigo-700 dark:text-indigo-400"
            >
              <Settings size={12} /> Editar
            </button>
          </div>

          {isEditingUser ? (
            <div className="animate-fade-in space-y-3">
              <div>
                <label className="text-[10px] font-black uppercase text-slate-400">Nome</label>
                <input type="text" value={editUserForm.name} onChange={(event) => onEditUserFormChange({ ...editUserForm, name: event.target.value })} className="w-full rounded-lg border border-slate-200 bg-slate-50 p-2 text-xs font-bold dark:border-slate-700 dark:bg-slate-900" />
              </div>
              <div>
                <label className="text-[10px] font-black uppercase text-slate-400">Email</label>
                <input type="email" value={editUserForm.email} onChange={(event) => onEditUserFormChange({ ...editUserForm, email: event.target.value })} className="w-full rounded-lg border border-slate-200 bg-slate-50 p-2 text-xs font-bold dark:border-slate-700 dark:bg-slate-900" />
              </div>
              <div>
                <label className="text-[10px] font-black uppercase text-slate-400">CPF</label>
                <input type="text" value={editUserForm.cpf} onChange={(event) => onEditUserFormChange({ ...editUserForm, cpf: event.target.value })} className="w-full rounded-lg border border-slate-200 bg-slate-50 p-2 text-xs font-bold dark:border-slate-700 dark:bg-slate-900" />
              </div>
              <div>
                <label className="text-[10px] font-black uppercase text-slate-400">Telefone</label>
                <input type="text" value={editUserForm.phone} onChange={(event) => onEditUserFormChange({ ...editUserForm, phone: event.target.value })} className="w-full rounded-lg border border-slate-200 bg-slate-50 p-2 text-xs font-bold dark:border-slate-700 dark:bg-slate-900" />
              </div>
              <div>
                <label className="text-[10px] font-black uppercase text-slate-400">Concurso Alvo</label>
                <input type="text" value={editUserForm.targetExam} onChange={(event) => onEditUserFormChange({ ...editUserForm, targetExam: event.target.value })} className="w-full rounded-lg border border-slate-200 bg-slate-50 p-2 text-xs font-bold dark:border-slate-700 dark:bg-slate-900" />
              </div>
              <div>
                <label className="text-[10px] font-black uppercase text-slate-400">Nivel de Acesso (Cargo)</label>
                <select value={editUserForm.role || 'user'} onChange={(event) => onEditUserFormChange({ ...editUserForm, role: event.target.value })} className="w-full rounded-lg border border-slate-200 bg-slate-50 p-2 text-xs font-bold outline-none focus:border-indigo-500 dark:border-slate-700 dark:bg-slate-900">
                  <option value="user">Usuário Comum</option>
                  <option value="tester">Testador (Acesso Max Vitalicio)</option>
                  <option value="partner">Parceiro (Professor)</option>
                  <option value="admin">Administrador</option>
                </select>
              </div>
              <div className="flex gap-2 pt-2">
                <button type="button" onClick={onCancelEditingUser} className="flex-1 rounded-lg bg-slate-100 py-2 text-[10px] font-black uppercase text-slate-500 dark:bg-slate-700">Cancelar</button>
                <button type="button" onClick={() => onUserAction('update_profile', editUserForm)} disabled={actionLoading} className="flex-1 rounded-lg bg-indigo-600 py-2 text-[10px] font-black uppercase text-white transition-colors hover:bg-indigo-700">Salvar</button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <p className="text-[10px] font-black uppercase text-slate-400 dark:text-slate-500">Membro Desde</p>
                <p className="text-sm font-bold text-slate-700 dark:text-slate-300">{detailedUser.profile?.created_at ? new Date(detailedUser.profile.created_at).toLocaleDateString() : 'N/A'}</p>
              </div>
              <div>
                <p className="text-[10px] font-black uppercase text-slate-400 dark:text-slate-500">Plano Atual</p>
                <p className="text-sm font-bold text-indigo-600 dark:text-indigo-400">{activeSubscription?.plan_name || 'Gratuito'}</p>
              </div>
              <div>
                <p className="text-[10px] font-black uppercase text-slate-400 dark:text-slate-500">CPF</p>
                <p className="text-sm font-bold text-slate-700 dark:text-slate-300">{detailedUser.profile?.cpf || 'Não informado'}</p>
              </div>
              <div>
                <p className="text-[10px] font-black uppercase text-slate-400 dark:text-slate-500">Concurso Alvo</p>
                <p className="text-sm font-bold text-slate-700 dark:text-slate-300">{detailedUser.profile?.target_exam || 'Não informado'}</p>
              </div>
              <div>
                <p className="text-[10px] font-black uppercase text-slate-400 dark:text-slate-500">Resumo de Atividade</p>
                <div className="mt-1 grid grid-cols-2 gap-2">
                  <div className="rounded-lg bg-slate-50 p-2 dark:bg-slate-900/50">
                    <p className="text-[9px] font-bold uppercase text-slate-400">Assinaturas</p>
                    <p className="text-sm font-black text-slate-800 dark:text-slate-200">{detailedUser.subscriptions?.length || 0}</p>
                  </div>
                  <div className="rounded-lg bg-slate-50 p-2 dark:bg-slate-900/50">
                    <p className="text-[9px] font-bold uppercase text-slate-400">Materiais</p>
                    <p className="text-sm font-black text-slate-800 dark:text-slate-200">{detailedUser.materials?.length || 0}</p>
                  </div>
                </div>
              </div>
              <div className="flex flex-col gap-2 pt-2">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">Contato Rapido</p>
                <div className="flex gap-2">
                  <a href={`mailto:${detailedUser.profile?.email}`} className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-slate-100 py-2 text-slate-600 transition-colors hover:bg-slate-200 dark:bg-slate-700 dark:text-slate-300 dark:hover:bg-slate-600">
                    <Mail size={14} /> <span className="text-[10px] font-black uppercase">Email</span>
                  </a>
                  {detailedUser.profile?.phone && (
                    <a href={`https://wa.me/55${detailedUser.profile.phone.replace(/\D/g, '')}`} target="_blank" rel="noreferrer" className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-emerald-50 py-2 text-emerald-600 transition-colors hover:bg-emerald-100 dark:bg-emerald-900/20 dark:text-emerald-400 dark:hover:bg-emerald-900/40">
                      <MessageCircle size={14} /> <span className="text-[10px] font-black uppercase">WhatsApp</span>
                    </a>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="space-y-4 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-800">
          <h4 className="flex items-center gap-2 border-b border-slate-50 pb-3 text-xs font-black uppercase tracking-widest text-slate-900 dark:border-slate-700/50 dark:text-slate-100">
            <MapPin size={14} /> Dados Pessoais
          </h4>
          <div className="space-y-3">
            <div>
              <p className="text-[10px] font-black uppercase text-slate-400">CPF</p>
              <p className="font-mono text-sm font-bold text-slate-800 dark:text-slate-200">{detailedUser.profile?.cpf || '-'}</p>
            </div>
            <div>
              <p className="text-[10px] font-black uppercase text-slate-400">Concurso Alvo</p>
              <p className="text-sm font-bold text-slate-800 dark:text-slate-200">{detailedUser.profile?.target_exam || '-'}</p>
            </div>
            <div>
              <p className="text-[10px] font-black uppercase text-slate-400">Endereco</p>
              {detailedUser.profile?.address ? (
                <div className="space-y-1 text-sm font-medium text-slate-600 dark:text-slate-400">
                  <p>
                    {detailedUser.profile?.address?.street}, {detailedUser.profile?.address?.number}{' '}
                    {detailedUser.profile?.address?.complement ? `- ${detailedUser.profile?.address?.complement}` : ''}
                  </p>
                  <p>{detailedUser.profile?.address?.neighborhood}</p>
                  <p>
                    {detailedUser.profile?.address?.city} - {detailedUser.profile?.address?.state}
                  </p>
                  <p className="font-mono text-xs text-slate-400">{detailedUser.profile?.address?.zipCode}</p>
                </div>
              ) : (
                <p className="text-sm italic text-slate-400">Endereco não cadastrado.</p>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderSubscriptionContent = () => {
    if (!detailedUser) return null;

    return (
      <div className="space-y-6">
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-800">
            <h4 className="mb-6 text-xs font-black uppercase tracking-widest text-slate-900 dark:text-slate-100">Plano Atual</h4>
            <div className="mb-6 flex items-center gap-4">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-indigo-600 text-2xl font-black text-white shadow-lg shadow-indigo-200 dark:shadow-none">
                {activeSubscription?.plan_name?.[0] || 'G'}
              </div>
              <div>
                <h3 className="text-xl font-black text-slate-900 dark:text-slate-100">{activeSubscription?.plan_name || 'Gratuito'}</h3>
                <p className={`text-xs font-bold uppercase ${activeSubscription ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-400'}`}>
                  Status: {activeSubscription?.status || 'Inativo'}
                </p>
              </div>
            </div>

            {activeSubscription?.current_period_end ? (
              <div className="mb-6 rounded-xl border border-slate-100 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-900/50">
                <p className="mb-1 text-[10px] font-black uppercase tracking-widest text-slate-400">Expira em / Renovação</p>
                <p className="font-mono text-lg font-bold text-slate-800 dark:text-slate-200">{formatDate(activeSubscription.current_period_end)}</p>
              </div>
            ) : null}

            <div className="space-y-3">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Ações Rapidas</p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const days = prompt('Quantos dias deseja adicionar?');
                    if (days) onUserAction('add_days', { days });
                  }}
                  className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-indigo-50 py-3 text-xs font-black uppercase text-indigo-600 transition-all hover:bg-indigo-100 dark:bg-indigo-900/20 dark:text-indigo-400 dark:hover:bg-indigo-900/40"
                >
                  <PlusCircle size={14} /> Add Dias
                </button>

                <button
                  type="button"
                  onClick={() => {
                    const planId = prompt('ID do Plano para Upgrade (1=Essencial, 2=Pro, 3=Elite):');
                    if (planId) onUserAction('upgrade_plan', { plan_id: planId });
                  }}
                  className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-emerald-50 py-3 text-xs font-black uppercase text-emerald-600 transition-all hover:bg-emerald-100 dark:bg-emerald-900/20 dark:text-emerald-400 dark:hover:bg-emerald-900/40"
                >
                  <ArrowUpCircle size={14} /> Upgrade
                </button>
              </div>
            </div>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-800">
            <h4 className="mb-4 text-xs font-black uppercase tracking-widest text-slate-900 dark:text-slate-100">Histórico de Assinaturas</h4>
            <div className="no-scrollbar max-h-[300px] space-y-3 overflow-y-auto">
              {subscriptions.length ? (
                subscriptions.map((subscription: any) => (
                  <div key={subscription.id} className="flex items-center justify-between rounded-xl border border-slate-100 p-3 dark:border-slate-700">
                    <div>
                      <p className="text-xs font-bold text-slate-800 dark:text-slate-200">{subscription.plan_name}</p>
                      <p className="text-[10px] text-slate-400">
                        {formatDate(subscription.created_at)} - {formatDate(subscription.current_period_end)}
                      </p>
                    </div>
                    <span className={`rounded px-2 py-0.5 text-[10px] font-black uppercase ${subscription.status === 'active' ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' : 'bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-300'}`}>
                      {subscription.status}
                    </span>
                  </div>
                ))
              ) : (
                <p className="text-xs italic text-slate-400">Sem histórico.</p>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderTransactionsContent = () => {
    if (!detailedUser) return null;

    return (
      <div className="space-y-4 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-800">
        <h4 className="mb-4 flex items-center gap-2 text-xs font-black uppercase tracking-widest text-slate-900 dark:text-slate-100">
          <DollarSign size={14} /> Histórico Financeiro Completo
        </h4>

        {transactions.length ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[760px] text-left text-xs">
              <thead className="bg-slate-50 uppercase font-black text-slate-400 dark:bg-slate-900/50">
                <tr>
                  <th className="rounded-l-xl p-3">Data</th>
                  <th className="p-3">Tipo</th>
                  <th className="p-3">Valor</th>
                  <th className="p-3">Status</th>
                  <th className="rounded-r-xl p-3 text-center">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50 dark:divide-slate-800">
                {transactions.map((transaction: any) => (
                  <tr key={transaction.id} className="transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/50">
                    <td className="p-3 font-mono text-slate-500">{formatDate(transaction.created_at)}</td>
                    <td className="p-3 font-bold text-slate-700 dark:text-slate-300">
                      {transaction.type === 'plan' ? 'Assinatura' : transaction.type === 'material_purchase' ? 'Compra Material' : 'Venda Material'}
                    </td>
                    <td className={`p-3 font-black ${transaction.amount < 0 ? 'text-red-500' : 'text-emerald-600 dark:text-emerald-400'}`}>
                      R$ {Math.abs(Number(transaction.amount || 0)).toFixed(2)}
                    </td>
                    <td className="p-3">
                      <div className="flex items-center gap-2">
                        <span className={`rounded px-2 py-0.5 text-[9px] font-black uppercase ${(transaction.status === 'completed' || transaction.status === 'approved') ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400' : transaction.status === 'refunded' ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400' : 'bg-slate-100 text-slate-500 dark:bg-slate-700 dark:text-slate-300'}`}>
                          {transaction.status}
                        </span>
                        {transaction.type === 'plan' ? (
                          <span className="flex items-center gap-1 rounded bg-indigo-100 px-2 py-0.5 text-[9px] font-black uppercase text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-400">
                            <Crown size={8} /> Assinatura
                          </span>
                        ) : null}
                      </div>
                    </td>
                    <td className="p-3">
                      <div className="flex items-center justify-center gap-2">
                        {(transaction.status === 'completed' || transaction.status === 'approved') && Number(transaction.amount) > 0 ? (
                          <>
                            <button
                              type="button"
                              onClick={() => {
                                if (confirm('Deseja emitir Nota Fiscal para esta transação?')) onUserAction('issue_invoice', { transaction_id: transaction.id });
                              }}
                              disabled={actionLoading}
                              className="rounded-lg border border-slate-100 bg-slate-50 p-1.5 text-slate-400 transition-all hover:bg-emerald-50 hover:text-emerald-600 disabled:opacity-60 dark:border-slate-800 dark:bg-slate-900 dark:hover:bg-emerald-900/20 dark:hover:text-emerald-400"
                              title="Emitir Nota Fiscal"
                            >
                              <FileText size={14} />
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                if (confirm('Tem certeza que deseja estornar esta transação?')) onUserAction('refund_transaction', { transaction_id: transaction.id });
                              }}
                              disabled={actionLoading}
                              className="rounded-lg border border-slate-100 bg-slate-50 p-1.5 text-slate-400 transition-all hover:bg-red-50 hover:text-red-600 disabled:opacity-60 dark:border-slate-800 dark:bg-slate-900 dark:hover:bg-red-900/20 dark:hover:text-red-400"
                              title="Estornar Transação"
                            >
                              <RefreshCcw size={14} />
                            </button>
                          </>
                        ) : null}

                        {transaction.type === 'material_purchase' || transaction.type === 'material_sale' ? (
                          <div className="flex items-center gap-1 rounded border border-blue-100 bg-blue-50 px-2 py-0.5 text-[9px] font-black uppercase text-blue-600 dark:border-blue-800/30 dark:bg-blue-900/20 dark:text-blue-400" title="Transferencia Segura Ativa">
                            <Activity size={10} /> Transfer.
                          </div>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="py-8 text-center italic text-slate-400">Nenhuma transação registrada.</p>
        )}
      </div>
    );
  };

  const renderCommentsContent = () => {
    if (!detailedUser) return null;

    return (
      <div className="animate-fade-in space-y-6">
        <div className="flex items-center justify-between">
          <h4 className="flex items-center gap-2 text-xs font-black uppercase tracking-widest text-slate-900 dark:text-slate-100">
            <MessageSquare size={14} className="text-indigo-500" /> Histórico de Comentários (últimos 50)
          </h4>
          <span className="rounded-lg border border-indigo-100 bg-indigo-50 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-indigo-600 dark:border-indigo-900/30 dark:bg-indigo-900/20 dark:text-indigo-400">
            Total: {detailedUser.stats?.comments_count || 0}
          </span>
        </div>

        {lastComments.length ? (
          <div className="space-y-4">
            {lastComments.map((comment: any) => (
              <div key={comment.id} className="group relative rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition-all hover:border-indigo-200 dark:border-slate-700 dark:bg-slate-800 dark:hover:border-indigo-900">
                <div className="mb-2 flex items-start justify-between gap-4">
                  <span className="flex items-center gap-1 text-[10px] font-black uppercase tracking-widest text-slate-400">
                    <Clock size={10} /> {formatDateTime(comment.created_at)}
                  </span>
                  <Link
                    to={`/questões?q=${comment.question_id}`}
                    target="_blank"
                    className="flex items-center gap-1 rounded-lg bg-slate-50 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-slate-500 transition-all hover:bg-indigo-50 hover:text-indigo-600 dark:bg-slate-900 dark:text-slate-400 dark:hover:bg-indigo-900/20 dark:hover:text-indigo-400"
                  >
                    Q{comment.question_id} <LinkIcon size={10} />
                  </Link>
                </div>
                <p className="border-l-2 border-slate-100 pl-3 text-sm font-medium leading-relaxed text-slate-700 dark:border-slate-700 dark:text-slate-300">
                  "{comment.comment}"
                </p>
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-3xl border border-dashed border-slate-100 bg-slate-50 py-12 text-center dark:border-slate-700 dark:bg-slate-800/50">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-300 dark:bg-slate-800">
              <MessageSquare size={20} />
            </div>
            <p className="text-xs font-bold uppercase tracking-widest text-slate-400">Nenhum comentário encontrado</p>
          </div>
        )}
      </div>
    );
  };

  return createPortal(
    <div className="fixed inset-0 z-[9999] flex flex-col overflow-hidden bg-slate-50 animate-in fade-in slide-in-from-bottom-4 duration-300 dark:bg-slate-950">
      <div className="flex flex-1 flex-col overflow-hidden">
        <div className="z-10 flex items-center justify-between border-b border-slate-100 bg-white p-8 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center gap-6">
            <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-indigo-100 text-indigo-600 shadow-inner dark:bg-indigo-900/30 dark:text-indigo-400">
              {detailedUser?.profile?.photo_url ? (
                <img src={getAssetUrl(detailedUser.profile.photo_url)} alt="Profile" className="h-full w-full rounded-3xl object-cover" />
              ) : (
                <User size={40} />
              )}
            </div>
            <div>
              <h3 className="mb-1 font-display text-3xl font-black tracking-tight text-slate-900 dark:text-slate-100">
                {detailedUser?.profile?.name || 'Carregando...'}
              </h3>
              <div className="flex items-center gap-3">
                <span className="rounded-md bg-slate-100 px-2 py-1 text-xs font-bold uppercase tracking-widest text-slate-400 dark:bg-slate-800 dark:text-slate-500">
                  {detailedUser?.profile?.email}
                </span>
                <span
                  className={`rounded-md px-2 py-1 text-[10px] font-black uppercase tracking-wider ${
                    detailedUser?.profile?.billing?.status === 'active'
                      ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                      : 'bg-slate-100 text-slate-500 dark:bg-slate-800'
                  }`}
                >
                  {detailedUser?.profile?.billing?.status || 'Free'}
                </span>
                <span className="rounded-md bg-indigo-50 px-2 py-1 text-[10px] font-black uppercase text-indigo-500 dark:bg-indigo-900/20">
                  ID: {viewingProfileId}
                </span>
              </div>
            </div>
          </div>
          <button type="button" onClick={onClose} className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-100 text-slate-400 transition-all hover:bg-red-50 hover:text-red-500 dark:bg-slate-800 dark:text-slate-500 dark:hover:bg-red-900/20">
            <X size={24} />
          </button>
        </div>

        {isLoadingDetail ? (
          <div className="flex flex-1 items-center justify-center">
            <Loader2 className="animate-spin text-indigo-600" size={48} />
          </div>
        ) : (
          <div className="flex flex-1 flex-col overflow-hidden bg-slate-50 dark:bg-slate-900">
            <div className="no-scrollbar flex gap-4 overflow-x-auto border-b border-slate-200 px-8 pb-2 pt-6 dark:border-slate-800">
              <button type="button" onClick={() => onDetailTabChange('overview')} className={`border-b-2 px-2 pb-4 text-xs font-black uppercase tracking-widest transition-all ${detailTab === 'overview' ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400' : 'border-transparent text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'}`}>Visao Geral</button>
              <button type="button" onClick={() => onDetailTabChange('subscription')} className={`border-b-2 px-2 pb-4 text-xs font-black uppercase tracking-widest transition-all ${detailTab === 'subscription' ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400' : 'border-transparent text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'}`}>Assinatura & Planos</button>
              <button type="button" onClick={() => onDetailTabChange('transactions')} className={`border-b-2 px-2 pb-4 text-xs font-black uppercase tracking-widest transition-all ${detailTab === 'transactions' ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400' : 'border-transparent text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'}`}>Financeiro</button>
              <button type="button" onClick={() => onDetailTabChange('comments')} className={`border-b-2 px-2 pb-4 text-xs font-black uppercase tracking-widest transition-all ${detailTab === 'comments' ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400' : 'border-transparent text-slate-400 hover:text-slate-600 dark:hover:text-slate-300'}`}>Comentários ({detailedUser?.last_comments?.length || 0})</button>
            </div>

            <div className="no-scrollbar flex-1 overflow-y-auto p-8">
              {detailTab === 'overview' && renderOverviewContent()}
              {detailTab === 'subscription' && renderSubscriptionContent()}
              {detailTab === 'transactions' && renderTransactionsContent()}
              {detailTab === 'comments' && renderCommentsContent()}
            </div>
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
};

export default UserProfileAdminModal;

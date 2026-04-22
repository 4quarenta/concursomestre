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

import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  DollarSign,
  FileQuestion,
  Loader2,
  MessageSquare,
  RefreshCcw,
  ShieldAlert,
  Users,
} from 'lucide-react';
import type { SystemSettings } from '@types';
import { adminService, type AdminFeedbackThread, type AdminStatsPayload } from '@services/admin/adminService';

interface AdminDashboardProps {
  questions: any[];
  allMaterials: any[];
  allTransactions: any[];
  allUsers: any[];
  systemSettings: SystemSettings;
  allReports: any[];
  allRankings: any[];
  onNavigate?: (tab: string, subTab?: string) => void;
}

type DashboardPeriod = 'all' | 'today' | 'week' | 'month' | 'year' | 'custom';

const PERIOD_OPTIONS: { key: DashboardPeriod; label: string }[] = [
  { key: 'all', label: 'Tudo' },
  { key: 'today', label: 'Hoje' },
  { key: 'week', label: '7 dias' },
  { key: 'month', label: '30 dias' },
  { key: 'year', label: 'Ano' },
  { key: 'custom', label: 'Personalizado' },
];

const EMPTY_STATS: AdminStatsPayload = {
  total_revenue: 0,
  available_total_revenue: 0,
  platform_revenue: 0,
  subscription_revenue: 0,
  available_subscription_revenue: 0,
  marketplace_revenue: 0,
  active_subscriptions: 0,
  cancelled_subscriptions: 0,
  expired_subscriptions: 0,
  trial_subscriptions: 0,
  mrr: 0,
  new_users: 0,
  seller_payout: 0,
  available_seller_payout: 0,
  transactions_count: 0,
  refund_requests_count: 0,
  refund_requested_amount: 0,
  total_refunded: 0,
  held_balance: 0,
  total_paid: 0,
  feedback_count: 0,
  questions_count: 0,
  users_count: 0,
  materials_count: 0,
  rankings_count: 0,
  available_platform_revenue: 0,
};

const formatNumber = (value: number) => value.toLocaleString('pt-BR');

const formatCurrency = (value: number) => (
  value.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
  })
);

const getQuestionTitle = (question: any) =>
  question?.enunciado_clean
  || question?.enunciado
  || question?.text
  || 'Questao sem enunciado';

const getQuestionSubject = (question: any) => (
  question?.assuntos?.find?.((assunto: any) => assunto?.materia)?.nome
  || question?.assuntos?.[0]?.nome
  || question?.bancas?.[0]?.sigla
  || 'Sem materia'
);

const getQuestionStatus = (question: any) => {
  if (Number(question?.anulada) === 1 || question?.isCanceled) {
    return { label: 'Anulada', tone: 'rose' as const };
  }

  if (Number(question?.desatualizada) === 1 || question?.isOutdated) {
    return { label: 'Revisao', tone: 'amber' as const };
  }

  if (question?.teacherComment || question?.detailedComment || question?.hasTeacherComment) {
    return { label: 'Publicada', tone: 'emerald' as const };
  }

  return { label: 'Rascunho', tone: 'slate' as const };
};

const getStatusBadgeClassName = (tone: 'emerald' | 'amber' | 'rose' | 'slate' | 'blue') => {
  if (tone === 'emerald') {
    return 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300';
  }

  if (tone === 'amber') {
    return 'bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-300';
  }

  if (tone === 'rose') {
    return 'bg-rose-50 text-rose-700 dark:bg-rose-900/20 dark:text-rose-300';
  }

  if (tone === 'blue') {
    return 'bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-300';
  }

  return 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300';
};

const getThreadStatusMeta = (status: string) => {
  const normalized = String(status || '').toLowerCase();

  if (normalized === 'resolved') {
    return { label: 'Resolvido', tone: 'emerald' as const };
  }

  if (normalized === 'read') {
    return { label: 'Em analise', tone: 'amber' as const };
  }

  return { label: 'Novo', tone: 'blue' as const };
};

const DashboardCard = ({
  title,
  children,
  action,
  className = '',
}: {
  title: string;
  children: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) => (
  <section className={`rounded-lg border border-slate-200 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900 ${className}`}>
    <div className="flex items-center justify-between gap-3 border-b border-slate-100 px-5 py-4 dark:border-slate-800">
      <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">{title}</h3>
      {action}
    </div>
    <div className="p-5">{children}</div>
  </section>
);

const AdminDashboard = ({
  questions,
  allMaterials,
  allTransactions,
  allUsers,
  systemSettings,
  allReports,
  allRankings,
  onNavigate,
}: AdminDashboardProps) => {
  const [selectedPeriod, setSelectedPeriod] = useState<DashboardPeriod>('all');
  const [customStartDate, setCustomStartDate] = useState('');
  const [customEndDate, setCustomEndDate] = useState('');
  const [stats, setStats] = useState<AdminStatsPayload>(EMPTY_STATS);
  const [feedbackThreads, setFeedbackThreads] = useState<AdminFeedbackThread[]>([]);
  const [isStatsLoading, setIsStatsLoading] = useState(false);

  useEffect(() => {
    let isCurrent = true;

    setIsStatsLoading(true);

    adminService.getStats({
      period: selectedPeriod,
      startDate: customStartDate || undefined,
      endDate: customEndDate || undefined,
    })
      .then((payload) => {
        if (isCurrent) {
          setStats(payload);
        }
      })
      .catch(() => {
        if (isCurrent) {
          setStats(EMPTY_STATS);
        }
      })
      .finally(() => {
        if (isCurrent) {
          setIsStatsLoading(false);
        }
      });

    return () => {
      isCurrent = false;
    };
  }, [customEndDate, customStartDate, selectedPeriod]);

  useEffect(() => {
    let isCurrent = true;

    adminService.getFeedbackThreads()
      .then((threads) => {
        if (isCurrent) {
          setFeedbackThreads(Array.isArray(threads) ? threads : []);
        }
      })
      .catch(() => {
        if (isCurrent) {
          setFeedbackThreads([]);
        }
      });

    return () => {
      isCurrent = false;
    };
  }, []);

  const unresolvedReportsCount = useMemo(() => (
    (allReports || []).filter((report: any) => !['resolved', 'ignored'].includes(String(report?.status || '').toLowerCase())).length
  ), [allReports]);
  const activeCouponsCount = Number(systemSettings?.coupons?.length || 0);

  const refundRequestsCount = useMemo(() => (
    (allTransactions || []).filter((transaction: any) => String(transaction?.status || '').toLowerCase() === 'refund_requested').length
  ), [allTransactions]);

  const pendingMaterialsCount = useMemo(() => (
    (allMaterials || []).filter((material: any) => String(material?.status || '').toLowerCase() === 'pending').length
  ), [allMaterials]);

  const recentQuestions = useMemo(() => (
    [...(questions || [])]
      .sort((left: any, right: any) => Number(right?.id || 0) - Number(left?.id || 0))
      .slice(0, 5)
  ), [questions]);

  const recentFeedback = useMemo(() => (
    [...feedbackThreads]
      .sort((left, right) => new Date(right.created_at).getTime() - new Date(left.created_at).getTime())
      .slice(0, 4)
  ), [feedbackThreads]);

  const summaryCards = useMemo(() => ([
    {
      label: 'Questoes publicadas',
      value: formatNumber(stats.questions_count || questions.length || 0),
      helper: `${formatNumber((questions || []).filter((question: any) => question?.teacherComment || question?.hasTeacherComment).length)} com comentario`,
      icon: FileQuestion,
      iconClassName: 'bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-300',
    },
    {
      label: 'Usuarios ativos',
      value: formatNumber(stats.users_count || allUsers.length || 0),
      helper: `${formatNumber(stats.new_users || 0)} novos no periodo`,
      icon: Users,
      iconClassName: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-300',
    },
    {
      label: 'Feedback pendente',
      value: formatNumber(stats.feedback_count || recentFeedback.length || 0),
      helper: `${formatNumber(unresolvedReportsCount)} denuncias abertas`,
      icon: MessageSquare,
      iconClassName: 'bg-amber-50 text-amber-600 dark:bg-amber-900/20 dark:text-amber-300',
    },
    {
      label: 'Receita disponivel',
      value: formatCurrency(stats.available_platform_revenue || stats.platform_revenue || 0),
      helper: `MRR ${formatCurrency(stats.mrr || 0)}`,
      icon: DollarSign,
      iconClassName: 'bg-violet-50 text-violet-600 dark:bg-violet-900/20 dark:text-violet-300',
    },
  ]), [allUsers.length, questions, recentFeedback.length, stats, unresolvedReportsCount]);

  const quickAlerts = useMemo(() => ([
    {
      label: 'Denuncias aguardando moderacao',
      value: unresolvedReportsCount,
      description: 'Itens que ainda exigem decisao da equipe.',
      onClick: () => onNavigate?.('support', 'reports'),
    },
    {
      label: 'Reembolsos pendentes',
      value: refundRequestsCount,
      description: 'Pedidos financeiros aguardando tratamento.',
      onClick: () => onNavigate?.('finance', 'refunds'),
    },
    {
      label: 'Materiais aguardando analise',
      value: pendingMaterialsCount,
      description: 'Fila de marketplace em revisao administrativa.',
      onClick: () => onNavigate?.('operation', 'materials'),
    },
  ]), [onNavigate, pendingMaterialsCount, refundRequestsCount, unresolvedReportsCount]);

  const quickLinks = useMemo(() => ([
    { label: 'Gerenciar questoes', description: 'Banco principal e edicao manual.', onClick: () => onNavigate?.('operation', 'questions') },
    { label: 'Banco de provas', description: 'Cadastros e simulados.', onClick: () => onNavigate?.('operation', 'exams') },
    { label: 'Lei comentada', description: 'Acervo legislativo e conteudo editorial.', onClick: () => onNavigate?.('operation', 'lei-comentada') },
    { label: 'SEO e indexacao', description: 'Ajustes tecnicos e visibilidade.', onClick: () => onNavigate?.('settings', 'seo') },
  ]), [onNavigate]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-slate-200 bg-white p-2 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          {PERIOD_OPTIONS.map((period) => (
            <button
              key={period.key}
              type="button"
              onClick={() => setSelectedPeriod(period.key)}
              className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                selectedPeriod === period.key
                  ? 'bg-blue-600 text-white'
                  : 'text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800'
              }`}
            >
              {period.label}
            </button>
          ))}
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          {selectedPeriod === 'custom' ? (
            <div className="flex flex-wrap items-center gap-2">
              <input
                type="date"
                value={customStartDate}
                onChange={(event) => setCustomStartDate(event.target.value)}
                className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
              />
              <input
                type="date"
                value={customEndDate}
                onChange={(event) => setCustomEndDate(event.target.value)}
                className="h-10 rounded-lg border border-slate-200 bg-white px-3 text-sm text-slate-700 outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
              />
            </div>
          ) : null}

          <button
            type="button"
            onClick={() => onNavigate?.('support', 'reports')}
            className="inline-flex h-10 items-center gap-2 rounded-lg bg-blue-600 px-4 text-sm font-semibold text-white transition-colors hover:bg-blue-700"
          >
            <ShieldAlert size={16} />
            Ver relatorios
          </button>
        </div>
      </div>

      {isStatsLoading ? (
        <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
          <Loader2 size={16} className="animate-spin" />
          Atualizando indicadores do painel...
        </div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {summaryCards.map((card) => (
          <section
            key={card.label}
            className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="text-xs font-black uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">
                  {card.label}
                </p>
                <p className="mt-3 truncate text-3xl font-black tracking-tight text-slate-900 dark:text-slate-100">
                  {card.value}
                </p>
                <p className="mt-2 inline-flex items-center gap-1 text-sm text-emerald-600 dark:text-emerald-300">
                  <ArrowUpRight size={14} />
                  {card.helper}
                </p>
              </div>

              <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-lg ${card.iconClassName}`}>
                <card.icon size={20} />
              </div>
            </div>
          </section>
        ))}
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.65fr)_minmax(320px,0.95fr)]">
        <DashboardCard
          title="Questoes recentes"
          action={(
            <button
              type="button"
              onClick={() => onNavigate?.('operation', 'questions')}
              className="text-sm font-semibold text-blue-600 transition-colors hover:text-blue-700 dark:text-blue-300 dark:hover:text-blue-200"
            >
              Ver todas
            </button>
          )}
        >
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left">
              <thead>
                <tr className="border-b border-slate-100 text-xs font-black uppercase tracking-[0.18em] text-slate-400 dark:border-slate-800 dark:text-slate-500">
                  <th className="pb-3 pr-4">Titulo</th>
                  <th className="pb-3 pr-4">Materia</th>
                  <th className="pb-3 pr-4">Origem</th>
                  <th className="pb-3 text-right">Status</th>
                </tr>
              </thead>
              <tbody>
                {recentQuestions.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="py-8 text-center text-sm text-slate-500 dark:text-slate-400">
                      Nenhuma questao encontrada para compor o painel.
                    </td>
                  </tr>
                ) : recentQuestions.map((question: any) => {
                  const status = getQuestionStatus(question);

                  return (
                    <tr key={question?.id || getQuestionTitle(question)} className="border-b border-slate-100 last:border-b-0 dark:border-slate-800">
                      <td className="py-4 pr-4 align-top">
                        <p className="max-w-xl truncate text-sm font-semibold text-slate-900 dark:text-slate-100">
                          {getQuestionTitle(question)}
                        </p>
                        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">ID #{question?.id || '-'}</p>
                      </td>
                      <td className="py-4 pr-4 text-sm text-slate-600 dark:text-slate-300">
                        {getQuestionSubject(question)}
                      </td>
                      <td className="py-4 pr-4 text-sm text-slate-600 dark:text-slate-300">
                        {question?.provas?.[0]?.nome || question?.bancas?.[0]?.nome || 'Base interna'}
                      </td>
                      <td className="py-4 text-right">
                        <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${getStatusBadgeClassName(status.tone)}`}>
                          {status.label}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </DashboardCard>

        <DashboardCard
          title="Feedback recente"
          action={(
            <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-500 dark:bg-slate-800 dark:text-slate-400">
              {recentFeedback.length} item(ns)
            </span>
          )}
        >
          <div className="space-y-4">
            {recentFeedback.length === 0 ? (
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Ainda nao houve conversas recentes para exibir aqui.
              </p>
            ) : recentFeedback.map((thread) => {
              const status = getThreadStatusMeta(thread.status);

              return (
                <button
                  key={thread.id}
                  type="button"
                  onClick={() => onNavigate?.('support', 'feedback')}
                  className="w-full border-b border-slate-100 pb-4 text-left last:border-b-0 last:pb-0 dark:border-slate-800"
                >
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{thread.user_name || 'Usuario'}</p>
                    <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${getStatusBadgeClassName(status.tone)}`}>
                      {status.label}
                    </span>
                  </div>
                  <p className="mt-1 line-clamp-2 text-sm text-slate-500 dark:text-slate-400">
                    {thread.details || thread.reason || 'Sem detalhes registrados.'}
                  </p>
                  <p className="mt-2 text-xs text-slate-400 dark:text-slate-500">
                    {new Date(thread.created_at).toLocaleDateString('pt-BR')}
                  </p>
                </button>
              );
            })}
          </div>
        </DashboardCard>
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <DashboardCard title="Fluxos que pedem atencao">
          <div className="space-y-3">
            {quickAlerts.map((item) => (
              <button
                key={item.label}
                type="button"
                onClick={item.onClick}
                className="flex w-full items-center justify-between gap-3 rounded-lg border border-slate-200 px-4 py-3 text-left transition-colors hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800/70"
              >
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{item.label}</p>
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{item.description}</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xl font-black text-slate-900 dark:text-slate-100">{item.value}</span>
                  <ArrowRight size={16} className="text-slate-400" />
                </div>
              </button>
            ))}
          </div>
        </DashboardCard>

        <DashboardCard title="Financeiro rapido">
          <div className="space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">Receita total da plataforma</p>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Soma do periodo selecionado.</p>
              </div>
              <span className="text-right text-lg font-black text-slate-900 dark:text-slate-100">
                {formatCurrency(stats.platform_revenue || 0)}
              </span>
            </div>

            <div className="border-t border-slate-100 pt-4 dark:border-slate-800">
              <div className="flex items-center justify-between gap-3 text-sm">
                <span className="text-slate-500 dark:text-slate-400">Saldo retido</span>
                <span className="font-semibold text-slate-900 dark:text-slate-100">{formatCurrency(stats.held_balance || 0)}</span>
              </div>
              <div className="mt-3 flex items-center justify-between gap-3 text-sm">
                <span className="text-slate-500 dark:text-slate-400">Repasses a vendedores</span>
                <span className="font-semibold text-slate-900 dark:text-slate-100">{formatCurrency(stats.available_seller_payout || stats.seller_payout || 0)}</span>
              </div>
              <div className="mt-3 flex items-center justify-between gap-3 text-sm">
                <span className="text-slate-500 dark:text-slate-400">Reembolsos solicitados</span>
                <span className="font-semibold text-slate-900 dark:text-slate-100">{formatCurrency(stats.refund_requested_amount || 0)}</span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => onNavigate?.('finance', 'transactions')}
              className="inline-flex items-center gap-2 text-sm font-semibold text-blue-600 transition-colors hover:text-blue-700 dark:text-blue-300 dark:hover:text-blue-200"
            >
              Abrir financeiro
              <ArrowRight size={16} />
            </button>
          </div>
        </DashboardCard>

        <DashboardCard title="Atalhos do administrador">
          <div className="space-y-3">
            {quickLinks.map((link) => (
              <button
                key={link.label}
                type="button"
                onClick={link.onClick}
                className="flex w-full items-center justify-between gap-3 rounded-lg border border-slate-200 px-4 py-3 text-left transition-colors hover:bg-slate-50 dark:border-slate-800 dark:hover:bg-slate-800/70"
              >
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{link.label}</p>
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{link.description}</p>
                </div>
                <BookOpen size={16} className="shrink-0 text-slate-400" />
              </button>
            ))}
          </div>
        </DashboardCard>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center gap-3">
            <AlertTriangle size={18} className="text-amber-500" />
            <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">Moderacao</p>
          </div>
          <p className="mt-4 text-2xl font-black text-slate-900 dark:text-slate-100">{formatNumber(unresolvedReportsCount)}</p>
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">Denuncias ainda abertas no painel.</p>
        </section>

        <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center gap-3">
            <RefreshCcw size={18} className="text-rose-500" />
            <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">Reembolso</p>
          </div>
          <p className="mt-4 text-2xl font-black text-slate-900 dark:text-slate-100">{formatNumber(refundRequestsCount)}</p>
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">Pedidos financeiros aguardando decisao.</p>
        </section>

        <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center gap-3">
            <FileQuestion size={18} className="text-blue-500" />
            <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">Acervo</p>
          </div>
          <p className="mt-4 text-2xl font-black text-slate-900 dark:text-slate-100">{formatNumber(stats.materials_count || allMaterials.length || 0)}</p>
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">Materiais e ativos cadastrados na plataforma.</p>
        </section>

        <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center gap-3">
            <BookOpen size={18} className="text-emerald-500" />
            <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">Simulados e rankings</p>
          </div>
          <p className="mt-4 text-2xl font-black text-slate-900 dark:text-slate-100">{formatNumber(stats.rankings_count || allRankings.length || 0)}</p>
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
            Estruturas ativas para provas, ranking e desafio. {activeCouponsCount > 0 ? `${activeCouponsCount} cupom(ns) ativo(s).` : ''}
          </p>
        </section>
      </div>
    </div>
  );
};

export default AdminDashboard;

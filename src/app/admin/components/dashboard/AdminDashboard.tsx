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
import {
  adminService,
  type AdminDashboardAnalyticsPayload,
  type AdminFeedbackThread,
  type AdminStatsPayload,
} from '@services/admin/adminService';
import {
  ADMIN_FIELD_CLASS,
  ADMIN_PAGE_PANEL_CLASS,
  ADMIN_SURFACE_CLASS,
  ADMIN_TAB_BUTTON_ACTIVE_CLASS,
} from '../shared/adminPanelStyles';

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

const EMPTY_DASHBOARD_ANALYTICS: AdminDashboardAnalyticsPayload = {
  period: 'all',
  counts: {},
  trends: [],
  insights: [],
  funnelSummary: [],
  billingHealth: {
    failedPayments: 0,
    pastDueSubscribers: 0,
    recoveredSubscribers: 0,
    refundRequestedCount: 0,
    refundedCount: 0,
  },
};

const formatNumber = (value: number) => value.toLocaleString('pt-BR');

const formatCurrency = (value: number) => (
  value.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
  })
);

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
  <section className={`${ADMIN_SURFACE_CLASS} ${className}`}>
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
  const [dashboardAnalytics, setDashboardAnalytics] = useState<AdminDashboardAnalyticsPayload>(EMPTY_DASHBOARD_ANALYTICS);
  const [feedbackThreads, setFeedbackThreads] = useState<AdminFeedbackThread[]>([]);
  const [isStatsLoading, setIsStatsLoading] = useState(false);

  useEffect(() => {
    let isCurrent = true;

    setIsStatsLoading(true);

    Promise.all([
      adminService.getStats({
        period: selectedPeriod,
        startDate: customStartDate || undefined,
        endDate: customEndDate || undefined,
      }),
      adminService.getDashboardAnalytics({
        period: selectedPeriod,
        startDate: customStartDate || undefined,
        endDate: customEndDate || undefined,
      }),
    ])
      .then(([statsPayload, dashboardPayload]) => {
        if (!isCurrent) return;
        setStats(statsPayload);
        setDashboardAnalytics(dashboardPayload);
      })
      .catch(() => {
        if (!isCurrent) return;
        setStats(EMPTY_STATS);
        setDashboardAnalytics(EMPTY_DASHBOARD_ANALYTICS);
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

  const recentFeedback = useMemo(() => (
    [...feedbackThreads]
      .sort((left, right) => new Date(right.created_at).getTime() - new Date(left.created_at).getTime())
      .slice(0, 4)
  ), [feedbackThreads]);

  const examsCount = useMemo(() => {
    const registry = new Set<string>();

    (questions || []).forEach((question: any) => {
      const provas = Array.isArray(question?.provas) ? question.provas : [];

      if (provas.length > 0) {
        provas.forEach((prova: any) => {
          const key = prova?.id ?? prova?.nome ?? prova?.title ?? prova?.slug;
          if (key) {
            registry.add(String(key));
          }
        });
        return;
      }

      const fallbackKey = question?.prova_id ?? question?.exam_id ?? question?.prova_nome ?? question?.provaNome;
      if (fallbackKey) {
        registry.add(String(fallbackKey));
      }
    });

    return registry.size;
  }, [questions]);

  const platformTotals = useMemo(() => ({
    questions: Number(dashboardAnalytics.counts.questions_count || stats.questions_count || questions.length || 0),
    users: Number(dashboardAnalytics.counts.users_count || stats.users_count || allUsers.length || 0),
    laws: Number(dashboardAnalytics.counts.laws_count || stats.laws_count || 0),
    comments: Number(dashboardAnalytics.counts.comments_count || 0),
    pendingComments: Number(dashboardAnalytics.counts.pending_comments_count || 0),
    approvedComments: Number(dashboardAnalytics.counts.approved_comments_count || 0),
    spamComments: Number(dashboardAnalytics.counts.spam_comments_count || 0),
    materials: Number(dashboardAnalytics.counts.materials_count || stats.materials_count || allMaterials.length || 0),
    publishedMaterials: Number(dashboardAnalytics.counts.published_marketplace_materials_count || 0),
    rankings: Number(stats.rankings_count || allRankings.length || 0),
    vendors: Number(dashboardAnalytics.counts.active_vendors_count || 0),
    exams: examsCount,
  }), [allMaterials.length, allRankings.length, allUsers.length, dashboardAnalytics.counts, examsCount, questions.length, stats.laws_count, stats.materials_count, stats.questions_count, stats.rankings_count, stats.users_count]);

  const summaryCards = useMemo(() => ([
    {
      label: 'Questoes no banco',
      value: formatNumber(platformTotals.questions),
      helper: `${formatNumber(platformTotals.exams)} provas mapeadas`,
      icon: FileQuestion,
      iconClassName: 'bg-blue-50 text-blue-600 dark:bg-blue-900/20 dark:text-blue-300',
    },
    {
      label: 'Usuarios cadastrados',
      value: formatNumber(platformTotals.users),
      helper: `${formatNumber(stats.new_users || 0)} novos no periodo`,
      icon: Users,
      iconClassName: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-900/20 dark:text-emerald-300',
    },
    {
      label: 'Comentarios pendentes',
      value: formatNumber(platformTotals.pendingComments),
      helper: `${formatNumber(platformTotals.comments)} comentarios no total`,
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
  ]), [platformTotals.comments, platformTotals.exams, platformTotals.pendingComments, platformTotals.questions, platformTotals.users, stats.available_platform_revenue, stats.mrr, stats.new_users, stats.platform_revenue]);

  const platformOverviewItems = useMemo(() => ([
    { label: 'Leis comentadas', value: formatNumber(platformTotals.laws), helper: 'Acervo legislativo publicado' },
    { label: 'Banco de provas', value: formatNumber(platformTotals.exams), helper: 'Provas ligadas ao banco de questoes' },
    { label: 'Rankings', value: formatNumber(platformTotals.rankings), helper: 'Estruturas competitivas ativas' },
    { label: 'Materiais publicados', value: formatNumber(platformTotals.publishedMaterials), helper: `${formatNumber(platformTotals.materials)} materiais totais` },
    { label: 'Vendedores ativos', value: formatNumber(platformTotals.vendors), helper: 'Marketplace habilitado para venda' },
    { label: 'Comentarios aprovados', value: formatNumber(platformTotals.approvedComments), helper: `${formatNumber(platformTotals.spamComments)} em spam` },
  ]), [platformTotals.approvedComments, platformTotals.exams, platformTotals.laws, platformTotals.materials, platformTotals.publishedMaterials, platformTotals.rankings, platformTotals.spamComments, platformTotals.vendors]);

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
      onClick: () => onNavigate?.('support', 'materials'),
    },
    {
      label: 'Comentários aguardando moderação',
      value: Number(dashboardAnalytics.counts.pending_comments_count || 0),
      description: 'Fila editorial de comentários em análise.',
      onClick: () => onNavigate?.('support', 'comments'),
    },
  ]), [dashboardAnalytics.counts, onNavigate, pendingMaterialsCount, refundRequestsCount, unresolvedReportsCount]);

  const quickLinks = useMemo(() => ([
    { label: 'Gerenciar questoes', description: 'Banco principal e edicao manual.', onClick: () => onNavigate?.('operation', 'questions') },
    { label: 'Banco de provas', description: 'Cadastros e simulados.', onClick: () => onNavigate?.('operation', 'exams') },
    { label: 'Lei comentada', description: 'Acervo legislativo e conteudo editorial.', onClick: () => onNavigate?.('operation', 'lei-comentada') },
    { label: 'Moderar comentarios', description: 'Fila unificada de comentarios do ecossistema.', onClick: () => onNavigate?.('support', 'comments') },
    { label: 'SEO e indexacao', description: 'Ajustes tecnicos e visibilidade.', onClick: () => onNavigate?.('settings', 'seo') },
  ]), [onNavigate]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
        <div className={`${ADMIN_SURFACE_CLASS} flex flex-wrap items-center gap-2 p-2`}>
          {PERIOD_OPTIONS.map((period) => (
            <button
              key={period.key}
              type="button"
              onClick={() => setSelectedPeriod(period.key)}
              className={`rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                selectedPeriod === period.key
                  ? ADMIN_TAB_BUTTON_ACTIVE_CLASS
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
                className={ADMIN_FIELD_CLASS}
              />
              <input
                type="date"
                value={customEndDate}
                onChange={(event) => setCustomEndDate(event.target.value)}
                className={ADMIN_FIELD_CLASS}
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
            className={ADMIN_PAGE_PANEL_CLASS}
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

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)]">
        <DashboardCard
          title="Visao geral da plataforma"
          action={(
            <button
              type="button"
              onClick={() => onNavigate?.('panel', 'dashboard')}
              className="text-sm font-semibold text-blue-600 transition-colors hover:text-blue-700 dark:text-blue-300 dark:hover:text-blue-200"
            >
              Atualizar leitura
            </button>
          )}
        >
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {platformOverviewItems.map((item) => (
              <div
                key={item.label}
                className="rounded-sm border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-800 dark:bg-slate-950/40"
              >
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">
                  {item.label}
                </p>
                <p className="mt-3 text-2xl font-black text-slate-900 dark:text-slate-100">
                  {item.value}
                </p>
                <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
                  {item.helper}
                </p>
              </div>
            ))}

            <div className="rounded-sm border border-slate-200 bg-white px-4 py-3 dark:border-slate-800 dark:bg-slate-900 sm:col-span-2 xl:col-span-3">
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">
                Panorama do ecossistema
              </p>
              <p className="mt-3 text-sm text-slate-600 dark:text-slate-300">
                A plataforma hoje opera com {formatNumber(platformTotals.questions)} questoes, {formatNumber(platformTotals.laws)} leis comentadas, {formatNumber(platformTotals.exams)} provas cadastradas, {formatNumber(platformTotals.rankings)} rankings e {formatNumber(platformTotals.publishedMaterials)} materiais publicados no marketplace.
              </p>
              <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                No relacionamento, ha {formatNumber(platformTotals.comments)} comentarios registrados, sendo {formatNumber(platformTotals.pendingComments)} pendentes, {formatNumber(platformTotals.approvedComments)} aprovados e {formatNumber(platformTotals.spamComments)} marcados como spam.
              </p>
            </div>
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
        <DashboardCard title="Insights do periodo">
          <div className="space-y-3">
            {dashboardAnalytics.insights.length === 0 ? (
              <p className="text-sm text-slate-500 dark:text-slate-400">Sem alertas relevantes para este recorte.</p>
            ) : dashboardAnalytics.insights.map((insight) => (
              <div
                key={`${insight.title}-${insight.body}`}
                className={`rounded-lg border px-4 py-3 ${
                  insight.tone === 'warning'
                    ? 'border-amber-200 bg-amber-50 dark:border-amber-900/30 dark:bg-amber-900/10'
                    : insight.tone === 'success'
                      ? 'border-emerald-200 bg-emerald-50 dark:border-emerald-900/30 dark:bg-emerald-900/10'
                      : 'border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-800/60'
                }`}
              >
                <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{insight.title}</p>
                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{insight.body}</p>
              </div>
            ))}
          </div>
        </DashboardCard>

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
              <div className="mt-3 flex items-center justify-between gap-3 text-sm">
                <span className="text-slate-500 dark:text-slate-400">Falhas de pagamento</span>
                <span className="font-semibold text-slate-900 dark:text-slate-100">{dashboardAnalytics.billingHealth.failedPayments}</span>
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
        <section className={ADMIN_PAGE_PANEL_CLASS}>
          <div className="flex items-center gap-3">
            <AlertTriangle size={18} className="text-amber-500" />
            <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">Moderacao</p>
          </div>
          <p className="mt-4 text-2xl font-black text-slate-900 dark:text-slate-100">{formatNumber(unresolvedReportsCount)}</p>
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">Denuncias ainda abertas no painel.</p>
        </section>

        <section className={ADMIN_PAGE_PANEL_CLASS}>
          <div className="flex items-center gap-3">
            <RefreshCcw size={18} className="text-rose-500" />
            <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">Reembolso</p>
          </div>
          <p className="mt-4 text-2xl font-black text-slate-900 dark:text-slate-100">{formatNumber(refundRequestsCount)}</p>
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">Pedidos financeiros aguardando decisao.</p>
        </section>

        <section className={ADMIN_PAGE_PANEL_CLASS}>
          <div className="flex items-center gap-3">
            <FileQuestion size={18} className="text-blue-500" />
            <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">Acervo</p>
          </div>
          <p className="mt-4 text-2xl font-black text-slate-900 dark:text-slate-100">{formatNumber(Number(dashboardAnalytics.counts.materials_count || stats.materials_count || allMaterials.length || 0))}</p>
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
            {formatNumber(Number(dashboardAnalytics.counts.published_marketplace_materials_count || 0))} materiais publicados e {formatNumber(Number(dashboardAnalytics.counts.laws_count || 0))} leis no acervo.
          </p>
        </section>

        <section className={ADMIN_PAGE_PANEL_CLASS}>
          <div className="flex items-center gap-3">
            <BookOpen size={18} className="text-emerald-500" />
            <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">Simulados e rankings</p>
          </div>
          <p className="mt-4 text-2xl font-black text-slate-900 dark:text-slate-100">{formatNumber(stats.rankings_count || allRankings.length || 0)}</p>
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
            Estruturas ativas para provas, ranking e desafio. {activeCouponsCount > 0 ? `${activeCouponsCount} cupom(ns) ativo(s).` : ''}
          </p>
        </section>

        <section className={ADMIN_PAGE_PANEL_CLASS}>
          <div className="flex items-center gap-3">
            <MessageSquare size={18} className="text-violet-500" />
            <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">Comentários</p>
          </div>
          <p className="mt-4 text-2xl font-black text-slate-900 dark:text-slate-100">{formatNumber(Number(dashboardAnalytics.counts.comments_count || 0))}</p>
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
            {formatNumber(Number(dashboardAnalytics.counts.approved_comments_count || 0))} aprovados e {formatNumber(Number(dashboardAnalytics.counts.spam_comments_count || 0))} em spam.
          </p>
        </section>
      </div>
    </div>
  );
};

export default AdminDashboard;

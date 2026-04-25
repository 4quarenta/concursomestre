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
import { AlertTriangle, Copy, CreditCard, Download, Loader2, Mail, RefreshCcw, TrendingUp, Users } from 'lucide-react';
import {
  adminService,
  type AdminFinanceAnalyticsPayload,
  type AdminLeadSegment,
} from '@services/admin/adminService';
import { downloadAuthenticatedFile } from '@services/api';
import { useToast } from '@providers/ToastProvider';
import {
  ADMIN_FIELD_CLASS,
  ADMIN_SECONDARY_BUTTON_CLASS,
  ADMIN_SURFACE_CLASS,
  ADMIN_SURFACE_HEADER_CLASS,
  ADMIN_TAB_BUTTON_ACTIVE_CLASS,
  ADMIN_TAB_BUTTON_IDLE_CLASS,
} from '../shared/adminPanelStyles';

type FinanceAnalyticsPeriod = 'all' | 'today' | 'week' | 'month' | 'year' | 'custom';

const PERIOD_OPTIONS: Array<{ key: FinanceAnalyticsPeriod; label: string }> = [
  { key: 'week', label: '7 dias' },
  { key: 'month', label: '30 dias' },
  { key: 'year', label: '12 meses' },
  { key: 'all', label: 'Tudo' },
  { key: 'custom', label: 'Personalizado' },
];

const EMPTY_PAYLOAD: AdminFinanceAnalyticsPayload = {
  period: 'month',
  range: { startDate: null, endDate: null },
  summary: {
    totalRevenue: 0,
    mrr: 0,
    arr: 0,
    projectedConfirmedRevenue: 0,
    projectedRemainingInstallments: 0,
    activeSubscribers: 0,
    churnedSubscribers: 0,
    churnRate: 0,
    pastDueSubscribers: 0,
    recoveredSubscribers: 0,
    avgTicket: 0,
    ltvOperational: 0,
    refundRequestedAmount: 0,
    refundedAmount: 0,
  },
  funnel: [],
  funnelDetails: {
    identifiedLeads: 0,
    capturedEmailsCount: 0,
    createdAccountsCount: 0,
    checkoutStartedCount: 0,
    paymentStartedCount: 0,
    purchasedCount: 0,
    recentLeads: [],
    topReferrers: [],
    topCampaigns: [],
  },
  conversionByCycle: [],
  billingHealth: {
    failedPayments: 0,
    pastDueSubscribers: 0,
    recoveredSubscribers: 0,
    refundRequestedCount: 0,
    refundedCount: 0,
  },
  cohorts: {
    acquisition: [],
    revenue: [],
  },
  revenueProjection: {
    totalProjectedAmount: 0,
    totalRemainingInstallments: 0,
    activeContracts: 0,
    atRiskProjectedAmount: 0,
    breakdownByCycle: [],
    breakdownByMonth: [],
    items: [],
  },
};

const formatCurrency = (value: number) => value.toLocaleString('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  minimumFractionDigits: 2,
});

const formatDateTime = (value?: string | null) => {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString('pt-BR');
};

const formatDate = (value?: string | null) => {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString('pt-BR');
};

const panelClassName = ADMIN_SURFACE_CLASS;

const MetricCard = ({
  label,
  value,
  helper,
  icon: Icon,
}: {
  label: string;
  value: string;
  helper: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
}) => (
  <section className={panelClassName}>
    <div className="flex items-start justify-between gap-3 p-4">
      <div className="min-w-0">
        <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-slate-500 dark:text-slate-400">{label}</p>
        <p className="mt-2 text-2xl font-bold text-slate-900 dark:text-slate-100">{value}</p>
        <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">{helper}</p>
      </div>
      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md border border-slate-200 bg-slate-50 text-slate-600 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200">
        <Icon size={18} />
      </div>
    </div>
  </section>
);

const SectionCard = ({
  title,
  description,
  actions,
  children,
}: {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  children: React.ReactNode;
}) => (
  <section className={panelClassName}>
    <header className="flex flex-col gap-3 border-b border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-800 dark:bg-slate-950/40 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">{title}</h3>
        {description ? (
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{description}</p>
        ) : null}
      </div>
      {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
    </header>
    <div className="p-4">{children}</div>
  </section>
);

const AdminFinanceAnalyticsPanel = () => {
  const { addToast } = useToast();
  const [period, setPeriod] = useState<FinanceAnalyticsPeriod>('month');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [payload, setPayload] = useState<AdminFinanceAnalyticsPayload>(EMPTY_PAYLOAD);
  const [segments, setSegments] = useState<AdminLeadSegment[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    let isCurrent = true;
    setIsLoading(true);

    Promise.all([
      adminService.getFinanceAnalytics({
        period,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
      }),
      adminService.getAnalyticsSegments({
        period,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
      }),
    ])
      .then(([analyticsPayload, segmentsPayload]) => {
        if (!isCurrent) return;
        setPayload(analyticsPayload);
        setSegments(segmentsPayload.segments || []);
      })
      .catch((error) => {
        console.error('Failed to load finance analytics:', error);
        if (isCurrent) {
          setPayload(EMPTY_PAYLOAD);
          setSegments([]);
          addToast('Não foi possível carregar o analytics financeiro.', 'error');
        }
      })
      .finally(() => {
        if (isCurrent) {
          setIsLoading(false);
        }
      });

    return () => {
      isCurrent = false;
    };
  }, [addToast, endDate, period, startDate]);

  const summaryCards = useMemo(() => ([
    {
      label: 'Receita do período',
      value: formatCurrency(payload.summary.totalRevenue),
      helper: `Ticket médio ${formatCurrency(payload.summary.avgTicket)}`,
      icon: TrendingUp,
    },
    {
      label: 'MRR / ARR',
      value: `${formatCurrency(payload.summary.mrr)} / ${formatCurrency(payload.summary.arr)}`,
      helper: `LTV operacional ${formatCurrency(payload.summary.ltvOperational)}`,
      icon: CreditCard,
    },
    {
      label: 'Assinantes ativos',
      value: String(payload.summary.activeSubscribers),
      helper: `Churn ${payload.summary.churnRate.toFixed(2)}%`,
      icon: Users,
    },
    {
      label: 'Cobrança em risco',
      value: `${payload.billingHealth.failedPayments} falha(s)`,
      helper: `${payload.billingHealth.pastDueSubscribers} em past_due`,
      icon: AlertTriangle,
    },
  ]), [payload]);

  const visibleEmails = useMemo(() => (
    Array.from(
      new Set(
        payload.funnelDetails.recentLeads
          .map((lead) => lead.email?.trim())
          .filter((email): email is string => Boolean(email)),
      ),
    )
  ), [payload.funnelDetails.recentLeads]);

  const topSegments = useMemo(() => (
    segments
      .filter((segment) => segment.count > 0)
      .sort((left, right) => right.count - left.count)
      .slice(0, 8)
  ), [segments]);

  const copyVisibleEmails = async () => {
    if (visibleEmails.length === 0) {
      addToast('Ainda não há emails visíveis para copiar.', 'info');
      return;
    }

    await navigator.clipboard.writeText(visibleEmails.join(', '));
    addToast('Emails copiados.', 'success');
  };

  const exportParams = useMemo(() => ({
    period,
    startDate: startDate || undefined,
    endDate: endDate || undefined,
  }), [endDate, period, startDate]);

  const openExport = async (url: string) => {
    try {
      await downloadAuthenticatedFile(url, 'analytics-export.csv');
    } catch (error) {
      console.error('Failed to export analytics CSV:', error);
      addToast('Não foi possível exportar o CSV agora.', 'error');
    }
  };

  return (
    <div className="space-y-4">
      <section className={panelClassName}>
        <div className={ADMIN_SURFACE_HEADER_CLASS}>
          <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-slate-500 dark:text-slate-400">
            Financeiro
          </p>
          <h2 className="mt-1 text-lg font-semibold text-slate-900 dark:text-slate-100">
            Analytics comercial
          </h2>
          <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
            Receita, funil, coortes e sinais de cobrança num formato mais operacional.
          </p>
        </div>

        <div className="flex flex-col gap-4 p-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="flex flex-wrap gap-2">
            {PERIOD_OPTIONS.map((option) => (
              <button
                key={option.key}
                type="button"
                onClick={() => setPeriod(option.key)}
                className={`rounded-md border px-3 py-2 text-xs font-medium transition-colors ${
                  period === option.key
                    ? ADMIN_TAB_BUTTON_ACTIVE_CLASS
                    : ADMIN_TAB_BUTTON_IDLE_CLASS
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>

          {period === 'custom' ? (
            <div className="grid gap-2 sm:grid-cols-2">
              <input
                type="date"
                value={startDate}
                onChange={(event) => setStartDate(event.target.value)}
                className={ADMIN_FIELD_CLASS}
              />
              <input
                type="date"
                value={endDate}
                onChange={(event) => setEndDate(event.target.value)}
                className={ADMIN_FIELD_CLASS}
              />
            </div>
          ) : (
            <div className="text-xs text-slate-500 dark:text-slate-400">
              {payload.range.startDate || payload.range.endDate ? (
                <>Janela: {formatDate(payload.range.startDate)} até {formatDate(payload.range.endDate)}</>
              ) : (
                <>Janela aberta conforme o recorte selecionado.</>
              )}
            </div>
          )}
        </div>
      </section>

      {isLoading ? (
        <div className="flex items-center gap-2 rounded-md border border-slate-200 bg-white px-4 py-3 text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400">
          <Loader2 size={16} className="animate-spin" />
          Carregando analytics financeiro...
        </div>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-4">
        {summaryCards.map((card) => (
          <MetricCard
            key={card.label}
            label={card.label}
            value={card.value}
            helper={card.helper}
            icon={card.icon}
          />
        ))}
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.15fr)_minmax(320px,0.85fr)]">
        <SectionCard
          title="Funil do período"
          description="Da identificação à compra, com conversão entre etapas."
        >
          <div className="overflow-x-auto">
            <table className="w-full min-w-[520px] text-left">
              <thead className="text-[11px] font-bold uppercase tracking-[0.08em] text-slate-500 dark:text-slate-400">
                <tr>
                  <th className="pb-3 pr-4">Etapa</th>
                  <th className="pb-3 pr-4">Leads</th>
                  <th className="pb-3">Conversão</th>
                </tr>
              </thead>
              <tbody>
                {payload.funnel.map((step) => (
                  <tr key={step.key} className="border-t border-slate-200 dark:border-slate-800">
                    <td className="py-3 pr-4 text-sm font-medium text-slate-900 dark:text-slate-100">{step.label}</td>
                    <td className="py-3 pr-4 text-sm text-slate-700 dark:text-slate-300">{step.count}</td>
                    <td className="py-3 text-sm text-slate-500 dark:text-slate-400">
                      {step.conversionFromPrevious === null
                        ? 'Etapa inicial'
                        : `${step.conversionFromPrevious.toFixed(2)}%`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </SectionCard>

        <SectionCard
          title="Leads identificados"
          description="Resumo do que aconteceu com os contatos reconhecidos no recorte."
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-3 dark:border-slate-800 dark:bg-slate-950">
              <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-slate-500 dark:text-slate-400">Emails capturados</p>
              <p className="mt-2 text-xl font-semibold text-slate-900 dark:text-slate-100">{payload.funnelDetails.capturedEmailsCount}</p>
            </div>
            <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-3 dark:border-slate-800 dark:bg-slate-950">
              <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-slate-500 dark:text-slate-400">Criaram conta</p>
              <p className="mt-2 text-xl font-semibold text-slate-900 dark:text-slate-100">{payload.funnelDetails.createdAccountsCount}</p>
            </div>
            <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-3 dark:border-slate-800 dark:bg-slate-950">
              <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-slate-500 dark:text-slate-400">Iniciaram checkout</p>
              <p className="mt-2 text-xl font-semibold text-slate-900 dark:text-slate-100">{payload.funnelDetails.checkoutStartedCount}</p>
            </div>
            <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-3 dark:border-slate-800 dark:bg-slate-950">
              <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-slate-500 dark:text-slate-400">Compraram</p>
              <p className="mt-2 text-xl font-semibold text-slate-900 dark:text-slate-100">{payload.funnelDetails.purchasedCount}</p>
            </div>
          </div>
        </SectionCard>
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)]">
        <SectionCard
          title="Leads capturados"
          description="Emails, referência e situação atual de cada lead identificado."
          actions={(
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={copyVisibleEmails}
                className={ADMIN_SECONDARY_BUTTON_CLASS}
              >
                <Copy size={14} />
                Copiar emails
              </button>
              <button
                type="button"
                onClick={() => openExport(adminService.getFunnelExportUrl(exportParams))}
                className={ADMIN_SECONDARY_BUTTON_CLASS}
              >
                <Download size={14} />
                Exportar CSV
              </button>
            </div>
          )}
        >
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] text-left">
              <thead className="text-[11px] font-bold uppercase tracking-[0.08em] text-slate-500 dark:text-slate-400">
                <tr>
                  <th className="pb-3 pr-4">Lead</th>
                  <th className="pb-3 pr-4">Referência</th>
                  <th className="pb-3 pr-4">Criou conta</th>
                  <th className="pb-3 pr-4">Checkout</th>
                  <th className="pb-3 pr-4">Etapa atual</th>
                  <th className="pb-3">Último evento</th>
                </tr>
              </thead>
              <tbody>
                {payload.funnelDetails.recentLeads.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="border-t border-slate-200 py-4 text-sm text-slate-500 dark:border-slate-800 dark:text-slate-400">
                      Ainda não há leads identificados no recorte selecionado.
                    </td>
                  </tr>
                ) : payload.funnelDetails.recentLeads.map((lead) => (
                  <tr key={lead.leadKey} className="border-t border-slate-200 dark:border-slate-800">
                    <td className="py-3 pr-4">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-slate-900 dark:text-slate-100">
                          {lead.name || lead.email || 'Lead identificado'}
                        </p>
                        <p className="mt-1 flex items-center gap-1 text-xs text-slate-500 dark:text-slate-400">
                          <Mail size={12} />
                          {lead.email || '-'}
                        </p>
                      </div>
                    </td>
                    <td className="py-3 pr-4 text-sm text-slate-600 dark:text-slate-300">
                      <p>{lead.referrerLabel}</p>
                      <p className="mt-1 text-xs text-slate-400 dark:text-slate-500">
                        {[lead.utmSource, lead.utmMedium, lead.utmCampaign].filter(Boolean).join(' / ') || 'Sem campanha mapeada'}
                      </p>
                    </td>
                    <td className="py-3 pr-4 text-sm text-slate-600 dark:text-slate-300">
                      {lead.createdAccount ? 'Sim' : 'Não'}
                    </td>
                    <td className="py-3 pr-4 text-sm text-slate-600 dark:text-slate-300">
                      {lead.checkoutStarted ? 'Sim' : 'Não'}
                    </td>
                    <td className="py-3 pr-4 text-sm font-medium text-slate-900 dark:text-slate-100">
                      {lead.currentStage}
                    </td>
                    <td className="py-3 text-sm text-slate-500 dark:text-slate-400">
                      {formatDateTime(lead.lastEventAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </SectionCard>

        <div className="space-y-4">
          <SectionCard
            title="Principais referências"
            description="De onde vieram os leads identificados e quanto avançaram."
          >
            <div className="overflow-x-auto">
              <table className="w-full min-w-[420px] text-left">
                <thead className="text-[11px] font-bold uppercase tracking-[0.08em] text-slate-500 dark:text-slate-400">
                  <tr>
                    <th className="pb-3 pr-4">Origem</th>
                    <th className="pb-3 pr-4">Leads</th>
                    <th className="pb-3">Compras</th>
                  </tr>
                </thead>
                <tbody>
                  {payload.funnelDetails.topReferrers.length === 0 ? (
                    <tr>
                      <td colSpan={3} className="border-t border-slate-200 py-4 text-sm text-slate-500 dark:border-slate-800 dark:text-slate-400">
                        Sem referências suficientes neste recorte.
                      </td>
                    </tr>
                  ) : payload.funnelDetails.topReferrers.map((item) => (
                    <tr key={item.key} className="border-t border-slate-200 dark:border-slate-800">
                      <td className="py-3 pr-4 text-sm font-medium text-slate-900 dark:text-slate-100">{item.label}</td>
                      <td className="py-3 pr-4 text-sm text-slate-600 dark:text-slate-300">{item.leads}</td>
                      <td className="py-3 text-sm text-slate-600 dark:text-slate-300">{item.purchases}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </SectionCard>

          <SectionCard
            title="Campanhas mapeadas"
            description="UTMs e campanhas que realmente geraram avanço no funil."
          >
            <div className="overflow-x-auto">
              <table className="w-full min-w-[420px] text-left">
                <thead className="text-[11px] font-bold uppercase tracking-[0.08em] text-slate-500 dark:text-slate-400">
                  <tr>
                    <th className="pb-3 pr-4">Campanha</th>
                    <th className="pb-3 pr-4">Criou conta</th>
                    <th className="pb-3">Compras</th>
                  </tr>
                </thead>
                <tbody>
                  {payload.funnelDetails.topCampaigns.length === 0 ? (
                    <tr>
                      <td colSpan={3} className="border-t border-slate-200 py-4 text-sm text-slate-500 dark:border-slate-800 dark:text-slate-400">
                        Sem campanhas rastreadas neste recorte.
                      </td>
                    </tr>
                  ) : payload.funnelDetails.topCampaigns.map((item) => (
                    <tr key={item.key} className="border-t border-slate-200 dark:border-slate-800">
                      <td className="py-3 pr-4 text-sm font-medium text-slate-900 dark:text-slate-100">{item.label}</td>
                      <td className="py-3 pr-4 text-sm text-slate-600 dark:text-slate-300">{item.createdAccounts}</td>
                      <td className="py-3 text-sm text-slate-600 dark:text-slate-300">{item.purchases}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </SectionCard>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(320px,0.9fr)]">
        <SectionCard
          title="Conversão por modalidade"
          description="Compras e base ativa por mensal, trimestral e anual."
        >
          <div className="overflow-x-auto">
            <table className="w-full min-w-[420px] text-left">
              <thead className="text-[11px] font-bold uppercase tracking-[0.08em] text-slate-500 dark:text-slate-400">
                <tr>
                  <th className="pb-3 pr-4">Modalidade</th>
                  <th className="pb-3 pr-4">Compras</th>
                  <th className="pb-3">Ativos</th>
                </tr>
              </thead>
              <tbody>
                {payload.conversionByCycle.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="border-t border-slate-200 py-4 text-sm text-slate-500 dark:border-slate-800 dark:text-slate-400">
                      Ainda sem volume suficiente para comparar as modalidades.
                    </td>
                  </tr>
                ) : payload.conversionByCycle.map((cycle) => (
                  <tr key={cycle.key} className="border-t border-slate-200 dark:border-slate-800">
                    <td className="py-3 pr-4 text-sm font-medium text-slate-900 dark:text-slate-100">{cycle.label}</td>
                    <td className="py-3 pr-4 text-sm text-slate-600 dark:text-slate-300">{cycle.purchases}</td>
                    <td className="py-3 text-sm text-slate-600 dark:text-slate-300">{cycle.activeSubscribers}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </SectionCard>

        <SectionCard
          title="Saúde de cobrança"
          description="Falha, inadimplência, recuperação e reembolso."
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-3 dark:border-slate-800 dark:bg-slate-950">
              <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-slate-500 dark:text-slate-400">Falhas</p>
              <p className="mt-2 text-xl font-semibold text-slate-900 dark:text-slate-100">{payload.billingHealth.failedPayments}</p>
            </div>
            <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-3 dark:border-slate-800 dark:bg-slate-950">
              <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-slate-500 dark:text-slate-400">Past due</p>
              <p className="mt-2 text-xl font-semibold text-slate-900 dark:text-slate-100">{payload.billingHealth.pastDueSubscribers}</p>
            </div>
            <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-3 dark:border-slate-800 dark:bg-slate-950">
              <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-slate-500 dark:text-slate-400">Recuperados</p>
              <p className="mt-2 text-xl font-semibold text-slate-900 dark:text-slate-100">{payload.billingHealth.recoveredSubscribers}</p>
            </div>
            <div className="rounded-md border border-slate-200 bg-slate-50 px-3 py-3 dark:border-slate-800 dark:bg-slate-950">
              <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-slate-500 dark:text-slate-400">Reembolsos</p>
              <p className="mt-2 text-xl font-semibold text-slate-900 dark:text-slate-100">{payload.billingHealth.refundRequestedCount}</p>
            </div>
          </div>
        </SectionCard>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <SectionCard
          title="Coorte de aquisição"
          description="Do email capturado até compra, mês a mês."
        >
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left">
              <thead className="text-[11px] font-bold uppercase tracking-[0.08em] text-slate-500 dark:text-slate-400">
                <tr>
                  <th className="pb-3 pr-4">Mês</th>
                  <th className="pb-3 pr-4">Emails</th>
                  <th className="pb-3 pr-4">Contas</th>
                  <th className="pb-3 pr-4">Checkout</th>
                  <th className="pb-3 pr-4">Compras</th>
                  <th className="pb-3 pr-4">Taxa cadastro</th>
                  <th className="pb-3">Taxa compra</th>
                </tr>
              </thead>
              <tbody>
                {payload.cohorts.acquisition.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="border-t border-slate-200 py-4 text-sm text-slate-500 dark:border-slate-800 dark:text-slate-400">
                      Ainda sem coorte de aquisição suficiente.
                    </td>
                  </tr>
                ) : payload.cohorts.acquisition.map((cohort) => (
                  <tr key={cohort.month} className="border-t border-slate-200 dark:border-slate-800">
                    <td className="py-3 pr-4 text-sm font-medium text-slate-900 dark:text-slate-100">{cohort.month}</td>
                    <td className="py-3 pr-4 text-sm text-slate-600 dark:text-slate-300">{cohort.capturedEmails}</td>
                    <td className="py-3 pr-4 text-sm text-slate-600 dark:text-slate-300">{cohort.createdAccounts}</td>
                    <td className="py-3 pr-4 text-sm text-slate-600 dark:text-slate-300">{cohort.checkoutStarted}</td>
                    <td className="py-3 pr-4 text-sm text-slate-600 dark:text-slate-300">{cohort.purchases}</td>
                    <td className="py-3 pr-4 text-sm text-slate-600 dark:text-slate-300">{cohort.signupRate.toFixed(2)}%</td>
                    <td className="py-3 text-sm text-slate-600 dark:text-slate-300">{cohort.purchaseRate.toFixed(2)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </SectionCard>

        <SectionCard
          title="Coorte de receita"
          description="Compradores por mês, quantos renovaram e quantos seguem ativos."
        >
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-left">
              <thead className="text-[11px] font-bold uppercase tracking-[0.08em] text-slate-500 dark:text-slate-400">
                <tr>
                  <th className="pb-3 pr-4">Mês</th>
                  <th className="pb-3 pr-4">Compradores</th>
                  <th className="pb-3 pr-4">Ativos hoje</th>
                  <th className="pb-3 pr-4">Renovaram</th>
                  <th className="pb-3">Retenção</th>
                </tr>
              </thead>
              <tbody>
                {payload.cohorts.revenue.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="border-t border-slate-200 py-4 text-sm text-slate-500 dark:border-slate-800 dark:text-slate-400">
                      Ainda sem coorte de receita suficiente.
                    </td>
                  </tr>
                ) : payload.cohorts.revenue.map((cohort) => (
                  <tr key={cohort.month} className="border-t border-slate-200 dark:border-slate-800">
                    <td className="py-3 pr-4 text-sm font-medium text-slate-900 dark:text-slate-100">{cohort.month}</td>
                    <td className="py-3 pr-4 text-sm text-slate-600 dark:text-slate-300">{cohort.buyers}</td>
                    <td className="py-3 pr-4 text-sm text-slate-600 dark:text-slate-300">{cohort.currentlyActive}</td>
                    <td className="py-3 pr-4 text-sm text-slate-600 dark:text-slate-300">{cohort.renewed}</td>
                    <td className="py-3 text-sm text-slate-600 dark:text-slate-300">{cohort.retentionRate.toFixed(2)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </SectionCard>
      </div>

      <SectionCard
        title="Segmentos acionáveis"
        description="Listas prontas para campanha, recuperação ou abordagem comercial."
        actions={(
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => openExport(adminService.getSegmentsExportUrl(exportParams))}
              className={ADMIN_SECONDARY_BUTTON_CLASS}
            >
              <Download size={14} />
              Exportar CSV
            </button>
            <RefreshCcw size={14} className="text-slate-400" />
          </div>
        )}
      >
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left">
            <thead className="text-[11px] font-bold uppercase tracking-[0.08em] text-slate-500 dark:text-slate-400">
              <tr>
                <th className="pb-3 pr-4">Segmento</th>
                <th className="pb-3 pr-4">Volume</th>
                <th className="pb-3 pr-4">Último lead</th>
                <th className="pb-3 pr-4">Observação</th>
                <th className="pb-3">Ação</th>
              </tr>
            </thead>
            <tbody>
              {topSegments.length === 0 ? (
                <tr>
                  <td colSpan={5} className="border-t border-slate-200 py-4 text-sm text-slate-500 dark:border-slate-800 dark:text-slate-400">
                    Nenhum segmento populado neste recorte.
                  </td>
                </tr>
              ) : topSegments.map((segment) => (
                <tr key={segment.key} className="border-t border-slate-200 dark:border-slate-800">
                  <td className="py-3 pr-4 text-sm font-medium text-slate-900 dark:text-slate-100">{segment.label}</td>
                  <td className="py-3 pr-4 text-sm text-slate-600 dark:text-slate-300">{segment.count}</td>
                  <td className="py-3 pr-4 text-sm text-slate-600 dark:text-slate-300">
                    {segment.items[0]?.email || segment.items[0]?.name || '-'}
                  </td>
                  <td className="py-3 pr-4 text-sm text-slate-500 dark:text-slate-400">
                    {segment.items[0]?.notes || 'Segmento disponível para atuação.'}
                  </td>
                  <td className="py-3">
                    <button
                      type="button"
                      onClick={() => openExport(adminService.getSegmentsExportUrl({ ...exportParams, segmentKey: segment.key }))}
                      className={ADMIN_SECONDARY_BUTTON_CLASS}
                    >
                      <Download size={13} />
                      Exportar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SectionCard>
    </div>
  );
};

export default AdminFinanceAnalyticsPanel;

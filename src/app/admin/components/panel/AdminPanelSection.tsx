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
import { AlertTriangle, RefreshCcw, ShieldCheck, Terminal } from 'lucide-react';
import AdminDashboard from '../dashboard/AdminDashboard';
import { subscriptionsService } from '@services/subscriptions';
import { seoService } from '@services/seo';
import type { AdminPanelSection as AdminPanelSectionKey } from '../shared/useAdminPageController';
import { calculateSeoCompletenessScore, mergeSeoSettings } from '../settings/seoSettings';

interface AdminPanelSectionProps extends React.ComponentProps<typeof AdminDashboard> {
  initialSection?: AdminPanelSectionKey;
  onSectionChange?: (section: AdminPanelSectionKey) => void;
}

const PANEL_SECTIONS: { key: AdminPanelSectionKey; label: string }[] = [
  { key: 'dashboard', label: 'Dashboard' },
  { key: 'alerts', label: 'Alertas' },
  { key: 'billing-health', label: 'Saude do billing' },
];

/**
 * Organiza a area "Painel" em tres subareas menores.
 *
 * @since 1.0.0
 */
const AdminPanelSection = ({
  initialSection = 'dashboard',
  onSectionChange,
  allTransactions,
  allReports,
  allMaterials,
  systemSettings,
  onNavigate,
  ...dashboardProps
}: AdminPanelSectionProps) => {
  const [activeSection, setActiveSection] = useState<AdminPanelSectionKey>(initialSection);
  const [automationHelper, setAutomationHelper] = useState<any | null>(null);
  const [sitemapCoveragePercent, setSitemapCoveragePercent] = useState<number | null>(null);

  useEffect(() => {
    setActiveSection(initialSection);
  }, [initialSection]);

  useEffect(() => {
    if (activeSection !== 'billing-health' || automationHelper) {
      return;
    }

    subscriptionsService.getAutomationHelperInfo()
      .then((payload) => setAutomationHelper(payload))
      .catch(() => setAutomationHelper({ error: 'Nao foi possivel carregar a automacao oficial.' }));
  }, [activeSection, automationHelper]);

  useEffect(() => {
    if (activeSection !== 'billing-health' || sitemapCoveragePercent !== null) {
      return;
    }

    seoService.getSitemapStatus()
      .then((payload) => {
        if (!payload) {
          setSitemapCoveragePercent(null);
          return;
        }

        const dynamicTotal = payload.coverage.questions.total + payload.coverage.rankings.total + payload.coverage.materials.total;
        const dynamicIndexed = payload.coverage.questions.indexed + payload.coverage.rankings.indexed + payload.coverage.materials.indexed;
        const percent = dynamicTotal > 0 ? Math.round((dynamicIndexed / dynamicTotal) * 100) : 100;
        setSitemapCoveragePercent(percent);
      })
      .catch(() => setSitemapCoveragePercent(null));
  }, [activeSection, sitemapCoveragePercent]);

  const changeSection = (section: AdminPanelSectionKey) => {
    setActiveSection(section);
    onSectionChange?.(section);
  };

  const unresolvedReports = (allReports || []).filter((report: any) => !['resolved', 'ignored'].includes(String(report.status || '').toLowerCase()));
  const refundRequests = (allTransactions || []).filter((transaction: any) => transaction.status === 'refund_requested');
  const rejectedTransactions = (allTransactions || []).filter((transaction: any) => transaction.status === 'rejected');
  const pendingMaterials = (allMaterials || []).filter((material: any) => String(material.status || '').toLowerCase() === 'pending');
  const feedbackInboxCount = Number((systemSettings as any)?.adminFeedbackCount || 0);
  const seoScore = calculateSeoCompletenessScore(mergeSeoSettings(systemSettings?.seo));

  const billingHealthItems = useMemo(() => ([
    {
      label: 'Stripe publishable key',
      value: systemSettings?.stripePublishableKey || systemSettings?.stripeKey ? 'Configurada' : 'Ausente',
      tone: systemSettings?.stripePublishableKey || systemSettings?.stripeKey ? 'emerald' : 'rose',
    },
    {
      label: 'Webhook Stripe',
      value: systemSettings?.hasStripeWebhookConfigured ? 'Configurado' : 'Nao comprovado',
      tone: systemSettings?.hasStripeWebhookConfigured ? 'emerald' : 'amber',
    },
    {
      label: 'Cron oficial',
      value: automationHelper?.linux_command ? 'Disponivel' : 'Nao comprovado',
      tone: automationHelper?.linux_command ? 'indigo' : 'amber',
    },
    {
      label: 'Recorrencia',
      value: systemSettings?.features?.recurringEnabled ? 'Ativa' : 'Desativada',
      tone: systemSettings?.features?.recurringEnabled ? 'emerald' : 'slate',
    },
    {
      label: 'Reembolsos pendentes',
      value: String(refundRequests.length),
      tone: refundRequests.length > 0 ? 'amber' : 'emerald',
    },
    {
      label: 'SEO',
      value: `${seoScore}%`,
      tone: seoScore >= 80 ? 'emerald' : seoScore >= 50 ? 'amber' : 'rose',
    },
    {
      label: 'Cobertura sitemap',
      value: sitemapCoveragePercent === null ? 'Nao comprovado' : `${sitemapCoveragePercent}%`,
      tone: sitemapCoveragePercent === null
        ? 'amber'
        : sitemapCoveragePercent >= 90
          ? 'emerald'
          : sitemapCoveragePercent >= 60
            ? 'indigo'
            : 'rose',
    },
  ]), [
    automationHelper?.linux_command,
    refundRequests.length,
    seoScore,
    sitemapCoveragePercent,
    systemSettings?.features?.recurringEnabled,
    systemSettings?.hasStripeWebhookConfigured,
    systemSettings?.stripeKey,
    systemSettings?.stripePublishableKey,
  ]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2 rounded-lg border border-slate-200 bg-white p-2 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        {PANEL_SECTIONS.map((section) => (
          <button
            key={section.key}
            onClick={() => changeSection(section.key)}
            className={`rounded-lg px-4 py-2 text-[11px] font-semibold transition-colors ${
              activeSection === section.key
                ? 'bg-blue-600 text-white'
                : 'text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800'
            }`}
          >
            {section.label}
          </button>
        ))}
      </div>

      {activeSection === 'dashboard' && (
        <AdminDashboard
          {...dashboardProps}
          allTransactions={allTransactions}
          allReports={allReports}
          allMaterials={allMaterials}
          systemSettings={systemSettings}
          onNavigate={onNavigate}
        />
      )}

      {activeSection === 'alerts' && (
        <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-5">
          <button
            onClick={() => onNavigate?.('support', 'reports')}
            className="rounded-[2rem] border border-amber-200 bg-amber-50 p-6 text-left transition-all hover:border-amber-300 dark:border-amber-900/30 dark:bg-amber-900/10"
          >
            <AlertTriangle size={18} className="text-amber-600 dark:text-amber-300" />
            <p className="mt-4 text-[10px] font-black uppercase tracking-[0.18em] text-amber-600 dark:text-amber-300">Denuncias abertas</p>
            <p className="mt-3 text-3xl font-black text-slate-900 dark:text-slate-100">{unresolvedReports.length}</p>
            <p className="mt-2 text-xs font-medium text-slate-500 dark:text-slate-400">Itens aguardando moderacao.</p>
          </button>

          <button
            onClick={() => onNavigate?.('finance', 'refunds')}
            className="rounded-[2rem] border border-rose-200 bg-rose-50 p-6 text-left transition-all hover:border-rose-300 dark:border-rose-900/30 dark:bg-rose-900/10"
          >
            <RefreshCcw size={18} className="text-rose-600 dark:text-rose-300" />
            <p className="mt-4 text-[10px] font-black uppercase tracking-[0.18em] text-rose-600 dark:text-rose-300">Reembolsos pendentes</p>
            <p className="mt-3 text-3xl font-black text-slate-900 dark:text-slate-100">{refundRequests.length}</p>
            <p className="mt-2 text-xs font-medium text-slate-500 dark:text-slate-400">Pedidos que exigem validacao financeira.</p>
          </button>

          <button
            onClick={() => onNavigate?.('finance', 'transactions')}
            className="rounded-[2rem] border border-slate-200 bg-white p-6 text-left transition-all hover:border-slate-300 dark:border-slate-800 dark:bg-slate-900"
          >
            <Terminal size={18} className="text-slate-600 dark:text-slate-300" />
            <p className="mt-4 text-[10px] font-black uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">Falhas recentes</p>
            <p className="mt-3 text-3xl font-black text-slate-900 dark:text-slate-100">{rejectedTransactions.length}</p>
            <p className="mt-2 text-xs font-medium text-slate-500 dark:text-slate-400">Transacoes com rejeicao ou erro operacional.</p>
          </button>

          <button
            onClick={() => onNavigate?.('support', 'feedback')}
            className="rounded-[2rem] border border-indigo-200 bg-indigo-50 p-6 text-left transition-all hover:border-indigo-300 dark:border-indigo-900/30 dark:bg-indigo-900/10"
          >
            <ShieldCheck size={18} className="text-indigo-600 dark:text-indigo-300" />
            <p className="mt-4 text-[10px] font-black uppercase tracking-[0.18em] text-indigo-600 dark:text-indigo-300">Inbox de suporte</p>
            <p className="mt-3 text-3xl font-black text-slate-900 dark:text-slate-100">{feedbackInboxCount}</p>
            <p className="mt-2 text-xs font-medium text-slate-500 dark:text-slate-400">Feedbacks e conversas que ainda exigem retorno.</p>
          </button>

          <button
            onClick={() => onNavigate?.('operation', 'materials')}
            className="rounded-[2rem] border border-emerald-200 bg-emerald-50 p-6 text-left transition-all hover:border-emerald-300 dark:border-emerald-900/30 dark:bg-emerald-900/10"
          >
            <RefreshCcw size={18} className="text-emerald-600 dark:text-emerald-300" />
            <p className="mt-4 text-[10px] font-black uppercase tracking-[0.18em] text-emerald-600 dark:text-emerald-300">Materiais aguardando</p>
            <p className="mt-3 text-3xl font-black text-slate-900 dark:text-slate-100">{pendingMaterials.length}</p>
            <p className="mt-2 text-xs font-medium text-slate-500 dark:text-slate-400">Fila de moderacao de materiais pendentes.</p>
          </button>
        </div>
      )}

      {activeSection === 'billing-health' && (
        <div className="space-y-6">
          <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-5">
            {billingHealthItems.map((item) => (
              <div
                key={item.label}
                className={`rounded-[2rem] border p-5 ${
                  item.tone === 'emerald'
                    ? 'border-emerald-200 bg-emerald-50 dark:border-emerald-900/30 dark:bg-emerald-900/10'
                    : item.tone === 'rose'
                      ? 'border-rose-200 bg-rose-50 dark:border-rose-900/30 dark:bg-rose-900/10'
                      : item.tone === 'amber'
                        ? 'border-amber-200 bg-amber-50 dark:border-amber-900/30 dark:bg-amber-900/10'
                        : item.tone === 'indigo'
                          ? 'border-indigo-200 bg-indigo-50 dark:border-indigo-900/30 dark:bg-indigo-900/10'
                          : 'border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900'
                }`}
              >
                <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">{item.label}</p>
                <p className="mt-3 text-sm font-black text-slate-900 dark:text-slate-100">{item.value}</p>
              </div>
            ))}
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-[2rem] border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
              <div className="flex items-center gap-3">
                <ShieldCheck size={18} className="text-indigo-600 dark:text-indigo-300" />
                <div>
                  <p className="text-sm font-black text-slate-900 dark:text-slate-100">Webhook e cron</p>
                  <p className="text-xs font-medium text-slate-500 dark:text-slate-400">Use esta area para validar a automacao oficial antes do deploy.</p>
                </div>
              </div>
              <div className="mt-5 space-y-3 text-xs font-medium text-slate-500 dark:text-slate-400">
                <p>Webhook ativo: `/subscriptions/stripe_webhook.php`.</p>
                <p>Cron oficial: {automationHelper?.linux_command || 'NAO COMPROVADO'}.</p>
                <p>Download helper: {automationHelper?.download_url || 'NAO COMPROVADO'}.</p>
              </div>
            </div>

            <div className="rounded-[2rem] border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
              <p className="text-sm font-black text-slate-900 dark:text-slate-100">Pendencias reais</p>
              <ul className="mt-5 space-y-3 text-xs font-medium text-slate-500 dark:text-slate-400">
                <li>Execute `npm run check:billing-renewal` antes de cada deploy financeiro.</li>
                <li>Confirme webhook e cron reais no servidor depois de publicar segredos novos.</li>
                <li>Use o viewer de logs para validar refunds e reprocessamentos antes de encerrar incidentes.</li>
              </ul>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminPanelSection;

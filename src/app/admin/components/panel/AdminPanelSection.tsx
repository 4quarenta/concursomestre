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
import type { AdminPanelSection as AdminPanelSectionKey } from '../shared/useAdminPageController';

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
  systemSettings,
  onNavigate,
  ...dashboardProps
}: AdminPanelSectionProps) => {
  const [activeSection, setActiveSection] = useState<AdminPanelSectionKey>(initialSection);
  const [automationHelper, setAutomationHelper] = useState<any | null>(null);

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

  const changeSection = (section: AdminPanelSectionKey) => {
    setActiveSection(section);
    onSectionChange?.(section);
  };

  const unresolvedReports = (allReports || []).filter((report: any) => !['resolved', 'ignored'].includes(String(report.status || '').toLowerCase()));
  const refundRequests = (allTransactions || []).filter((transaction: any) => transaction.status === 'refund_requested');
  const rejectedTransactions = (allTransactions || []).filter((transaction: any) => transaction.status === 'rejected');

  const billingHealthItems = useMemo(() => ([
    {
      label: 'Stripe publishable key',
      value: systemSettings?.stripePublishableKey || systemSettings?.stripeKey ? 'Configurada' : 'Ausente',
      tone: systemSettings?.stripePublishableKey || systemSettings?.stripeKey ? 'emerald' : 'rose',
    },
    {
      label: 'Webhook Stripe',
      value: automationHelper?.cron_url ? 'Cron operacional disponivel' : 'Nao comprovado',
      tone: automationHelper?.cron_url ? 'indigo' : 'amber',
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
  ]), [automationHelper, refundRequests.length, systemSettings?.features?.recurringEnabled, systemSettings?.stripeKey, systemSettings?.stripePublishableKey]);

  return (
    <div className="space-y-6 animate-slide-up">
      <div className="flex flex-wrap gap-2 rounded-3xl border border-slate-200 bg-white p-2 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        {PANEL_SECTIONS.map((section) => (
          <button
            key={section.key}
            onClick={() => changeSection(section.key)}
            className={`rounded-2xl px-4 py-2 text-[10px] font-black uppercase tracking-[0.18em] transition-all ${
              activeSection === section.key
                ? 'bg-indigo-600 text-white shadow-md'
                : 'text-slate-500 hover:bg-slate-50 dark:text-slate-400 dark:hover:bg-slate-800'
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
          systemSettings={systemSettings}
          onNavigate={onNavigate}
        />
      )}

      {activeSection === 'alerts' && (
        <div className="grid gap-4 lg:grid-cols-3">
          <button
            onClick={() => onNavigate?.('reports')}
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
        </div>
      )}

      {activeSection === 'billing-health' && (
        <div className="space-y-6">
          <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-4">
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
                <li>Renovacao Stripe E2E real segue marcada como NAO COMPROVADO.</li>
                <li>Webhook fora de ordem em ambiente real segue NAO COMPROVADO.</li>
                <li>Refund concorrente em todos os cenarios segue NAO COMPROVADO.</li>
              </ul>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminPanelSection;

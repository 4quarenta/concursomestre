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
import { AlertTriangle, LifeBuoy, MessageSquareText } from 'lucide-react';
import { useToast } from '@providers/ToastProvider';
import type { ErrorReport } from '@types';
import { AdminFeedback } from './AdminFeedback';
import AdminReportsSection from '../reports/AdminReportsSection';
import {
  getQuickReportResolutionReason,
  getReportTargetBadgeClass,
  getReportTargetLabel,
  groupPendingReports,
} from '../reports/reportModeration';
import type { AdminSupportSection as AdminSupportSectionKey } from '../shared/useAdminPageController';

interface AdminSupportSectionProps {
  initialSection?: AdminSupportSectionKey;
  onSectionChange?: (section: AdminSupportSectionKey) => void;
  allReports?: ErrorReport[];
  onOpenReportTarget?: (report: ErrorReport) => void;
  onResolveReport?: (report: ErrorReport) => Promise<any> | any;
}

const SUPPORT_SECTIONS: Array<{
  key: AdminSupportSectionKey;
  label: string;
  description: string;
}> = [
  {
    key: 'feedback',
    label: 'Feedback',
    description: 'Triagem de opinioes, bugs e pendencias vindas dos usuarios.',
  },
  {
    key: 'reports',
    label: 'Denuncias',
    description: 'Fila oficial de denuncias com atalho para a area responsavel.',
  },
  {
    key: 'threads',
    label: 'Threads',
    description: 'Acompanhe conversas abertas, retornos e historico do atendimento.',
  },
];

const renderSupportHeader = (label: string) => (
  <th className="p-4 text-[10px] font-black uppercase tracking-widest text-slate-400 dark:text-slate-500">
    {label}
  </th>
);

/**
 * Consolida a area de suporte em feedback, denuncias e threads.
 * Denuncias saiu da operacao e passa a centralizar a triagem de atendimento.
 *
 * @since 1.0.0
 */
const AdminSupportSection = ({
  initialSection = 'feedback',
  onSectionChange,
  allReports = [],
  onOpenReportTarget,
  onResolveReport,
}: AdminSupportSectionProps) => {
  const { addToast } = useToast();
  const [activeSection, setActiveSection] = useState<AdminSupportSectionKey>(initialSection);
  const [resolvingReportId, setResolvingReportId] = useState<string | number | null>(null);

  useEffect(() => {
    setActiveSection(initialSection);
  }, [initialSection]);

  const groupedReports = useMemo(
    () => groupPendingReports(allReports as ErrorReport[]),
    [allReports],
  );

  const changeSection = (section: AdminSupportSectionKey) => {
    setActiveSection(section);
    onSectionChange?.(section);
  };

  const handleResolveReport = async (report: ErrorReport) => {
    if (!onResolveReport) {
      return;
    }

    setResolvingReportId(report.id);
    try {
      await onResolveReport({
        ...report,
        resolution: getQuickReportResolutionReason(report),
      });
      addToast('Denuncia resolvida com sucesso.', 'success');
    } catch (error) {
      console.error('Error resolving report from support:', error);
      addToast('Nao foi possivel resolver a denuncia.', 'error');
    } finally {
      setResolvingReportId(null);
    }
  };

  const activeSectionMeta = SUPPORT_SECTIONS.find((section) => section.key === activeSection);

  return (
    <div className="space-y-6 animate-slide-up">
      <div className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">Suporte organizado</p>
            <p className="mt-2 text-sm font-black text-slate-900 dark:text-slate-100">Atendimento separado por contexto</p>
          </div>

          <div className="flex flex-wrap gap-2">
            {SUPPORT_SECTIONS.map((section) => (
              <button
                key={section.key}
                onClick={() => changeSection(section.key)}
                className={`rounded-2xl px-4 py-2 text-[10px] font-black uppercase tracking-[0.18em] transition-all ${
                  activeSection === section.key
                    ? 'bg-indigo-600 text-white shadow-md'
                    : 'border border-slate-200 bg-slate-50 text-slate-500 hover:border-slate-300 hover:bg-white dark:border-slate-800 dark:bg-slate-800/60 dark:text-slate-400 dark:hover:border-slate-700 dark:hover:bg-slate-800'
                }`}
              >
                {section.label}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-800/60">
          <div className="flex items-start gap-3">
            <div className="rounded-2xl bg-indigo-50 p-3 text-indigo-600 dark:bg-indigo-900/20 dark:text-indigo-300">
              {activeSection === 'feedback' ? (
                <LifeBuoy size={18} />
              ) : activeSection === 'reports' ? (
                <AlertTriangle size={18} />
              ) : (
                <MessageSquareText size={18} />
              )}
            </div>
            <div>
              <p className="text-sm font-black text-slate-900 dark:text-slate-100">{activeSectionMeta?.label}</p>
              <p className="mt-1 text-xs font-medium text-slate-500 dark:text-slate-400">
                {activeSectionMeta?.description}
              </p>
            </div>
          </div>
        </div>
      </div>

      {activeSection === 'reports' ? (
        <div className="space-y-4">
          <div className="grid gap-4 md:grid-cols-3">
            <div className="rounded-[2rem] border border-amber-200 bg-amber-50 p-5 dark:border-amber-900/30 dark:bg-amber-900/10">
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-amber-700 dark:text-amber-300">Pendentes</p>
              <p className="mt-3 text-3xl font-black text-slate-900 dark:text-slate-100">{groupedReports.length}</p>
            </div>
            <div className="rounded-[2rem] border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">Acao</p>
              <p className="mt-3 text-sm font-black text-slate-900 dark:text-slate-100">Triagem em Suporte</p>
              <p className="mt-2 text-xs font-medium text-slate-500 dark:text-slate-400">Abertura do alvo segue para a area operacional correta.</p>
            </div>
            <div className="rounded-[2rem] border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">Estado</p>
              <p className="mt-3 text-sm font-black text-slate-900 dark:text-slate-100">
                {resolvingReportId ? 'Processando resolucao...' : 'Fila pronta para tratamento'}
              </p>
            </div>
          </div>

          <AdminReportsSection
            reports={groupedReports}
            renderSortableHeader={renderSupportHeader}
            getReportTargetBadgeClass={getReportTargetBadgeClass}
            getReportTargetLabel={getReportTargetLabel}
            onInspect={(report) => onOpenReportTarget?.(report)}
            onResolve={handleResolveReport}
          />
        </div>
      ) : (
        <AdminFeedback />
      )}
    </div>
  );
};

export default AdminSupportSection;

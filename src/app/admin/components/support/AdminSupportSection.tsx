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
import { createPortal } from 'react-dom';
import { AlertTriangle, CheckCircle2, LifeBuoy, MessageSquareText, Shield, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useToast } from '@providers/ToastProvider';
import type { ErrorReport } from '@types';
import { AdminFeedback } from './AdminFeedback';
import AdminReportsSection from '../reports/AdminReportsSection';
import {
  getQuickReportResolutionReason,
  getReportModerationTemplates,
  getReportTargetId,
  getReportTargetBadgeClass,
  getReportTargetLabel,
  groupPendingReports,
} from '../reports/reportModeration';
import type { AdminSupportSection as AdminSupportSectionKey } from '../shared/useAdminPageController';
import { buildAdminQuestionEditPath } from '../../config/adminPageNavigationConfig';

interface AdminSupportSectionProps {
  initialSection?: AdminSupportSectionKey;
  onSectionChange?: (section: AdminSupportSectionKey) => void;
  allReports?: ErrorReport[];
  pendingFeedbackCount?: number;
  onPendingFeedbackCountChange?: (count: number) => void;
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
  pendingFeedbackCount = 0,
  onPendingFeedbackCountChange,
  onResolveReport,
}: AdminSupportSectionProps) => {
  const { addToast } = useToast();
  const router = useRouter();
  const [activeSection, setActiveSection] = useState<AdminSupportSectionKey>(initialSection);
  const [resolvingReportId, setResolvingReportId] = useState<string | number | null>(null);
  const [moderatingReport, setModeratingReport] = useState<ErrorReport | null>(null);
  const [moderationResolution, setModerationResolution] = useState('');

  useEffect(() => {
    setActiveSection(initialSection);
  }, [initialSection]);

  const groupedReports = useMemo(
    () => groupPendingReports(allReports as ErrorReport[]),
    [allReports],
  );
  const pendingReportsCount = useMemo(
    () => groupedReports.reduce((total, group) => total + group.reports.length, 0),
    [groupedReports],
  );
  const safePendingFeedbackCount = Math.max(0, Number(pendingFeedbackCount || 0));

  const getSectionBadgeCount = (section: AdminSupportSectionKey) => {
    if (section === 'feedback') {
      return safePendingFeedbackCount;
    }

    if (section === 'reports') {
      return pendingReportsCount;
    }

    return 0;
  };

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

  const openReportModerationModal = (report: ErrorReport) => {
    if (report.targetType === 'question') {
      const questionId = getReportTargetId(report);

      if (!questionId) {
        addToast('Nao foi possivel identificar a questao denunciada.', 'error');
        return;
      }

      router.push(buildAdminQuestionEditPath(questionId, report.id));
      return;
    }

    setModeratingReport(report);
    setModerationResolution(getQuickReportResolutionReason(report));
  };

  const closeReportModerationModal = () => {
    if (resolvingReportId) return;

    setModeratingReport(null);
    setModerationResolution('');
  };

  const confirmReportModeration = async () => {
    if (!moderatingReport || !onResolveReport) {
      return;
    }

    const resolution = moderationResolution.trim();
    if (!resolution) {
      addToast('Informe a decisao da moderacao antes de concluir.', 'warning');
      return;
    }

    setResolvingReportId(moderatingReport.id);
    try {
      await onResolveReport({
        ...moderatingReport,
        resolution,
      });
      addToast('Denuncia moderada com sucesso.', 'success');
      setModeratingReport(null);
      setModerationResolution('');
    } catch (error) {
      console.error('Error moderating report from support:', error);
      addToast('Nao foi possivel moderar a denuncia.', 'error');
    } finally {
      setResolvingReportId(null);
    }
  };

  const activeSectionMeta = SUPPORT_SECTIONS.find((section) => section.key === activeSection);

  return (
    <div className="space-y-6">
      <div className="rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">Suporte organizado</p>
            <p className="mt-2 text-sm font-black text-slate-900 dark:text-slate-100">Atendimento separado por contexto</p>
          </div>

          <div className="flex flex-wrap gap-2">
            {SUPPORT_SECTIONS.map((section) => {
              const badgeCount = getSectionBadgeCount(section.key);

              return (
                <button
                  key={section.key}
                  onClick={() => changeSection(section.key)}
                  className={`inline-flex items-center gap-2 rounded-2xl px-4 py-2 text-[10px] font-black uppercase tracking-[0.18em] transition-all ${
                    activeSection === section.key
                      ? 'bg-indigo-600 text-white shadow-md'
                      : 'border border-slate-200 bg-slate-50 text-slate-500 hover:border-slate-300 hover:bg-white dark:border-slate-800 dark:bg-slate-800/60 dark:text-slate-400 dark:hover:border-slate-700 dark:hover:bg-slate-800'
                  }`}
                >
                  <span>{section.label}</span>
                  {badgeCount > 0 ? (
                    <span className={`rounded-full px-2 py-0.5 text-[9px] font-black ${
                      activeSection === section.key
                        ? 'bg-white/20 text-white'
                        : section.key === 'reports'
                          ? 'bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300'
                          : 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300'
                    }`}>
                      {badgeCount}
                    </span>
                  ) : null}
                </button>
              );
            })}
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
              <p className="mt-3 text-3xl font-black text-slate-900 dark:text-slate-100">{pendingReportsCount}</p>
            </div>
            <div className="rounded-[2rem] border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">Acao</p>
              <p className="mt-3 text-sm font-black text-slate-900 dark:text-slate-100">Moderacao no alvo</p>
              <p className="mt-2 text-xs font-medium text-slate-500 dark:text-slate-400">Em questoes, Moderar abre a pagina de edicao da questao denunciada.</p>
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
            onInspect={openReportModerationModal}
            onResolve={handleResolveReport}
          />
        </div>
      ) : (
        <AdminFeedback
          mode={activeSection === 'threads' ? 'threads' : 'feedback'}
          onPendingCountChange={onPendingFeedbackCountChange}
        />
      )}

      {moderatingReport && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-950/75 p-4 backdrop-blur-sm">
          <div className="w-full max-w-3xl overflow-hidden rounded-[2rem] border border-slate-200 bg-white shadow-2xl dark:border-slate-800 dark:bg-slate-900">
            <div className="flex items-start justify-between gap-4 border-b border-slate-100 p-6 dark:border-slate-800">
              <div>
                <p className="inline-flex items-center gap-2 rounded-full bg-amber-50 px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-amber-700 dark:bg-amber-900/20 dark:text-amber-300">
                  <Shield size={12} /> Moderacao de denuncia
                </p>
                <h3 className="mt-3 text-xl font-black text-slate-900 dark:text-slate-100">
                  {getReportTargetLabel(moderatingReport.targetType)} denunciado
                </h3>
                <p className="mt-1 text-xs font-medium text-slate-500 dark:text-slate-400">
                  Analise, registre a decisao e conclua sem sair desta pagina.
                </p>
              </div>
              <button
                type="button"
                onClick={closeReportModerationModal}
                className="rounded-2xl border border-slate-200 p-2 text-slate-400 transition-colors hover:bg-slate-50 hover:text-slate-700 dark:border-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200"
                aria-label="Fechar moderacao"
              >
                <X size={18} />
              </button>
            </div>

            <div className="grid gap-5 p-6 md:grid-cols-[0.9fr_1.1fr]">
              <div className="space-y-4">
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950">
                  <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Motivo</p>
                  <p className="mt-2 text-sm font-black text-slate-900 dark:text-slate-100">{moderatingReport.reason}</p>
                  <p className="mt-3 text-sm font-medium leading-6 text-slate-600 dark:text-slate-400">{moderatingReport.details || 'Sem detalhes adicionais.'}</p>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white p-4 text-xs font-medium text-slate-500 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-400">
                  <p><strong className="text-slate-800 dark:text-slate-200">Alvo:</strong> {getReportTargetLabel(moderatingReport.targetType)}</p>
                  <p className="mt-2"><strong className="text-slate-800 dark:text-slate-200">Usuario:</strong> {moderatingReport.userName || 'Nao informado'}</p>
                  <p className="mt-2"><strong className="text-slate-800 dark:text-slate-200">Data:</strong> {new Date(moderatingReport.timestamp).toLocaleDateString('pt-BR')}</p>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Decisao rapida</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {getReportModerationTemplates(moderatingReport).map((template) => (
                      <button
                        key={template.label}
                        type="button"
                        onClick={() => setModerationResolution(template.message)}
                        className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-[10px] font-black uppercase tracking-[0.14em] text-slate-600 transition-colors hover:border-indigo-200 hover:bg-indigo-50 hover:text-indigo-700 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300 dark:hover:border-indigo-900/50 dark:hover:bg-indigo-900/20"
                      >
                        {template.label}
                      </button>
                    ))}
                  </div>
                </div>

                <label className="block">
                  <span className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Registro da moderacao</span>
                  <textarea
                    value={moderationResolution}
                    onChange={(event) => setModerationResolution(event.target.value)}
                    rows={7}
                    className="mt-3 w-full resize-none rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-medium leading-6 text-slate-900 outline-none transition-colors focus:border-indigo-400 focus:bg-white dark:border-slate-800 dark:bg-slate-950 dark:text-slate-100 dark:focus:border-indigo-500 dark:focus:bg-slate-900"
                  />
                </label>
              </div>
            </div>

            <div className="flex flex-col gap-3 border-t border-slate-100 p-6 dark:border-slate-800 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={closeReportModerationModal}
                className="rounded-2xl px-5 py-3 text-[10px] font-black uppercase tracking-[0.18em] text-slate-400 transition-colors hover:bg-slate-50 dark:hover:bg-slate-800"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={confirmReportModeration}
                disabled={resolvingReportId === moderatingReport.id}
                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-indigo-600 px-5 py-3 text-[10px] font-black uppercase tracking-[0.18em] text-white transition-colors hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <CheckCircle2 size={14} />
                {resolvingReportId === moderatingReport.id ? 'Concluindo...' : 'Concluir moderacao'}
              </button>
            </div>
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
};

export default AdminSupportSection;

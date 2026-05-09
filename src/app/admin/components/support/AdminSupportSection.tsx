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

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { createPortal } from 'react-dom';
import { AlertTriangle, CheckCircle2, LifeBuoy, MessageSquareText, Shield, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useToast } from '@providers/ToastProvider';
import type { ErrorReport } from '@types';
import { adminService, type AdminCommentModerationCounts } from '@services/admin/adminService';
import { AdminFeedback } from './AdminFeedback';
import AdminCommentsModerationSection from './AdminCommentsModerationSection';
import {
  ADMIN_MODAL_FOOTER_CLASS,
  ADMIN_MODAL_HEADER_CLASS,
  ADMIN_MODAL_PANEL_CLASS,
  ADMIN_MUTED_SURFACE_CLASS,
  ADMIN_PAGE_PANEL_CLASS,
  ADMIN_PRIMARY_BUTTON_CLASS,
  ADMIN_SECONDARY_BUTTON_CLASS,
  ADMIN_SEGMENTED_TABS_CLASS,
  ADMIN_TAB_BUTTON_ACTIVE_CLASS,
  ADMIN_TAB_BUTTON_IDLE_CLASS,
  ADMIN_TEXTAREA_CLASS,
} from '../shared/adminPanelStyles';
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
  onPendingCommentsCountChange?: (count: number) => void;
  onResolveReport?: (report: ErrorReport) => Promise<unknown> | unknown;
  standaloneSection?: boolean;
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
    key: 'comments',
    label: 'Comentários',
    description: 'Caixa de entrada única para moderar comentários de questões, materiais e leis.',
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
  onPendingCommentsCountChange,
  onResolveReport,
  standaloneSection = false,
}: AdminSupportSectionProps) => {
  const { addToast } = useToast();
  const router = useRouter();
  const [resolvingReportId, setResolvingReportId] = useState<string | number | null>(null);
  const [moderatingReport, setModeratingReport] = useState<ErrorReport | null>(null);
  const [moderationResolution, setModerationResolution] = useState('');
  const [reportSearch, setReportSearch] = useState('');
  const [commentsLiveCounts, setCommentsLiveCounts] = useState<AdminCommentModerationCounts>({
    all: 0,
    pending: 0,
    approved: 0,
    spam: 0,
    trash: 0,
  });
  const activeSection = initialSection;
  const onPendingCommentsCountChangeRef = useRef(onPendingCommentsCountChange);

  useEffect(() => {
    onPendingCommentsCountChangeRef.current = onPendingCommentsCountChange;
  }, [onPendingCommentsCountChange]);

  const moderationCountsQuery = useQuery({
    queryKey: ['admin', 'comments-moderation-counts'],
    queryFn: async () => {
      const response = await adminService.getModerationComments({
        status: 'pending',
        page: 1,
        perPage: 1,
      });

      return response.counts;
    },
    enabled: activeSection !== 'comments',
    staleTime: 60_000,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
    retry: 1,
  });

  const moderationCounts = useMemo<AdminCommentModerationCounts>(() => {
    if (activeSection === 'comments') {
      return commentsLiveCounts;
    }

    if (moderationCountsQuery.data) {
      return moderationCountsQuery.data;
    }

    return commentsLiveCounts;
  }, [activeSection, commentsLiveCounts, moderationCountsQuery.data]);

  useEffect(() => {
    onPendingCommentsCountChangeRef.current?.(Number(moderationCounts.pending || 0));
  }, [moderationCounts.pending]);

  const handleModerationCountsChange = useCallback((counts: AdminCommentModerationCounts) => {
    setCommentsLiveCounts(counts);
  }, []);

  const groupedReports = useMemo(
    () => groupPendingReports(allReports),
    [allReports],
  );
  const filteredGroupedReports = useMemo(() => {
    const normalizedSearch = reportSearch.trim().toLowerCase();
    if (!normalizedSearch) {
      return groupedReports;
    }

    return groupedReports.filter((group) => {
      const haystack = [
        group.targetId,
        group.targetType,
        group.lastReport.reason,
        group.lastReport.details,
        group.lastReport.userName,
      ]
        .map((value) => String(value || '').toLowerCase())
        .join(' ');

      return haystack.includes(normalizedSearch);
    });
  }, [groupedReports, reportSearch]);
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

    if (section === 'comments') {
      return moderationCounts.pending;
    }

    return 0;
  };

  const changeSection = (section: AdminSupportSectionKey) => {
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
      {standaloneSection ? null : (
        <div className={ADMIN_PAGE_PANEL_CLASS}>
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400 dark:text-slate-500">
                Suporte organizado
              </p>
              <p className="mt-2 text-sm font-black text-slate-900 dark:text-slate-100">
                Atendimento separado por contexto
              </p>
            </div>

            <div className={`${ADMIN_SEGMENTED_TABS_CLASS} max-w-full`}>
              {SUPPORT_SECTIONS.map((section) => {
                const badgeCount = getSectionBadgeCount(section.key);

                return (
                  <button
                    key={section.key}
                    onClick={() => changeSection(section.key)}
                    className={`inline-flex items-center gap-2 rounded-md border px-4 py-2 text-[10px] font-black uppercase tracking-[0.18em] transition-all ${
                      activeSection === section.key
                        ? ADMIN_TAB_BUTTON_ACTIVE_CLASS
                        : ADMIN_TAB_BUTTON_IDLE_CLASS
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
        </div>
      )}

      <div className={`p-4 ${ADMIN_MUTED_SURFACE_CLASS}`}>
        <div className="flex items-start gap-3">
          <div className="rounded-md bg-indigo-50 p-3 text-indigo-600 dark:bg-indigo-900/20 dark:text-indigo-300">
            {activeSection === 'feedback' ? (
              <LifeBuoy size={18} />
            ) : activeSection === 'comments' ? (
              <Shield size={18} />
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
            reports={filteredGroupedReports}
            filter={reportSearch}
            onFilterChange={setReportSearch}
            renderSortableHeader={renderSupportHeader}
            getReportTargetBadgeClass={getReportTargetBadgeClass}
            getReportTargetLabel={getReportTargetLabel}
            onInspect={openReportModerationModal}
            onResolve={handleResolveReport}
          />
        </div>
      ) : activeSection === 'comments' ? (
        <AdminCommentsModerationSection onCountsChange={handleModerationCountsChange} />
      ) : (
        <AdminFeedback
          mode={activeSection === 'threads' ? 'threads' : 'feedback'}
          onPendingCountChange={onPendingFeedbackCountChange}
        />
      )}

      {moderatingReport && createPortal(
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-950/75 p-4 backdrop-blur-sm">
          <div className={`${ADMIN_MODAL_PANEL_CLASS} w-full max-w-3xl shadow-2xl`}>
            <div className={ADMIN_MODAL_HEADER_CLASS}>
              <div>
                <p className="inline-flex items-center gap-2 rounded-sm bg-amber-50 px-3 py-1 text-[10px] font-black uppercase tracking-[0.18em] text-amber-700 dark:bg-amber-900/20 dark:text-amber-300">
                  <Shield size={12} /> Moderacao de denuncia
                </p>
                <h3 className="mt-3 text-lg font-bold text-slate-900 dark:text-slate-100">
                  {getReportTargetLabel(moderatingReport.targetType)} denunciado
                </h3>
                <p className="mt-1 text-xs font-medium text-slate-500 dark:text-slate-400">
                  Analise, registre a decisao e conclua sem sair desta pagina.
                </p>
              </div>
              <button
                type="button"
                onClick={closeReportModerationModal}
                className="rounded-sm border border-slate-300 p-2 text-slate-400 transition-colors hover:bg-slate-50 hover:text-slate-700 dark:border-slate-700 dark:hover:bg-slate-800 dark:hover:text-slate-200"
                aria-label="Fechar moderacao"
              >
                <X size={18} />
              </button>
            </div>

            <div className="grid gap-5 p-6 md:grid-cols-[0.9fr_1.1fr]">
              <div className="space-y-4">
                <div className={`${ADMIN_MUTED_SURFACE_CLASS} p-4`}>
                  <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">Motivo</p>
                  <p className="mt-2 text-sm font-black text-slate-900 dark:text-slate-100">{moderatingReport.reason}</p>
                  <p className="mt-3 text-sm font-medium leading-6 text-slate-600 dark:text-slate-400">{moderatingReport.details || 'Sem detalhes adicionais.'}</p>
                </div>

                <div className={`${ADMIN_MUTED_SURFACE_CLASS} bg-white p-4 text-xs font-medium text-slate-500 dark:bg-slate-950 dark:text-slate-400`}>
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
                        className={`${ADMIN_SECONDARY_BUTTON_CLASS} text-[10px] font-black uppercase tracking-[0.14em] hover:border-sky-200 hover:bg-sky-50 hover:text-sky-700 dark:hover:border-sky-900/50 dark:hover:bg-sky-900/20`}
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
                    className={`${ADMIN_TEXTAREA_CLASS} mt-3 w-full resize-none bg-slate-50 font-medium leading-6 dark:bg-slate-950`}
                  />
                </label>
              </div>
            </div>

            <div className={`${ADMIN_MODAL_FOOTER_CLASS} flex flex-col gap-3 sm:flex-row sm:justify-end`}>
              <button
                type="button"
                onClick={closeReportModerationModal}
                className={ADMIN_SECONDARY_BUTTON_CLASS}
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={confirmReportModeration}
                disabled={resolvingReportId === moderatingReport.id}
                className={ADMIN_PRIMARY_BUTTON_CLASS}
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
